'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, CreditCard, Loader2, QrCode, X } from 'lucide-react'
import { ClinicalHeader, RedCross } from '@/components/clinical-header'
import { CodigoQr } from '@/components/qr-code'
import { CardForm } from '@/components/card-form'
import { PriceBreakdown } from '@/components/price-breakdown'
import { atribuicaoAtual } from '@/lib/checkout'
import { courseData } from '@/lib/course-data'
import {
  CARTAO_VAZIO, DadosCartao, digits, EnrollmentData, fieldError, formatarBRL,
  loadJson, maskCpf, maskPhone, MENSAGEM_FECHAR_CHECKOUT, PagamentoMetodo, PRECO_CENTAVOS,
  ROTA_INSCRICAO, saveJson, STORAGE_KEYS,
} from '@/lib/enrollment'
import {
  buscarCobranca, Cobranca, confirmarCobranca, consultarCpf, criarCobranca, encerrarCobranca,
  ErroDaApi, salvarInscricao,
} from '@/lib/api-cliente'
import { rastrear } from '@/lib/rastreio'

type Stage = 'dados' | 'pagamento' | 'confirmado'
type Cadastro = { primeiroNome: string; telefoneFinal: string; jaPaga: boolean }

const EMPTY: EnrollmentData = { name: '', phone: '', cpf: '', email: '', highSchool: false }
// 10s: cada consulta pode bater na API da Únicopag, então não convém
// encurtar sem necessidade.
const INTERVALO_POLLING = 10_000

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
  // Fica aqui, e não dentro do CardForm, para sobreviver a um clique fora da
  // folha. Só em memória: dado de cartão nunca é gravado.
  const [cartao, setCartao] = useState<DadosCartao>(CARTAO_VAZIO)
  const [agora, setAgora] = useState(0)
  const pointerStart = useRef<number | null>(null)
  // Cobrança pedida no envio do cadastro, antes da tela de pagamento montar
  // — a resposta da Únicopag corre em paralelo com a transição.
  const cobrancaPrefetch = useRef<Promise<Cobranca> | null>(null)

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

  /**
   * Troca de etapa preservando o resto da URL.
   *
   * Reescrever para `?etapa=X` puro apagava as UTMs: quem entra direto em
   * `/inscricao` pelo anúncio (sem `etapa` na URL) e clica em "Abrir
   * inscrição" chegava ao cadastro sem campanha nenhuma, e a venda ficava sem
   * origem. A variante sobrevivia por estar em cookie; a campanha só existe
   * na URL.
   */
  const go = useCallback((next: Stage) => {
    const params = new URLSearchParams(search.toString())
    params.set('etapa', next)
    router.push(`${ROTA_INSCRICAO}?${params}`)
  }, [router, search])

  /**
   * Etapa 5: dinheiro confirmado. O `id` da cobrança vira `eventID` do Meta,
   * que descarta a repetição mesmo vinda de outra aba ou de outro
   * dispositivo — a tela de pagamento é consultada em intervalos e pode
   * chegar aqui mais de uma vez para a mesma venda.
   *
   * `valorCentavos` é sempre o valor gravado na cobrança, nunca uma
   * constante do build — é o número que a Únicopag de fato cobrou.
   */
  const registrarVenda = useCallback((pagamentoId: string, valorCentavos: number) => {
    rastrear('pago', { id: pagamentoId, valorCentavos, umaVezSo: true })
  }, [])

  // Aberto pela gaveta da landing, fechar é fechar a gaveta — quem navega é
  // a página de fora. Aberto direto em `/inscricao`, volta para a landing.
  const close = () => {
    if (window.self !== window.top) {
      window.parent.postMessage(MENSAGEM_FECHAR_CHECKOUT, window.location.origin)
      return
    }
    router.push('/')
  }

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
      // A variante e a campanha só existem no navegador (URL e cookie), e este
      // é o último momento em que dá para lê-las: da etapa de pagamento em
      // diante nada mais grava na inscrição.
      const salva = await salvarInscricao(data, atribuicaoAtual())
      // Etapa 3: nome, CPF e e-mail entregues. É o Lead do funil — daqui a
      // secretaria já consegue falar com a pessoa, tenha ela pago ou não.
      rastrear('dados', { id: salva.id, umaVezSo: true })
      if (salva.jaPaga) { go('confirmado'); return }
      // A cobrança começa aqui, não quando a tela de pagamento monta: a
      // resposta da Únicopag é a espera dominante do checkout, e assim ela
      // corre em paralelo com a transição. Sem risco de duplicar — o servidor
      // reaproveita cobrança PIX aberta. O catch vazio só evita rejeição sem
      // dono se a pessoa fechar antes; o erro de verdade é tratado por quem
      // consome o prefetch.
      cobrancaPrefetch.current = criarCobranca({ metodo: 'pix' })
      cobrancaPrefetch.current.catch(() => undefined)
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
        // Veio do cadastro nesta mesma visita: a cobrança já está sendo
        // criada desde o clique — só falta a resposta chegar. A consulta de
        // cobrança existente fica para quem entra na etapa sem prefetch
        // (recarregou a página ou voltou outro dia).
        const prefetch = cobrancaPrefetch.current
        if (prefetch) {
          cobrancaPrefetch.current = null
          const nova = await prefetch
          if (cancelado) return
          setCobranca(nova); setMetodo(nova.metodo)
          rastrear('pagamento', { dados: { metodo: nova.metodo }, id: nova.id, valorCentavos: nova.valorCentavos, umaVezSo: true })
          return
        }
        const atual = await buscarCobranca()
        if (cancelado) return
        if (atual.existe && atual.status === 'pendente') {
          setCobranca(atual); setMetodo(atual.metodo)
          rastrear('pagamento', { dados: { metodo: atual.metodo }, id: atual.id, valorCentavos: atual.valorCentavos, umaVezSo: true })
          return
        }
        if (atual.existe && atual.status === 'confirmado') { registrarVenda(atual.id, atual.valorCentavos); go('confirmado'); return }
        const nova = await criarCobranca({ metodo: 'pix' })
        if (cancelado) return
        setCobranca(nova)
        // Etapa 4: existe uma cobrança de verdade esperando pagamento. Só
        // aqui, e não ao abrir a tela, porque sem cobrança não há o que pagar.
        rastrear('pagamento', { dados: { metodo: nova.metodo }, id: nova.id, valorCentavos: nova.valorCentavos, umaVezSo: true })
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
        if (atual.status === 'confirmado') { registrarVenda(atual.id, atual.valorCentavos); go('confirmado'); return }
        if (atual.status !== cobranca.status) setCobranca(atual)
      } catch { /* rede instável: a próxima rodada tenta de novo */ }
    }, INTERVALO_POLLING)
    return () => window.clearInterval(id)
  }, [stage, cobranca, go])

  const expiraEm = cobranca ? new Date(cobranca.criadoEm).getTime() + cobranca.minutosParaExpirar * 60_000 : 0
  const restante = cobranca && agora ? Math.max(0, Math.floor((expiraEm - agora) / 1000)) : null

  // Estourou o prazo: encerra a cobrança no servidor uma única vez.
  //
  // Só na simulação. Com cobrança real, quem define a validade é o provedor
  // — a Únicopag mantém o PIX pagável por 24 horas. Encerrar aqui aos 30
  // minutos marcaria como expirada uma cobrança que o aluno ainda vai pagar.
  const expirando = useRef(false)
  useEffect(() => {
    if (!cobranca || cobranca.metodo !== 'pix' || cobranca.status !== 'pendente') return
    if (!cobranca.simulacao) return
    if (restante === null || restante > 0 || expirando.current) return
    expirando.current = true
    encerrarCobranca(cobranca.id, 'expirado')
      .then(() => setCobranca(c => c && { ...c, status: 'expirado' }))
      .catch(() => undefined)
      .finally(() => { expirando.current = false })
  }, [cobranca, restante])

  /**
   * A cobrança no cartão só nasce quando o formulário é enviado.
   *
   * Criar ao trocar de aba quebrava o cartão inteiro: a API do provedor
   * exige os dados do cartão na criação, e nesse momento eles ainda não
   * foram digitados — a resposta era 422 e o formulário nunca aparecia.
   */
  const trocarMetodo = async (novo: PagamentoMetodo) => {
    if (novo === metodo) return
    setMetodo(novo); setErroGeral('')
    if (novo === 'cartao') return
    // Voltando ao PIX: reaproveita a cobrança pendente, se ainda houver.
    if (cobranca?.metodo === 'pix' && cobranca.status === 'pendente') return
    setCobranca(null)
    try { setCobranca(await criarCobranca({ metodo: 'pix' })) }
    catch (e) { setErroGeral(e instanceof ErroDaApi ? e.message : 'Não foi possível abrir a cobrança.') }
  }

  const gerarNovoCodigo = async () => {
    setErroGeral(''); setCobranca(null)
    // No cartão, "tentar de novo" é voltar ao formulário — sem os dados não
    // há o que recriar.
    if (metodo === 'cartao') return
    try { setCobranca(await criarCobranca({ metodo: 'pix' })) }
    catch (e) { setErroGeral(e instanceof ErroDaApi ? e.message : 'Não foi possível gerar novo código.') }
  }

  /** Confirma a cobrança e leva para a etapa seguinte. */
  const aprovar = useCallback(async (pagamentoId: string, valorCentavos: number) => {
    try { await confirmarCobranca(pagamentoId); registrarVenda(pagamentoId, valorCentavos); go('confirmado') }
    catch (e) { setErroGeral(e instanceof ErroDaApi ? e.message : 'Não foi possível confirmar o pagamento.') }
  }, [go])

  const copyPix = async () => {
    if (!cobranca?.pixCopiaCola) return
    try { await navigator.clipboard.writeText(cobranca.pixCopiaCola) } catch { /* sem clipboard no preview */ }
    navigator.vibrate?.(35); setCopied(true); window.setTimeout(() => setCopied(false), 2000)
    // [SIMULAÇÃO] Sem provedor, copiar o código é o gatilho de "já paguei".
    // A pausa existe só para o aluno ver o aviso de copiado antes da troca de tela.
    if (cobranca.simulacao) window.setTimeout(() => aprovar(cobranca.id, cobranca.valorCentavos), 1200)
  }

  /**
   * Cobrança no cartão.
   *
   * A API da Únicopag recebe o número em claro, então ele vai daqui para a
   * nossa rota e de lá para o provedor. Não é gravado em lugar nenhum: fica
   * apenas neste estado em memória, que some ao recarregar a página.
   */
  const pagarComCartao = async (cartao: DadosCartao) => {
    setEnviando(true); setErroGeral('')
    try {
      const nova = await criarCobranca({
        metodo: 'cartao',
        parcelas: cartao.parcelas,
        cartao: {
          numero: digits(cartao.numero),
          nome: cartao.nome.trim(),
          validade: cartao.validade,
          cvv: cartao.cvv,
        },
      })
      setCobranca(nova)
      // O cartão costuma ter desfecho imediato. Sem isto, uma cobrança
      // aprovada de verdade ficava parada na tela de pagamento.
      if (nova.status === 'confirmado') { registrarVenda(nova.id, nova.valorCentavos); go('confirmado'); return }
      if (nova.simulacao) await aprovar(nova.id, nova.valorCentavos)
    } catch (e) {
      setErroGeral(e instanceof ErroDaApi ? e.message : 'Não foi possível processar o cartão.')
    } finally { setEnviando(false) }
  }

  const simular = async (desfecho: 'pago' | 'expirado' | 'recusado') => {
    if (!cobranca) return
    try {
      if (desfecho === 'pago') { await aprovar(cobranca.id, cobranca.valorCentavos); return }
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
            cartao={cartao} setCartao={setCartao}
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
        <Field id="dados-nome" label="Nome completo" error={errors.name}><input id="dados-nome" type="text" autoComplete="name" value={data.name} onChange={e => update('name', e.target.value)} onBlur={() => blur('name')} onFocus={focus} aria-invalid={!!errors.name} /></Field>
        <Field id="dados-telefone" label="WhatsApp" error={errors.phone}><input id="dados-telefone" type="tel" inputMode="numeric" autoComplete="tel" placeholder="(00) 00000-0000" value={data.phone} onChange={e => update('phone', maskPhone(e.target.value))} onBlur={() => blur('phone')} onFocus={focus} aria-invalid={!!errors.phone} /></Field>
        <Field id="dados-email" label="E-mail" error={errors.email}><input id="dados-email" type="email" inputMode="email" autoComplete="email" placeholder="voce@exemplo.com" value={data.email} onChange={e => update('email', e.target.value)} onBlur={() => blur('email')} onFocus={focus} aria-invalid={!!errors.email} /></Field>
        <Field id="dados-cpf" label="CPF" error={errors.cpf}><input id="dados-cpf" type="text" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" value={data.cpf} onChange={e => update('cpf', maskCpf(e.target.value))} onBlur={() => blur('cpf')} onFocus={focus} aria-invalid={!!errors.cpf} /></Field>
        <div className="field">
          <label className="checkbox-row"><input type="checkbox" checked={data.highSchool} onChange={e => update('highSchool', e.target.checked)} onBlur={() => blur('highSchool')} /><span>Concluí o Ensino Médio</span></label>
          <p className="help">Pré-requisito do curso. A conferência é feita na secretaria no dia da aula.</p>
          {errors.highSchool && <p className="error" role="alert">{errors.highSchool}</p>}
        </div>
      </div>
      <PriceBreakdown />
      <LegalNote />
      {erroGeral && <p className="error" role="alert">{erroGeral}</p>}
    </div>
    <footer className="sheet-footer">
      <div className="price-summary"><small>Total à vista</small><strong>{formatarBRL(PRECO_CENTAVOS)}</strong></div>
      <button className="primary-button" onClick={submit} disabled={enviando}>{enviando ? <><Loader2 className="spin" /> Salvando…</> : 'Ir para o pagamento'}</button>
    </footer>
  </>
}

/**
 * `htmlFor` + `id` ligam o rótulo ao campo. Sem isso o leitor de tela anuncia
 * "campo de edição" sem dizer qual, e tocar no rótulo não foca o campo.
 */
function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return <div className="field"><label htmlFor={id}>{label}</label>{children}{error && <p className="error" role="alert">{error}</p>}</div>
}

