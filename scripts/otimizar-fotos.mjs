/**
 * Gera as versões leves das fotos da landing.
 *
 *   node scripts/otimizar-fotos.mjs <arquivo...>
 *
 * Para cada arquivo de entrada, escreve em `public/fotos/`:
 *
 *   <nome>-640.avif   <nome>-640.webp    (celular)
 *   <nome>-1080.avif  <nome>-1080.webp   (desktop e telas densas)
 *
 * Por que quatro arquivos, e não um: `next.config.mjs` traz
 * `images.unoptimized`, então o Next não redimensiona nem negocia formato —
 * o que está em `public/` vai cru para o aparelho do aluno. Sem as versões
 * de 640, um celular baixa a imagem de desktop inteira; sem o AVIF, paga
 * quase o dobro de bytes pela mesma foto. Quem escolhe é o `<picture>` do
 * componente `Foto`, e o navegador que não entende AVIF cai no webp.
 *
 * O AVIF sai em qualidade mais baixa que o webp de propósito: no mesmo
 * número, ele já parece melhor — comparar os dois pelo valor de `quality`
 * não diz nada.
 */
import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import sharp from 'sharp'

const LARGURAS = [640, 1080]
const DESTINO = 'public/fotos'

const entradas = process.argv.slice(2)
if (entradas.length === 0) {
  console.error('uso: node scripts/otimizar-fotos.mjs <arquivo...>')
  process.exit(1)
}

const kb = bytes => `${(bytes / 1024).toFixed(1)} KB`

for (const entrada of entradas) {
  const nome = basename(entrada, extname(entrada)).replace(/-\d+$/, '')
  const original = readFileSync(entrada)
  console.log(`\n${basename(entrada)} — ${kb(statSync(entrada).size)}`)

  for (const largura of LARGURAS) {
    // `withoutEnlargement`: uma foto entregue com menos de 1080px de largura
    // não é esticada — subir resolução só acrescenta peso, nunca detalhe.
    const base = sharp(original).resize({ width: largura, withoutEnlargement: true })

    const saidas = [
      ['avif', base.clone().avif({ quality: 50, effort: 6 })],
      ['webp', base.clone().webp({ quality: 76, effort: 6 })],
    ]

    for (const [formato, pipeline] of saidas) {
      const buf = await pipeline.toBuffer()
      const arquivo = join(DESTINO, `${nome}-${largura}.${formato}`)
      writeFileSync(arquivo, buf)
      console.log(`  ${arquivo.padEnd(46)} ${kb(buf.length)}`)
    }
  }
}
