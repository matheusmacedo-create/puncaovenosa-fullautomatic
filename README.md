# Curso de Punção Venosa — Cruz Vermelha Brasileira RJ

Aplicação Next.js do **Curso de Punção Venosa (8h, presencial)** da Cruz Vermelha Brasileira — Rio de Janeiro: página de vendas, checkout via PIX ou cartão, confirmação de vaga, triagem de 8 perguntas e ficha do aluno em PWA. Os dados são persistidos em Postgres no Supabase.

Página de vendas e checkout são **um app só**, e não dois projetos. Não é organização: a sessão do aluno é um cookie `SameSite=Lax`, que o navegador não envia dentro de um iframe de outra origem — em dois domínios, o aluno pagaria e voltaria sem inscrição.

## Fluxo do produto

| Etapa | Rota | O que acontece |
| --- | --- | --- |
| 0. Venda | `/` | Landing: oferta, conteúdo, FAQ, prova institucional. Os CTAs abrem o checkout numa gaveta sobre a página, preservando UTMs e a variante do teste A/B |
| 1. Captura | `/inscricao?etapa=dados` | Dados (nome, WhatsApp, e-mail, CPF, pré-requisito de ensino médio) e composição do preço |
| 2. Pagamento | `/inscricao?etapa=pagamento` | Escolha entre PIX (copia-e-cola) e cartão (com parcelamento). Estados `pendente / confirmado / expirado / recusado` |
| 3. Confirmação | `/inscricao?etapa=confirmado` | Vaga garantida — convite para a triagem |
| 4. Triagem | `/triagem/1` … `/triagem/8` | CEP, perfil profissional, turno, dias, urgência, e-mail opcional, origem e confirmação final |
| 5. Ficha do aluno | `/minha-inscricao` | Comprovante com QR, dados do curso e local — instalável como PWA e imprimível |
| 6. Conferência | `/validar/[token]` | Credencial do aluno lida na portaria, sem login |

A sessão do aluno é um cookie `httpOnly` (`cvb_inscricao`) com o id da inscrição — não há login. O `localStorage` (`cvb-enrollment`, `cvb-triage`) continua como cache do rascunho, mas **o servidor é a fonte da verdade**.

## Preço

| Item | Valor |
| --- | --- |
| Matrícula | R$ 99,00 |
| Curso presencial, 8h | R$ 150,00 |
| **Total à vista** | **R$ 249,00** |

O aluno paga o total de uma vez, em PIX ou cartão. A composição é definida em `COMPOSICAO_PRECO` (`lib/enrollment.ts`) e o total é **derivado da soma** — nunca escreva o valor solto. A landing lê os mesmos valores por `lib/course-data.ts`: anunciar um preço e cobrar outro é o pior defeito possível numa página de venda.

Cada cobrança grava sua própria composição na coluna `pagamentos.itens`, e uma constraint no banco exige que os itens fechem com `valor_centavos`. Isso impede que uma cobrança de R$ 249 seja registrada com itens somando R$ 99.

Cobrar apenas a matrícula é aceito pelo modelo, mas **não está implementado no funil** — fica disponível para um downsell futuro.

## Arquitetura de dados

Todo acesso ao banco passa por route handlers no servidor. As três tabelas têm RLS ligada e **forçada, sem nenhuma policy**, o que nega qualquer acesso pela chave publicável; o servidor usa a chave secreta, que ignora RLS.

| Tabela | Guarda |
| --- | --- |
| `inscricoes` | Aluno, com CPF como chave natural única |
| `triagem_respostas` | Uma linha por passo, resposta em `jsonb` |
| `pagamentos` | Cobranças PIX e cartão, com histórico de tentativas |

Três funções no banco mantêm atômico o que seria uma sequência de queries:

- `upsert_inscricao` — cria ou atualiza pelo CPF, sem rebaixar quem já pagou
- `confirmar_pagamento` — **idempotente**: webhook e clique podem chegar juntos sem gerar dois números de inscrição
- `concluir_triagem_se_completa` — promove o status só quando os 8 passos existem

### Rotas de API

