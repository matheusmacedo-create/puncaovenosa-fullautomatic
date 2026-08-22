export type EnrollmentData = {
  name: string
  phone: string
  cpf: string
  /** Obrigatório: a Únicopag exige `customer.email` para criar a cobrança. */
  email: string
  highSchool: boolean
}

export type TriageAnswers = Record<string, string | string[] | boolean[]>

export const STORAGE_KEYS = {
  enrollment: 'cvb-enrollment',
  triage: 'cvb-triage',
} as const

/**
 * Recebedor do PIX.
 *
 * [INTEGRAÇÃO] `chave` é um placeholder. Antes de ir ao ar, troque pela
 * chave real da Cruz Vermelha (CNPJ, e-mail ou chave aleatória) — o
 * pagamento não cai numa chave que não existe.
 *
 * O código copia-e-cola é montado por cobrança em `lib/pix.ts`, e não
 * escrito à mão: o payload anterior tinha os tamanhos de campo errados, o
 * que impedia o app do banco de ler o valor e deixava o pagador digitar
 * qualquer quantia.
 */
export const PIX_RECEBEDOR = {
  chave: 'cvbrj-puncao-venosa-2026',
  nome: 'CRUZ VERMELHA BRASILEIRA',
  cidade: 'RIO DE JANEIRO',
} as const

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

export const EMAIL_PLAUSIVEL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function fieldError(field: keyof EnrollmentData, data: EnrollmentData) {
  if (field === 'name') return data.name.trim().split(/\s+/).length < 2 ? 'Digite seu nome e sobrenome.' : ''
  if (field === 'email') {
    if (!data.email.trim()) return 'Informe seu e-mail — o comprovante do pagamento é enviado nele.'
    return EMAIL_PLAUSIVEL.test(data.email.trim()) ? '' : 'Confira o e-mail digitado.'
  }
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

/**
 * Composição do preço, item a item.
 *
 * O aluno paga o total à vista. A separação existe para ficar explícito no
 * checkout o que ele está comprando — e porque matrícula e curso são coisas
 * distintas, que um dia podem ser cobradas em momentos diferentes.
 */
type ItemDePreco = { id: string; rotulo: string; detalhe?: string; centavos: number }

const COMPOSICAO_REAL: ItemDePreco[] = [
  { id: 'matricula', rotulo: 'Matrícula', detalhe: 'Reserva da vaga e cadastro', centavos: 9900 },
  { id: 'curso', rotulo: 'Curso presencial', detalhe: '8 horas na sede CVB-RJ', centavos: 15000 },
]

const TOTAL_REAL = COMPOSICAO_REAL.reduce((soma, item) => soma + item.centavos, 0)

/**
 * Preço reduzido para teste operacional — pagar de verdade sem gastar R$ 249.
 *
 * É variável de ambiente, e não um valor trocado no código, porque um preço
 * editado à mão é fácil de esquecer revertido: o curso passaria a ser vendido
 * por centavos para todo mundo. Assim, some sozinho quando a variável sair.
 *
 * `NEXT_PUBLIC_` de propósito: preço precisa ser o mesmo na tela e na
 * cobrança, e mudá-lo exige um novo deploy — o que é desejável, porque preço
 * não deveria mudar sem que alguém publique a mudança.
 */
function precoDeTeste(): number | null {
  const bruto = process.env.NEXT_PUBLIC_PRECO_TESTE_CENTAVOS?.trim()
  if (!bruto) return null
  const centavos = Number(bruto)
  if (!Number.isInteger(centavos) || centavos < 1) return null
  return centavos
}

/**
 * Reparte o total de teste entre os itens na mesma proporção do preço real,
 * garantindo que a soma feche exatamente — há uma constraint no banco que
 * exige isso, e a Únicopag recusa item com preço zero.
 */
function escalar(total: number): ItemDePreco[] {
  // Pouco demais para repartir sem zerar alguém: vira item único.
  if (total < COMPOSICAO_REAL.length) {
    return [{ id: 'teste', rotulo: 'Teste operacional', detalhe: 'Cobrança de verificação', centavos: total }]
  }
  const escalados = COMPOSICAO_REAL.map(item => ({
    ...item,
    centavos: Math.max(1, Math.round((item.centavos / TOTAL_REAL) * total)),
  }))
  // O último item absorve a diferença do arredondamento.
  const diferenca = total - escalados.reduce((soma, item) => soma + item.centavos, 0)
  escalados[escalados.length - 1].centavos += diferenca
  return escalados
}

/** Indica que o valor em uso não é o preço real do curso. */
export const PRECO_DE_TESTE = precoDeTeste() !== null

export const COMPOSICAO_PRECO: ItemDePreco[] = (() => {
  const teste = precoDeTeste()
  return teste === null ? COMPOSICAO_REAL : escalar(teste)
})()

/** Total cobrado. Derivado dos itens — nunca escreva o valor solto. */
export const PRECO_CENTAVOS = COMPOSICAO_PRECO.reduce((soma, item) => soma + item.centavos, 0)

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
