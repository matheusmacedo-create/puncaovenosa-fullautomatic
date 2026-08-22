import { NextResponse } from 'next/server'
import { rota } from '@/lib/http'
import { formatarBRL, PRECO_CENTAVOS, PRECO_DE_TESTE } from '@/lib/enrollment'
import { lerInscricaoId } from '@/lib/session'
import { confirmacaoManualPermitida, estadoDaSimulacao } from '@/lib/simulacao'
import { supabaseServer } from '@/lib/supabase/server'
import { siteUrl } from '@/lib/site-url'
import { consultarSaldo, UnicopagErro } from '@/lib/unicopag'

/**
 *Check-up da configuração, para diagnosticar um ambiente onde não dá para
 * abrir o terminal — o preview do v0, um deploy na Vercel.
 *
 * Responde o que está definido, o que é válido e se o banco responde, SEM
 * devolver nenhum segredo: da chave, só o prefixo, que é o suficiente para
 * flagrar o engano mais comum (colar a publicável no lugar da secreta).
 *
 * Fica atrás de NEXT_PUBLIC_SIMULAR_PAGAMENTO pelo mesmo motivo dos botões
 * de simulação: em produção, nem a forma da configuração deve ser pública.
 */

/**
 * Classifica a chave pelo prefixo, sem revelar o valor.
 *
 * `serve` é o que decide o veredito: uma chave publicável não produz erro
 * nenhum — o RLS apenas devolve lista vazia —, então sem esta checagem o
 * diagnóstico diria "tudo certo" para uma configuração que não funciona.
 */
function analisarChave(chave: string | undefined) {
  if (!chave) return { tipo: 'ausente', serve: false }
  if (chave.startsWith('sb_secret_')) return { tipo: 'secreta (correta)', serve: true }
  if (chave.startsWith('sb_publishable_')) return { tipo: 'PUBLICÁVEL — não serve, o RLS bloqueia tudo', serve: false }
  if (chave.startsWith('eyJ')) return { tipo: 'JWT antiga — precisa ser a service_role, não a anon', serve: true }
  if (chave.includes('process.env')) return { tipo: 'o NOME da variável foi colado no lugar do VALOR', serve: false }
  return { tipo: 'formato não reconhecido', serve: false }
}

function urlValida(valor: string | undefined) {
  if (!valor) return false
  try {
    const { protocol } = new URL(valor)
    return protocol === 'https:' || protocol === 'http:'
  } catch { return false }
}

/**
 * Prova que a chave da Únicopag funciona, sem criar cobrança: consulta o
 * saldo, que é somente leitura. Devolve apenas se respondeu, nunca o valor —
 * o saldo da instituição não é informação para uma rota pública.
 */
async function estadoDoProvedor() {
  if (!process.env.UNICO_API_KEY?.trim()) {
    return { configurado: false, chaveValida: null as boolean | null, erro: null as string | null }
  }
  try {
    await consultarSaldo()
    return { configurado: true, chaveValida: true, erro: null }
  } catch (e) {
    const detalhe = e instanceof UnicopagErro ? `${e.status}: ${e.message}` : 'falha de rede'
    return { configurado: true, chaveValida: false, erro: detalhe }
  }
}