| Rota | Para que serve |
| --- | --- |
| `POST /api/inscricoes` | Cria/atualiza a inscrição e abre a sessão |
| `GET /api/inscricoes/atual` | Estado da inscrição da sessão |
| `GET /api/inscricoes/consulta` | Diz se um CPF já tem cadastro (resposta mascarada) |
| `POST /api/pagamentos` | Abre uma cobrança PIX ou cartão |
| `GET /api/pagamentos/atual` | Última cobrança — usada no polling da tela de pagamento |
| `POST /api/pagamentos/confirmar` | Confirma e promove a inscrição (só com a simulação ligada) |
| `POST /api/pagamentos/desfecho` | Encerra como `expirado` ou `recusado` |
| `GET`/`PUT` `/api/triagem` | Lê e grava as respostas da triagem |
| `POST /api/webhooks/unicopag` | Postback da Únicopag — confirma consultando a API, não confia no corpo |
| `GET /api/diagnostico` | Estado da configuração e da simulação |

### Credencial do aluno

Cada inscrição carrega um `token_validacao` — 128 bits aleatórios em hexadecimal, gerado pelo banco. O QR Code da ficha aponta para `/validar/<token>`, e é essa página que qualquer pessoa da instituição abre ao escanear, sem login.

Hexadecimal, e não base64: base64 termina em `=` e pode conter `+`, que numa URL são ambíguos — o token que chega ao servidor deixa de ser o do banco e a credencial válida é recusada. Aconteceu no primeiro desenho.

A página mostra só o necessário para conferir a pessoa com um documento: nome, número de inscrição, miolo do CPF e situação. Cada leitura é registrada em `validacoes`, com o horário — que aparece na tela justamente para denunciar uma captura de tela antiga sendo exibida no lugar de uma conferência real.

O QR **não** usa serviço externo: é gerado no próprio navegador pela biblioteca `qrcode`. Dado de aluno não precisa passar por terceiros para virar imagem.

### Dados de cartão e PCI

O número do cartão, o CVV e a validade **nunca** trafegam pela nossa API nem são gravados. `POST /api/pagamentos` rejeita explicitamente qualquer corpo que contenha esses campos. O banco guarda apenas bandeira, últimos 4 dígitos e parcelas. A tokenização acontece no navegador, pelo SDK do provedor.

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19**
- **TypeScript 5.7** em modo `strict`
- **Tailwind CSS 4** via `@tailwindcss/postcss`, com design system em `app/globals.css`
- **lucide-react** para ícones, **Vercel Analytics** em produção
- **pnpm** como gerenciador de pacotes

## Rodando localmente

```bash
cp .env.example .env.local   # e preencha SUPABASE_SECRET_KEY
pnpm install
pnpm dev                     # http://localhost:3000
```

Sem as variáveis do Supabase a interface sobe normalmente, mas as rotas de API respondem `503`.

### Variáveis aceitas

| Para quê | Nomes aceitos |
| --- | --- |
| URL do projeto | `NEXT_PUBLIC_SUPABASE_URL` ou `SUPABASE_URL` |
| Chave secreta | `SUPABASE_SECRET_KEY` ou `SUPABASE_SERVICE_ROLE_KEY` |

As segundas opções são os nomes que a integração Supabase da Vercel injeta sozinha. Num deploy pela Vercel com essa integração ativa, não é preciso configurar nada à mão.

### Teste operacional com preço reduzido

`NEXT_PUBLIC_PRECO_TESTE_CENTAVOS=10` faz o funil cobrar R$ 0,10 em vez de R$ 249. É o jeito de percorrer o fluxo pagando de verdade — o único caminho que prova que o dinheiro entra e a vaga é liberada.

O valor é repartido entre os itens na mesma proporção do preço real (R$ 0,10 vira R$ 0,04 de matrícula e R$ 0,06 de curso), porque uma constraint no banco exige que a composição feche com o total, e a Únicopag recusa item com preço zero. Abaixo de um centavo por item, a composição vira um item único.

O preço não é editado no código de propósito: um valor trocado à mão é fácil de esquecer revertido, e o curso passaria a ser vendido por centavos. Como variável, some sozinho quando ela sair — e o diagnóstico acusa enquanto estiver definida.

## Antes de vender

`GET /api/diagnostico` responde `prontoParaVender` e lista o que falta. As pendências possíveis:

| Pendência | Efeito |
| --- | --- |
| `UNICO_API_KEY` ausente | Nenhuma cobrança é real |
| Chave recusada pela API | Cobrança falha no ato |
| Simulação ativa | As cobranças não são reais |
| `PERMITIR_CONFIRMACAO_MANUAL` ligada | Qualquer visitante conclui a inscrição sem pagar |
| `NEXT_PUBLIC_SITE_URL` ausente | A Únicopag não consegue avisar o pagamento |
| Preço de teste em uso | O curso está sendo vendido por centavos |

