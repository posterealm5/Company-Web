import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env', 'utf8');
const env: Record<string, string> = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
  const idx = trimmed.indexOf('=');
  const key = trimmed.slice(0, idx).trim();
  const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  env[key] = val;
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('Connecting to Supabase at:', env.SUPABASE_URL);

  // Search by name
  const { data: searchByName, error: errByName } = await supabase
    .from('products')
    .select('*')
    .ilike('name', '%NUN%');

  console.log('Search by %NUN%:', { count: searchByName?.length, err: errByName, data: searchByName });

  // Search by exact phrase words
  const { data: searchFcks, error: errFcks } = await supabase
    .from('products')
    .select('*')
    .ilike('name', '%GIVE%');

  console.log('Search by %GIVE%:', { count: searchFcks?.length, err: errFcks, data: searchFcks });
}

main().catch(console.error);

