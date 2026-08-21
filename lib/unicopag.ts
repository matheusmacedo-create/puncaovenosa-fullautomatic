/**
 * Cliente da API da Únicopag.
 *
 * Contrato conferido em https://docs.unicopag.com — autenticação por query
 * string `api_token`, valores sempre em centavos.
 *
 * ATENÇÃO — PCI-DSS: esta API recebe o número do cartão em claro, no corpo
 * da requisição. Não existe tokenização no navegador. Isso significa que o
 * dado do cartão atravessa o nosso servidor a caminho do provedor, o que
 * coloca a aplicação no escopo de PCI. As regras que seguem daqui:
 *
 *   - o número, o CVV e a validade NUNCA são gravados em banco, log ou
 *     arquivo. Só existem em memória, durante a requisição;
 *   - o objeto `card` nunca entra em `console.log` nem em mensagem de erro;
 *   - do cartão, o banco guarda apenas bandeira e últimos 4 dígitos.
 */

const BASE_PADRAO = 'https://api.cloud.unicopag.com.br'

export class UnicopagNaoConfigurado extends Error {
  constructor() {
    super('UNICO_API_KEY não está definida. Veja .env.example.')
    this.name = 'UnicopagNaoConfigurado'
  }
}

/** Erro da API com o status e as mensagens de validação já legíveis. */
export class UnicopagErro extends Error {
  constructor(public status: number, mensagem: string, public campos?: Record<string, string[]>) {
    super(mensagem)
    this.name = 'UnicopagErro'
  }

  /** A primeira mensagem de campo, que é a que faz sentido mostrar ao aluno. */
  get mensagemParaOAluno(): string {
    const primeira = this.campos && Object.values(this.campos)[0]?.[0]
    if (primeira) return primeira
    if (this.status === 422 || this.status === 400) return this.message
    return 'Não foi possível processar o pagamento. Tente novamente.'
  }
}

export type Cliente = {
  name: string
  email: string
  phone_number: string
  document: string
  zip_code?: string
  street_name?: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
}

export type ItemDoCarrinho = { hash: string; title: string; price: number; quantity: number }

/** Dados do cartão. Só trafegam; nunca são persistidos. */
export type CartaoEmClaro = {
  number: string
  holdername: string
  exp_month: string
  exp_year: string
  cvv: string
}

export type NovoPagamento = {
  amount: number
  payment_method: 'pix' | 'credit_card'
  installments: number
  customer: Cliente
  cart: ItemDoCarrinho[]
  postback_url: string
  card?: CartaoEmClaro
  expire_in_days?: number
  origin?: string
  metadata?: Record<string, unknown>
}

export type RespostaDePagamento = {
  hash: string
  payment_method: string
  payment_status: string
  installments: number
  amount_total: number
  pix: { pix_url: string | null; pix_qr_code: string | null; pix_base64: string | null } | null
  card_brand: string | null
  paid_at: string | null
  created_at: string
}

function credenciais() {
  const token = process.env.UNICO_API_KEY?.trim()
  if (!token) throw new UnicopagNaoConfigurado()
  return { token, base: process.env.UNICO_BASE_URL?.trim() || BASE_PADRAO }
}

async function chamar<T>(caminho: string, init?: RequestInit): Promise<T> {
  const { token, base } = credenciais()
  const url = new URL(caminho, base)
  url.searchParams.set('api_token', token)

  const resposta = await fetch(url, {
    ...init,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...init?.headers },
    // Nunca cachear: são operações financeiras.
    cache: 'no-store',
  })

  const corpo = await resposta.json().catch(() => null)
  if (!resposta.ok) {
    const mensagem = (corpo?.message as string) || `Únicopag respondeu ${resposta.status}.`
    throw new UnicopagErro(resposta.status, mensagem, corpo?.errors)
  }
  return corpo as T
}

/**
 * Cria a cobrança. `payload.card` é enviado e imediatamente esquecido — não
 * retorne esse objeto, não o registre, não o inclua em erro.
 */
export const criarPagamento = (payload: NovoPagamento) =>
  chamar<RespostaDePagamento>('/public/v1/payments', { method: 'POST', body: JSON.stringify(payload) })

/** Estado atual de uma transação, pelo hash devolvido na criação. */
export const consultarTransacao = (hash: string) =>
  chamar<RespostaDePagamento>(`/public/v1/transactions/${encodeURIComponent(hash)}`)

export type OpcaoDeParcela = { installment: number; total: number; interest_rate: number }

/** Tabela de parcelamento com os juros reais da conta. */
export const consultarParcelamento = (centavos: number) =>
  chamar<{ installments?: OpcaoDeParcela[] } | OpcaoDeParcela[]>(`/public/v1/installments?amount=${centavos}`)

/** Saldo — usado pelo diagnóstico para provar que a chave é válida. */
export const consultarSaldo = () =>
  chamar<{ available: number; waiting_funds: number }>('/public/v1/balance')