As rotas de pagamento declaram `maxDuration = 60`. A criação de cobrança no cartão leva cerca de 11 segundos na Únicopag, e o limite padrão de uma função na Vercel é 10 — sem isso, o aluno receberia erro numa cobrança possivelmente criada.

## Publicando na Vercel

1. Em vercel.com, **Add New → Project** e importar `puncaovenosa-fullautomatic`.
2. A Vercel detecta Next.js e pnpm sozinha — não mexa em build command nem output directory.
3. Em **Settings → Environment Variables**, conferir se a URL e a chave secreta do Supabase estão presentes (a integração costuma injetá-las). Se não estiverem, adicionar com qualquer um dos nomes da tabela acima.
4. Para conseguir percorrer o funil sem provedor de pagamento, adicionar `SIMULAR_PAGAMENTO` com valor `true`. **Remova essa variável antes de receber aluno de verdade.**
5. Deploy. Cada push na `main` gera um novo deploy, e cada pull request ganha uma URL de preview própria.

### Diagnóstico

`GET /api/diagnostico` responde o estado da configuração num ambiente onde não dá para abrir o terminal — o preview do v0, um deploy na Vercel:

```json
{ "ok": true, "etapa": "tudo certo",
  "config": { "url": {...}, "chave": { "tipo": "secreta (correta)", "serve": true } },
  "banco": { "leTabelas": true, "temFuncoes": true } }
```

Fica **sem proteção** de propósito: a primeira versão exigia a simulação ligada e, com isso, respondia `403` justamente quando alguém precisava descobrir por que a simulação estava desligada. Ele informa se a simulação está ativa, o motivo, e nomeia os enganos mais comuns: URL inválida, o nome da variável colado no lugar do valor, e a chave **publicável** usada onde deveria estar a secreta. Esse último é traiçoeiro — a chave publicável não gera erro, o RLS apenas devolve lista vazia, então tudo parece funcionar e nada é gravado.

Nenhum segredo é devolvido: da chave, só o prefixo. A rota fica atrás da mesma variável da simulação, e responde `403` sem ela.

| Resposta | O que fazer |
| --- | --- |
| `etapa: "configuração"` | Corrigir a variável que o campo aponta |
| `etapa: "banco"` | Chave certa, mas o schema não respondeu — conferir se as migrations rodaram |
| `etapa: "tudo certo"` | Configuração ok; o problema é outro |

### Simulação de pagamento

O app decide sozinho, a partir do ambiente:

| Situação | Comportamento |
| --- | --- |
| Nenhuma chave de provedor configurada | **Simula** — copiar o PIX ou pagar no cartão aprova e avança |
| `UNICO_API_KEY` presente | **Não simula** — o dinheiro é real |

Exigir uma variável para ligar a simulação parecia mais seguro, mas não era: sem provedor ninguém consegue pagar de qualquer forma, então a variável desligada apenas travava o funil sem proteger nada. A proteção aparece sozinha quando a chave do provedor existir.

`SIMULAR_PAGAMENTO` tem a palavra final e sobrescreve os dois lados — `true` força a simulação, `false` a desliga. Na Vercel, lembre-se de que **cada ambiente tem suas próprias variáveis**: um valor definido só em Production não vale nos previews, e vice-versa. Alterar a variável exige **refazer o deploy** para valer.

Enquanto a simulação está ativa, a tela de pagamento exibe um aviso de modo de teste.

Outros comandos:

```bash
pnpm typecheck    # tsc --noEmit
pnpm build        # build de produção
pnpm start        # servir o build
```

## Estrutura

```
app/                    Rotas do App Router (landing, triagem/[step], minha-inscricao)
  globals.css           Design system completo (tokens, componentes, print styles)
components/             Componentes de fluxo (enrollment, triage, student-pass, header)
  ui/                   Primitivas shadcn
  api/                  Route handlers — a única camada que fala com o banco
components/card-form.tsx  Formulário de cartão (tokenização entra aqui)
lib/enrollment.ts       Tipos, máscaras, validação de CPF e cartão, preço e perguntas da triagem
lib/api-cliente.ts      Chamadas do navegador para as rotas
lib/supabase/server.ts  Cliente Supabase com a chave secreta (nunca importar no cliente)
lib/session.ts          Cookie httpOnly da sessão do funil
supabase/migrations/    Schema versionado
public/                 Ícones, manifest PWA e service worker
```

## Pontos de integração pendentes

O funil está ligado à **Únicopag** em produção. PIX e cartão criam cobrança de verdade.

