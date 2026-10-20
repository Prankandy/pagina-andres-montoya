-- ============================================================
--  Tabla de leads del panel de administración (/admin).
--  Pégalo en Supabase → SQL Editor → New query → Run.
--  Se puede ejecutar varias veces sin romper nada: si la tabla ya
--  existe, solo agrega lo que falte.
-- ============================================================

create table if not exists public.leads (
  id             bigint generated always as identity primary key,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  nombre         text not null,                 -- persona o negocio
  necesidad      text not null,                 -- lo que pidió, en sus palabras
  categoria      text not null check (categoria in ('soporte', 'desarrollo')),
  estado         text not null default 'NUEVO'
                   check (estado in ('NUEVO', 'CONTACTADO', 'CERRADO')),
  fuente         text,                          -- facebook, x, reddit, simulado…
  url            text unique,                   -- publicación o perfil; evita guardar el mismo lead dos veces
  telefono       text                           -- WhatsApp en formato internacional, sin "+" (opcional)
);

create index if not exists leads_creado_en_idx on public.leads (creado_en desc);

-- Fase 1 (alertas): se agregan sin tocar los datos que ya existen.
alter table public.leads
  add column if not exists urgencia text not null default 'media'
    check (urgencia in ('alta', 'media', 'baja'));
alter table public.leads
  add column if not exists huella text unique;  -- hash del texto: el mismo pedido publicado en varios sitios entra una sola vez

-- Fase 2 (Reddit + IA)
alter table public.leads
  add column if not exists resumen text;        -- lo que necesita, en una frase (lo escribe la IA)

-- Panel: notas de seguimiento por lead ("le escribí por DM el martes, pidió cotización").
alter table public.leads
  add column if not exists notas text;

-- Publicaciones que la IA ya evaluó, sean lead o no. Evita pagar dos veces por
-- la misma publicación: el rastreo corre cada 5 minutos y ve las mismas 24 horas.
create table if not exists public.revisados (
  url          text primary key,
  huella       text,
  es_lead      boolean not null,
  resumen      text,
  revisado_en  timestamptz not null default now()
);
create index if not exists revisados_huella_idx on public.revisados (huella);

-- Inserta varios leads e ignora los repetidos (misma url o misma huella).
-- Devuelve solo los nuevos: a esos se les envía la alerta de Telegram.
create or replace function public.insertar_leads(filas jsonb)
returns setof public.leads
language sql
as $$
  insert into public.leads (nombre, necesidad, resumen, categoria, urgencia, fuente, url, telefono, huella)
  select nombre, necesidad, resumen, categoria, coalesce(urgencia, 'media'), fuente, url, telefono, huella
  from jsonb_to_recordset(filas)
    as f(nombre text, necesidad text, resumen text, categoria text, urgencia text, fuente text, url text, telefono text, huella text)
  on conflict do nothing
  returning *;
$$;

-- De una lista de publicaciones [{url, huella}], devuelve las que nadie ha
-- revisado todavía (ni están en revisados ni ya son un lead).
create or replace function public.posts_sin_revisar(posts jsonb)
returns table (pendiente text)
language sql
stable
as $$
  select p.url
  from jsonb_to_recordset(posts) as p(url text, huella text)
  where not exists (
      select 1 from public.revisados r
      where r.url = p.url or (p.huella is not null and r.huella = p.huella))
    and not exists (
      select 1 from public.leads l
      where l.url = p.url or (p.huella is not null and l.huella = p.huella));
$$;

-- Cuántos leads hay en cada estado (para los contadores del panel), opcionalmente de una categoría.
create or replace function public.conteo_leads(cat text default null)
returns table (estado_lead text, cantidad bigint)
language sql
stable
as $$
  select l.estado, count(*)
  from public.leads l
  where cat is null or l.categoria = cat
  group by l.estado;
$$;

-- Solo la service_role (funciones de Vercel) puede llamarlas.
revoke execute on function public.conteo_leads(text) from public, anon, authenticated;
grant execute on function public.conteo_leads(text) to service_role;
revoke execute on function public.insertar_leads(jsonb) from public, anon, authenticated;
grant execute on function public.insertar_leads(jsonb) to service_role;
revoke execute on function public.posts_sin_revisar(jsonb) from public, anon, authenticated;
grant execute on function public.posts_sin_revisar(jsonb) to service_role;

-- Seguridad: RLS activo y SIN políticas. Nadie puede leer ni escribir con la
-- clave pública (anon); solo las funciones de Vercel, que usan la service_role.
alter table public.leads enable row level security;
alter table public.revisados enable row level security;

-- Para borrar los leads de prueba del rastreo simulado (versión anterior):
-- delete from public.leads where fuente = 'simulado';
