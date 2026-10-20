-- ============================================================
--  Radar cada 5 minutos con Supabase Cron (pg_cron + pg_net).
--  Córrelo en Supabase → SQL Editor, POR PARTES y en orden.
--  Antes debe estar actualizado schema.sql.
-- ============================================================

-- 1) Extensiones (una sola vez). Si da error de permisos, actívalas en
--    Database → Extensions: pg_cron y pg_net.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2) Crear la clave que comparten Supabase y Vercel, guardada en el Vault.
--    Córrelo UNA sola vez: si lo repites, avisa que el nombre ya existe (no pasa nada).
select vault.create_secret(
  replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  'radar_cron_secret',
  'Clave con la que Supabase Cron llama a /api/trigger-scraper'
);

-- 3) Ver la clave y copiarla en Vercel como CRON_SECRET (Production, Sensitive).
--    No la pegues en chats ni en archivos del repositorio.
select decrypted_secret from vault.decrypted_secrets where name = 'radar_cron_secret';

-- 4) Programar el radar cada 5 minutos. Si ya existe con este nombre, se actualiza.
select cron.schedule(
  'radar-reddit',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://andresfmontoya.vercel.app/api/trigger-scraper',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'radar_cron_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- ---------- Revisar que funcione ----------
-- Tareas programadas:
--   select jobname, schedule, active from cron.job;
-- Últimas ejecuciones:
--   select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
-- Respuestas de Vercel (200 = bien; 401 = CRON_SECRET distinto en Vercel):
--   select status_code, left(content::text, 300) as respuesta, created
--   from net._http_response order by created desc limit 5;

-- ---------- Pausar o quitar el radar ----------
--   select cron.unschedule('radar-reddit');
