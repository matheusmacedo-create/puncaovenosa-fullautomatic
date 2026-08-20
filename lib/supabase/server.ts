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

/**
 * Nomes aceitos, em ordem de preferência.
 *
 * A integração Supabase da Vercel injeta as variáveis com nomes próprios
 * (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`), diferentes dos que o
 * `.env.example` sugere. Aceitar as duas convenções evita um deploy que
 * sobe e responde 503 em todas as rotas sem explicar o motivo.
 */
const NOMES_DE_URL = 'NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_URL'
const NOMES_DE_CHAVE = 'SUPABASE_SECRET_KEY ou SUPABASE_SERVICE_ROLE_KEY'

/** Vazio conta como ausente: um valor em branco no painel não é configuração. */
const definida = (valor: string | undefined) => (valor?.trim() ? valor : undefined)

let cached: SupabaseClient | null = null

export function supabaseServer(): SupabaseClient {
  if (cached) return cached
  // Acesso direto, e não por chave dinâmica: o Next substitui `process.env.X`
  // em tempo de build, e `process.env[nome]` pode não ser substituído.
  const url = definida(process.env.NEXT_PUBLIC_SUPABASE_URL) ?? definida(process.env.SUPABASE_URL)
  const key = definida(process.env.SUPABASE_SECRET_KEY) ?? definida(process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (!url || !key) throw new SupabaseNaoConfigurado(!url, !key)
  cached = createClient(url, key, { auth: { persistSession: false } })
  return cached
}

export class SupabaseNaoConfigurado extends Error {
  constructor(faltaUrl = true, faltaChave = true) {
    // A mensagem diz o que faltou e onde procurar — é o que aparece no log
    // do servidor quando um deploy sobe sem configuração.
    const faltando = [
      faltaUrl ? `a URL (${NOMES_DE_URL})` : null,
      faltaChave ? `a chave secreta (${NOMES_DE_CHAVE})` : null,
    ].filter(Boolean).join(' e ')
    super(`Supabase não configurado — falta ${faltando}. Veja .env.example.`)
    this.name = 'SupabaseNaoConfigurado'
  }
}