| Etapa | Estado |
| --- | --- |
| Cadastro, triagem, número de inscrição | Real |
| Cobrança PIX e cartão | **Real** — Únicopag |
| Confirmação de pagamento | **Real** — postback verificado contra a API |
| QR Code exibido | Decorativo; o código copia-e-cola é o real |

Ainda pendente: o QR desenhado em `components/clinical-header.tsx` é visual e não codifica o payload — quem paga precisa usar o copia-e-cola.

### Como a cobrança funciona

`POST /public/v1/payments` recebe `amount` em centavos, `customer` (nome, e-mail, telefone e CPF — todos obrigatórios), `cart` com a composição do preço e `postback_url`. A resposta traz o `hash` da transação, que gravamos em `pagamentos.provedor_id`, e o `pix.pix_qr_code`, que é o copia-e-cola exibido ao aluno.

**O e-mail é obrigatório para o provedor**, por isso ele passou a ser pedido já na primeira etapa do funil — antes ele só aparecia na triagem, que acontece depois do pagamento.

### Prazo do PIX

A Únicopag mantém o código pagável por 24 horas (`expire_in_days`). A tela **não** marca a cobrança como expirada por conta própria quando há provedor — quem define a validade é ele. A versão anterior encerrava aos 30 minutos, e um aluno que pagasse no minuto 31 tinha o dinheiro debitado e a inscrição recusada pelo nosso próprio código.

Pelo mesmo motivo, `confirmar_pagamento` honra um pagamento confirmado pelo provedor mesmo se a cobrança estiver marcada como expirada: quem chama já verificou contra a API, então o pagamento é fato consumado.

### Confirmação de pagamento

A confirmação tem **dois caminhos independentes**, porque depender só do postback significaria deixar o aluno na tela de espera sempre que ele falhasse:

1. **Postback** — a Únicopag avisa em `/api/webhooks/unicopag`.
2. **Consulta ativa** — `GET /api/pagamentos/atual`, que a tela consulta a cada 10 segundos, pergunta o status direto à API quando a cobrança está pendente.

O postback da Únicopag **não é fonte da verdade**. A documentação não descreve assinatura, então qualquer um que descobrisse a URL poderia forjar um "pago". O que chega serve apenas de gatilho: o `hash` é usado para consultar `GET /public/v1/transactions/:hash`, e é essa resposta que decide. Verificado na prática — um postback forjado dizendo `paid` não confirma a inscrição.

### CEP na triagem

O primeiro passo da triagem aceita **CEP ou endereço**. Digitando números, resolve o CEP pela ViaCEP e mostra o bairro e a cidade para o aluno confirmar. Digitando letras, vira busca por logradouro (`/ws/UF/Cidade/Rua/json/`) e lista as ruas encontradas — clicar numa delas preenche o CEP. Quem não sabe o próprio CEP é justamente quem trava num formulário; sem isso, restava mandar o aluno procurar em outro site no meio da inscrição.

As duas consultas passam pelo servidor, por `/api/cep/[cep]` e `/api/enderecos`. É o padrão do projeto — quem fala com terceiro é o servidor —, mantém `connect-src 'self'` na CSP, evita expor o IP do aluno aos provedores e permite cachear (CEP não muda; um mês).

**A consulta por CEP usa duas fontes em cadeia.** A BrasilAPI vem primeiro, porque ela mesma consulta vários serviços por baixo e só desiste quando todos falham; a ViaCEP entra depois, como segunda opinião. Um CEP só é dado como inexistente quando as duas concordam — antes disso, o mais provável é que uma esteja fora do ar, e não que o aluno tenha digitado um endereço que não existe. Cada uma tem 4 segundos de paciência, então o pior caso são 8, e o normal é a primeira responder em menos de um.

A **busca por nome de rua fica só na ViaCEP**: a BrasilAPI não tem esse endpoint (verificado — responde 404). As duas também divergem no formato do CEP (uma devolve `20230130`, a outra `20230-130`), uniformizado em `lib/cep.ts` para o resto do funil não precisar saber de qual veio.

A busca por rua tem duas particularidades da ViaCEP que o código trata:

- **Ela casa pedaço de texto, não palavra.** Quem procura "Praça da Cruz Vermelha" não acha "Praça Cruz Vermelha", porque o "da" não está lá — e é assim que as pessoas falam o nome da rua. Quando a primeira busca volta vazia, há uma segunda sem as ligações (`da`, `de`, `do`, `das`, `dos`, `e`). É tentativa, e não regra: em "Avenida das Américas" a ligação faz parte do nome, e tirá-la de saída estragaria a busca que teria funcionado.
- **UF, cidade e rua são obrigatórios**, com no mínimo três letras nas duas últimas. A UF e a cidade vêm preenchidas com RJ e Rio de Janeiro, que é de onde vem quase todo mundo num curso presencial na sede, e quem não é de lá troca.

