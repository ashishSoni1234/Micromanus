-- Add to Supabase SQL editor alongside the migration
-- Atomic credit decrement function (prevents race conditions when concurrent requests try to deduct)

create or replace function public.decrement_credits(user_id_input uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.users
  set credits = greatest(0, credits - 1)
  where id = user_id_input;
end;
$$;
