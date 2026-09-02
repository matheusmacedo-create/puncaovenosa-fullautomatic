import { Award, Clock, GraduationCap, MapPin, Wallet } from 'lucide-react'
import { courseData, formatBRL } from '@/lib/course-data'

export function CourseFacts() {
  const facts = [
    { icon: Clock, label: '8 horas' },
    { icon: MapPin, label: 'Curso presencial' },
    { icon: Award, label: 'Certificado' },
    { icon: GraduationCap, label: `Pré-requisito: ${courseData.prerequisite}` },
    // Os dois números juntos: o que se paga hoje, que é o da decisão, e o
    // total, que é o da transparência. Só o total, logo abaixo de um botão
    // de R$ 99, fazia a faixa desmentir o próprio CTA.
    {
      icon: Wallet,
      label: `Matrícula ${formatBRL(courseData.registrationPrice)} · total ${formatBRL(courseData.totalPrice)}`,
    },
  ]

  return (
    <div className="border-b border-border bg-muted">
      <ul className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-px bg-border px-0 sm:grid-cols-3 lg:grid-cols-5">
        {facts.map(({ icon: Icon, label }) => (
          <li
            key={label}
            className="flex items-center gap-2.5 bg-muted px-5 py-5 text-[13px] font-semibold leading-tight sm:px-6"
          >
            <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="text-pretty">{label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
