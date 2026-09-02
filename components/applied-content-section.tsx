import { AlertTriangle, ListChecks, Package } from 'lucide-react'
import { CtaButton } from '@/components/cta-button'
import { Foto } from '@/components/foto'
import { CtaReassurance } from '@/components/cta-reassurance'
import { contentPhoto, courseData } from '@/lib/course-data'

const highlights = [
  {
    icon: ListChecks,
    title: 'Entenda cada etapa',
    text: 'Compreenda a lógica e os cuidados envolvidos no procedimento.',
  },
  {
    icon: Package,
    title: 'Reconheça materiais e dispositivos',
    text: 'Amplie sua familiaridade com os itens utilizados na rotina.',
  },
  {
    icon: AlertTriangle,
    title: 'Antecipe riscos',
    text: 'Conheça cuidados de biossegurança e situações que exigem atenção.',
  },
]

export function AppliedContentSection() {
  return (
    <section aria-labelledby="content-title" className="bg-muted px-5 py-10 sm:px-8 sm:py-14 md:py-24">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-10 md:flex-row md:items-center md:gap-14">
        <figure className="md:w-[44%] md:shrink-0">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-background md:aspect-[4/5]">
            <Foto foto={contentPhoto} sizes="(max-width: 768px) 100vw, 480px" className="object-cover" />
          </div>
          <figcaption className="mt-2 text-xs text-muted-foreground">
            {contentPhoto.caption}
          </figcaption>
        </figure>

        <div className="md:flex-1">
          <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
            Conhecimento aplicado
          </p>
          <h2
            id="content-title"
            className="mt-3 text-balance text-2xl font-bold leading-tight sm:text-3xl md:text-[2.1rem]"
          >
            Conteúdo técnico para você chegar mais preparado à rotina.
          </h2>

          <p className="mt-5 max-w-[55ch] text-[15px] leading-relaxed text-muted-foreground">
            Ao longo das {courseData.duration}, o curso aborda a técnica, os materiais, a
            biossegurança e a prevenção de complicações com foco na compreensão do que faz parte do
            dia a dia da punção venosa.
          </p>

          <ul className="mt-8 flex flex-col gap-5">
            {highlights.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <Icon
                  className="mt-0.5 size-[18px] shrink-0 text-primary"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <div>
                  <h3 className="text-[15px] font-bold">{title}</h3>
                  <p className="mt-1 max-w-[55ch] text-sm leading-relaxed text-muted-foreground text-pretty">
                    {text}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          {/*
            Caixa branca com a mesma borda dos outros cartões da página, e não
            um bloco tingido com barrinha de destaque na lateral: aquele era o
            único elemento da landing desenhado assim, então em vez de chamar
            atenção ele parecia um aviso de sistema colado no meio do texto.
            Como a seção já corre sobre fundo cinza, o branco sozinho destaca.

            O texto também encolheu. Havia "matrícula por R$ 99" na frase, no
            rótulo do botão e de novo na linha de preço abaixo dele — o mesmo
            número três vezes em quatro linhas —, e uma última linha repetindo
            que a secretaria confirma a data, coisa que o parágrafo já diz.
          */}
          <div className="mt-10 rounded-md border border-border bg-background p-6">
            {/*
              Título curto: "Dê o primeiro passo para participar de uma turma"
              ocupava duas linhas no celular para dizer o que o botão logo
              abaixo já diz melhor.

              E a frase falava de processo — o que acontece depois do
              pagamento — num ponto da página em que a pessoa acabou de ler o
              que vai aprender e precisa de um motivo para clicar, não de
              logística. A logística está no hero, na seção de formação de
              turmas e em três respostas do FAQ; aqui basta a garantia da
              vaga, que é o que a matrícula compra.
            */}
            <h3 className="text-lg font-bold sm:text-xl">Comece pela matrícula</h3>
            <p className="mt-2 max-w-[55ch] text-sm leading-relaxed text-muted-foreground">
              Ela garante sua vaga hoje. Os dias e horários você combina com a secretaria depois.
            </p>

            {/* Sem rótulo próprio: o mesmo gesto tem o mesmo nome nos quatro CTAs. */}
            <CtaButton position="content" className="mt-5 w-full sm:w-auto" />

            <CtaReassurance />
          </div>
        </div>
      </div>
    </section>
  )
}
