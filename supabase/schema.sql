create extension if not exists "pgcrypto";

create table if not exists public.experiments (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  experiment jsonb not null,
  created_at timestamptz not null default now()
);