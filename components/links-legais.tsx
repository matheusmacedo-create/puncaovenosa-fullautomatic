import { courseData, SELLER } from '@/lib/course-data'

/**
 * Os documentos legais e a volta às preferências de cookies, em toda página
 * pública — no rodapé da landing e das políticas, e numa linha discreta no fim
 * das telas do funil, da triagem, da ficha e da conferência.
 *
 * "Preferências de cookies" é um link comum para a Política de Cookies com
 * `data-cvrj-cookies`: com o aviso carregado (`components/aviso-de-cookies.tsx`),
 * o clique abre as categorias ali mesmo; sem JavaScript, leva à seção da
 * política que explica como mudar a escolha.
 *
 * `novaAba` é para dentro do funil: quem está no meio da compra não pode perder
 * a tela de pagamento para ler uma política.
 */
export function LinksLegais({ className = 'links-legais', novaAba = false }: { className?: string; novaAba?: boolean }) {
  const alvo = novaAba ? { target: '_blank', rel: 'noopener noreferrer' } : {}
  return (
    <nav aria-label="Documentos legais" className={className}>
      {courseData.privacyPolicyUrl && <a href={courseData.privacyPolicyUrl} {...alvo}>Política de Privacidade</a>}
      <a href={courseData.cookiePolicyUrl} {...alvo}>Política de Cookies</a>
      {courseData.refundPolicyUrl && <a href={courseData.refundPolicyUrl} {...alvo}>Política de Reembolso</a>}
      <a href={`${courseData.cookiePolicyUrl}#preferencias`} data-cvrj-cookies="">Preferências de cookies</a>
    </nav>
  )
}

/**
 * Quem vende: nome, CNPJ, endereço e e-mail (Decreto nº 7.962/2013, art. 2º),
 * onde a oferta é feita e onde a compra acontece.
 */
export function IdentificacaoDoVendedor({ className }: { className?: string }) {
  return (
    <p className={className}>
      {SELLER.legalName} · CNPJ {SELLER.cnpj} · {SELLER.address} ·{' '}
      <a href={`mailto:${SELLER.email}`}>{SELLER.email}</a>
    </p>
  )
}
