import { CircleAlert } from 'lucide-react'
import { courseData, isDev } from '@/lib/course-data'

type ChecklistItem = { field: string; description: string; done: boolean }

/**
 * Itens obrigatórios antes de publicar (seção 21 do documento mestre).
 * Visível apenas em desenvolvimento — nunca em produção.
 */
export function DevelopmentChecklist() {
  if (!isDev) return null

  const items: ChecklistItem[] = [
    {
      field: 'checkoutUrl',
      description: 'Conectar todos os CTAs à rota de matrícula',
      done: courseData.checkoutUrl !== '#',
    },
    {
      field: 'cobrança',
      description: 'Conferir em /api/diagnostico se a Únicopag está configurada e o preço em vigor é o real',
      done: false,
    },
    {
      field: 'formulário de disponibilidade',
      description: 'Testar o formulário de dias e horários enviado após o pagamento',
      done: false,
    },
    {
      field: 'prazo de contato',
      description: 'Publicar o prazo de retorno da secretaria somente quando operacionalmente garantido',
      done: false,
    },
    {
      field: 'metaPixelId',
      description: 'Meta Pixel válido para medir matrícula paga nas duas variantes',
      done: Boolean(courseData.metaPixelId),
    },
    {
      field: 'privacyPolicyUrl',
      description: 'Exibir Política de Privacidade apenas com link funcional',
      done: Boolean(courseData.privacyPolicyUrl),
    },
    {
      field: 'maxSeatsPerClass',
      description: 'Capacidade por turma só aparece se confirmada pela secretaria',
      done: courseData.maxSeatsPerClass !== null,
    },
    {
      field: 'institutionalIndicators',
      description: 'Indicadores institucionais verificáveis (opcional; nada é exibido sem fonte real)',
      done: courseData.institutionalIndicators.length > 0,
    },
    {
      field: 'variantes A/B',
      description: 'Testar /?variant=a e /?variant=b, persistência 50/50, UTMs e eventos de conversão',
      done: false,
    },
    {
      field: 'rodapé responsivo',
      description: 'Conferir o rodapé em desktop, tablet e mobile',
      done: false,
    },
  ]

  const pending = items.filter((item) => !item.done)

  return (
    <section
      aria-label="Checklist de desenvolvimento"
      className="border-t-2 border-dashed border-primary/40 bg-primary/5 px-5 py-10 sm:px-8"
    >
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex items-center gap-2">
          <CircleAlert className="size-5 text-primary" aria-hidden="true" />
          <h2 className="text-base font-bold">
            Checklist de publicação — visível apenas em desenvolvimento
          </h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {pending.length} {pending.length === 1 ? 'item pendente' : 'itens pendentes'} de{' '}
          {items.length}. Nenhum dado é inventado na página: campos sem fonte real são omitidos.
        </p>

        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <li
              key={item.field}
              className="flex items-start gap-3 rounded-md border border-border bg-background p-3 text-sm"
            >
              <span
                aria-hidden="true"
                className={`mt-1 size-2 shrink-0 rounded-full ${item.done ? 'bg-foreground/30' : 'bg-primary'}`}
              />
              <span>
                <code className="font-mono text-[13px] font-semibold">{item.field}</code>
                <span className="sr-only">{item.done ? ' — confirmado' : ' — pendente'}</span>
                <span className="block text-[13px] leading-relaxed text-muted-foreground">
                  {item.description}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
