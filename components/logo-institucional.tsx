/**
 * A marca da instituição, no topo e no rodapé.
 *
 * O arquivo original é um PNG de 1844×752 e 109 KB, exibido com 36 a 44
 * pixels de altura — o navegador baixava umas dezessete vezes mais pixels do
 * que chegava a mostrar, e no cabeçalho isso acontece com prioridade alta,
 * disputando banda justamente com a primeira tela. Nas versões AVIF e webp,
 * dimensionadas para o maior uso real, a mesma marca custa entre 4 e 7 KB.
 *
 * O PNG continua como último fallback: é o formato que qualquer coisa abre.
 */
export function LogoInstitucional({ alt, className, prioridade = false }: {
  alt: string
  className?: string
  prioridade?: boolean
}) {
  return (
    <picture>
      <source type="image/avif" srcSet="/logo-cvb-rj.avif" />
      <source type="image/webp" srcSet="/logo-cvb-rj.webp" />
      <img
        src="/logo-cvb-rj.png"
        alt={alt}
        width={440}
        height={179}
        loading={prioridade ? 'eager' : 'lazy'}
        fetchPriority={prioridade ? 'high' : undefined}
        decoding="async"
        className={className}
      />
    </picture>
  )
}
