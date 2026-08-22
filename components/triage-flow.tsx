'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClinicalHeader } from '@/components/clinical-header'
import { cepDaResposta, resumoDoEndereco } from '@/lib/cep'
import { digits, loadJson, maskCep, ROTA_INSCRICAO, saveJson, STORAGE_KEYS, TriageAnswers, triageQuestions } from '@/lib/enrollment'
import { buscarEnderecoDoCep, ErroDaApi, buscarTriagem, salvarResposta } from '@/lib/api-cliente'

export function TriageFlow({ step }: { step: number }) {
  const router = useRouter()
  const question = triageQuestions[step - 1]
  const key = String(step)
  const [answers, setAnswers] = useState<TriageAnswers>({})
  const [error, setError] = useState('')

  // O servidor é a fonte da verdade; o localStorage fica como cache para o
  // caso de o aluno abrir a triagem offline ou antes de a resposta subir.
  useEffect(() => {
    const cache = loadJson<TriageAnswers>(STORAGE_KEYS.triage, {})
    setAnswers(cache)
    buscarTriagem()
      .then(({ respostas }) => {
        if (Object.keys(respostas).length) setAnswers(respostas as TriageAnswers)
      })
      .catch(() => undefined)
  }, [])

  const save = (value: string | string[] | boolean[]) => {
    const next = { ...answers, [key]: value }
    setAnswers(next); saveJson(STORAGE_KEYS.triage, next)
    // Gravação otimista: a navegação não espera a rede. O cache local cobre
    // uma falha aqui, e o passo é reenviado se o aluno voltar nele.
    salvarResposta(step, value).catch(() => undefined)
  }
  const next = () => step === 8 ? router.push('/minha-inscricao') : router.push(`/triagem/${step + 1}`)
  const back = () => step === 1 ? router.push(`${ROTA_INSCRICAO}?etapa=confirmado`) : router.push(`/triagem/${step - 1}`)
  const choose = (value: string) => { save(value); window.setTimeout(next, 200) }
  const value = answers[key]

  if (!question) return null
  return <main className="triage-shell">
    <ClinicalHeader step={step + 1} back={back} />
    <div className="progress-track"><div className="progress-bar" style={{ width: `${step * 12.5}%` }} /></div>
    <section className="triage-main">
      <p className="question-number">Pergunta {step} de 8</p>
      <h1>{question.title}</h1>
      {question.type === 'single' && <div className="choices">{'options' in question && question.options.map(option => <button key={option} className={`choice-button ${value === option ? 'selected' : ''}`} onClick={() => choose(option)}>{option}</button>)}</div>}
      {question.type === 'cep' && <CepQuestion value={value} save={save} next={next} />}
      {question.type === 'email' && <EmailQuestion value={typeof value === 'string' ? value : ''} save={save} next={next} />}
      {question.type === 'multi' && <MultiQuestion options={[...question.options]} value={Array.isArray(value) ? value as string[] : []} save={save} next={next} />}
      {question.type === 'confirm' && <ConfirmQuestion options={[...question.options]} value={Array.isArray(value) ? value as boolean[] : []} save={save} next={next} />}
    </section>
  </main>
}

type BuscaDeCep =
  | { estado: 'parado' }
  | { estado: 'buscando' }
  | { estado: 'achou'; lugar: string }
  | { estado: 'nao-existe' }
  | { estado: 'indisponivel' }

/**
 * CEP com o endereço resolvido de verdade.
 *
 * A versão anterior exibia "Tijuca, Rio de Janeiro" fixo assim que o campo
 * chegava a 8 dígitos, viesse o CEP de onde viesse — era um resquício do
 * mockup, e dizia a coisa errada para todo mundo que não fosse da Tijuca.
 *
 * Guarda o endereço junto com o CEP, e não só o número, para a secretaria
 * montar turma por região sem precisar consultar CEP a CEP depois.
 */
