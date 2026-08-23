'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClinicalHeader } from '@/components/clinical-header'
import { cepDaResposta, type Endereco, pesquisaValida, resumoDoEndereco } from '@/lib/cep'
import { digits, loadJson, maskCep, ROTA_INSCRICAO, saveJson, STORAGE_KEYS, TriageAnswers, triageQuestions } from '@/lib/enrollment'
import { buscarEnderecoDoCep, ErroDaApi, buscarTriagem, pesquisarEnderecos, salvarResposta } from '@/lib/api-cliente'
import { rastrear } from '@/lib/rastreio'

export function TriageFlow({ step }: { step: number }) {
  const router = useRouter()
  const question = triageQuestions[step - 1]
  const key = String(step)
  const [answers, setAnswers] = useState<TriageAnswers>({})
  const [error, setError] = useState('')
  // Só para marcar o CompleteRegistration com o mesmo eventID que o servidor
  // usa na Conversions API — nada mais no front lê este valor.
  const inscricaoIdRef = useRef<string | null>(null)

  // O servidor é a fonte da verdade; o localStorage fica como cache para o
  // caso de o aluno abrir a triagem offline ou antes de a resposta subir.
  useEffect(() => {
    const cache = loadJson<TriageAnswers>(STORAGE_KEYS.triage, {})
    setAnswers(cache)
    buscarTriagem()
      .then(({ id, respostas }) => {
        inscricaoIdRef.current = id
        if (Object.keys(respostas).length) setAnswers(respostas as TriageAnswers)
      })
      .catch(() => undefined)
  }, [])

  // Etapa 6: entrou na triagem. Só no passo 1 — os outros sete são
  // continuação, não uma nova chegada.
  useEffect(() => {
    if (step === 1) rastrear('triagemInicio', { umaVezSo: true })
  }, [step])

  const save = (value: string | string[] | boolean[]) => {
    const next = { ...answers, [key]: value }
    setAnswers(next); saveJson(STORAGE_KEYS.triage, next)
    // Gravação otimista: a navegação não espera a rede. O cache local cobre
    // uma falha aqui, e o passo é reenviado se o aluno voltar nele.
    salvarResposta(step, value).catch(() => undefined)
  }
  const next = () => {
    // Etapa 7: as 8 perguntas foram respondidas. É o CompleteRegistration —
    // a inscrição está pronta, com dados suficientes para montar a turma.
    if (step === 8) rastrear('triagemFim', { id: inscricaoIdRef.current ?? undefined, umaVezSo: true })
    step === 8 ? router.push('/minha-inscricao') : router.push(`/triagem/${step + 1}`)
  }
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

type Pesquisa =
  | { estado: 'parado' }
  | { estado: 'curta' }
  | { estado: 'pesquisando' }
  | { estado: 'achou'; enderecos: Endereco[]; total: number }
  | { estado: 'vazia' }
  | { estado: 'indisponivel' }

const temLetra = (texto: string) => /[a-zA-ZÀ-ÿ]/.test(texto)

// O curso é presencial na sede, no Rio: é de onde vem quase todo mundo. Deixar
// preenchido poupa dois campos de quem é da cidade, e quem não é troca.
const UF_PADRAO = 'RJ'
const CIDADE_PADRAO = 'Rio de Janeiro'

/**
 * A caixa aceita as duas pontas: o CEP, se a pessoa souber, ou o nome da rua,
 * se não souber.
 *
 * Quem não sabe o próprio CEP é justamente quem trava num formulário — e a
 * ViaCEP publica a busca por endereço para esse caso. Sem ela, restava mandar
 * o aluno procurar o CEP em outro site no meio da inscrição.
 *
 * A versão original exibia "Tijuca, Rio de Janeiro" fixo assim que o campo
 * chegava a 8 dígitos, viesse o CEP de onde viesse — resquício do mockup, e
 * dizia a coisa errada para todo mundo que não fosse da Tijuca.
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
  const salvo = cepDaResposta(value)
  const [entrada, setEntrada] = useState(salvo)
  const [uf, setUf] = useState(UF_PADRAO)
  const [cidade, setCidade] = useState(CIDADE_PADRAO)
  const [busca, setBusca] = useState<BuscaDeCep>({ estado: 'parado' })
  const [pesquisa, setPesquisa] = useState<Pesquisa>({ estado: 'parado' })
  const [error, setError] = useState('')
  // Evita repetir a consulta quando o componente re-renderiza sem o CEP mudar.
  const consultado = useRef<string | null>(null)

  // O rascunho chega depois da montagem (localStorage e servidor), então a
  // caixa começa vazia e é preenchida quando ele aparece.
  useEffect(() => {
    if (salvo && !entrada) setEntrada(salvo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salvo])

  const procurandoPorEndereco = temLetra(entrada)
  const numeros = digits(entrada)
  const cepCompleto = !procurandoPorEndereco && numeros.length === 8

  // Consulta por CEP.
  useEffect(() => {
    if (!cepCompleto) { setBusca({ estado: 'parado' }); consultado.current = null; return }
    if (consultado.current === numeros) return
    consultado.current = numeros

    let cancelado = false
    setBusca({ estado: 'buscando' })

    buscarEnderecoDoCep(numeros)
      .then(endereco => {
        if (cancelado) return
        setBusca({ estado: 'achou', lugar: resumoDoEndereco(endereco) })
        setError('')
        save({
          cep: endereco.cep, bairro: endereco.bairro, cidade: endereco.cidade, uf: endereco.uf,
          latitude: endereco.latitude, longitude: endereco.longitude,
        } as never)
      })
      .catch((e: unknown) => {
        if (cancelado) return
        // 404 é CEP que não existe — quase sempre um dígito errado. Qualquer
        // outra falha é problema nosso ou do provedor, e não pode custar a
        // vaga de quem digitou certo.
        const naoExiste = e instanceof ErroDaApi && (e.status === 404 || e.status === 422)
        setBusca({ estado: naoExiste ? 'nao-existe' : 'indisponivel' })
        save({ cep: maskCep(numeros) } as never)
      })

    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numeros, cepCompleto])

  // Pesquisa por endereço, com folga entre as teclas: o nome da rua é digitado
  // letra a letra, e uma consulta por tecla castigaria a ViaCEP à toa.
  useEffect(() => {
    if (!procurandoPorEndereco) { setPesquisa({ estado: 'parado' }); return }
    if (!pesquisaValida(uf, cidade, entrada)) { setPesquisa({ estado: 'curta' }); return }

    let cancelado = false
    setPesquisa({ estado: 'pesquisando' })
    const relogio = window.setTimeout(() => {
      pesquisarEnderecos(uf, cidade, entrada)
        .then(({ enderecos, total }) => {
          if (cancelado) return
          setPesquisa(enderecos.length ? { estado: 'achou', enderecos, total } : { estado: 'vazia' })
        })
        .catch(() => { if (!cancelado) setPesquisa({ estado: 'indisponivel' }) })
    }, 500)

    return () => { cancelado = true; window.clearTimeout(relogio) }
  }, [entrada, uf, cidade, procurandoPorEndereco])

  const escolher = (endereco: Endereco) => {
    setEntrada(endereco.cep)
    consultado.current = digits(endereco.cep)
    setPesquisa({ estado: 'parado' })
    setBusca({ estado: 'achou', lugar: resumoDoEndereco(endereco) })
    setError('')
    save({
      cep: endereco.cep, bairro: endereco.bairro, cidade: endereco.cidade, uf: endereco.uf,
      latitude: endereco.latitude, longitude: endereco.longitude,
    } as never)
  }

  const seguir = () => {
    if (procurandoPorEndereco) return setError('Escolha um endereço na lista, ou digite o CEP.')
    if (!cepCompleto) return setError('CEP incompleto — digite os 8 números.')
    if (busca.estado === 'nao-existe') return setError('Esse CEP não existe. Confira os números.')
    next()
  }

  return <div className="field triage-input">
    <label htmlFor="cep">CEP ou endereço</label>
    <input id="cep" type="text" inputMode={procurandoPorEndereco ? 'text' : 'numeric'}
      autoComplete="postal-code" placeholder="00000-000 ou o nome da sua rua"
      value={entrada}
      onChange={e => {
        const bruto = e.target.value
        setError('')
        setEntrada(temLetra(bruto) ? bruto : maskCep(bruto))
      }}
      onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) seguir() }}
      aria-invalid={!!error || busca.estado === 'nao-existe'} />

    <p className="question-support cep-dica">Não sabe o CEP? Escreva o nome da rua.</p>

    {procurandoPorEndereco && <div className="cep-lugar">
      <label className="cep-uf">UF<input value={uf} maxLength={2} onChange={e => setUf(e.target.value.toUpperCase())} /></label>
      <label className="cep-cidade">Cidade<input value={cidade} onChange={e => setCidade(e.target.value)} /></label>
    </div>}

    <p className={`address-result ${busca.estado}`} aria-live="polite">
      {busca.estado === 'buscando' && 'Procurando o endereço…'}
      {busca.estado === 'achou' && busca.lugar}
      {busca.estado === 'nao-existe' && 'CEP não encontrado.'}
      {busca.estado === 'indisponivel' && 'Não deu para conferir o endereço agora — pode seguir assim mesmo.'}
    </p>

    {procurandoPorEndereco && <div className="cep-resultados" aria-live="polite">
      {pesquisa.estado === 'curta' && <p className="cep-aviso">Escreva pelo menos 3 letras da rua e confira a cidade.</p>}
      {pesquisa.estado === 'pesquisando' && <p className="cep-aviso">Procurando ruas…</p>}
      {pesquisa.estado === 'vazia' && <p className="cep-aviso">Nenhuma rua com esse nome em {cidade}/{uf}.</p>}
      {pesquisa.estado === 'indisponivel' && <p className="cep-aviso">Não deu para pesquisar agora — se souber o CEP, digite os 8 números.</p>}
      {pesquisa.estado === 'achou' && <>
        {pesquisa.enderecos.map(endereco => (
          <button type="button" key={endereco.cep + endereco.logradouro} className="cep-opcao" onClick={() => escolher(endereco)}>
            <strong>{endereco.logradouro}</strong>
            <span>{[endereco.bairro, endereco.cidade].filter(Boolean).join(', ')} · {endereco.cep}</span>
          </button>
        ))}
        {pesquisa.total > pesquisa.enderecos.length &&
          <p className="cep-aviso">Mais {pesquisa.total - pesquisa.enderecos.length} resultados — escreva o nome completo da rua para afinar.</p>}
      </>}
    </div>}

    {error && <p className="error">{error}</p>}
    <div className="triage-actions">
      <button className="primary-button full" onClick={seguir}>Continuar</button>
    </div>
  </div>
}

function EmailQuestion({ value, save, next }: { value: string; save: (v: string) => void; next: () => void }) {
  const [error, setError] = useState('')
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  // Avançar sem nunca ter digitado nada não chama `onChange`, então sem este
  // `save(value)` explícito o passo 6 nunca grava resposta nenhuma — e sem os
  // 8 passos gravados, a triagem nunca fecha. Foi exatamente isso: como o
  // e-mail já foi pedido na etapa de dados, quem clica "sem e-mail" aqui
  // (a maioria) travava a matrícula pra sempre em "paga", nunca "completa".
  const seguir = () => {
    if (value && !valid) { setError('Digite um e-mail válido ou deixe o campo vazio.'); return }
    save(value)
    next()
  }
  return <div className="field triage-input">
    <p className="question-support">Você deseja salvar um e-mail para solicitar uma segunda via ou receber ajuda com o certificado, caso precise?</p>
    <label htmlFor="email">E-mail <span>(opcional)</span></label>
    <input id="email" type="email" inputMode="email" autoComplete="email" placeholder="voce@exemplo.com" value={value} onChange={e => { save(e.target.value); setError('') }} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) seguir() }} aria-invalid={!!error} />
    {error && <p className="error">{error}</p>}
    <div className="triage-actions">
      <button className="primary-button full" onClick={seguir}>{value ? 'Salvar e continuar' : 'Continuar sem e-mail'}</button>
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
