import { NextResponse } from 'next/server'
import { coordenadaAproximada } from '@/lib/cep'
import { triageQuestions } from '@/lib/enrollment'
import { corpo, erro, rota } from '@/lib/http'
import { lerInscricaoId } from '@/lib/session'
import { supabaseServer } from '@/lib/supabase/server'
import { notificarSecretaria } from '@/lib/webhook-secretaria'

type Payload = { passo?: number; resposta?: unknown }

const TOTAL_PASSOS = triageQuestions.length

/** Todas as respostas da triagem, no mesmo formato que o front já usa: { "1": ..., "2": ... }. */
export function GET() {
  return rota(async () => {
    const inscricaoId = await lerInscricaoId()
    if (!inscricaoId) return NextResponse.json({ respostas: {}, concluida: false })

    const { data, error } = await supabaseServer()
      .from('triagem_respostas')
      .select('passo, resposta')
      .eq('inscricao_id', inscricaoId)

    if (error) {
      console.error('[funil] leitura da triagem falhou:', error)
      return erro('Não foi possível carregar suas respostas.', 502)
    }

    const respostas = Object.fromEntries((data ?? []).map(r => [String(r.passo), r.resposta]))
    return NextResponse.json({
      respostas,
      concluida: Object.keys(respostas).length >= TOTAL_PASSOS,
    })
  })
}

/**
 * Grava a resposta de um passo. Reenviar o mesmo passo sobrescreve, que é o
 * que acontece quando o aluno volta e troca a escolha.
 */
export function PUT(request: Request) {
  return rota(async () => {
    const inscricaoId = await lerInscricaoId()
    if (!inscricaoId) return erro('Preencha seus dados antes de responder a triagem.', 401)

    const body = await corpo<Payload>(request)
    if (!body) return erro('Corpo da requisição inválido.', 400)

    const passo = Number(body.passo)
    if (!Number.isInteger(passo) || passo < 1 || passo > TOTAL_PASSOS) {
      return erro(`Passo deve ser um número de 1 a ${TOTAL_PASSOS}.`, 422)
    }
    if (body.resposta === undefined || body.resposta === null) return erro('Resposta ausente.', 422)

    // Passo 1 é o CEP/endereço. Quando a busca não trouxe coordenada exata
    // (a maioria dos casos — só a BrasilAPI devolve, e nem sempre), completa
    // com uma aproximada por bairro/cidade, para o mapa da secretaria não
    // deixar a inscrição de fora. Roda aqui, e não na busca em si, porque o
    // aluno não espera esta gravação — `save()` no front é fire-and-forget.
    let resposta = body.resposta
    if (passo === 1 && typeof resposta === 'object') {
      const r = resposta as { bairro?: string | null; cidade?: string | null; uf?: string | null; latitude?: unknown; longitude?: unknown }
      if (typeof r.latitude !== 'number' || typeof r.longitude !== 'number') {
        const aproximada = await coordenadaAproximada(r.bairro ?? null, r.cidade ?? null, r.uf ?? null)
        if (aproximada) resposta = { ...r, latitude: aproximada.latitude, longitude: aproximada.longitude }
      }
    }

    const supabase = supabaseServer()
    const { error } = await supabase
      .from('triagem_respostas')
      .upsert(
        { inscricao_id: inscricaoId, passo, resposta },
        { onConflict: 'inscricao_id,passo' },
      )

    if (error) {
      console.error('[funil] gravação da triagem falhou:', error)
      return erro('Não foi possível salvar sua resposta.', 502)
    }

    const { data: concluida } = await supabase.rpc('concluir_triagem_se_completa', {
      p_inscricao_id: inscricaoId,
    })

    if (concluida === true) notificarSecretaria(inscricaoId, 'triagem_concluida')

    return NextResponse.json({ salvo: true, concluida: concluida === true })
  })
}
