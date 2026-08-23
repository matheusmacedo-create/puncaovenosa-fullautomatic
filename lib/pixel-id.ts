/**
 * O ID do Pixel do Meta, isolado num arquivo sem `'use client'`.
 *
 * `components/meta-pixel.tsx` é renderizado dentro de `app/layout.tsx`, um
 * Server Component — e um Server Component que importa uma constante de um
 * módulo `'use client'` não pega o valor real: pega uma referência que o
 * bundler não sabe resolver fora do lado do cliente, e ela chega serializada
 * como uma string de erro. Com `PIXEL_ID` virando essa string, `!PIXEL_ID`
 * dá falso e o pixel é instalado mesmo sem ID configurado — o oposto do que
 * o comentário do componente promete.
 *
 * `lib/rastreio.ts` é `'use client'` porque dispara eventos do navegador; a
 * leitura da variável de ambiente não precisa estar lá dentro, e separá-la
 * aqui é o que permite tanto o componente de servidor quanto o código do
 * cliente lerem o mesmo valor sem cruzar a fronteira errada.
 */
export const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || null
