import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LandingPage } from '@/components/landing-page'
import { CHAVES, PAGINAS, chaveDoSlug } from '@/lib/paginas-de-venda'

/**
 * Uma página de venda por endereço, para colar no anúncio.
 *
 * Cada slug do registro vira uma rota, pré-renderizada no build: o conteúdo
 * não depende de nada da requisição, então não há motivo para gerar de novo a
 * cada acesso — e uma landing de tráfego pago é justamente onde o primeiro
 * byte importa.
 */
export function generateStaticParams() {
  return CHAVES.map(chave => ({ slug: PAGINAS[chave].slug }))
}

/**
 * `noindex` de propósito: estas páginas são quase idênticas entre si e à `/`,
 * e deixá-las indexáveis faria o Google escolher qual das versões mostrar —
 * competindo com a própria página principal em vez de somar. Como destino de
 * anúncio, ser indexável não faz falta nenhuma. `follow` fica ligado para os
 * links internos (políticas, site da instituição) seguirem valendo, e a
 * canônica aponta para `/`, que é a versão que deve aparecer na busca.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
  alternates: { canonical: '/' },
}

export default async function PaginaDeVenda({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const chave = chaveDoSlug(slug)
  if (!chave) notFound()

  return <LandingPage variante={chave} />
}
