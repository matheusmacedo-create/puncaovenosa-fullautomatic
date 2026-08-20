# Guia do repositório para sessões do Claude Code

Contexto que vale carregar antes de mexer em qualquer coisa aqui.

## O que é

Funil de inscrição do Curso de Punção Venosa da Cruz Vermelha Brasileira RJ. Next.js 16 (App Router, Turbopack), React 19, TypeScript strict, Tailwind 4. Ver `README.md` para o mapa de rotas e etapas.

## Comandos

```bash
pnpm install --frozen-lockfile   # sempre com lockfile
pnpm dev                         # desenvolvimento
pnpm typecheck                   # tsc --noEmit — é o gate real de tipos
pnpm build                       # build de produção
```

Use **pnpm**, nunca npm ou yarn — o lockfile é do pnpm e o CI roda com `--frozen-lockfile`.

## Convenções do código

- Estilo enxuto, uma linha por bloco JSX quando cabe — é o padrão que veio do v0 e está mantido por todo o projeto. Combine com o arquivo ao redor em vez de reformatar.
- Sem biblioteca de CSS-in-JS: todo o visual está em `app/globals.css` com classes semânticas (`.triage-shell`, `.primary-button`, `.student-pass`). Reaproveite classe existente antes de criar uma nova.
- Textos de interface em **português do Brasil**, tom clínico e direto.
- Alias de import é `@/*` apontando para a raiz.
- `lib/enrollment.ts` é a fonte única de máscaras, validação, chaves de `localStorage` e das 8 perguntas da triagem. Mudou lá, confira `/` e `/triagem/[step]`.

## Armadilhas

- `next.config.mjs` tem `typescript.ignoreBuildErrors: true` — `pnpm build` passa mesmo com erro de tipo. Rode `pnpm typecheck` sempre; hoje ele passa limpo.
- A triagem tem exatamente 8 passos, validados em `app/triagem/[step]/page.tsx` e usados no cálculo da barra de progresso (`step * 12.5`). Mudar a quantidade de perguntas exige mexer nos dois lugares.
- Todo estado vive em `localStorage`; não há back-end. Componentes que leem estado usam `useEffect` para evitar mismatch de hidratação — mantenha esse padrão.
- Pagamento, código PIX, número de inscrição e QR são **simulados**. Trechos marcados com `[INTEGRAÇÃO]` sinalizam onde entra back-end de verdade.

## Fluxo de trabalho

Branch por tarefa, PR contra a `main`, template preenchido. Detalhes em `CONTRIBUTING.md`.
