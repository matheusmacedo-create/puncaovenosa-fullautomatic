import { CHAVES, type Variant } from '@/lib/paginas-de-venda'

export type { Variant }

export const VARIANT_STORAGE_KEY = 'pv_variant'
export const VARIANT_COOKIE = 'pv_variant'

export function normalizeVariant(value?: string | string[] | null): Variant | null {
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = raw?.toLowerCase()
  // Valida contra o registro, e não contra uma lista escrita à mão: uma
  // página nova passa a ser aceita em `?variant=` sem tocar aqui.
  return parsed && (CHAVES as string[]).includes(parsed) ? (parsed as Variant) : null
}

/**
 * Página pedida explicitamente na URL (`?variant=a|b`), lida no servidor.
 *
 * Continua funcionando para não quebrar anúncio já publicado apontando para
 * `/?variant=b`. O endereço novo de cada página é `/lp/[slug]`.
 */
export function resolveVariant(value?: string | string[] | null): Variant | null {
  return normalizeVariant(value)
}

/**
 * Grava a página vista, para o funil saber de onde a pessoa veio.
 *
 * O cookie é o que liga a landing ao checkout: dentro da gaveta em iframe não
 * há `?variant=` na URL, e sem isto a matrícula seria creditada à página
 * errada. 90 dias para quem volta depois continuar contando para a mesma.
 */
export function persistVariant(variant: Variant) {
  try {
    window.localStorage.setItem(VARIANT_STORAGE_KEY, variant)
  } catch {
    // localStorage indisponível (modo privado); o cookie basta.
  }
  document.cookie = `${VARIANT_COOKIE}=${variant}; path=/; max-age=${60 * 60 * 24 * 90}; samesite=lax`
}
