import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(url!, serviceKey!);

async function testAuthUpload() {
  console.log('Testing upload with an authenticated session...');
  
  // Create or get link for posterealm5@gmail.com
  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: 'posterealm5@gmail.com',
  });
  
  console.log('Magic link generation:', { linkData: !!linkData, linkErr });
  
  if (linkData?.properties?.hashed_token) {
    const supabaseClient = createClient(url!, anonKey!);
    const { data: sessionData, error: verifyErr } = await supabaseClient.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'magiclink'
    });
    
    console.log('Verified OTP session for posterealm5@gmail.com:', {
      user: sessionData?.user?.email,
      role: sessionData?.user?.role,
      verifyErr
    });
    
    // Now try upload to posters/artworks/test-auth-upload.png
    const dummyBuffer = Buffer.from('89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C63000100000500010D0A2DB40000000049454E44AE426082', 'hex');
    const { data: authUpload, error: authUploadErr } = await supabaseClient.storage
      .from('posters')
      .upload('artworks/test-auth-upload.png', dummyBuffer, {
        contentType: 'image/png',
        upsert: true
      });
      
    console.log('Authenticated upload result to posters/artworks/:', { authUpload, authUploadErr });
  }
}

testAuthUpload().catch(console.error);
