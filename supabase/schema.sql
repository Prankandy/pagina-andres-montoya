-- ============================================================
--  Tabla de leads del panel de administración (/admin).
--  Pégalo en Supabase → SQL Editor → New query → Run.
--  Se puede ejecutar varias veces sin romper nada.
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

-- Seguridad: RLS activo y SIN políticas. Nadie puede leer ni escribir con la
-- clave pública (anon); solo las funciones de Vercel, que usan la service_role.
alter table public.leads enable row level security;

-- Para borrar los leads de prueba del rastreo simulado:
-- delete from public.leads where fuente = 'simulado';
