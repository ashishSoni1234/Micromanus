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
  console.log('Deleting corrupted empty messages...');
  const { error } = await sb.from('messages').delete().eq('content', '');
  if (error) console.error('Error:', error);
  else console.log('Successfully cleaned up DB.');
}
run();
