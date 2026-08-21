import { RedCross } from '@/components/clinical-header'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Conferência presencial do aluno.
 *
 * Quem chega aqui escaneou o QR Code da ficha. Não há login: a credencial é
 * o próprio token, aleatório de 128 bits — inviável de adivinhar. Em troca,
 * a página mostra o mínimo necessário para conferir a pessoa com um
 * documento: nome, número de inscrição, miolo do CPF e situação.
 *
 * Renderiza no servidor a cada acesso (`force-dynamic`), por dois motivos:
 * a resposta muda conforme o pagamento, e o horário exibido precisa ser o de
 * agora — é ele que denuncia uma captura de tela antiga sendo mostrada no
 * lugar de uma leitura real.
 */
export const dynamic = 'force-dynamic'

type Validacao = {
  encontrada: boolean
  nome: string | null
  numero_inscricao: string | null
  cpf_mascarado: string | null
  status: string | null
  passos: number | null
  inscrito_em: string | null
  leituras: number | null
}

const ROTULO: Record<string, { texto: string; liberado: boolean }> = {
  rascunho: { texto: 'Cadastro incompleto', liberado: false },
  aguardando_pagamento: { texto: 'Pagamento não confirmado', liberado: false },
  paga: { texto: 'Pagamento confirmado', liberado: true },
  triagem_concluida: { texto: 'Inscrição completa', liberado: true },
  cancelada: { texto: 'Inscrição cancelada', liberado: false },
}

const horaDeAgora = () =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/Sao_Paulo' })
    .format(new Date())

export default async function ValidarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const { data, error } = await supabaseServer()
    .rpc('validar_credencial', { p_token: token })
    .single<Validacao>()

  if (error) {
    console.error('[funil] validação falhou:', error)
    return <Moldura><div className="validacao negada"><h1>Não foi possível conferir</h1><p>Tente novamente em instantes.</p></div></Moldura>
  }

  if (!data?.encontrada) {
    return <Moldura>
      <div className="validacao negada">
        <span className="validacao-selo">Credencial inválida</span>
        <h1>Este código não corresponde a nenhuma inscrição</h1>
        <p>Peça ao aluno para abrir a ficha novamente em <strong>/minha-inscricao</strong>, ou confira na secretaria.</p>
        <p className="validacao-hora">Conferido em {horaDeAgora()}</p>
      </div>
    </Moldura>
  }

  const situacao = ROTULO[data.status ?? ''] ?? { texto: data.status ?? 'Situação desconhecida', liberado: false }

  return <Moldura>
    <div className={`validacao ${situacao.liberado ? 'liberada' : 'negada'}`}>
      <span className="validacao-selo">{situacao.liberado ? 'Inscrição válida' : 'Atenção'}</span>
      <h1>{data.nome}</h1>
      <p className="validacao-situacao">{situacao.texto}</p>

      <dl className="validacao-dados">
        <div><dt>Inscrição</dt><dd>{data.numero_inscricao ?? '—'}</dd></div>
        <div><dt>CPF</dt><dd>{data.cpf_mascarado}</dd></div>
        <div><dt>Curso</dt><dd>Punção Venosa · 8h</dd></div>
        <div><dt>Triagem</dt><dd>{data.passos ?? 0} de 8 respondidas</dd></div>
      </dl>

      {!situacao.liberado && <p className="validacao-aviso">Não libere o acesso. Encaminhe o aluno à secretaria.</p>}

      <p className="validacao-hora">
        Conferido em {horaDeAgora()} · {data.leituras}ª leitura desta credencial
      </p>
    </div>
  </Moldura>
}

function Moldura({ children }: { children: React.ReactNode }) {
  return <main className="validacao-page">
    <header><RedCross /><span>Cruz Vermelha Brasileira · RJ</span></header>
    {children}
    <p className="validacao-rodape">
      Confira o nome e o CPF com um documento com foto. O horário acima é o desta leitura —
      se estiver defasado, você está vendo uma captura de tela, não uma conferência real.
    </p>
  </main>
}
