import { LandingPage } from '@/components/landing-page'
import { resolveVariant } from '@/lib/ab-test'
import { CHAVE_PADRAO } from '@/lib/paginas-de-venda'

/**
 * A página padrão do curso.
 *
 * `?variant=` continua sendo lido para não quebrar anúncio já publicado
 * apontando para `/?variant=b`, mas o endereço próprio de cada página agora
 * é `/lp/[slug]` — ver `lib/paginas-de-venda.ts`.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string | string[] }>
}) {
  const { variant } = await searchParams
  return <LandingPage variante={resolveVariant(variant) ?? CHAVE_PADRAO} />
}
