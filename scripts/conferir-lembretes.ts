/**
 * Confere as regras dos lembretes de recuperação e a assinatura dos links,
 * sem banco nem rede:
 *
 *   npx tsx scripts/conferir-lembretes.ts
 */
import assert from 'node:assert/strict'
import { dentroDoHorario, lembreteDevido, type Candidato } from '../lib/lembretes-regras'
import { assinar, verificar } from '../lib/link-assinado'

// O segredo é lido a cada chamada, não na importação.
process.env.LINK_ASSINADO_SEGREDO = 'x'.repeat(40)

const H = 3_600_000
const D = 24 * H
const agora = Date.parse('2026-10-30T13:00:00Z')

const base: Candidato = {
  status: 'aguardando_pagamento',
  email: 'aluna@exemplo.com',
  lembretesDesligados: false,
  primeiraCobrancaEm: agora - 5 * H,
  matriculaPagaEm: null,
  passosRespondidos: 0,
  enviados: {},
}
const caso = (mudancas: Partial<Candidato>) => lembreteDevido({ ...base, ...mudancas }, agora)

// Pagamento
assert.equal(caso({}), 'lembrete_pagamento_1')
assert.equal(caso({ primeiraCobrancaEm: agora - 1 * H }), null, 'pagando agora não recebe "você esqueceu"')
assert.equal(caso({ primeiraCobrancaEm: null }), null, 'sem cobrança não há o que lembrar')
assert.equal(caso({ primeiraCobrancaEm: agora - 11 * D }), null, 'lead antigo não é acordado')
assert.equal(caso({ enviados: { lembrete_pagamento_1: agora - 1 * D } }), null)
assert.equal(caso({ enviados: { lembrete_pagamento_1: agora - 3 * D + 30 * 60_000 } }), 'lembrete_pagamento_2', 'folga do horário do cron')
assert.equal(caso({ enviados: { lembrete_pagamento_1: agora - 4 * D, lembrete_pagamento_2: agora - D } }), null, 'depois do segundo, silêncio')

// Ninguém recebe
assert.equal(caso({ email: null }), null)
assert.equal(caso({ lembretesDesligados: true }), null)
assert.equal(caso({ status: 'cancelada' }), null)

// Triagem
const pago = { status: 'paga', matriculaPagaEm: agora - 2 * D }
assert.equal(caso(pago), 'lembrete_triagem')
assert.equal(caso({ ...pago, matriculaPagaEm: agora - 2 * H }), null, 'acabou de pagar')
assert.equal(caso({ ...pago, passosRespondidos: 8 }), null)
assert.equal(caso({ ...pago, status: 'triagem_concluida' }), null)
assert.equal(caso({ ...pago, enviados: { lembrete_triagem: agora - D } }), null)
assert.equal(caso({ ...pago, matriculaPagaEm: agora - 15 * D }), null)
assert.equal(caso({ ...pago, enviados: { lembrete_pagamento_1: agora - 3 * D } }), 'lembrete_triagem', 'pagou depois do lembrete')

// Horário de envio (Brasília = UTC−3)
assert.equal(dentroDoHorario(Date.parse('2026-10-30T10:07:00Z')), true, '7h07')
assert.equal(dentroDoHorario(Date.parse('2026-10-31T00:07:00Z')), true, '21h07')
assert.equal(dentroDoHorario(Date.parse('2026-10-31T01:30:00Z')), true, '22h30, rodada das 21h atrasada')
assert.equal(dentroDoHorario(Date.parse('2026-10-31T02:00:00Z')), false, '23h')
assert.equal(dentroDoHorario(Date.parse('2026-10-30T08:00:00Z')), false, '5h')

// Links assinados
const id = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b'
const p = assinar(id, 'pagamento', 30, agora)!
assert.ok(p)
assert.deepEqual(verificar(p, agora), { ok: true, inscricaoId: id, finalidade: 'pagamento' })
assert.deepEqual(verificar(p, agora + 31 * D), { ok: false, motivo: 'expirado' })
assert.deepEqual(verificar({ ...p, f: 'ficha' }, agora), { ok: false, motivo: 'assinatura' }, 'trocar a finalidade invalida')
assert.deepEqual(verificar({ ...p, i: id.replace('6f', '7f') }, agora), { ok: false, motivo: 'assinatura' }, 'trocar a inscrição invalida')
assert.deepEqual(verificar({ ...p, x: String(Number(p.x) + 999_999) }, agora), { ok: false, motivo: 'assinatura' }, 'esticar a validade invalida')
assert.deepEqual(verificar({ ...p, s: p.s.slice(1) }, agora), { ok: false, motivo: 'assinatura' })
assert.deepEqual(verificar({ i: id }, agora), { ok: false, motivo: 'malformado' })
assert.ok(!/[=+/]/.test(p.s), 'assinatura segura para URL')
assert.equal(assinar('nao-e-uuid', 'ficha', 1, agora), null)

process.env.LINK_ASSINADO_SEGREDO = 'curto'
assert.equal(assinar(id, 'ficha', 1, agora), null, 'segredo curto não assina')
assert.deepEqual(verificar(p, agora), { ok: false, motivo: 'sem_segredo' })

// Sem LINK_ASSINADO_SEGREDO, a chave sai da chave do banco — e é outra chave
delete process.env.LINK_ASSINADO_SEGREDO
process.env.SUPABASE_SECRET_KEY = 'sb_secret_' + 'k'.repeat(31)
const derivado = assinar(id, 'pagamento', 30, agora)!
assert.ok(derivado, 'assina com a chave derivada')
assert.deepEqual(verificar(derivado, agora), { ok: true, inscricaoId: id, finalidade: 'pagamento' })
assert.deepEqual(verificar(p, agora), { ok: false, motivo: 'assinatura' }, 'link de outra chave não vale')
process.env.SUPABASE_SECRET_KEY = 'sb_secret_' + 'j'.repeat(31)
assert.deepEqual(verificar(derivado, agora), { ok: false, motivo: 'assinatura' }, 'trocar a chave do banco invalida')

console.log('lembretes e links assinados: ok')
