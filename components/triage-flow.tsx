'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClinicalHeader } from '@/components/clinical-header'
import { digits, loadJson, maskCep, saveJson, STORAGE_KEYS, TriageAnswers, triageQuestions } from '@/lib/enrollment'

export function TriageFlow({ step }: { step: number }) {
  const router = useRouter()
  const question = triageQuestions[step - 1]
  const key = String(step)
  const [answers, setAnswers] = useState<TriageAnswers>({})
  const [error, setError] = useState('')
  useEffect(() => setAnswers(loadJson(STORAGE_KEYS.triage, {})), [])

  const save = (value: string | string[] | boolean[]) => {
    const next = { ...answers, [key]: value }; setAnswers(next); saveJson(STORAGE_KEYS.triage, next)
  }
  const next = () => step === 8 ? router.push('/minha-inscricao') : router.push(`/triagem/${step + 1}`)
  const back = () => step === 1 ? router.push('/?etapa=confirmado') : router.push(`/triagem/${step - 1}`)
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
      {question.type === 'cep' && <div className="field triage-input"><label htmlFor="cep">CEP</label><input id="cep" type="text" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" value={typeof value === 'string' ? value : ''} onChange={e => { setError(''); save(maskCep(e.target.value)) }} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) { if (digits(String(value || '')).length === 8) next(); else setError('CEP incompleto — digite os 8 números.') } }} aria-invalid={!!error} />{digits(String(value || '')).length === 8 && <p className="address-result">Tijuca, Rio de Janeiro</p>}{error && <p className="error">{error}</p>}<div className="triage-actions"><button className="primary-button full" onClick={() => digits(String(value || '')).length === 8 ? next() : setError('CEP incompleto — digite os 8 números.')}>Continuar</button></div></div>}
      {question.type === 'email' && <EmailQuestion value={typeof value === 'string' ? value : ''} save={save} next={next} />}
      {question.type === 'multi' && <MultiQuestion options={[...question.options]} value={Array.isArray(value) ? value as string[] : []} save={save} next={next} />}
      {question.type === 'confirm' && <ConfirmQuestion options={[...question.options]} value={Array.isArray(value) ? value as boolean[] : []} save={save} next={next} />}
    </section>
  </main>
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
