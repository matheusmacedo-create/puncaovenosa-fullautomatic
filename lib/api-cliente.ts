'use client'

import type { Endereco } from '@/lib/cep'
import type { Atribuicao } from '@/lib/checkout'
import { EnrollmentData, PagamentoMetodo, PagamentoStatus } from '@/lib/enrollment'

/**
 * Chamadas do navegador para as rotas do funil.
 *
 * Nenhuma delas recebe id de inscrição: a sessão vem do cookie httpOnly que
 * o servidor gravou, então o navegador não tem como forjar outra inscrição.
 */

export type Inscricao = {
  id: string
  nome: string
  cpfMascarado: string
  telefone: string
  email: string | null
  status: 'rascunho' | 'aguardando_pagamento' | 'paga' | 'triagem_concluida' | 'cancelada'
  numeroInscricao: string | null
  /** Endereço que o QR Code da ficha carrega, para conferência presencial. */
  validacaoUrl: string
  passosRespondidos: number
}

export type ItemDePreco = { id: string; rotulo: string; detalhe?: string; centavos: number }

export type Cobranca = {
  id: string
  metodo: PagamentoMetodo
  parcelas: number
  valorCentavos: number
  itens: ItemDePreco[] | null
  status: PagamentoStatus
  pixCopiaCola: string | null
  recusaMotivo?: string | null
  criadoEm: string
  minutosParaExpirar: number
  /** Vem do servidor a cada requisição — ver lib/simulacao.ts. */
  simulacao: boolean
  /** Libera os controles de conferência manual, mesmo com cobrança real. */
  confirmacaoManual: boolean
}

export class ErroDaApi extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem)
    this.name = 'ErroDaApi'
  }
}

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const corpo = await resposta.json().catch(() => ({}))
  if (!resposta.ok) throw new ErroDaApi(resposta.status, corpo?.erro ?? 'Falha na comunicação com o servidor.')
  return corpo as T
}

/**
 * A atribuição vai junto do cadastro, e não numa chamada à parte: é o
 * primeiro momento em que existe uma inscrição para ancorá-la, e uma segunda
 * requisição poderia falhar sozinha e deixar a inscrição sem origem.
 */
export const salvarInscricao = (dados: EnrollmentData, atribuicao: Atribuicao = {}) =>
  pedir<{ id: string; status: string; numeroInscricao: string | null; jaPaga: boolean }>(
    '/api/inscricoes',
    { method: 'POST', body: JSON.stringify({ ...dados, ...atribuicao }) },
  )

export const buscarInscricao = () => pedir<Inscricao>('/api/inscricoes/atual')

export const consultarCpf = (cpf: string) =>
  pedir<{ existe: boolean; primeiroNome?: string; telefoneFinal?: string; jaPaga?: boolean }>(
    `/api/inscricoes/consulta?cpf=${encodeURIComponent(cpf)}`,
  )

/**
 * Abre a cobrança.
 *
 * PCI-DSS: a API da Únicopag recebe o número do cartão em claro — não há
 * tokenização no navegador. Os dados vão por HTTPS para a nossa rota, que
 * os repassa ao provedor e os descarta. Nada de cartão é gravado aqui, nem
 * em `localStorage`, nem em qualquer cache.
 */
export const criarCobranca = (payload: {
  metodo: PagamentoMetodo
  parcelas?: number
  cartao?: { numero: string; nome: string; validade: string; cvv: string }
}) => pedir<Cobranca>('/api/pagamentos', { method: 'POST', body: JSON.stringify(payload) })

export const buscarCobranca = () => pedir<Cobranca & { existe: boolean }>('/api/pagamentos/atual')

export const confirmarCobranca = (pagamentoId: string) =>
  pedir<{ numeroInscricao: string | null; jaConfirmado: boolean }>(
    '/api/pagamentos/confirmar',
    { method: 'POST', body: JSON.stringify({ pagamentoId }) },
  )

export const encerrarCobranca = (pagamentoId: string, desfecho: 'expirado' | 'recusado', motivo?: string) =>
  pedir<{ alterado: boolean; status: string | null }>(
    '/api/pagamentos/desfecho',
    { method: 'POST', body: JSON.stringify({ pagamentoId, desfecho, motivo }) },
  )

export const buscarTriagem = () =>
  pedir<{ id: string | null; respostas: Record<string, unknown>; concluida: boolean }>('/api/triagem')

export const salvarResposta = (passo: number, resposta: unknown) =>
  pedir<{ salvo: boolean; concluida: boolean }>('/api/triagem', {
    method: 'PUT',
    body: JSON.stringify({ passo, resposta }),
  })

export const buscarEnderecoDoCep = (cepEmDigitos: string) =>
  pedir<Endereco>(`/api/cep/${cepEmDigitos}`)

export const pesquisarEnderecos = (uf: string, cidade: string, logradouro: string) =>
  pedir<{ enderecos: Endereco[]; total: number }>(
    `/api/enderecos?uf=${encodeURIComponent(uf)}&cidade=${encodeURIComponent(cidade)}&logradouro=${encodeURIComponent(logradouro)}`,
  )

/** Uma visita real à landing — o topo do funil que não tem inscrição para ancorar. Chamar sempre com `.catch()`: nunca deve atrapalhar a navegação de quem visita. */
export const registrarVisita = (dados: Atribuicao) =>
  pedir<{ ok: boolean }>('/api/visitas', { method: 'POST', body: JSON.stringify(dados) })
