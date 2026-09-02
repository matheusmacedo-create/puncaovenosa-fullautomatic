'use client'

import { useState } from 'react'
import { CreditCard, Loader2, Lock } from 'lucide-react'
import {
  bandeiraDoCartao, cardFieldError, CARTAO_VAZIO, DadosCartao, digits, formatarBRL,
  maskCardNumber, maskValidade, parcelasDisponiveis, PRECO_MATRICULA_CENTAVOS,
} from '@/lib/enrollment'

const NOMES_DE_BANDEIRA: Record<string, string> = {
  visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', elo: 'Elo', hipercard: 'Hipercard',
}

/**
 * Formulário de cartão.
 *
 * [INTEGRAÇÃO] Os dados digitados aqui não são enviados para a nossa API.
 * Quando a Único entrar, é neste componente que o SDK dela tokeniza o
 * cartão no próprio navegador; `onSubmit` passa a receber o token, e o
 * número completo nunca sai do dispositivo do aluno.
 *
 * O estado do cartão vive no componente PAI, e não aqui: fechar a folha sem
 * querer desmonta este formulário, e um estado local seria perdido junto com
 * tudo o que o aluno digitou. Continua só em memória — nunca em
 * localStorage, que é exatamente o que a PCI-DSS proíbe.
 */
export function CardForm({ enviando, cartao, setCartao, onSubmit, valorCentavos = PRECO_MATRICULA_CENTAVOS }: {
  enviando: boolean
  cartao: DadosCartao
  setCartao: (atualizar: (anterior: DadosCartao) => DadosCartao) => void
  onSubmit: (dados: DadosCartao) => void
  /** Quanto esta cobrança vai levar — matrícula ou saldo do curso. */
  valorCentavos?: number
}) {
  const [erros, setErros] = useState<Partial<Record<keyof DadosCartao, string>>>({})
  const bandeira = bandeiraDoCartao(cartao.numero)
  const parcelas = parcelasDisponiveis(valorCentavos)

  const mudar = <K extends keyof DadosCartao>(campo: K, valor: DadosCartao[K]) => {
    setCartao(c => ({ ...c, [campo]: valor }))
    setErros(e => ({ ...e, [campo]: '' }))
  }
  const validar = (campo: keyof DadosCartao) =>
    setErros(e => ({ ...e, [campo]: cardFieldError(campo, cartao) }))

  const enviar = () => {
    const campos = ['numero', 'nome', 'validade', 'cvv'] as const
    const novos = Object.fromEntries(campos.map(c => [c, cardFieldError(c, cartao)]))
    setErros(novos)
    if (Object.values(novos).every(v => !v)) onSubmit(cartao)
  }

  const cvvEsperado = bandeira === 'amex' ? 4 : 3
  const escolhida = parcelas.find(p => p.numero === cartao.parcelas) ?? parcelas[0]

  return <div className="card-form">
    <div className="field">
      <label htmlFor="card-numero">Número do cartão</label>
      <div className="input-with-badge">
        <input id="card-numero" type="text" inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000"
          value={cartao.numero} onChange={e => mudar('numero', maskCardNumber(e.target.value))} onBlur={() => validar('numero')} aria-invalid={!!erros.numero} />
        <span className="card-brand" aria-live="polite">{bandeira ? NOMES_DE_BANDEIRA[bandeira] : <CreditCard aria-hidden="true" />}</span>
      </div>
      {erros.numero && <p className="error" role="alert">{erros.numero}</p>}
    </div>

    <div className="field">
      <label htmlFor="card-nome">Nome impresso no cartão</label>
      <input id="card-nome" type="text" autoComplete="cc-name" placeholder="Como aparece no cartão"
        value={cartao.nome} onChange={e => mudar('nome', e.target.value.toUpperCase())} onBlur={() => validar('nome')} aria-invalid={!!erros.nome} />
      {erros.nome && <p className="error" role="alert">{erros.nome}</p>}
    </div>

    <div className="field-row">
      <div className="field">
        <label htmlFor="card-validade">Validade</label>
        <input id="card-validade" type="text" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA"
          value={cartao.validade} onChange={e => mudar('validade', maskValidade(e.target.value))} onBlur={() => validar('validade')} aria-invalid={!!erros.validade} />
        {erros.validade && <p className="error" role="alert">{erros.validade}</p>}
      </div>
      <div className="field">
        <label htmlFor="card-cvv">Código de segurança</label>
        <input id="card-cvv" type="text" inputMode="numeric" autoComplete="cc-csc" placeholder={'0'.repeat(cvvEsperado)}
          value={cartao.cvv} onChange={e => mudar('cvv', digits(e.target.value).slice(0, cvvEsperado))} onBlur={() => validar('cvv')} aria-invalid={!!erros.cvv} />
        {erros.cvv && <p className="error" role="alert">{erros.cvv}</p>}
      </div>
    </div>

    <div className="field">
      <label htmlFor="card-parcelas">Parcelamento</label>
      <select id="card-parcelas" value={cartao.parcelas} onChange={e => mudar('parcelas', Number(e.target.value))}>
        {parcelas.map(p => <option key={p.numero} value={p.numero}>{p.numero}x de {formatarBRL(p.valorCentavos)}{p.numero === 1 ? ' à vista' : ''}</option>)}
      </select>
      <p className="help">Total de {formatarBRL(valorCentavos)} em {escolhida?.numero ?? 1}x. Sem juros.</p>
    </div>

    <button className="primary-button full" onClick={enviar} disabled={enviando}>
      {enviando ? <><Loader2 className="spin" /> Processando…</> : <>Pagar {formatarBRL(valorCentavos)}</>}
    </button>
    <p className="secure-note"><Lock aria-hidden="true" /> Seus dados vão criptografados direto para a operadora. O número do cartão não é gravado por nós.</p>
  </div>
}
