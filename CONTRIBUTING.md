# Como contribuir

Este repositório é a central de trabalho do projeto: **nada entra direto na `main`** — todo ajuste vira um branch e um pull request.

## Fluxo padrão

1. Atualize sua base:
   ```bash
   git checkout main && git pull origin main
   ```
2. Crie o branch com o prefixo certo:
   ```bash
   git checkout -b feat/nome-curto
   ```
3. Faça as alterações e valide localmente:
   ```bash
   pnpm typecheck && pnpm build
   ```
4. Commit e push:
   ```bash
   git commit -m "feat: descrição curta no imperativo"
   git push -u origin feat/nome-curto
   ```
5. Abra o PR contra a `main`, preenchendo o template.

## Nomes de branch

| Prefixo | Use para |
| --- | --- |
| `feat/` | nova funcionalidade ou etapa do funil |
| `fix/` | correção de bug |
| `chore/` | dependências, configuração, tarefas de manutenção |
| `docs/` | apenas documentação |
| `refactor/` | reorganização sem mudança de comportamento |
| `claude/` | branches criados por sessões do Claude Code |

## Mensagens de commit

Padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/), em português, no imperativo:

```
feat: adiciona validação de e-mail na etapa 6 da triagem
fix: corrige máscara de CPF ao colar valor formatado
chore: atualiza next para 16.3.1
```

## Checagens

O workflow `CI` (`.github/workflows/ci.yml`) roda em todo push e todo PR:

- `pnpm install --frozen-lockfile` — o `pnpm-lock.yaml` precisa estar em dia; sempre commite o lockfile junto com mudanças em `package.json`.
- `pnpm typecheck` — `tsc --noEmit` em modo `strict`. Passa limpo hoje; mantenha assim.
- `pnpm build` — build de produção com Turbopack.

> `next.config.mjs` usa `typescript.ignoreBuildErrors: true`, então o build **não** barra erro de tipo. Quem barra é o passo `typecheck` do CI — não remova.

## Antes de pedir review

- [ ] `pnpm typecheck` e `pnpm build` passam localmente
- [ ] Testado no mobile (o funil é majoritariamente mobile-first)
- [ ] Nenhum dado real de aluno, chave PIX de produção ou credencial no diff
- [ ] Se mexeu em `lib/enrollment.ts`, conferiu os fluxos de `/` e `/triagem/[step]`

## Dados sensíveis

O projeto lida com CPF, telefone e pagamento. Nunca commite CPFs reais, chaves de PSP, tokens ou `.env`. Dados de exemplo devem ser claramente fictícios.
