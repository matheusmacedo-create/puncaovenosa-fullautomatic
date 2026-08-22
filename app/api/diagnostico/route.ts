import { NextResponse } from 'next/server'
import { rota } from '@/lib/http'
import { formatarBRL, PRECO_CENTAVOS, PRECO_DE_TESTE } from '@/lib/enrollment'
import { planilhaConfigurada } from '@/lib/planilha'
import { estadoDaSecretaria } from '@/lib/secretaria'
import { lerInscricaoId } from '@/lib/session'
import { confirmacaoManualPermitida, estadoDaSimulacao } from '@/lib/simulacao'
import { supabaseServer } from '@/lib/supabase/server'
import { siteUrl, urlDoWebhook } from '@/lib/site-url'
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

/**
 * Prova que o endereço do postback é alcançável de fora.
 *
 * A Únicopag avisa o pagamento fazendo uma requisição a esta aplicação, sem
 * cookie e sem sessão. Se a URL cair atrás da Deployment Protection da Vercel,
 * ela responde 401 ou redireciona para o SSO, e o aviso nunca chega — o aluno
 * paga e a tela fica girando. É uma falha silenciosa: tudo o mais parece certo.
 *
 * Acontece quando `siteUrl()` cai no endereço específico do deployment, que é
 * protegido, em vez do domínio estável do projeto, que não é.
 */
async function estadoDoPostback() {
  let endereco: string
  try { endereco = urlDoWebhook() } catch { return { url: null, alcancavel: false, motivo: 'endereço não definido' } }

  try {
    const resposta = await fetch(endereco, { method: 'GET', redirect: 'manual' })
    // A rota só aceita POST, então 405 é a resposta saudável. 200 também serve.
    if (resposta.status === 405 || resposta.status === 200) return { url: endereco, alcancavel: true, motivo: null }
    if (resposta.status === 401 || (resposta.status >= 300 && resposta.status < 400)) {
      return { url: endereco, alcancavel: false, motivo: 'protegido por autenticação da Vercel' }
    }
    return { url: endereco, alcancavel: false, motivo: `respondeu ${resposta.status}` }
  } catch {
    return { url: endereco, alcancavel: false, motivo: 'não respondeu' }
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
      postback: await estadoDoPostback(),
      // Opcional: sem ela o funil funciona igual, só não espelha na planilha.
      planilha: { configurada: planilhaConfigurada() },
      // Também opcional: sem senha, /secretaria responde 404.
      secretaria: estadoDaSecretaria(),
      preco: {
        centavos: PRECO_CENTAVOS,
        exibido: formatarBRL(PRECO_CENTAVOS),
        deTeste: PRECO_DE_TESTE,
        // O que a cobrança usa: lido do ambiente a cada requisição.
        variavelTesteDisponivelNoRuntime: Boolean(process.env.NEXT_PUBLIC_PRECO_TESTE_CENTAVOS),
        // O que a tela usa: congelado no bundle do navegador pelo build.
        variavelTesteDisponivelNoBuild: Boolean(process.env.PRECO_TESTE_CENTAVOS_NO_BUILD),
      },
      cookieDeSessao: (await lerInscricaoId()) ? 'presente' : 'ausente',
      recebeuCookies: !!request.headers.get('cookie'),
    }

    /*
     * Tela e cobrança discordando sobre o preço — o pior estado possível.
     *
     * O navegador usa o valor congelado no build; a cobrança usa o valor lido
     * do ambiente agora. Quando os dois discordam, a página anuncia um preço e
     * a Únicopag cobra outro. Vale para vender e para testar: nos dois casos
     * alguém paga um valor que não foi o combinado.
     *
     * Fica antes da checagem de banco porque não depende dela — e é justamente
     * num ambiente meio configurado que se quer enxergar isso.
     */
    const precoDivergente =
      config.preco.variavelTesteDisponivelNoBuild === config.preco.variavelTesteDisponivelNoRuntime
        ? null
        : config.preco.variavelTesteDisponivelNoRuntime
          ? 'NEXT_PUBLIC_PRECO_TESTE_CENTAVOS existe no ambiente mas não entrou no build: a tela mostra o preço real e a cobrança sai reduzida. Na Vercel isso é variável marcada como Sensitive — recrie como Non-sensitive e refaça o deploy.'
          : 'NEXT_PUBLIC_PRECO_TESTE_CENTAVOS entrou no build mas não está mais no ambiente: a tela mostra o preço reduzido e a cobrança sai cheia. Refaça o deploy.'

    // Sem configuração válida não adianta tentar falar com o banco. Os
    // veredictos vão junto mesmo assim: quem consulta esta rota está
    // perguntando "posso cobrar?", e omitir a resposta é pior que dá-la
    // negativa — some justamente no caso em que algo está errado.
    if (!config.url.valida || !analise.serve) {
      const impedimentos = ['Supabase mal configurado: sem banco não há inscrição para cobrar.']
      if (precoDivergente) impedimentos.push(precoDivergente)
      return NextResponse.json({
        ok: false,
        etapa: 'configuração',
        prontoParaVender: false,
        pendencias: impedimentos,
        prontoParaTesteOperacional: false,
        pendenciasDoTeste: impedimentos,
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
    else if (!config.postback.alcancavel) {
      bloqueios.push(
        `A Únicopag não consegue avisar o pagamento: ${config.postback.url} está ${config.postback.motivo}. ` +
        'Defina NEXT_PUBLIC_SITE_URL com o domínio estável do projeto — o endereço específico do deployment ' +
        'fica atrás da Deployment Protection e recusa o postback.',
      )
    }

    if (precoDivergente) bloqueios.push(precoDivergente)

    // Vender exige, além do resto, que o preço em vigor seja o do curso.
    const pendencias = [...bloqueios]
    if (PRECO_DE_TESTE) pendencias.push(`Preço de teste em uso (${formatarBRL(PRECO_CENTAVOS)}) — remova NEXT_PUBLIC_PRECO_TESTE_CENTAVOS antes de vender.`)

    // O teste operacional exige o contrário: pagar de verdade, mas centavos.
    // O caso em que a variável existe só num dos lados já saiu nos bloqueios.
    const pendenciasDoTeste = [...bloqueios]
    if (!config.preco.variavelTesteDisponivelNoRuntime && !config.preco.variavelTesteDisponivelNoBuild) {
      pendenciasDoTeste.push('NEXT_PUBLIC_PRECO_TESTE_CENTAVOS não está definida — o preço em vigor é o real, de verdade.')
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
