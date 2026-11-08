import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Testing Supabase Connection...');
console.log('URL:', url);
console.log('Anon Key Present:', !!anonKey);
console.log('Service Key Present:', !!serviceKey);

const supabaseAnon = createClient(url!, anonKey!);
const supabaseAdmin = createClient(url!, serviceKey!);

async function run() {
  console.log('\n--- 1. Querying Product ID 8 ---');
  const { data: prod, error: prodErr } = await supabaseAnon
    .from('products')
    .select('id, name, artwork_url, image')
    .eq('id', 8)
    .single();

  console.log('Product 8 result:', { prod, error: prodErr });

  console.log('\n--- 2. Checking all products columns ---');
  const { data: sample, error: sampleErr } = await supabaseAnon
    .from('products')
    .select('*')
    .limit(1);
  if (sample && sample[0]) {
    console.log('Columns in products table:', Object.keys(sample[0]));
    console.log('Has artwork_url column?', 'artwork_url' in sample[0]);
  } else {
    console.log('Sample error:', sampleErr);
  }

  console.log('\n--- 3. Listing storage in bucket "posters", folder "artworks" ---');
  const { data: storageList, error: storageListErr } = await supabaseAnon.storage
    .from('posters')
    .list('artworks', { limit: 100 });
  console.log('Storage artworks list:', { files: storageList, error: storageListErr });

  console.log('\n--- 4. Test uploading a small buffer to "posters/artworks/test-upload.png" via ANON client ---');
  const dummyBuffer = Buffer.from('89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C63000100000500010D0A2DB40000000049454E44AE426082', 'hex');
  const { data: uploadData, error: uploadErr } = await supabaseAnon.storage
    .from('posters')
    .upload('artworks/test-upload.png', dummyBuffer, {
      contentType: 'image/png',
      upsert: true
    });
  console.log('Anon Storage upload result:', { uploadData, error: uploadErr });

  console.log('\n--- 5. Test updating product 8 artwork_url via ANON client ---');
  const testUrl = 'https://tmzafqeneyreqffobcwn.supabase.co/storage/v1/object/public/posters/artworks/8.png';
  const { data: updateAnonData, error: updateAnonErr } = await supabaseAnon
    .from('products')
    .update({ artwork_url: testUrl })
    .eq('id', 8)
    .select();
  console.log('Anon DB update result:', { data: updateAnonData, error: updateAnonErr });

  console.log('\n--- 6. Test updating product 8 artwork_url via SERVICE ROLE client ---');
  const { data: updateAdminData, error: updateAdminErr } = await supabaseAdmin
    .from('products')
    .update({ artwork_url: testUrl })
    .eq('id', 8)
    .select();
  console.log('Admin DB update result:', { data: updateAdminData, error: updateAdminErr });

  console.log('\n--- 7. Checking RLS policies on products table ---');
  try {
    const { data: policies, error: polErr } = await supabaseAdmin.rpc('get_policies_for_table', { table_name: 'products' });
    console.log('Policies check:', { policies, polErr });
  } catch (err: any) {
    console.log('RPC check failed:', err.message);
  }
}

run().catch(console.error);
