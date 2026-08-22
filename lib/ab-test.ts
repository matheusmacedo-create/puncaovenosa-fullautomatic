export type Variant = 'a' | 'b'

export const VARIANT_STORAGE_KEY = 'pv_variant'
export const VARIANT_COOKIE = 'pv_variant'

export function normalizeVariant(value?: string | string[] | null): Variant | null {
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = raw?.toLowerCase()
  return parsed === 'a' || parsed === 'b' ? parsed : null
}

/**
 * Variante explicitamente pedida na URL (?variant=a|b), lida no servidor.
 * Retorna null quando não há parâmetro, caso em que o sorteio 50/50
 * acontece no cliente para não quebrar o cache da rota estática.
 */
export function resolveVariant(value?: string | string[] | null): Variant | null {
  return normalizeVariant(value)
}

/**
 * Resolve a variante no cliente: parâmetro da URL tem prioridade, depois o
 * valor persistido e, na ausência de ambos, sorteio 50/50. O resultado é
 * gravado em cookie e localStorage para que o visitante permaneça na mesma
 * variante em recarregamentos e retornos.
 */
export function resolveClientVariant(): Variant {
  if (typeof window === 'undefined') return 'a'

  const fromUrl = normalizeVariant(new URLSearchParams(window.location.search).get('variant'))
  if (fromUrl) {
    persistVariant(fromUrl)
    return fromUrl
  }

  const stored = readStoredVariant()
  if (stored) return stored

  const assigned: Variant = Math.random() < 0.5 ? 'a' : 'b'
  persistVariant(assigned)
  return assigned
}

function readStoredVariant(): Variant | null {
  try {
    const fromStorage = normalizeVariant(window.localStorage.getItem(VARIANT_STORAGE_KEY))
    if (fromStorage) return fromStorage
  } catch {
    // localStorage indisponível (modo privado); segue para o cookie.
  }

  const match = document.cookie.match(new RegExp(`(?:^|; )${VARIANT_COOKIE}=([^;]*)`))
  return normalizeVariant(match?.[1] ?? null)
}

function persistVariant(variant: Variant) {
  try {
    window.localStorage.setItem(VARIANT_STORAGE_KEY, variant)
  } catch {
    // Ignora falha de storage e mantém o cookie como fonte.
  }
  document.cookie = `${VARIANT_COOKIE}=${variant}; path=/; max-age=${60 * 60 * 24 * 90}; samesite=lax`
}
