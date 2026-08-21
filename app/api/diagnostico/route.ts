import { NextResponse } from 'next/server'
import { erro, rota } from '@/lib/http'
import { lerInscricaoId } from '@/lib/session'
import { SIMULACAO_ATIVA } from '@/lib/simulacao'
import { supabaseServer } from '@/lib/supabase/server'

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

export function GET(request: Request) {
  return rota(async () => {
    if (!SIMULACAO_ATIVA) return erro('Diagnóstico desativado.', 403)

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
      cookieDeSessao: (await lerInscricaoId()) ? 'presente' : 'ausente',
      recebeuCookies: !!request.headers.get('cookie'),
    }

    // Sem configuração válida não adianta tentar falar com o banco.
    if (!config.url.valida || !analise.serve) {
      return NextResponse.json({ ok: false, etapa: 'configuração', config }, { status: 200 })
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

    return NextResponse.json({
      ok: banco.leTabelas && banco.temFuncoes,
      etapa: banco.leTabelas && banco.temFuncoes ? 'tudo certo' : 'banco',
      config,
      banco,
    })
  })
}
