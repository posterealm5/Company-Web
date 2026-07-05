import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const PRODUCTS = [
  { id: 1, name: 'Spirit Samurai', genre: 'Anime', price: 599, image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=800&auto=format&fit=crop', description: 'A mystical samurai spirit wandering through the neon-lit streets of ancient Kyoto.' },
  { id: 2, name: 'Cyberpunk Oni', genre: 'Anime', price: 649, image: 'https://images.unsplash.com/photo-1614728263952-84ea256f9679?q=80&w=800&auto=format&fit=crop', description: 'Merging traditional Japanese folklore with a grit-tech future, this Oni brings raw power to your wall.' },
  { id: 3, name: 'Neo Tokyo', genre: 'Anime', price: 499, image: 'https://images.unsplash.com/photo-1578632738981-4246ed8039e0?q=80&w=800&auto=format&fit=crop', description: 'The sprawling nightscape of a futuristic metropolis, buzzing with synthetic energy.' },
  { id: 4, name: 'Golden Age Hollywood', genre: 'Movies', price: 449, image: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=800&auto=format&fit=crop', description: 'A nostalgic tribute to the era of cinematic legends and timeless classic storytelling.' },
  { id: 5, name: 'Sci-Fi Odyssey', genre: 'Movies', price: 549, image: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=800&auto=format&fit=crop', description: 'Journey into the vast unknown with this interstellar scene capturing the awe of deep space exploration.' },
  { id: 6, name: 'Desert Cruiser', genre: 'Bike', price: 399, image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?q=80&w=800&auto=format&fit=crop', description: 'Feel the freedom of the open road with this rugged cruiser set against the backdrop of a desert sunset.' },
  { id: 7, name: 'Midnight Racer', genre: 'Cars', price: 899, image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=800&auto=format&fit=crop', description: 'High-octane excitement captured in pixels, featuring the sleekest lines of a midnight sports car.' },
  { id: 8, name: 'Synthwave Night', genre: 'Music', price: 299, image: 'https://images.unsplash.com/photo-1514525253342-b0bb0d845ff2?q=80&w=800&auto=format&fit=crop', description: 'Vibrant neon hues and retro beats come alive in this tribute to the synthwave musical movement.' },
  { id: 9, name: 'Abstract Flow', genre: 'Printesty', price: 349, image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=800&auto=format&fit=crop', description: 'A dance of colors and shapes designed to evoke emotion and spark conversation in any room.' },
  { id: 10, name: 'Retro Console', genre: 'Gaming', price: 299, image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=800&auto=format&fit=crop', description: 'Relive the 8-bit glory days with this pixel-perfect render of a classic gaming console.' },
  { id: 11, name: 'The Grid', genre: 'Gaming', price: 399, image: 'https://images.unsplash.com/photo-1558244661-9121f2827562?q=80&w=800&auto=format&fit=crop', description: 'Step into the digital realm where every pixel tells a story of strategy and triumph.' },
  { id: 12, name: 'Melody Line', genre: 'Music', price: 249, image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop', description: 'Simple, elegant, and harmonious—a visual representation of your favorite sonic landscapes.' },
  { id: 13, name: 'Cyberpunk Aesthetic Set', genre: 'Bundle', price: 1499, image: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=800&auto=format&fit=crop', description: 'The ultimate collection for the tech-obsessed, featuring 4 unique cyberpunk art pieces.' },
  { id: 14, name: 'Minimalist Tokyo Set', genre: 'Bundle', price: 1299, image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=800&auto=format&fit=crop', description: 'A curated selection of 3 minimalist prints that capture the quiet beauty of Tokyo streets.' },
  { id: 15, name: 'Retro Gaming Pack', genre: 'Bundle', price: 1349, image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=800&auto=format&fit=crop', description: 'The definitive bundle for classic gamers, bringing the arcade vibe directly to your living space.' },
];

async function seed() {
  console.log('Checking existing products...');
  const { data: existing, error: fetchErr } = await supabase.from('products').select('id');
  
  if (fetchErr) {
    console.error('Error fetching products:', fetchErr.message);
    process.exit(1);
  }
  
  if (existing && existing.length > 0) {
    console.log(`Database already has ${existing.length} products. Skipping seed.`);
    process.exit(0);
  }
  
  console.log('Seeding products...');
  for (const product of PRODUCTS) {
    const { error } = await supabase.from('products').insert(product);
    if (error) {
      console.error(`Failed to insert ${product.name}:`, error.message);
    } else {
      console.log(`Inserted ${product.name}`);
    }
  }
  
  console.log('Seeding complete.');
}

seed();
