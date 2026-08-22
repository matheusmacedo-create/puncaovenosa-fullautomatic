/**
 * Recebe as inscrições do funil e mantém uma linha por aluno.
 *
 * Como instalar:
 *
 *   1. Crie a planilha e deixe-a RESTRITA — só quem precisa ver. Ela vai
 *      conter CPF e telefone de alunos reais, então nada de "qualquer pessoa
 *      com o link".
 *   2. Extensões > Apps Script, apague o conteúdo e cole este arquivo.
 *   3. Troque TOKEN abaixo por um segredo longo e aleatório, só seu.
 *   4. Implantar > Nova implantação > tipo "App da Web".
 *        Executar como:      Eu
 *        Quem pode acessar:  Qualquer pessoa
 *      "Qualquer pessoa" é exigência do Google para que um servidor sem login
 *      consiga postar. Quem protege a planilha é o TOKEN, não a permissão.
 *   5. Copie a URL da implantação (termina em /exec) e configure na Vercel:
 *        PLANILHA_URL   = a URL /exec
 *        PLANILHA_TOKEN = o mesmo segredo do passo 3
 *      As duas SEM o prefixo NEXT_PUBLIC_ — elas não podem ir para o navegador.
 *   6. Redeploy.
 *
 * A cada nova implantação o Google gera uma URL nova. Se publicar de novo,
 * atualize PLANILHA_URL.
 */

const TOKEN = 'troque-por-um-segredo-longo-e-aleatorio'

const ABA = 'Inscrições'

const COLUNAS = [
  'Inscrição (id)',
  'Nº inscrição',
  'Nome',
  'CPF',
  'WhatsApp',
  'E-mail',
  'Ensino médio',
  'Status da inscrição',
  'Status do pagamento',
  'Método',
  'Valor',
  'Triagem (de 8)',
  'Criada em',
  'Atualizada em',
]

function doPost(e) {
  try {
    const dados = JSON.parse(e.postData.contents)

    // Comparação de tamanho fixo, para não vazar o token por tempo de resposta.
    if (!seguroIgual(String(dados.token || ''), TOKEN)) {
      return responder({ ok: false, erro: 'token inválido' })
    }
    if (!dados.inscricaoId) {
      return responder({ ok: false, erro: 'sem inscricaoId' })
    }

    // Um lock evita que duas confirmações simultâneas criem linhas duplicadas
    // para o mesmo aluno.
    const lock = LockService.getScriptLock()
    lock.waitLock(20000)
    try {
      gravar(dados)
    } finally {
      lock.releaseLock()
    }

    return responder({ ok: true })
  } catch (erro) {
    return responder({ ok: false, erro: String(erro) })
  }
}

function gravar(dados) {
  const aba = abaPreparada()
  const linha = [
    dados.inscricaoId,
    dados.numeroInscricao || '',
    dados.nome || '',
    // Apóstrofo à frente: sem ele o Sheets trata o CPF como número e come o
    // zero à esquerda — 03323281985 viraria 3323281985.
    dados.cpf ? "'" + dados.cpf : '',
    dados.telefone ? "'" + dados.telefone : '',
    dados.email || '',
    dados.ensinoMedio ? 'sim' : 'não',
    dados.statusInscricao || '',
    dados.statusPagamento || '',
    dados.metodo || '',
    dados.valorCentavos == null ? '' : dados.valorCentavos / 100,
    dados.triagemRespondida == null ? '' : dados.triagemRespondida,
    dados.criadoEm || '',
    dados.atualizadoEm || '',
  ]

  // Uma linha por aluno: procura pelo id da inscrição e atualiza no lugar.
  const existente = procurarLinha(aba, dados.inscricaoId)
  if (existente > 0) {
    aba.getRange(existente, 1, 1, linha.length).setValues([linha])
  } else {
    aba.appendRow(linha)
  }
}

function abaPreparada() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet()
  let aba = planilha.getSheetByName(ABA)
  if (!aba) aba = planilha.insertSheet(ABA)

  if (aba.getLastRow() === 0) {
    aba.appendRow(COLUNAS)
    aba.getRange(1, 1, 1, COLUNAS.length).setFontWeight('bold')
    aba.setFrozenRows(1)
    // A coluna do id serve só para reencontrar a linha; não interessa ler.
    aba.hideColumns(1)
  }
  return aba
}

function procurarLinha(aba, inscricaoId) {
  const total = aba.getLastRow()
  if (total < 2) return -1
  const ids = aba.getRange(2, 1, total - 1, 1).getValues()
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(inscricaoId)) return i + 2
  }
  return -1
}

function seguroIgual(a, b) {
  if (a.length !== b.length) return false
  let diferenca = 0
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diferenca === 0
}

function responder(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON)
}
