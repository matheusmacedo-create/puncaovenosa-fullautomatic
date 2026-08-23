'use client'

import { useMemo, useState } from 'react'

export type ColunaDeTriagem = { passo: number; rotulo: string; pergunta: string }

export type LinhaInscricao = {
  id: string
  quando: string
  nome: string
  identificacao: string
  telefone: string
  email: string
  situacao: string
  paga: boolean
  /** Chave do status cru, usada pelos filtros. */
  status: string
  pagamento: string | null
  pagamentoDetalhe: string | null
  /** Uma entrada por coluna de triagem, na mesma ordem de `colunas`. */
  respostas: string[]
  /** Nome, CPF, e-mail, telefone e número, já em minúsculas e sem acento. */
  busca: string
}

/** Recortes que respondem "o que eu preciso fazer agora", não só "o que existe". */
const FILTROS = [
  { id: 'todas', rotulo: 'Todas', combina: () => true },
  { id: 'aguardando', rotulo: 'Falta pagar', combina: (l: LinhaInscricao) => l.status === 'rascunho' || l.status === 'aguardando_pagamento' },
  { id: 'triagem', rotulo: 'Pagou, falta triagem', combina: (l: LinhaInscricao) => l.status === 'paga' },
  { id: 'completa', rotulo: 'Matrícula completa', combina: (l: LinhaInscricao) => l.status === 'triagem_concluida' },
] as const

const semAcento = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/**
 * Tabela de inscrições com busca e recortes.
 *
 * Antes eram 300 linhas por 11 colunas, sem filtro: achar uma pessoa era
 * varrer a tela com os olhos, e decidir o que fazer exigia manter o funil
 * inteiro na cabeça. A busca resolve a primeira parte e os filtros a segunda
 * — cada um é uma pergunta de trabalho ("quem falta pagar?"), não um estado
 * técnico do banco.
 *
 * A filtragem é imediata e síncrona, sem espera entre a tecla e o resultado:
 * um atraso faz a lista parecer que mudou sozinha depois que a pessoa já
 * parou de digitar.
 */
export function SecretariaInscricoes({ linhas, colunas }: {
  linhas: LinhaInscricao[]
  colunas: ColunaDeTriagem[]
}) {
  const [termo, setTermo] = useState('')
  const [filtro, setFiltro] = useState<string>('todas')

  const visiveis = useMemo(() => {
    const combina = FILTROS.find(f => f.id === filtro)?.combina ?? (() => true)
    const alvo = semAcento(termo.trim())
    return linhas.filter(l => combina(l) && (!alvo || l.busca.includes(alvo)))
  }, [linhas, termo, filtro])

  const contagem = (id: string) => {
    const f = FILTROS.find(x => x.id === id)
    return f ? linhas.filter(f.combina).length : 0
  }

  return <div className="secretaria-inscricoes">
    <div className="secretaria-filtros">
      <div className="secretaria-campo-busca">
        <label htmlFor="busca-inscricoes">Procurar aluno</label>
        <input
          id="busca-inscricoes"
          type="search"
          value={termo}
          onChange={e => setTermo(e.target.value)}
          placeholder="Nome, CPF, e-mail ou telefone"
          autoComplete="off"
        />
      </div>

      <div className="secretaria-recortes" role="group" aria-label="Filtrar por situação">
        {FILTROS.map(f => (
          <button
            key={f.id}
            type="button"
            className={`secretaria-recorte ${filtro === f.id ? 'ativo' : ''}`}
            aria-pressed={filtro === f.id}
            onClick={() => setFiltro(f.id)}
          >
            {f.rotulo} <span>{contagem(f.id)}</span>
          </button>
        ))}
      </div>
    </div>

    {/* Anunciado em voz alta ao mudar, e visível para quem só olha. */}
    <p className="secretaria-contagem" aria-live="polite">
      {visiveis.length === linhas.length
        ? `Mostrando todas as ${linhas.length} inscrições.`
        : `Mostrando ${visiveis.length} de ${linhas.length} inscrições.`}
    </p>

    {visiveis.length === 0 ? (
      <p className="secretaria-vazio">
        Nenhuma inscrição encontrada com esse recorte. Apague a busca ou escolha "Todas" para ver a lista inteira.
      </p>
    ) : (
      <div className="secretaria-tabela-rolagem">
        <table className="secretaria-tabela">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Aluno</th>
              <th>Contato</th>
              <th>Situação</th>
              <th>Pagamento</th>
              {colunas.map(c => <th key={c.passo}>{c.rotulo}</th>)}
            </tr>
          </thead>
          <tbody>
            {visiveis.map(l => (
              <tr key={l.id} className={l.paga ? 'paga' : undefined}>
                <td className="secretaria-quando">{l.quando}</td>
                <td>
                  <strong>{l.nome}</strong>
                  <span className="secretaria-sub">{l.identificacao}</span>
                </td>
                <td>
                  {l.telefone}
                  <span className="secretaria-sub">{l.email}</span>
                </td>
                <td><span className={`secretaria-selo ${l.paga ? 'ok' : 'espera'}`}>{l.situacao}</span></td>
                <td>
                  {l.pagamento ? <>
                    {l.pagamento}
                    <span className="secretaria-sub">{l.pagamentoDetalhe}</span>
                  </> : <span className="secretaria-sub">sem cobrança</span>}
                </td>
                {l.respostas.map((resposta, i) => (
                  <td key={colunas[i].passo} className="secretaria-triagem" title={colunas[i].pergunta}>
                    {resposta}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
}
