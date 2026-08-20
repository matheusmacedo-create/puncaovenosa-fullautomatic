export type EnrollmentData = {
  name: string
  phone: string
  cpf: string
  highSchool: boolean
}

export type TriageAnswers = Record<string, string | string[] | boolean[]>

export const STORAGE_KEYS = {
  enrollment: 'cvb-enrollment',
  triage: 'cvb-triage',
} as const

export const PIX_CODE =
  '00020126580014BR.GOV.BCB.PIX0136cvbrj-puncao-venosa-20265204000053039865406249.005802BR5925CRUZ VERMELHA BRASILEIRA6009RIO DE JANEIRO62140510CVB202600016304A13F'

export const digits = (value: string) => value.replace(/\D/g, '')

export function maskPhone(value: string) {
  const v = digits(value).slice(0, 11)
  return v.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}

export function maskCpf(value: string) {
  const v = digits(value).slice(0, 11)
  return v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export function maskCep(value: string) {
  return digits(value).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2')
}

export function isValidCpf(value: string) {
  const cpf = digits(value)
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false
  const calc = (length: number) => {
    const sum = cpf.slice(0, length).split('').reduce((acc, n, i) => acc + Number(n) * (length + 1 - i), 0)
    const result = (sum * 10) % 11
    return result === 10 ? 0 : result
  }
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10])
}

export function fieldError(field: keyof EnrollmentData, data: EnrollmentData) {
  if (field === 'name') return data.name.trim().split(/\s+/).length < 2 ? 'Digite seu nome e sobrenome.' : ''
  if (field === 'phone') {
    const missing = 11 - digits(data.phone).length
    return missing > 0 ? `WhatsApp incompleto — faltam ${missing} dígito${missing > 1 ? 's' : ''}.` : ''
  }
  if (field === 'cpf') {
    const missing = 11 - digits(data.cpf).length
    if (missing > 0) return `CPF incompleto — faltam ${missing} dígito${missing > 1 ? 's' : ''}.`
    return isValidCpf(data.cpf) ? '' : 'Confira os números do CPF.'
  }
  return data.highSchool ? '' : 'Confirme o pré-requisito para continuar.'
}

export function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try { return JSON.parse(localStorage.getItem(key) || '') as T } catch { return fallback }
}

export function saveJson(key: string, value: unknown) {
  if (typeof window !== 'undefined') localStorage.setItem(key, JSON.stringify(value))
}

export const triageQuestions = [
  { title: 'Qual seu CEP?', type: 'cep' },
  { title: 'Você já atua na área da saúde?', type: 'single', options: ['Técnico de enfermagem', 'Enfermeiro(a)', 'Estudante', 'Outra área'] },
  { title: 'Qual turno funciona melhor pra você?', type: 'single', options: ['Noite', 'Dia de semana', 'Sábado'] },
  { title: 'Quais dias você consegue?', type: 'multi', options: ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] },
  { title: 'Quando pretende fazer o curso?', type: 'single', options: ['Esta semana', 'Nos próximos 30 dias', 'Ainda vendo datas'] },
  { title: 'Seu certificado físico será entregue no dia do curso', type: 'email' },
  { title: 'Como você conheceu o curso?', type: 'single', options: ['Instagram', 'Facebook', 'Indicação', 'Já sou aluno'] },
  { title: 'Antes de concluir, confirme:', type: 'confirm', options: ['8h presenciais na sede CVB-RJ', 'Levar 1 kg de alimento não perecível', 'Documento com foto no dia'] },
] as const

// --- Preço -------------------------------------------------------------
// Fonte única do valor do curso. Tudo (interface, PIX, cartão e o registro
// em `pagamentos.valor_centavos`) deriva daqui.

export const PRECO_CENTAVOS = 24900
export const MAX_PARCELAS = 12

export const formatarBRL = (centavos: number) =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Parcelas oferecidas no cartão. [INTEGRAÇÃO] Hoje sem juros; a Único define a tabela real. */
export function parcelasDisponiveis(total = PRECO_CENTAVOS) {
  return Array.from({ length: MAX_PARCELAS }, (_, i) => i + 1)
    .filter(n => Math.round(total / n) >= 500) // não oferecer parcela abaixo de R$ 5,00
    .map(n => ({ numero: n, valorCentavos: Math.round(total / n), total }))
}

// --- Pagamento ---------------------------------------------------------

export type PagamentoMetodo = 'pix' | 'cartao'
export type PagamentoStatus = 'pendente' | 'confirmado' | 'expirado' | 'estornado' | 'recusado'

export type DadosCartao = { numero: string; nome: string; validade: string; cvv: string; parcelas: number }

export const CARTAO_VAZIO: DadosCartao = { numero: '', nome: '', validade: '', cvv: '', parcelas: 1 }

export function maskCardNumber(value: string) {
  return digits(value).slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}

export function maskValidade(value: string) {
  return digits(value).slice(0, 4).replace(/^(\d{2})(\d)/, '$1/$2')
}

/** Bandeira pelo prefixo, só para exibir o ícone certo enquanto o aluno digita. */
export function bandeiraDoCartao(numero: string): string | null {
  const n = digits(numero)
  if (!n) return null
  if (/^4/.test(n)) return 'visa'
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'mastercard'
  if (/^3[47]/.test(n)) return 'amex'
  if (/^(4011|4312|4389|5041|5067|509|6277|6362|650)/.test(n)) return 'elo'
  if (/^(38|60)/.test(n)) return 'hipercard'
  return null
}

/** Luhn — o dígito verificador que todo cartão carrega. Pega erro de digitação antes de chamar o provedor. */
export function isValidCardNumber(value: string) {
  const n = digits(value)
  if (n.length < 13 || n.length > 16) return false
  let soma = 0
  let dobra = false
  for (let i = n.length - 1; i >= 0; i--) {
    let d = Number(n[i])
    if (dobra) { d *= 2; if (d > 9) d -= 9 }
    soma += d
    dobra = !dobra
  }
  return soma % 10 === 0
}

export function isValidValidade(value: string) {
  const n = digits(value)
  if (n.length !== 4) return false
  const mes = Number(n.slice(0, 2))
  const ano = 2000 + Number(n.slice(2))
  if (mes < 1 || mes > 12) return false
  const agora = new Date()
  const fimDoMes = new Date(ano, mes, 0, 23, 59, 59)
  return fimDoMes >= agora
}

export function cardFieldError(field: keyof DadosCartao, data: DadosCartao) {
  if (field === 'numero') {
    const n = digits(data.numero)
    if (n.length < 13) return 'Número do cartão incompleto.'
    return isValidCardNumber(data.numero) ? '' : 'Confira os números do cartão.'
  }
  if (field === 'nome') return data.nome.trim().split(/\s+/).length < 2 ? 'Digite o nome como está impresso no cartão.' : ''
  if (field === 'validade') {
    if (digits(data.validade).length < 4) return 'Validade incompleta — use MM/AA.'
    return isValidValidade(data.validade) ? '' : 'Cartão vencido ou mês inválido.'
  }
  if (field === 'cvv') {
    const esperado = bandeiraDoCartao(data.numero) === 'amex' ? 4 : 3
    return digits(data.cvv).length === esperado ? '' : `O código de segurança tem ${esperado} dígitos.`
  }
  return ''
}

/** Minutos que uma cobrança PIX aceita pagamento antes de expirar. */
export const MINUTOS_PARA_EXPIRAR = 30
