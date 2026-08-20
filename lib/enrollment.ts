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
