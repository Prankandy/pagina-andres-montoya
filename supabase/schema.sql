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

-- Inserta varios leads e ignora los repetidos (misma url o misma huella).
-- Devuelve solo los nuevos: a esos se les envía la alerta de Telegram.
create or replace function public.insertar_leads(filas jsonb)
returns setof public.leads
language sql
as $$
  insert into public.leads (nombre, necesidad, categoria, urgencia, fuente, url, telefono, huella)
  select nombre, necesidad, categoria, coalesce(urgencia, 'media'), fuente, url, telefono, huella
  from jsonb_to_recordset(filas)
    as f(nombre text, necesidad text, categoria text, urgencia text, fuente text, url text, telefono text, huella text)
  on conflict do nothing
  returning *;
$$;

-- Solo la service_role (funciones de Vercel) puede llamarla.
revoke execute on function public.insertar_leads(jsonb) from public, anon, authenticated;
grant execute on function public.insertar_leads(jsonb) to service_role;

-- Seguridad: RLS activo y SIN políticas. Nadie puede leer ni escribir con la
-- clave pública (anon); solo las funciones de Vercel, que usan la service_role.
alter table public.leads enable row level security;

-- Para borrar los leads de prueba del rastreo simulado:
-- delete from public.leads where fuente = 'simulado';