A resposta do passo 1 guarda `{ cep, bairro, cidade, uf }`, e não só o número, para a secretaria montar turma por região sem consultar CEP a CEP depois. Os leitores aceitam também a forma antiga, em texto puro: há rascunhos em `localStorage` de quem começou a triagem antes.

Falha de consulta e CEP inexistente são tratados diferente, de propósito: um CEP que não existe quase sempre é dígito errado e **bloqueia** o avanço; a ViaCEP fora do ar é problema nosso e **não** pode custar a vaga de quem digitou certo — a tela avisa e deixa seguir.

> A versão anterior exibia `Tijuca, Rio de Janeiro` fixo assim que o campo chegava a 8 dígitos, viesse o CEP de onde viesse. Era um resquício do mockup, e dizia a coisa errada para todo mundo que não fosse da Tijuca.

### Painel da secretaria

`/secretaria` mostra ao vivo o que está passando pelo funil: quem entrou, quem pagou, e as respostas de triagem que definem a turma (CEP, perfil, turno, dias, urgência, origem). Lê direto do banco, que já é a fonte da verdade — não há cópia para sincronizar nem exportação para agendar.

Ligado por `SECRETARIA_SENHA`. Sem ela a rota responde **404**: um deploy que não pediu pelo painel não tem painel para invadir. A senha precisa ter no mínimo 16 caracteres, e o painel não liga com menos — não há como limitar tentativas numa página exposta na internet sem um lugar para contá-las, então a defesa possível é exigir que ela seja longa.

O formulário de entrada é `method="post"` puro, sem JavaScript: a secretaria pode estar num computador antigo, e uma tela de acompanhamento não deveria depender de bundle. O cookie de sessão (`cvb_secretaria`, httpOnly, 8 horas) guarda o hash da senha, não a senha.

A página lista nome, CPF e telefone de alunos reais. A senha é da secretaria, não de divulgação.

### Planilha da secretaria (alternativa)

Ponte provisória, ligada por `PLANILHA_URL` e `PLANILHA_TOKEN`. Sem as duas variáveis, o espelhamento não acontece e o funil funciona igual. Serve para a secretaria enxergar o que está sendo coletado antes de existir integração com os sistemas dela.

Um Apps Script preso à planilha (`docs/planilha-secretaria.gs`, com o passo a passo de instalação no topo do arquivo) recebe um POST do servidor e mantém **uma linha por aluno**, encontrada pelo id da inscrição. A linha é escrita quando a inscrição é criada e reescrita a cada mudança de status do pagamento — inclusive recusa e expiração, para dar visibilidade ao abandono no funil.

Três decisões que valem manter:

- **A gravação sai do servidor, nunca do navegador.** Por isso nenhuma das duas variáveis leva `NEXT_PUBLIC_`: CPF não pode transitar pelo cliente rumo a um terceiro, e o token não pode existir no bundle — é ele que protege a planilha, já que o Google exige "qualquer pessoa" para aceitar POST sem login.
- **Acontece depois da resposta**, via `after()` do `next/server`. O aluno não espera o Google, e um Apps Script lento não entra no tempo de criar inscrição nem de confirmar pagamento.
- **Nunca lança.** Planilha fora do ar não derruba inscrição nem confirmação: o banco continua sendo a fonte da verdade e a planilha é uma cópia para leitura humana.

O espelhamento só dispara na **transição** de status, e não a cada consulta — `/api/pagamentos/atual` é chamada a cada 10 segundos, e sem esse cuidado a planilha seria reescrita o tempo todo.

A planilha guarda CPF e telefone de alunos reais. Deixe-a restrita a quem precisa, nunca "qualquer pessoa com o link".

### Dados de cartão e PCI-DSS

A API da Únicopag **recebe o número do cartão em claro**; não há tokenização no navegador. O dado atravessa o nosso servidor a caminho do provedor, o que coloca a aplicação no escopo de PCI-DSS. As regras em vigor:

- número, CVV e validade **nunca** são gravados em banco, log ou arquivo — existem só em memória durante a requisição;
- o objeto `card` nunca entra em `console.log` nem em mensagem de erro;
- do cartão, o banco guarda apenas bandeira e últimos 4 dígitos, que a própria Únicopag devolve.


## Contribuindo

Todo o trabalho entra por pull request. Ver [CONTRIBUTING.md](CONTRIBUTING.md).
