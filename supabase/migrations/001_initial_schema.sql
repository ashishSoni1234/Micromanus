-- supabase/migrations/001_initial_schema.sql
-- Run this in the Supabase SQL editor to set up the database.
-- Also available in DEV_SETUP.md as a setup step.

-- ============================================================
-- TABLES
-- ============================================================

-- users: app-specific extension of auth.users
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  credits integer not null default 0,
  paywall_cleared boolean not null default false,
  created_at timestamptz not null default now()
);

-- api_keys: encrypted user LLM API keys (one row per provider per user)
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null check (provider in ('anthropic', 'openai', 'kimi', 'gemini', 'groq')),
  encrypted_key text not null,
  iv text not null,
  auth_tag text not null,
  updated_at timestamptz not null default now(),
  unique(user_id, provider)
);

-- chats: conversation threads
create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null default 'New Chat',
  created_at timestamptz not null default now()
);

-- messages: individual messages within a thread
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool')),
  content text not null default '',
  tool_calls jsonb,
  tool_result jsonb,
  created_at timestamptz not null default now()
);

-- usage_records: one row per LLM API call, for the cost dashboard
create table if not exists public.usage_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  chat_id uuid not null references public.chats(id) on delete cascade,
  model text not null,
  provider text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cost_usd numeric(12, 8) not null default 0,
  created_at timestamptz not null default now()
);

-- stripe_events: idempotency guard for Stripe webhooks
create table if not exists public.stripe_events (
  stripe_event_id text primary key,
  processed_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.users enable row level security;
alter table public.api_keys enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;
alter table public.usage_records enable row level security;
-- stripe_events has no RLS (accessed only by service role)

-- users: users can read/update their own row
create policy "Users can view own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id);

-- api_keys: users can CRUD their own keys
create policy "Users can manage own api_keys"
  on public.api_keys for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- chats: users can CRUD their own threads
create policy "Users can manage own chats"
  on public.chats for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- messages: users can read/write messages in their own chats
create policy "Users can manage own messages"
  on public.messages for all
  using (
    exists (
      select 1 from public.chats
      where chats.id = messages.chat_id
        and chats.user_id = auth.uid()
    )
  );

-- usage_records: users can read their own usage
create policy "Users can view own usage"
  on public.usage_records for select
  using (auth.uid() = user_id);

-- ============================================================
-- HELPER FUNCTION: create user profile on first login
-- Called by auth/callback route handler via service role key
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Trigger fires after a new auth.users row is created
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