/** Aviso de privacidade e reembolso exibido antes de qualquer cobrança. */
function LegalNote() {
  return <p className="legal-note">
    Ao continuar, você concorda com nossa{' '}
    {courseData.privacyPolicyUrl && <a href={courseData.privacyPolicyUrl} target="_blank" rel="noopener noreferrer">Política de Privacidade</a>}
    {courseData.privacyPolicyUrl && courseData.refundPolicyUrl && ' e a '}
    {courseData.refundPolicyUrl && <a href={courseData.refundPolicyUrl} target="_blank" rel="noopener noreferrer">Política de Cancelamento e Reembolso</a>}
    .
  </p>
}

function PaymentStage({ metodo, cobranca, copied, restante, enviando, erroGeral, cartao, setCartao, trocarMetodo, copyPix, gerarNovoCodigo, pagarComCartao, simular }: {
  metodo: PagamentoMetodo; cobranca: Cobranca | null; copied: boolean; restante: number | null
  enviando: boolean; erroGeral: string
  cartao: DadosCartao; setCartao: (atualizar: (anterior: DadosCartao) => DadosCartao) => void
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
    <LegalNote />

    <div className="method-tabs" role="tablist" aria-label="Meio de pagamento">
      <button role="tab" aria-selected={metodo === 'pix'} className={`method-tab ${metodo === 'pix' ? 'selected' : ''}`} onClick={() => trocarMetodo('pix')}><QrCode /> PIX</button>
      <button role="tab" aria-selected={metodo === 'cartao'} className={`method-tab ${metodo === 'cartao' ? 'selected' : ''}`} onClick={() => trocarMetodo('cartao')}><CreditCard /> Cartão</button>
    </div>

    {cobranca?.simulacao
      ? <p className="simulation-banner" role="status">Modo de teste — o pagamento é aprovado automaticamente e nenhuma cobrança é feita.</p>
      : cobranca?.confirmacaoManual
        ? <p className="simulation-banner" role="status">Cobrança real, com conferência manual liberada para teste. Remova a variável antes de receber aluno.</p>
        : null}
    {erroGeral && <p className="error" role="alert">{erroGeral}</p>}
    {/* Segura o aluno enquanto a Únicopag responde: sem isto a tela fica muda por alguns segundos, exatamente no momento em que o lead decide se espera ou fecha. */}
    {!cobranca && !erroGeral && metodo === 'pix' && <div className="state-message pix-gerando" role="status"><Loader2 className="spin" /><h3>Gerando seu código PIX…</h3><p>Leva só alguns segundos. Não feche esta tela — o código aparece aqui e você paga direto no app do seu banco.</p></div>}

    {cobranca?.status === 'expirado' && cobranca.metodo === metodo ? <div className="state-message"><h3>Código expirado</h3><p>Este código não aceita mais pagamentos.</p><button className="primary-button full" onClick={gerarNovoCodigo}>Gerar novo código</button></div>
      : cobranca?.status === 'recusado' && cobranca.metodo === metodo ? <div className="state-message"><h3>Pagamento recusado</h3><p>{cobranca.recusaMotivo || 'O banco emissor não autorizou a cobrança.'}</p><button className="primary-button full" onClick={gerarNovoCodigo}>Tentar de novo</button></div>
      : cobranca && metodo === 'pix' ? <>
        <div className="payment-desktop-qr"><CodigoQr conteudo={cobranca.pixCopiaCola} descricao="QR Code para pagar o PIX" /></div>
        <button className={`copy-button ${copied ? 'copied' : ''}`} onClick={copyPix}>{copied ? <><Check /> Código copiado</> : 'Copiar código PIX'}</button>
        {copied && <p className="copy-help">{cobranca.simulacao ? 'Modo de teste — seguindo para a próxima etapa…' : 'Agora abra o app do seu banco, escolha PIX Copia e Cola e conclua o pagamento.'}</p>}
        <code className="pix-code">{cobranca.pixCopiaCola}</code>
        <details className="qr-disclosure"><summary>Ver QR Code ampliado</summary><div className="qr-wrap"><CodigoQr conteudo={cobranca.pixCopiaCola} descricao="QR Code para pagar o PIX" lado={280} /></div></details>
        {cobranca.simulacao
          ? <p className={`timer ${restante !== null && restante <= 300 ? 'warning' : ''}`}>Este código expira em {timer}</p>
          : <p className="timer">Este código vale por 24 horas. Você pode pagar agora ou mais tarde.</p>}
        <div className="payment-status"><span className="pulse" /><span>Aguardando confirmação do pagamento…</span></div>
      </>
      : metodo === 'cartao' ? <CardForm enviando={enviando} cartao={cartao} setCartao={setCartao} onSubmit={pagarComCartao} />
      : null}

    {cobranca?.confirmacaoManual && <div className="dev-tools">
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