function CepQuestion({
  value, save, next,
}: {
  value: string | string[] | boolean[] | undefined
  save: (v: never) => void
  next: () => void
}) {
  const cep = cepDaResposta(value)
  const numeros = digits(cep)
  const completo = numeros.length === 8

  const [busca, setBusca] = useState<BuscaDeCep>({ estado: 'parado' })
  const [error, setError] = useState('')
  // Evita repetir a consulta quando o componente re-renderiza sem o CEP mudar.
  const consultado = useRef<string | null>(null)

  useEffect(() => {
    if (!completo) { setBusca({ estado: 'parado' }); consultado.current = null; return }
    if (consultado.current === numeros) return
    consultado.current = numeros

    let cancelado = false
    setBusca({ estado: 'buscando' })

    buscarEnderecoDoCep(numeros)
      .then(endereco => {
        if (cancelado) return
        setBusca({ estado: 'achou', lugar: resumoDoEndereco(endereco) })
        setError('')
        save({ cep, bairro: endereco.bairro, cidade: endereco.cidade, uf: endereco.uf } as never)
      })
      .catch((e: unknown) => {
        if (cancelado) return
        // 404 é CEP que não existe — quase sempre um dígito errado. Qualquer
        // outra falha é problema nosso ou do provedor, e não pode custar a
        // vaga de quem digitou certo.
        const naoExiste = e instanceof ErroDaApi && e.status === 404
        setBusca({ estado: naoExiste ? 'nao-existe' : 'indisponivel' })
        save({ cep } as never)
      })

    return () => { cancelado = true }
    // `save` e `cep` mudam a cada tecla; a consulta só depende do CEP completo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numeros, completo])

  const seguir = () => {
    if (!completo) return setError('CEP incompleto — digite os 8 números.')
    if (busca.estado === 'nao-existe') return setError('Esse CEP não existe. Confira os números.')
    next()
  }

  return <div className="field triage-input">
    <label htmlFor="cep">CEP</label>
    <input id="cep" type="text" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000"
      value={cep}
      onChange={e => { setError(''); save(maskCep(e.target.value) as never) }}
      onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) seguir() }}
      aria-invalid={!!error || busca.estado === 'nao-existe'} />

    <p className={`address-result ${busca.estado}`} aria-live="polite">
      {busca.estado === 'buscando' && 'Procurando o endereço…'}
      {busca.estado === 'achou' && busca.lugar}
      {busca.estado === 'nao-existe' && 'CEP não encontrado.'}
      {busca.estado === 'indisponivel' && 'Não deu para conferir o endereço agora — pode seguir assim mesmo.'}
    </p>

    {error && <p className="error">{error}</p>}
    <div className="triage-actions">
      <button className="primary-button full" onClick={seguir}>Continuar</button>
    </div>
  </div>
}

function EmailQuestion({ value, save, next }: { value: string; save: (v: string) => void; next: () => void }) {
  const [error, setError] = useState('')
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  return <div className="field triage-input">
    <p className="question-support">Você deseja salvar um e-mail para solicitar uma segunda via ou receber ajuda com o certificado, caso precise?</p>
    <label htmlFor="email">E-mail <span>(opcional)</span></label>
    <input id="email" type="email" inputMode="email" autoComplete="email" placeholder="voce@exemplo.com" value={value} onChange={e => { save(e.target.value); setError('') }} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) { if (!value || valid) next(); else setError('Digite um e-mail válido ou deixe o campo vazio.') } }} aria-invalid={!!error} />
    {error && <p className="error">{error}</p>}
    <div className="triage-actions">
      <button className="primary-button full" onClick={() => !value || valid ? next() : setError('Digite um e-mail válido ou deixe o campo vazio.')}>{value ? 'Salvar e continuar' : 'Continuar sem e-mail'}</button>
    </div>
  </div>
}

function MultiQuestion({ options, value, save, next }: { options: string[]; value: string[]; save: (v: string[]) => void; next: () => void }) {
  const toggle = (option: string) => save(value.includes(option) ? value.filter(v => v !== option) : [...value, option])
  return <><div className="choices">{options.map(option => <button key={option} className={`choice-button ${value.includes(option) ? 'selected' : ''}`} aria-pressed={value.includes(option)} onClick={() => toggle(option)}>{option}</button>)}</div><div className="triage-actions"><button className="primary-button full" disabled={!value.length} onClick={next}>Continuar</button></div></>
}

function ConfirmQuestion({ options, value, save, next }: { options: string[]; value: boolean[]; save: (v: boolean[]) => void; next: () => void }) {
  const checks = options.map((_, i) => !!value[i])
  const toggle = (i: number) => { const nextValue = [...checks]; nextValue[i] = !nextValue[i]; save(nextValue) }
  return <><div className="choices">{options.map((option, i) => <label className="choice-button checkbox-row" key={option}><input type="checkbox" checked={checks[i]} onChange={() => toggle(i)} /><span>{option}</span></label>)}</div><div className="triage-actions"><button className="primary-button full" disabled={!checks.every(Boolean)} onClick={next}>Concluir cadastro</button></div></>
}
