import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const envRaw = readFileSync('.env.local', 'utf8');
const env = {};
envRaw.split('\n').forEach(l => {
  const [k, ...v] = l.split('=');
  if (k?.trim()) env[k.trim()] = v.join('=').trim();
});

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data } = await sb.from('messages').select('*').order('created_at', { ascending: false }).limit(10);
  console.log(JSON.stringify(data, null, 2));
}
run();
