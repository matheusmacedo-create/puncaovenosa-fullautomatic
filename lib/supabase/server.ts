import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase para uso EXCLUSIVO no servidor.
 *
 * Usa a chave secreta, que ignora RLS — todas as tabelas do funil negam
 * acesso por padrão. Nunca importe este módulo de um Client Component:
 * a chave vazaria no bundle.
 *
 * O cliente é criado sob demanda, e não no topo do módulo, para que
 * `next build` não quebre num ambiente sem as variáveis configuradas
 * (o CI, por exemplo).
 */
let cached: SupabaseClient | null = null

export function supabaseServer(): SupabaseClient {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new SupabaseNaoConfigurado()
  cached = createClient(url, key, { auth: { persistSession: false } })
  return cached
}

export class SupabaseNaoConfigurado extends Error {
  constructor() {
    super('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY precisam estar definidas. Veja .env.example.')
    this.name = 'SupabaseNaoConfigurado'
  }
}
