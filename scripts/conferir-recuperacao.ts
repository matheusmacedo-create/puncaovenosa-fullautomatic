/**
 * Confere as regras da recuperação pelo WhatsApp (lib/recuperacao.ts) com
 * inscrições fictícias, sem banco e sem rede:
 *
 *   npx tsx scripts/conferir-recuperacao.ts
 */
import assert from 'node:assert/strict'
import {
  comNonoDigito, dentroDoHorario, etapaDevida, linkDeVolta, numeroDoWhatsapp, pedeParaSair, previa, primeiroNome,
  semNonoDigito, variaveisDoModelo, type CobrancaParaRecuperar, type Contexto, type InscricaoParaRecuperar,
} from '../lib/recuperacao'

const HORA = 60 * 60 * 1000
// 26/10/2026 13h UTC = 10h em Brasília, a hora da rotina.
const agora = Date.UTC(2026, 9, 26, 13, 0, 0)
const ha = (horas: number) => new Date(agora - horas * HORA).toISOString()

const inscricao = (status: InscricaoParaRecuperar['status'], criadoHaHoras: number): InscricaoParaRecuperar => ({
  id: 'i1', nome: 'MARIA da Silva', telefone: '21987654321', status, criadoEm: ha(criadoHaHoras),
})
const ctx = (c: Partial<Contexto> = {}): Contexto => ({ agora, cobrancas: [], enviados: [], bloqueado: false, ...c })
const pix = (horas: number, status: CobrancaParaRecuperar['status'] = 'pendente', etapa: CobrancaParaRecuperar['etapa'] = 'matricula'): CobrancaParaRecuperar => ({
  etapa, status, criadoEm: ha(horas), confirmadoEm: status === 'confirmado' ? ha(horas) : null,
})

let casos = 0
const caso = (nome: string, real: unknown, esperado: unknown) => { assert.deepEqual(real, esperado, nome); casos++ }

// Número
caso('11 dígitos ganham o 55', numeroDoWhatsapp('21987654321'), '5521987654321')
caso('fixo não é WhatsApp', numeroDoWhatsapp('2133334444'), null)
caso('vazio', numeroDoWhatsapp(''), null)
caso('sem o nono', semNonoDigito('5521987654321'), '552187654321')
caso('volta com o nono', comNonoDigito('552187654321'), '5521987654321')
caso('com o nono fica', comNonoDigito('5521987654321'), '5521987654321')

// PIX aberto
caso('PIX há 30 min: cedo', etapaDevida(inscricao('aguardando_pagamento', 1), ctx({ cobrancas: [pix(0.5)] })), null)
caso('PIX há 3h: lembra', etapaDevida(inscricao('aguardando_pagamento', 3), ctx({ cobrancas: [pix(3)] })), 'pix_aberto')
caso('PIX há 23h: já ia vencer', etapaDevida(inscricao('aguardando_pagamento', 23), ctx({ cobrancas: [pix(23)] })), null)
caso('PIX há 30h: vira abandono', etapaDevida(inscricao('aguardando_pagamento', 30), ctx({ cobrancas: [pix(30)] })), 'abandono')
caso('PIX já lembrado: nada no mesmo dia', etapaDevida(inscricao('aguardando_pagamento', 5), ctx({ cobrancas: [pix(5)], enviados: [{ etapa: 'pix_aberto', criadoEm: ha(2) }] })), null)
caso('PIX lembrado ontem: hoje o abandono', etapaDevida(inscricao('aguardando_pagamento', 30), ctx({ cobrancas: [pix(30)], enviados: [{ etapa: 'pix_aberto', criadoEm: ha(25) }] })), 'abandono')
caso('PIX do curso não conta como matrícula', etapaDevida(inscricao('aguardando_pagamento', 3), ctx({ cobrancas: [pix(3, 'pendente', 'curso')] })), null)

// Abandono
caso('rascunho há 2h: cedo', etapaDevida(inscricao('rascunho', 2), ctx()), null)
caso('rascunho há 2 dias', etapaDevida(inscricao('rascunho', 48), ctx()), 'abandono')
caso('rascunho há 8 dias: tarde', etapaDevida(inscricao('rascunho', 8 * 24), ctx()), null)
caso('abandono só uma vez', etapaDevida(inscricao('rascunho', 72), ctx({ enviados: [{ etapa: 'abandono', criadoEm: ha(48) }] })), null)
caso('cancelada nunca', etapaDevida(inscricao('cancelada', 48), ctx()), null)

// Triagem
caso('pagou há 2 dias, falta triagem', etapaDevida(inscricao('paga', 50), ctx({ cobrancas: [pix(48, 'confirmado')] })), 'triagem_pendente')
caso('pagou há 3h: cedo', etapaDevida(inscricao('paga', 5), ctx({ cobrancas: [pix(3, 'confirmado')] })), null)
caso('integral conta como matrícula', etapaDevida(inscricao('paga', 50), ctx({ cobrancas: [pix(48, 'confirmado', 'integral')] })), 'triagem_pendente')
caso('triagem concluída: nada', etapaDevida(inscricao('triagem_concluida', 50), ctx({ cobrancas: [pix(48, 'confirmado')] })), null)

// Bloqueio e telefone
caso('bloqueado: nada', etapaDevida(inscricao('rascunho', 48), ctx({ bloqueado: true })), null)
caso('telefone inválido: nada', etapaDevida({ ...inscricao('rascunho', 48), telefone: '2133334444' }, ctx()), null)

// Saída
caso('SAIR', pedeParaSair('SAIR'), true)
caso('Sair.', pedeParaSair(' Sair. '), true)
caso('não quero', pedeParaSair('Não quero'), true)
caso('frase com sair não é pedido', pedeParaSair('não quero sair do curso'), false)
caso('oi', pedeParaSair('oi'), false)

// Horário (Brasília)
caso('10h pode', dentroDoHorario(agora), true)
caso('22h não', dentroDoHorario(Date.UTC(2026, 9, 27, 1, 0, 0)), false)
caso('8h não', dentroDoHorario(Date.UTC(2026, 9, 26, 11, 0, 0)), false)

// Texto
caso('primeiro nome', primeiroNome('MARIA da Silva'), 'Maria')
const link = linkDeVolta('https://exemplo.org', 'abandono')
caso('link', link, 'https://exemplo.org/inscricao?utm_source=whatsapp&utm_medium=recuperacao&utm_campaign=recuperacao_abandono')
const texto = previa('abandono', variaveisDoModelo('MARIA da Silva', link))
assert.ok(texto.startsWith('Oi, Maria!') && texto.includes(link) && !texto.includes('{{'), 'prévia preenchida'); casos++

console.log(`recuperação: ${casos} casos conferidos`)
