-- Drop existing provider check constraint and add updated one
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.api_keys'::regclass
    AND contype = 'c';
    
  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.api_keys DROP CONSTRAINT ' || constraint_name;
  END IF;
END $$;

ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_provider_check 
  CHECK (provider in ('anthropic', 'openai', 'kimi', 'gemini', 'groq'));
