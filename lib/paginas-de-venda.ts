/**
 * Registro das páginas de venda.
 *
 * Cada entrada é uma página com endereço próprio, para ser colada num
 * anúncio. Não há sorteio: quem decide qual página a pessoa vê é o link do
 * anúncio, e não o navegador dela.
 *
 * Havia um sorteio 50/50 no cliente, e ele enviesava o teste que deveria
 * medir. O servidor sempre renderizava a página `a`; caindo `b`, o navegador
 * dava um `location.replace` e recarregava tudo de novo. A `b` pagava um
 * carregamento inteiro a mais antes de aparecer — e, como a visita só era
 * contada depois do recarregamento, quem desistia no meio não entrava em
 * nenhuma das duas contas. A `b` perdia gente de verdade e ao mesmo tempo
 * parecia converter melhor, porque o denominador dela encolhia.
 *
 * Para acrescentar uma página: uma entrada aqui e a copy correspondente em
 * `lib/headlines.ts`. O tipo `Variant`, as rotas em `/lp/[slug]` e a quebra
 * do funil em `/secretaria` seguem sozinhas — nenhum outro arquivo precisa
 * saber que ela existe.
 *
 * A chave (`a`, `b`, ...) é o que vai para `visitas_landing.variante` e
 * `inscricoes.variante`: é curta de propósito, porque é gravada em toda
 * visita, e renomear uma quebraria a comparação com o que já foi medido.
 * O `nome` é o rótulo legível, e esse pode mudar quando quiser.
 */
export const PAGINAS = {
  a: {
    slug: 'institucional',
    nome: 'Institucional',
    resumo: 'Abre pelo nome do curso e pela instituição.',
  },
  b: {
    slug: 'inseguranca',
    nome: 'Insegurança na rotina',
    resumo: 'Abre por uma pergunta sobre a insegurança na hora da punção.',
  },
} as const

export type Variant = keyof typeof PAGINAS

/** A página servida em `/`, sem slug nenhum. */
export const CHAVE_PADRAO: Variant = 'a'

export const CHAVES = Object.keys(PAGINAS) as Variant[]

export function chaveDoSlug(slug: string): Variant | null {
  return CHAVES.find(chave => PAGINAS[chave].slug === slug) ?? null
}

/** Caminho público da página — é o que se cola no anúncio. */
export function caminhoDaPagina(chave: Variant): string {
  return chave === CHAVE_PADRAO ? '/' : `/lp/${PAGINAS[chave].slug}`
}
