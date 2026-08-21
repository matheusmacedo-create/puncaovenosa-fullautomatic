'use client'

import { useEffect, useState } from 'react'
import { Download, Share2 } from 'lucide-react'
import { RedCross } from '@/components/clinical-header'
import { CodigoQr } from '@/components/qr-code'
import { EnrollmentData, loadJson, maskCpf, STORAGE_KEYS } from '@/lib/enrollment'
import { buscarInscricao, Inscricao } from '@/lib/api-cliente'
import { ServiceWorkerRegistration } from '@/components/service-worker-registration'

const FALLBACK: EnrollmentData = { name: 'Aluno(a) CVB-RJ', phone: '', cpf: '000.000.000-00', email: '', highSchool: true }

const ROTULO_DE_STATUS: Record<Inscricao['status'], string> = {
  rascunho: 'Cadastro iniciado',
  aguardando_pagamento: 'Aguardando pagamento',
  paga: 'Pagamento confirmado',
  triagem_concluida: 'Triagem concluída',
  cancelada: 'Inscrição cancelada',
}

export function StudentPass() {
  const [inscricao, setInscricao] = useState<Inscricao | null>(null)
  const [rascunho, setRascunho] = useState(FALLBACK)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    setRascunho(loadJson(STORAGE_KEYS.enrollment, FALLBACK))
    buscarInscricao()
      .then(setInscricao)
      .catch(() => undefined)
      .finally(() => setCarregando(false))
  }, [])

  // Sem inscrição no servidor (sessão nova, cookie expirado), a ficha mostra
  // o rascunho local em vez de uma tela vazia.
  const nome = inscricao?.nome ?? rascunho.name
  const cpfMascarado = inscricao?.cpfMascarado ?? maskCpf(rascunho.cpf).replace(/^\d{3}/, '***').replace(/\d{2}$/, '**')
  const numero = inscricao?.numeroInscricao
  const status = inscricao ? ROTULO_DE_STATUS[inscricao.status] : 'Cadastro iniciado'
  const confirmada = inscricao?.status === 'paga' || inscricao?.status === 'triagem_concluida'

  const save = async () => {
    if (navigator.share) {
      await navigator.share({ title: 'Minha inscrição CVB-RJ', text: 'Comprovante do Curso de Punção Venosa', url: location.href }).catch(() => undefined)
    } else window.print()
  }

  return <main className="pass-page">
    <ServiceWorkerRegistration />
    <header><RedCross /><h1>Minha inscrição</h1></header>
    <article className="student-pass" aria-label="Ficha de inscrição do aluno" aria-busy={carregando}>
      <div className="pass-band"><span>Identificação do aluno</span><span>{confirmada ? 'Confirmada' : 'Pendente'}</span></div>
      <div className="pass-content">
        {inscricao?.validacaoUrl
          ? <CodigoQr conteudo={inscricao.validacaoUrl} descricao="QR Code de identificação do aluno, para conferência na instituição" lado={200} />
          : <div className="qr-vazio" style={{ width: 200, height: 200 }} aria-hidden="true" />}
        <h2 className="pass-name">{nome}</h2>
        <p className="pass-id">CPF {cpfMascarado}{numero ? ` · INSCRIÇÃO ${numero}` : ''}</p>
        <div className="data-grid">
          <div className="data-cell"><small>Curso</small><strong>Punção Venosa</strong></div>
          <div className="data-cell"><small>Carga horária</small><strong>8 horas</strong></div>
          <div className="data-cell"><small>Modalidade</small><strong>Presencial</strong></div>
          <div className="data-cell"><small>Status</small><strong>{status}</strong></div>
        </div>
        <p><strong>Local</strong><br />Praça da Cruz Vermelha, 10 — Centro<br />Rio de Janeiro — RJ</p>
        {confirmada
          ? <div className="status-block"><strong>Sua vaga está garantida.</strong><br />A secretaria confirma sua turma em até 2 dias úteis pelo WhatsApp.</div>
          : <div className="status-block pendente"><strong>Pagamento ainda não confirmado.</strong><br />Sua vaga é garantida assim que o pagamento cair.</div>}
        {inscricao && inscricao.passosRespondidos < 8 && <p className="reminder"><strong>Falta a triagem:</strong> você respondeu {inscricao.passosRespondidos} de 8 perguntas. Elas definem a melhor data para a sua turma.</p>}
        <p className="reminder"><strong>Lembrete para o dia:</strong> leve 1 kg de alimento não perecível e um documento com foto. O certificado físico será entregue presencialmente no dia do curso.</p>
      </div>
    </article>
    <div className="pass-actions"><button className="primary-button full" onClick={save}><Download /> Adicionar à carteira / Salvar</button><button className="secondary-button" onClick={() => window.print()}><Share2 /> Imprimir</button></div>
  </main>
}
