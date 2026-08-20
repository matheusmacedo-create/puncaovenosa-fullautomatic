'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, CreditCard, Loader2, QrCode, X } from 'lucide-react'
import { ClinicalHeader, RedCross, VisualQr } from '@/components/clinical-header'
import { CardForm } from '@/components/card-form'
import { PriceBreakdown } from '@/components/price-breakdown'
import { SIMULACAO_ATIVA } from '@/lib/simulacao'
import {
  bandeiraDoCartao, DadosCartao, digits, EnrollmentData, fieldError, formatarBRL,
  loadJson, maskCpf, maskPhone, PagamentoMetodo, PRECO_CENTAVOS, saveJson, STORAGE_KEYS,
} from '@/lib/enrollment'
import {
  buscarCobranca, Cobranca, confirmarCobranca, consultarCpf, criarCobranca, encerrarCobranca,
  ErroDaApi, salvarInscricao,
} from '@/lib/api-cliente'

type Stage = 'dados' | 'pagamento' | 'confirmado'
type Cadastro = { primeiroNome: string; telefoneFinal: string; jaPaga: boolean }

const EMPTY: EnrollmentData = { name: '', phone: '', cpf: '', highSchool: false }
const INTERVALO_POLLING = 4000

export function EnrollmentFlow() {
  const search = useSearchParams()
  const router = useRouter()
  const stage = search.get('etapa') as Stage | null
  const open = !!stage
  const [data, setData] = useState<EnrollmentData>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof EnrollmentData, string>>>({})
  const [cadastro, setCadastro] = useState<Cadastro | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erroGeral, setErroGeral] = useState('')
  const [metodo, setMetodo] = useState<PagamentoMetodo>('pix')
  const [cobranca, setCobranca] = useState<Cobranca | null>(null)
  const [copied, setCopied] = useState(false)
  const [agora, setAgora] = useState(0)
  const pointerStart = useRef<number | null>(null)

  useEffect(() => setData(loadJson(STORAGE_KEYS.enrollment, EMPTY)), [])
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Relógio local, usado para o contador de expiração do PIX.
  useEffect(() => {
    setAgora(Date.now())
    const id = window.setInterval(() => setAgora(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const go = useCallback((next: Stage) => router.push(`/?etapa=${next}`), [router])
  const close = () => router.push('/')

  const update = <K extends keyof EnrollmentData>(key: K, value: EnrollmentData[K]) => {
    const next = { ...data, [key]: value }
    setData(next); saveJson(STORAGE_KEYS.enrollment, next)
  }

  const blur = async (key: keyof EnrollmentData) => {
    const message = fieldError(key, data)
    setErrors(e => ({ ...e, [key]: message }))
    if (key !== 'cpf' || message) return
    try {
      const achado = await consultarCpf(digits(data.cpf))
      setCadastro(achado.existe
        ? { primeiroNome: achado.primeiroNome ?? '', telefoneFinal: achado.telefoneFinal ?? '', jaPaga: !!achado.jaPaga }
        : null)
    } catch { setCadastro(null) }
  }

  const submitData = async () => {
    const nextErrors = Object.fromEntries(
      (Object.keys(data) as (keyof EnrollmentData)[]).map(k => [k, fieldError(k, data)]),
    )
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) return
    setEnviando(true); setErroGeral('')
    try {
      const salva = await salvarInscricao(data)
      if (salva.jaPaga) { go('confirmado'); return }
      go('pagamento')
    } catch (e) {
      setErroGeral(e instanceof ErroDaApi ? e.message : 'Não foi possível salvar. Tente novamente.')
    } finally { setEnviando(false) }
  }

  // Ao entrar na etapa de pagamento, recupera a cobrança aberta — ou cria uma.
  useEffect(() => {
    if (stage !== 'pagamento') return
    let cancelado = false
    ;(async () => {
      try {
        const atual = await buscarCobranca()
        if (cancelado) return
        if (atual.existe && atual.status === 'pendente') { setCobranca(atual); setMetodo(atual.metodo); return }
        if (atual.existe && atual.status === 'confirmado') { go('confirmado'); return }
        const nova = await criarCobranca({ metodo: 'pix' })
        if (!cancelado) setCobranca(nova)
      } catch (e) {
        if (!cancelado) setErroGeral(e instanceof ErroDaApi ? e.message : 'Não foi possível abrir a cobrança.')
      }
    })()
    return () => { cancelado = true }
  }, [stage, go])

  // Enquanto a cobrança está pendente, pergunta ao servidor se o dinheiro caiu.
  useEffect(() => {
    if (stage !== 'pagamento' || !cobranca || cobranca.status !== 'pendente') return
    const id = window.setInterval(async () => {
      try {
        const atual = await buscarCobranca()
        if (!atual.existe) return
        if (atual.status === 'confirmado') { go('confirmado'); return }
        if (atual.status !== cobranca.status) setCobranca(atual)
      } catch { /* rede instável: a próxima rodada tenta de novo */ }
    }, INTERVALO_POLLING)
    return () => window.clearInterval(id)
  }, [stage, cobranca, go])

  const expiraEm = cobranca ? new Date(cobranca.criadoEm).getTime() + cobranca.minutosParaExpirar * 60_000 : 0
  const restante = cobranca && agora ? Math.max(0, Math.floor((expiraEm - agora) / 1000)) : null

  // Estourou o prazo: encerra a cobrança no servidor uma única vez.
  const expirando = useRef(false)
  useEffect(() => {
    if (!cobranca || cobranca.metodo !== 'pix' || cobranca.status !== 'pendente') return
    if (restante === null || restante > 0 || expirando.current) return
    expirando.current = true
    encerrarCobranca(cobranca.id, 'expirado')
      .then(() => setCobranca(c => c && { ...c, status: 'expirado' }))
      .catch(() => undefined)
      .finally(() => { expirando.current = false })
  }, [cobranca, restante])

  const trocarMetodo = async (novo: PagamentoMetodo) => {
    if (novo === metodo) return
    setMetodo(novo); setErroGeral(''); setCobranca(null)
    try { setCobranca(await criarCobranca({ metodo: novo })) }
    catch (e) { setErroGeral(e instanceof ErroDaApi ? e.message : 'Não foi possível trocar o meio de pagamento.') }
  }

  const gerarNovoCodigo = async () => {
    setErroGeral(''); setCobranca(null)
    try { setCobranca(await criarCobranca({ metodo })) }
    catch (e) { setErroGeral(e instanceof ErroDaApi ? e.message : 'Não foi possível gerar novo código.') }
  }

  const copyPix = async () => {
    if (!cobranca?.pixCopiaCola) return
    try { await navigator.clipboard.writeText(cobranca.pixCopiaCola) } catch { /* sem clipboard no preview */ }
    navigator.vibrate?.(35); setCopied(true); window.setTimeout(() => setCopied(false), 2000)
  }

  /**
   * [INTEGRAÇÃO] Cobrança no cartão.
   *
   * O número do cartão NÃO sai daqui. Quando a Único entrar, o SDK dela
   * tokeniza os dados no navegador e devolve um token; só ele, a bandeira e
   * os últimos 4 dígitos seguem para a nossa API.
   */
  const pagarComCartao = async (cartao: DadosCartao) => {
    setEnviando(true); setErroGeral('')
    try {
      const nova = await criarCobranca({
        metodo: 'cartao',
        parcelas: cartao.parcelas,
        bandeira: bandeiraDoCartao(cartao.numero),
        ultimos4: digits(cartao.numero).slice(-4),
        token: 'token-simulado-ate-a-integracao',
      })
      setCobranca(nova)
    } catch (e) {
      setErroGeral(e instanceof ErroDaApi ? e.message : 'Não foi possível processar o cartão.')
    } finally { setEnviando(false) }
  }

  const simular = async (desfecho: 'pago' | 'expirado' | 'recusado') => {
    if (!cobranca) return
    try {
      if (desfecho === 'pago') { await confirmarCobranca(cobranca.id); go('confirmado'); return }
      await encerrarCobranca(cobranca.id, desfecho, desfecho === 'recusado' ? 'Simulação de recusa' : undefined)
      setCobranca(c => c && { ...c, status: desfecho })
    } catch (e) { setErroGeral(e instanceof ErroDaApi ? e.message : 'Falha na simulação.') }
  }

  return (
    <>
      <main className="launcher">
        <div className="launcher-top" />
        <div className="launcher-main">
          <section className="launcher-card" aria-labelledby="course-title">
            <p className="eyebrow">Cruz Vermelha Brasileira · RJ</p>
            <h1 id="course-title">Fluxo de inscrição</h1>
            <p className="lede">Ambiente de demonstração do checkout e da triagem do Curso de Punção Venosa. Pronto para ser ligado ao CTA da página de vendas.</p>
            <div className="course-meta"><span>8h presenciais</span><span>Sede CVB-RJ</span><span>PIX ou cartão</span></div>
            <button className="primary-button" onClick={() => go('dados')}>Abrir inscrição · {formatarBRL(PRECO_CENTAVOS)}</button>
          </section>
        </div>
      </main>
      {!open && <div className="mobile-cta"><span>{formatarBRL(PRECO_CENTAVOS)} · PIX ou cartão</span><button className="primary-button" onClick={() => go('dados')}>Garantir minha vaga</button></div>}
      {open && <>
        <button className="overlay" onClick={close} aria-label="Fechar inscrição" />
        <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"
          onPointerDown={e => { pointerStart.current = e.clientY }}
          onPointerUp={e => { if (pointerStart.current !== null && e.clientY - pointerStart.current > 90) close(); pointerStart.current = null }}>
          <div className="drag-handle" aria-hidden="true" />
          <ClinicalHeader step={stage === 'dados' ? 1 : stage === 'pagamento' ? 2 : 3} />
          <button className="icon-button sheet-close" onClick={close} aria-label="Fechar"><X /></button>
          {stage === 'dados' && <DataStage data={data} errors={errors} cadastro={cadastro} enviando={enviando} erroGeral={erroGeral} update={update} blur={blur} submit={submitData} />}
          {stage === 'pagamento' && <PaymentStage
            metodo={metodo} cobranca={cobranca} copied={copied} restante={restante} enviando={enviando} erroGeral={erroGeral}
            trocarMetodo={trocarMetodo} copyPix={copyPix} gerarNovoCodigo={gerarNovoCodigo} pagarComCartao={pagarComCartao} simular={simular} />}
          {stage === 'confirmado' && <ConfirmationStage />}
        </section>
      </>}
    </>
  )
}

function DataStage({ data, errors, cadastro, enviando, erroGeral, update, blur, submit }: {
  data: EnrollmentData; errors: Partial<Record<keyof EnrollmentData, string>>; cadastro: Cadastro | null
  enviando: boolean; erroGeral: string
  update: <K extends keyof EnrollmentData>(key: K, value: EnrollmentData[K]) => void
  blur: (key: keyof EnrollmentData) => void; submit: () => void
}) {
  const focus = (e: React.FocusEvent<HTMLInputElement>) => {
    const input = e.currentTarget
    window.setTimeout(() => input.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250)
  }
  return <>
    <div className="sheet-scroll">
      <h2 id="sheet-title">Garantir minha vaga</h2>
      <p className="subtitle">Curso de Punção Venosa · 8h presenciais · Sede CVB-RJ</p>
      {cadastro && <p className="notice">Já temos seu cadastro, {cadastro.primeiroNome}. {cadastro.jaPaga ? 'Sua inscrição está paga — vamos direto para a triagem.' : `Confirme seus dados para continuar. WhatsApp terminado em ${cadastro.telefoneFinal}.`}</p>}
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
      <PriceBreakdown />
      {erroGeral && <p className="error" role="alert">{erroGeral}</p>}
    </div>
    <footer className="sheet-footer">
      <div className="price-summary"><small>Total à vista</small><strong>{formatarBRL(PRECO_CENTAVOS)}</strong></div>
      <button className="primary-button" onClick={submit} disabled={enviando}>{enviando ? <><Loader2 className="spin" /> Salvando…</> : 'Ir para o pagamento'}</button>
    </footer>
  </>
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <div className="field"><label>{label}</label>{children}{error && <p className="error" role="alert">{error}</p>}</div>
}

function PaymentStage({ metodo, cobranca, copied, restante, enviando, erroGeral, trocarMetodo, copyPix, gerarNovoCodigo, pagarComCartao, simular }: {
  metodo: PagamentoMetodo; cobranca: Cobranca | null; copied: boolean; restante: number | null
  enviando: boolean; erroGeral: string
  trocarMetodo: (m: PagamentoMetodo) => void; copyPix: () => void; gerarNovoCodigo: () => void
  pagarComCartao: (c: DadosCartao) => void; simular: (d: 'pago' | 'expirado' | 'recusado') => void
}) {
  const timer = restante === null ? '--:--'
    : `${String(Math.floor(restante / 60)).padStart(2, '0')}:${String(restante % 60).padStart(2, '0')}`

  return <div className="sheet-scroll">
    <h2 id="sheet-title">Pagamento</h2>
    <p className="payment-value">{formatarBRL(PRECO_CENTAVOS)}</p>
    <p className="receiver">Recebedor: Cruz Vermelha Brasileira — Filial RJ</p>
    <PriceBreakdown itens={cobranca?.itens ?? undefined} total={cobranca?.valorCentavos} />

    <div className="method-tabs" role="tablist" aria-label="Meio de pagamento">
      <button role="tab" aria-selected={metodo === 'pix'} className={`method-tab ${metodo === 'pix' ? 'selected' : ''}`} onClick={() => trocarMetodo('pix')}><QrCode /> PIX</button>
      <button role="tab" aria-selected={metodo === 'cartao'} className={`method-tab ${metodo === 'cartao' ? 'selected' : ''}`} onClick={() => trocarMetodo('cartao')}><CreditCard /> Cartão</button>
    </div>

    {erroGeral && <p className="error" role="alert">{erroGeral}</p>}
    {!cobranca && !erroGeral && <p className="payment-status"><Loader2 className="spin" /><span>Preparando o pagamento…</span></p>}

    {cobranca?.status === 'expirado' ? <div className="state-message"><h3>Código expirado</h3><p>Este código não aceita mais pagamentos.</p><button className="primary-button full" onClick={gerarNovoCodigo}>Gerar novo código</button></div>
      : cobranca?.status === 'recusado' ? <div className="state-message"><h3>Pagamento recusado</h3><p>{cobranca.recusaMotivo || 'O banco emissor não autorizou a cobrança.'}</p><button className="primary-button full" onClick={gerarNovoCodigo}>Tentar de novo</button></div>
      : cobranca && metodo === 'pix' ? <>
        <div className="payment-desktop-qr"><VisualQr /></div>
        <button className={`copy-button ${copied ? 'copied' : ''}`} onClick={copyPix}>{copied ? <><Check /> Código copiado</> : 'Copiar código PIX'}</button>
        {copied && <p className="copy-help">Agora abra o app do seu banco, escolha PIX Copia e Cola e conclua o pagamento.</p>}
        <code className="pix-code">{cobranca.pixCopiaCola}</code>
        <details className="qr-disclosure"><summary>Ver QR Code para pagar em outro aparelho</summary><div className="qr-wrap"><VisualQr /></div></details>
        <p className={`timer ${restante !== null && restante <= 300 ? 'warning' : ''}`}>Este código expira em {timer}</p>
        <div className="payment-status"><span className="pulse" /><span>Aguardando confirmação do pagamento…</span></div>
      </>
      : cobranca && metodo === 'cartao' ? <CardForm enviando={enviando} onSubmit={pagarComCartao} />
      : null}

    {cobranca && SIMULACAO_ATIVA && <div className="dev-tools">
      <small>Simulação · não use em produção</small>
      <button onClick={() => simular('pago')}>Simular pagamento confirmado</button>
      <button onClick={() => simular('expirado')}>Simular expirado</button>
      <button onClick={() => simular('recusado')}>Simular recusado</button>
    </div>}
  </div>
}

function ConfirmationStage() {
  const router = useRouter()
  return <div className="sheet-scroll confirmation"><RedCross /><h2 id="sheet-title">Vaga garantida.</h2><p>Pagamento de {formatarBRL(PRECO_CENTAVOS)} confirmado. Falta só um passo.</p><p>Suas respostas definem a melhor data para a sua turma.</p><button className="primary-button full" onClick={() => router.push('/triagem/1')}>Responder 8 perguntas rápidas</button><button className="text-button" onClick={() => router.push('/minha-inscricao')}>Responder depois</button></div>
}
