import { NextResponse } from 'next/server'
import { corpo, rota } from '@/lib/http'
import { supabaseServer } from '@/lib/supabase/server'

type Payload = { utmSource?: string; utmMedium?: string; utmCampaign?: string }

/**
 * Registra uma visita real à landing — o topo do funil que não tem
 * inscrição para ancorar. Chamada por `trackLandingView` em `lib/checkout.ts`,
 * de forma otimista: o visitante não espera a resposta, e uma falha aqui
 * nunca aparece para ele.
 *
 * Sem validação de campos: é uma contagem, não um formulário — o pior que
 * um valor estranho faz é aparecer estranho na tela da secretaria.
 */
export function POST(request: Request) {
  return rota(async () => {
    const body = await corpo<Payload>(request)
    if (!body) return NextResponse.json({ ok: true })

    // `variante` fica de fora: a coluna guarda o histórico das duas páginas
    // de venda que existiram, e linhas novas nascem sem ela.
    const { error } = await supabaseServer().from('visitas_landing').insert({
      utm_source: body.utmSource ?? null,
      utm_medium: body.utmMedium ?? null,
      utm_campaign: body.utmCampaign ?? null,
    })
    if (error) console.error('[funil] gravação de visita falhou:', error)

    return NextResponse.json({ ok: true })
  })
}
