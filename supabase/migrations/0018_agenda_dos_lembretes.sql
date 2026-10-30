-- Agenda dos lembretes de recuperação: 8 rodadas por dia, das 7h às 21h de
-- Brasília (10h, 12h, ..., 22h e 0h UTC), no minuto 7.
--
-- Mora no banco, e não no vercel.json, porque o plano Hobby da Vercel recusa
-- no deploy qualquer cron que rode mais de uma vez por dia. O pg_cron só
-- chama a rota (GET /api/lembretes/sync) pelo pg_net; quem decide quem
-- recebe o quê continua sendo lib/lembretes-regras.ts.
--
-- O segredo NÃO está aqui: vive no Vault, com o nome `lembretes_segredo`, e
-- tem o mesmo valor de LEMBRETES_SEGREDO na Vercel. Para criar ou trocar:
--
--   select vault.create_secret('<valor>', 'lembretes_segredo');            -- primeira vez
--   select vault.update_secret(id, '<valor>') from vault.secrets
--    where name = 'lembretes_segredo';                                     -- troca
--
-- Sem o segredo no Vault, o cabeçalho vai sem valor e a rota responde 401 —
-- nada é enviado. Para pausar os lembretes sem mexer em código:
--
--   select cron.unschedule('lembretes-de-recuperacao');

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('lembretes-de-recuperacao')
 where exists (select 1 from cron.job where jobname = 'lembretes-de-recuperacao');

select cron.schedule(
  'lembretes-de-recuperacao',
  '7 0,10,12,14,16,18,20,22 * * *',
  $$
    select net.http_get(
      url := 'https://puncaovenosav1.cruzvermelhariodejaneiro.org/api/lembretes/sync',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'lembretes_segredo'), '')
      ),
      -- A rodada espera entre um envio e outro; o padrão de 5s cortaria a
      -- conexão no meio dela.
      timeout_milliseconds := 150000
    );
  $$
);
