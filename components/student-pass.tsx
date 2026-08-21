'use client'

import { useEffect, useState } from 'react'
import { Download, Share2 } from 'lucide-react'
import { RedCross, VisualQr } from '@/components/clinical-header'
import { EnrollmentData, loadJson, STORAGE_KEYS } from '@/lib/enrollment'
import { ServiceWorkerRegistration } from '@/components/service-worker-registration'

const FALLBACK: EnrollmentData = { name: 'Aluno(a) CVB-RJ', phone: '', cpf: '000.000.000-00', highSchool: true }

export function StudentPass() {
  const [data, setData] = useState(FALLBACK)
  useEffect(() => setData(loadJson(STORAGE_KEYS.enrollment, FALLBACK)), [])
  const maskedCpf = `***.${data.cpf.slice(4, 11)}-**`.replace('--', '-')
  const save = async () => {
    if (navigator.share) {
      await navigator.share({ title: 'Minha inscrição CVB-RJ', text: 'Comprovante do Curso de Punção Venosa', url: location.href }).catch(() => undefined)
    } else window.print()
  }
  return <main className="pass-page">
    <ServiceWorkerRegistration />
    <header><RedCross /><h1>Minha inscrição</h1></header>
    <article className="student-pass" aria-label="Ficha de inscrição do aluno">
      <div className="pass-band"><span>Identificação do aluno</span><span>Confirmada</span></div>
      <div className="pass-content">
        <VisualQr />
        <h2 className="pass-name">{data.name}</h2>
        <p className="pass-id">CPF {maskedCpf} · INSCRIÇÃO CVB-2026-0847</p>
        <div className="data-grid">
          <div className="data-cell"><small>Curso</small><strong>Punção Venosa</strong></div>
          <div className="data-cell"><small>Carga horária</small><strong>8 horas</strong></div>
          <div className="data-cell"><small>Modalidade</small><strong>Presencial</strong></div>
          <div className="data-cell"><small>Status</small><strong>Pagamento confirmado</strong></div>
        </div>
        <p><strong>Local</strong><br />Praça da Cruz Vermelha, 10 — Centro<br />Rio de Janeiro — RJ</p>
        <div className="status-block"><strong>Sua vaga está garantida.</strong><br />A secretaria confirma sua turma em até 2 dias úteis pelo WhatsApp.</div>
        <p className="reminder"><strong>Lembrete para o dia:</strong> leve 1 kg de alimento não perecível e um documento com foto. O certificado físico será entregue presencialmente no dia do curso.</p>
      </div>
    </article>
    <div className="pass-actions"><button className="primary-button full" onClick={save}><Download /> Adicionar à carteira / Salvar</button><button className="secondary-button" onClick={() => window.print()}><Share2 /> Imprimir</button></div>
  </main>
}
