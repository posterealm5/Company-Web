import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { SITE_URL } from '../src/config/seo';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

console.log('Generating SEO files with SITE_URL:', SITE_URL);

async function run() {
  let products: any[] = [];
  
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data, error } = await supabase
        .from('products')
        .select('slug, image, name, updated_at, is_active');
        
      if (error) {
        console.error('Error fetching products from Supabase:', error.message);
      } else if (data) {
        // Filter active products with valid database slugs
        products = data.filter(p => p.is_active && p.slug && p.slug.trim() !== '');
        console.log(`Successfully fetched ${products.length} active products.`);
      }
    } catch (err: any) {
      console.error('Unexpected error connecting to Supabase:', err.message);
    }
  } else {
    console.warn('Supabase URL or Key not found in environment variables. Generating sitemap with static pages only.');
  }

  // Get current date in YYYY-MM-DD format
  const currentDate = new Date().toISOString().split('T')[0];

  // Define static pages
  const staticPages = [
    { loc: '/', changefreq: 'daily', priority: '1.0', lastmod: currentDate },
    { loc: '/collections', changefreq: 'daily', priority: '0.8', lastmod: currentDate },
    { loc: '/customize', changefreq: 'weekly', priority: '0.8', lastmod: currentDate },
    { loc: '/how-it-works', changefreq: 'monthly', priority: '0.5', lastmod: currentDate },
    { loc: '/faq', changefreq: 'monthly', priority: '0.5', lastmod: currentDate },
    { loc: '/privacy-policy', changefreq: 'monthly', priority: '0.3', lastmod: currentDate },
    { loc: '/terms-of-service', changefreq: 'monthly', priority: '0.3', lastmod: currentDate },
  ];

  // Build XML sitemap content
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`;

  // Add static pages
  for (const page of staticPages) {
    xml += `
  <url>
    <loc>${SITE_URL}${page.loc}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
  }

  // Add dynamic product pages
  for (const product of products) {
    const productUrl = `${SITE_URL}/products/${product.slug}`;
    const lastmod = product.updated_at ? product.updated_at.split('T')[0] : currentDate;
    const escapedName = escapeXml(product.name);
    const escapedImage = escapeXml(product.image);

    xml += `
  <url>
    <loc>${productUrl}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>`;

    if (product.image) {
      xml += `
    <image:image>
      <image:loc>${escapedImage}</image:loc>
      <image:title>${escapedName}</image:title>
    </image:image>`;
    }

    xml += `
  </url>`;
  }

  xml += `\n</urlset>\n`;

  // Write sitemap.xml to public/sitemap.xml
  const publicDir = path.resolve(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), xml, 'utf8');
  console.log('Generated public/sitemap.xml successfully.');

  // Build robots.txt content
  const robotsTxt = `User-agent: *
Disallow: /admin
Disallow: /admin/
Disallow: /checkout
Disallow: /checkout/
Disallow: /login
Disallow: /login/
Disallow: /cart
Disallow: /cart/
Disallow: /wishlist
Disallow: /wishlist/
Disallow: /account
Disallow: /account/
Disallow: /reset-password
Disallow: /reset-password/
Disallow: /order-summary
Disallow: /order-summary/
Disallow: /payment
Disallow: /payment/

Sitemap: ${SITE_URL}/sitemap.xml
`;

  // Write robots.txt to public/robots.txt
  fs.writeFileSync(path.join(publicDir, 'robots.txt'), robotsTxt, 'utf8');
  console.log('Generated public/robots.txt successfully.');
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

run().catch(err => {
  console.error('Error executing sitemap/robots generator:', err);
  process.exit(1);
});
