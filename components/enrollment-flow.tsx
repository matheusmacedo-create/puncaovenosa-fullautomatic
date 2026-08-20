'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, X } from 'lucide-react'
import { ClinicalHeader, RedCross, VisualQr } from '@/components/clinical-header'
import { digits, EnrollmentData, fieldError, loadJson, maskCpf, maskPhone, PIX_CODE, saveJson, STORAGE_KEYS } from '@/lib/enrollment'

type Stage = 'dados' | 'pagamento' | 'confirmado'
type PaymentState = 'pendente' | 'pago' | 'expirado' | 'duplicado'

const EMPTY: EnrollmentData = { name: '', phone: '', cpf: '', highSchool: false }

export function EnrollmentFlow() {
  const search = useSearchParams()
  const router = useRouter()
  const stage = search.get('etapa') as Stage | null
  const open = !!stage
  const [data, setData] = useState<EnrollmentData>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof EnrollmentData, string>>>({})
  const [knownStudent, setKnownStudent] = useState(false)
  const [payment, setPayment] = useState<PaymentState>('pendente')
  const [copied, setCopied] = useState(false)
  const [seconds, setSeconds] = useState(1800)
  const pointerStart = useRef<number | null>(null)

  useEffect(() => setData(loadJson(STORAGE_KEYS.enrollment, EMPTY)), [])
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])
  useEffect(() => {
    if (!open || payment !== 'pendente') return
    const id = window.setInterval(() => setSeconds(s => s > 0 ? s - 1 : 0), 1000)
    return () => window.clearInterval(id)
  }, [open, payment])
  useEffect(() => { if (seconds === 0) setPayment('expirado') }, [seconds])

  const update = <K extends keyof EnrollmentData>(key: K, value: EnrollmentData[K]) => {
    const next = { ...data, [key]: value }
    setData(next); saveJson(STORAGE_KEYS.enrollment, next)
  }
  const go = (next: Stage) => router.push(`/?etapa=${next}`)
  const close = () => router.push('/')
  const blur = (key: keyof EnrollmentData) => {
    const message = fieldError(key, data)
    setErrors(e => ({ ...e, [key]: message }))
    if (key === 'cpf' && !message && digits(data.cpf).endsWith('725')) {
      // [INTEGRAÇÃO] Substituir por consulta de aluno existente.
      const next = { ...data, name: data.name || 'Mariana Oliveira', phone: data.phone || '(21) 99988-7766' }
      setKnownStudent(true); setData(next); saveJson(STORAGE_KEYS.enrollment, next)
    }
  }
  const submitData = () => {
    const nextErrors = Object.fromEntries((Object.keys(data) as (keyof EnrollmentData)[]).map(k => [k, fieldError(k, data)]))
    setErrors(nextErrors)
    if (Object.values(nextErrors).every(v => !v)) go('pagamento')
  }
  const copyPix = async () => {
    try { await navigator.clipboard.writeText(PIX_CODE) } catch { /* clipboard fallback unavailable in preview */ }
    navigator.vibrate?.(35); setCopied(true); window.setTimeout(() => setCopied(false), 2000)
  }
  const timer = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

  return (
    <>
      <main className="launcher">
        <div className="launcher-top" />
        <div className="launcher-main">
          <section className="launcher-card" aria-labelledby="course-title">
            <p className="eyebrow">Cruz Vermelha Brasileira · RJ</p>
            <h1 id="course-title">Fluxo de inscrição</h1>
            <p className="lede">Ambiente de demonstração do checkout e da triagem do Curso de Punção Venosa. Pronto para ser ligado ao CTA da página de vendas.</p>
            <div className="course-meta"><span>8h presenciais</span><span>Sede CVB-RJ</span><span>PIX à vista</span></div>
            <button className="primary-button" onClick={() => go('dados')}>Abrir inscrição · R$ 249</button>
          </section>
        </div>
      </main>
      {!open && <div className="mobile-cta"><span>R$ 249 · à vista no PIX</span><button className="primary-button" onClick={() => go('dados')}>Garantir minha vaga</button></div>}
      {open && <>
        <button className="overlay" onClick={close} aria-label="Fechar inscrição" />
        <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"
          onPointerDown={e => { pointerStart.current = e.clientY }}
          onPointerUp={e => { if (pointerStart.current !== null && e.clientY - pointerStart.current > 90) close(); pointerStart.current = null }}>
          <div className="drag-handle" aria-hidden="true" />
          <ClinicalHeader step={stage === 'dados' ? 1 : stage === 'pagamento' ? 2 : 3} />
          <button className="icon-button sheet-close" onClick={close} aria-label="Fechar"><X /></button>
          {stage === 'dados' && <DataStage data={data} errors={errors} knownStudent={knownStudent} update={update} blur={blur} submit={submitData} />}
          {stage === 'pagamento' && <PaymentStage payment={payment} copied={copied} timer={timer} seconds={seconds} copyPix={copyPix} setPayment={setPayment} regenerate={() => { setPayment('pendente'); setSeconds(1800) }} onPaid={() => go('confirmado')} />}
          {stage === 'confirmado' && <ConfirmationStage />}
        </section>
      </>}
    </>
  )
}

