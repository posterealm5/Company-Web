import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(url!, serviceKey!);

async function checkStoragePolicies() {
  console.log('Querying storage.objects policies...');
  const { data: buckets, error: bErr } = await supabaseAdmin.storage.listBuckets();
  console.log('Buckets:', { buckets, bErr });

  // Query postgres policies on storage.objects
  const { data: policies, error: pErr } = await supabaseAdmin
    .from('pg_policies' as any)
    .select('*')
    .eq('schemaname', 'storage')
    .eq('tablename', 'objects');
  
  if (pErr) {
    console.log('Error querying pg_policies via from:', pErr);
  } else {
    console.log('Policies on storage.objects:', policies);
  }

  // Also check if admin service client can upload to posters/artworks/
  const dummyBuffer = Buffer.from('89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C63000100000500010D0A2DB40000000049454E44AE426082', 'hex');
  const { data: adminUpload, error: adminUploadErr } = await supabaseAdmin.storage
    .from('posters')
    .upload('artworks/test-admin-upload.png', dummyBuffer, {
      contentType: 'image/png',
      upsert: true
    });
  console.log('Service Role Storage upload to posters/artworks/:', { adminUpload, adminUploadErr });
}

checkStoragePolicies().catch(console.error);
