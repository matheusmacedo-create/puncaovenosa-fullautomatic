import { NextResponse } from 'next/server'
import { retentarRemocoesPendentes, sincronizarAbandonados } from '@/lib/meta-audiencia'
import { secretariaAutenticada, secretariaHabilitada } from '@/lib/secretaria'

/**
 * Dispara a sincronização do público de remarketing na hora, sem esperar o
 * cron diário — útil para conferir a integração logo depois de configurar
 * o token, sem precisar esperar até o dia seguinte.
 */
export async function POST(request: Request) {
  if (!secretariaHabilitada() || !(await secretariaAutenticada())) {
    return new NextResponse('Não encontrado.', { status: 404 })
  }

  const destino = new URL('/secretaria', request.url)

  try {
    const [{ adicionados, falhas }, { removidos }] = await Promise.all([
      sincronizarAbandonados(),
      retentarRemocoesPendentes(),
    ])
    destino.searchParams.set('sincronizadoAudiencia', String(adicionados))
    if (falhas > 0) destino.searchParams.set('falhasAudiencia', String(falhas))
    if (removidos > 0) destino.searchParams.set('removidosAudiencia', String(removidos))
  } catch (e) {
    console.error('[secretaria] sincronização manual do público falhou:', e)
    destino.searchParams.set('erroAudiencia', '1')
  }

  return NextResponse.redirect(destino, { status: 303 })
}