export function GET(request: Request) {
  return rota(async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
    const chave = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

    const analise = analisarChave(chave)

    const config = {
      url: {
        origem: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'NEXT_PUBLIC_SUPABASE_URL' : process.env.SUPABASE_URL ? 'SUPABASE_URL' : null,
        valor: url ?? null,
        valida: urlValida(url),
      },
      chave: {
        origem: process.env.SUPABASE_SECRET_KEY ? 'SUPABASE_SECRET_KEY' : process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SUPABASE_SERVICE_ROLE_KEY' : null,
        tipo: analise.tipo,
        serve: analise.serve,
        tamanho: chave?.length ?? 0,
      },
      simulacao: estadoDaSimulacao(),
      provedor: await estadoDoProvedor(),
      siteUrl: siteUrl(),
      preco: { centavos: PRECO_CENTAVOS, exibido: formatarBRL(PRECO_CENTAVOS), deTeste: PRECO_DE_TESTE },
      cookieDeSessao: (await lerInscricaoId()) ? 'presente' : 'ausente',
      recebeuCookies: !!request.headers.get('cookie'),
    }

    // Sem configuração válida não adianta tentar falar com o banco. Os
    // veredictos vão junto mesmo assim: quem consulta esta rota está
    // perguntando "posso cobrar?", e omitir a resposta é pior que dá-la
    // negativa — some justamente no caso em que algo está errado.
    if (!config.url.valida || !analise.serve) {
      const impedimento = 'Supabase mal configurado: sem banco não há inscrição para cobrar.'
      return NextResponse.json({
        ok: false,
        etapa: 'configuração',
        prontoParaVender: false,
        pendencias: [impedimento],
        prontoParaTesteOperacional: false,
        pendenciasDoTeste: [impedimento],
        config,
      }, { status: 200 })
    }

    // Uma leitura barata prova que a chave é aceita e que o schema está lá.
    const supabase = supabaseServer()
    const { error: erroTabela } = await supabase.from('inscricoes').select('id').limit(1)
    // soma_itens é pura: prova que as funções do funil existem sem gastar um
    // número da sequência, como gerar_numero_inscricao gastaria.
    const { error: erroFuncao } = await supabase.rpc('soma_itens', { p_itens: [] })

    const banco = {
      leTabelas: !erroTabela,
      erroTabelas: erroTabela?.message ?? null,
      temFuncoes: !erroFuncao,
      erroFuncoes: erroFuncao?.message ?? null,
    }

    /*
     * O que impede uma cobrança real de acontecer. Vale igual para vender e
     * para o teste operacional: nos dois casos o dinheiro sai da conta de
     * alguém de verdade. Existe para não depender de alguém lembrar da lista
     * na hora de abrir.
     */
    const bloqueios: string[] = []
    if (!banco.leTabelas || !banco.temFuncoes) bloqueios.push('O banco não respondeu como esperado.')
    if (!config.provedor.configurado) bloqueios.push('UNICO_API_KEY ausente — sem ela nenhuma cobrança é real.')
    else if (!config.provedor.chaveValida) bloqueios.push('A chave da Únicopag foi recusada pela API.')
    if (config.simulacao.ativa) bloqueios.push('Simulação ativa — as cobranças não são reais.')
    // Combinação que trava o funil por inteiro e não é óbvia de enxergar.
    if (!config.simulacao.ativa && !config.provedor.configurado) {
      bloqueios.push('SIMULAR_PAGAMENTO=false sem UNICO_API_KEY: ninguém consegue pagar. Remova a variável ou configure o provedor.')
    }
    if (confirmacaoManualPermitida()) bloqueios.push('PERMITIR_CONFIRMACAO_MANUAL ligada — qualquer visitante conclui a inscrição sem pagar.')
    if (!config.siteUrl) bloqueios.push('NEXT_PUBLIC_SITE_URL ausente — a Únicopag precisa dela para avisar o pagamento.')

    // Vender exige, além do resto, que o preço em vigor seja o do curso.
    const pendencias = [...bloqueios]
    if (PRECO_DE_TESTE) pendencias.push(`Preço de teste em uso (${formatarBRL(PRECO_CENTAVOS)}) — remova NEXT_PUBLIC_PRECO_TESTE_CENTAVOS antes de vender.`)

    /*
     * O teste operacional exige o contrário: pagar de verdade, mas centavos.
     *
     * A dica sobre "Sensitive" não é hipotética. `NEXT_PUBLIC_` é resolvida
     * no build, e variável marcada como Sensitive na Vercel não fica
     * disponível ali — o valor vira `undefined` e o preço volta calado para
     * R$ 249, com a variável aparecendo como definida no painel.
     */
    const pendenciasDoTeste = [...bloqueios]
    if (!PRECO_DE_TESTE) {
      pendenciasDoTeste.push(
        'NEXT_PUBLIC_PRECO_TESTE_CENTAVOS não chegou ao build — o preço em vigor é o real. ' +
        'Se você já a definiu na Vercel, confira se ficou marcada como Sensitive: variável Sensitive ' +
        'não é exposta no build, e é no build que NEXT_PUBLIC_ é resolvida. Recrie como Non-sensitive ' +
        'em Production, Preview e Development, e refaça o deploy.',
      )
    }

    return NextResponse.json({
      ok: banco.leTabelas && banco.temFuncoes,
      etapa: banco.leTabelas && banco.temFuncoes ? 'tudo certo' : 'banco',
      prontoParaVender: pendencias.length === 0,
      pendencias,
      // Cobrança real da Únicopag, com o valor reduzido em vigor.
      prontoParaTesteOperacional: pendenciasDoTeste.length === 0,
      pendenciasDoTeste,
      config,
      banco,
    })
  })
}
