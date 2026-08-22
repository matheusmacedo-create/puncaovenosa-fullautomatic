import { CircleAlert } from 'lucide-react'
import { PRECO_DE_TESTE } from '@/lib/enrollment'

/**
 * Aviso de preço de teste no topo da landing.
 *
 * Os valores da página já vêm da mesma composição que o checkout cobra, então
 * eles não mentem. O que falta é o porquê: sem este aviso, a página anuncia o
 * curso por centavos como se fosse a oferta, e quem chegar por um anúncio no
 * ar durante o teste compra por esse valor. O funil já avisa na hora de pagar
 * — a landing precisa avisar antes.
 */
export function TestPriceNotice() {
  if (!PRECO_DE_TESTE) return null

  return (
    <div role="status" className="bg-primary px-4 py-2.5 text-primary-foreground">
      <p className="mx-auto flex max-w-3xl items-center justify-center gap-2 text-center text-sm font-semibold">
        <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
        Valor reduzido para teste operacional. Não é o preço do curso.
      </p>
    </div>
  )
}
