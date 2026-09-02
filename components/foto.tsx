import type { CoursePhoto } from '@/lib/course-data'

/**
 * Foto da landing, na versão mais leve que o aparelho aceitar.
 *
 * Não usa `next/image` porque `next.config.mjs` traz `images.unoptimized`:
 * ali o componente do Next não redimensiona nem converte nada, e o arquivo
 * de `public/` vai cru para o aparelho. Um `<picture>` escrito à mão faz o
 * que o Next não está fazendo — o navegador escolhe AVIF quando entende, cai
 * no webp quando não, e pega a versão de 640px no celular em vez de baixar a
 * de desktop inteira. Na prática o hero sai de 66 KB para 23 KB no celular.
 *
 * As versões são geradas por `scripts/otimizar-fotos.mjs`, que fixa os
 * sufixos `-640` e `-1080` esperados aqui.
 */
export function Foto({ foto, sizes, prioridade = false, className = '' }: {
  foto: CoursePhoto
  /** Quanto da largura da tela a foto ocupa, por faixa — igual ao do `next/image`. */
  sizes: string
  /** Só para a imagem do topo: sai do carregamento preguiçoso e ganha prioridade. */
  prioridade?: boolean
  className?: string
}) {
  if (!foto.base) return null

  const srcSet = (formato: string) => `${foto.base}-640.${formato} 640w, ${foto.base}-1080.${formato} 1080w`

  return (
    <picture>
      <source type="image/avif" srcSet={srcSet('avif')} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet('webp')} sizes={sizes} />
      <img
        src={`${foto.base}-1080.webp`}
        alt={foto.alt}
        width={1080}
        height={1341}
        loading={prioridade ? 'eager' : 'lazy'}
        fetchPriority={prioridade ? 'high' : undefined}
        decoding="async"
        className={`absolute inset-0 h-full w-full ${className}`}
      />
    </picture>
  )
}