function DataStage({ data, errors, knownStudent, update, blur, submit }: {
  data: EnrollmentData; errors: Partial<Record<keyof EnrollmentData, string>>; knownStudent: boolean
  update: <K extends keyof EnrollmentData>(key: K, value: EnrollmentData[K]) => void; blur: (key: keyof EnrollmentData) => void; submit: () => void
}) {
  const focus = (e: React.FocusEvent<HTMLInputElement>) => {
    const input = e.currentTarget
    window.setTimeout(() => input.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250)
  }
  return <>
    <div className="sheet-scroll">
      <h2 id="sheet-title">Garantir minha vaga</h2>
      <p className="subtitle">Curso de Punção Venosa · 8h presenciais · Sede CVB-RJ</p>
      {knownStudent && <p className="notice">Já temos seu cadastro. Confira se está tudo certo.</p>}
      <div className="field-group">
        <Field label="Nome completo" error={errors.name}><input type="text" autoComplete="name" value={data.name} onChange={e => update('name', e.target.value)} onBlur={() => blur('name')} onFocus={focus} aria-invalid={!!errors.name} /></Field>
        <Field label="WhatsApp" error={errors.phone}><input type="tel" inputMode="numeric" autoComplete="tel" placeholder="(00) 00000-0000" value={data.phone} onChange={e => update('phone', maskPhone(e.target.value))} onBlur={() => blur('phone')} onFocus={focus} aria-invalid={!!errors.phone} /></Field>
        <Field label="CPF" error={errors.cpf}><input type="text" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" value={data.cpf} onChange={e => update('cpf', maskCpf(e.target.value))} onBlur={() => blur('cpf')} onFocus={focus} aria-invalid={!!errors.cpf} /></Field>
        <div className="field">
          <label className="checkbox-row"><input type="checkbox" checked={data.highSchool} onChange={e => update('highSchool', e.target.checked)} onBlur={() => blur('highSchool')} /><span>Concluí o Ensino Médio</span></label>
          <p className="help">Pré-requisito do curso. A conferência é feita na secretaria no dia da aula.</p>
          {errors.highSchool && <p className="error" role="alert">{errors.highSchool}</p>}
        </div>
      </div>
    </div>
    <footer className="sheet-footer"><div className="price-summary"><small>Total no PIX</small><strong>R$ 249</strong></div><button className="primary-button" onClick={submit}>Gerar meu PIX</button></footer>
  </>
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <div className="field"><label>{label}</label>{children}{error && <p className="error" role="alert">{error}</p>}</div>
}

function PaymentStage({ payment, copied, timer, seconds, copyPix, setPayment, regenerate, onPaid }: {
  payment: PaymentState; copied: boolean; timer: string; seconds: number; copyPix: () => void; setPayment: (s: PaymentState) => void; regenerate: () => void; onPaid: () => void
}) {
  useEffect(() => { if (payment === 'pago') onPaid() }, [payment, onPaid])
  return <div className="sheet-scroll">
    <h2 id="sheet-title">Pague com PIX</h2>
    <p className="payment-value">R$ 249,00</p><p className="receiver">Recebedor: Cruz Vermelha Brasileira — Filial RJ</p>
    {payment === 'expirado' ? <div className="state-message"><h3>Código expirado</h3><p>Este código não aceita mais pagamentos.</p><button className="primary-button full" onClick={regenerate}>Gerar novo código</button></div> : payment === 'duplicado' ? <div className="state-message"><h3>Este CPF já tem inscrição paga</h3><p>Você pode continuar de onde parou.</p><button className="primary-button full" onClick={() => location.assign('/triagem/1')}>Continuar meu cadastro</button></div> : <>
      <div className="payment-desktop-qr"><VisualQr /></div>
      <button className={`copy-button ${copied ? 'copied' : ''}`} onClick={copyPix}>{copied ? <><Check /> Código copiado</> : 'Copiar código PIX'}</button>
      {copied && <p className="copy-help">Agora abra o app do seu banco, escolha PIX Copia e Cola e conclua o pagamento.</p>}
      <code className="pix-code">{PIX_CODE}</code>
      <details className="qr-disclosure"><summary>Ver QR Code para pagar em outro aparelho</summary><div className="qr-wrap"><VisualQr /></div></details>
      <p className={`timer ${seconds <= 300 ? 'warning' : ''}`}>Este código expira em {timer}</p>
      <div className="payment-status"><span className="pulse" /><span>Aguardando confirmação do pagamento…</span></div>
    </>}
    <div className="dev-tools"><small>Controles de desenvolvimento</small><button onClick={() => setPayment('pago')}>Simular pagamento confirmado</button><button onClick={() => setPayment('expirado')}>Simular expirado</button><button onClick={() => setPayment('duplicado')}>Simular duplicado</button></div>
  </div>
}

function ConfirmationStage() {
  const router = useRouter()
  return <div className="sheet-scroll confirmation"><RedCross /><h2 id="sheet-title">Vaga garantida.</h2><p>Pagamento de R$ 249 confirmado. Falta só um passo.</p><p>Suas respostas definem a melhor data para a sua turma.</p><button className="primary-button full" onClick={() => router.push('/triagem/1')}>Responder 8 perguntas rápidas</button><button className="text-button" onClick={() => router.push('/minha-inscricao')}>Responder depois</button></div>
}
