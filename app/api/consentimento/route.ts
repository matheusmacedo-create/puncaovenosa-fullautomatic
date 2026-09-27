import { NextResponse } from 'next/server'
import { consentimentoDaRequisicao } from '@/lib/consentimento'
import { gravarConsentimentoNaInscricao } from '@/lib/consentimento-servidor'
import { rota } from '@/lib/http'
import { removerDoPublicoDeAbandono } from '@/lib/meta-audiencia'
import { lerInscricaoId } from '@/lib/session'

/**
 * Leva a escolha feita agora no aviso de cookies para a inscrição desta
 * sessão, se houver uma. Chamada pelo navegador a cada escolha
 * (`gravarConsentimento` em `lib/consentimento-cliente.ts`).
 *
 * Sem corpo: a escolha é lida do próprio cookie `cvrj_consentimento` que
 * acabou de ser gravado, e a inscrição, do cookie httpOnly da sessão — nada
 * aqui aceita id vindo do cliente. Sem sessão, não há o que gravar.
 *
 * É o que faz "tirar a permissão" valer também do lado do servidor: o
 * postback da Únicopag que chegar depois não vira evento no Meta, e quem
 * estava no público de remarketing sai dele na hora.
 */
export function POST(request: Request) {
  return rota(async () => {
    const inscricaoId = await lerInscricaoId()
    if (!inscricaoId) return NextResponse.json({ gravado: false })

    const consentimento = consentimentoDaRequisicao(request)
    await gravarConsentimentoNaInscricao(inscricaoId, consentimento)
    if (!consentimento?.marketing) removerDoPublicoDeAbandono(inscricaoId)

    return NextResponse.json({ gravado: true })
  })
}
