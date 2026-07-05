export interface SEOMetadata {
  title: string;
  description: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogUrl: string;
  ogType: string;
  ogSiteName: string;
  twitterCard: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  noindex?: boolean;
}

import { SITE_URL } from '../config/seo';

const DEFAULT_IMAGE = `${SITE_URL}/assets/hero-center-DCUHGrId.jpg`;
const SITE_NAME = 'Posterealm';

export const getHomeMetadata = (): SEOMetadata => {
  const title = 'Posterealm | Premium Wall Posters & Custom Designs';
  const description = 'Discover premium wall posters and custom designs at Posterealm. Shop anime, movies, music, cars, gaming, minimalist art, custom posters, and more. Premium quality prints crafted to transform your space.';
  const canonical = `${SITE_URL}/`;

  return {
    title,
    description,
    canonical,
    ogTitle: title,
    ogDescription: description,
    ogImage: DEFAULT_IMAGE,
    ogUrl: canonical,
    ogType: 'website',
    ogSiteName: SITE_NAME,
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: DEFAULT_IMAGE
  };
};

export const getProductMetadata = (product: {
  name: string;
  display_name?: string | null;
  description?: string | null;
  meta_description?: string | null;
  slug?: string | null;
  image?: string | null;
}): SEOMetadata => {
  const displayName = product.display_name || product.name;
  const title = `${displayName} | Posterealm`;
  
  const description = product.meta_description || product.description || '';
  const slug = product.slug || '';
  const canonical = `${SITE_URL}/products/${slug}`;
  const ogImage = product.image || DEFAULT_IMAGE;

  return {
    title,
    description,
    canonical,
    ogTitle: title,
    ogDescription: description,
    ogImage,
    ogUrl: canonical,
    ogType: 'product',
    ogSiteName: SITE_NAME,
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: ogImage
  };
};

interface CollectionInfo {
  title: string;
  description: string;
}

const COLLECTION_MAP: { [key: string]: CollectionInfo } = {
  anime: {
    title: 'Anime Wall Posters | Posterealm',
    description: 'Explore premium anime wall posters featuring Dragon Ball, Naruto, Demon Slayer and more.'
  },
  movies: {
    title: 'Movie Wall Posters | Posterealm',
    description: 'Explore high-quality movie wall posters featuring classic films, cinema favorites, and blockbusters.'
  },
  bike: {
    title: 'Motorcycle & Bike Wall Posters | Posterealm',
    description: 'Discover sleek superbike and motorcycle wall posters for bike enthusiasts.'
  },
  cars: {
    title: 'Supercar & Car Wall Posters | Posterealm',
    description: 'Browse stunning supercar and automotive art prints to upgrade your garage or room decor.'
  },
  music: {
    title: 'Music & Band Wall Posters | Posterealm',
    description: 'Bring your walls to life with music, album, and band posters of iconic artists.'
  },
  printesty: {
    title: 'Aesthetic & Printesty Wall Posters | Posterealm',
    description: 'Transform your room with minimalist and aesthetic printesty wall art.'
  },
  gaming: {
    title: 'Gaming & Gamer Wall Posters | Posterealm',
    description: 'Level up your gaming setup with premium gamer wall posters from your favorite games.'
  },
  bundle: {
    title: 'Value Poster Bundles | Posterealm',
    description: 'Save big with curated premium poster bundle sets designed for complete wall makeovers.'
  },
  all: {
    title: 'Shop All Wall Posters | Posterealm',
    description: 'Browse our full catalog of premium anime, gaming, car, movie, and music wall posters.'
  }
};

export const getCollectionMetadata = (category: string): SEOMetadata => {
  const cleanCategory = (category || 'all').toLowerCase();
  const info = COLLECTION_MAP[cleanCategory] || COLLECTION_MAP.all;
  const canonical = cleanCategory === 'all'
    ? `${SITE_URL}/collections`
    : `${SITE_URL}/collections?category=${cleanCategory}`;

  return {
    title: info.title,
    description: info.description,
    canonical,
    ogTitle: info.title,
    ogDescription: info.description,
    ogImage: DEFAULT_IMAGE,
    ogUrl: canonical,
    ogType: 'website',
    ogSiteName: SITE_NAME,
    twitterCard: 'summary_large_image',
    twitterTitle: info.title,
    twitterDescription: info.description,
    twitterImage: DEFAULT_IMAGE
  };
};

export const getStaticPageMetadata = (pageName: string, customTitle?: string, customDescription?: string): SEOMetadata => {
  const slug = pageName.toLowerCase().replace(/\s+/g, '-');
  const title = `${customTitle || pageName} | Posterealm`;
  const description = customDescription || `Read the official ${pageName} page on Posterealm.`;
  const canonical = `${SITE_URL}/${slug}`;

  return {
    title,
    description,
    canonical,
    ogTitle: title,
    ogDescription: description,
    ogImage: DEFAULT_IMAGE,
    ogUrl: canonical,
    ogType: 'website',
    ogSiteName: SITE_NAME,
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: DEFAULT_IMAGE
  };
};

export const getCustomizeMetadata = (): SEOMetadata => {
  const title = 'Create Your Own Custom Wall Poster | Posterealm';
  const description = 'Design your own premium custom wall poster. Upload your favorite photos, anime artwork, gaming art, car designs, or personal memories and create high-quality posters with Posterealm.';
  const canonical = `${SITE_URL}/customize`;

  return {
    title,
    description,
    canonical,
    ogTitle: title,
    ogDescription: description,
    ogImage: DEFAULT_IMAGE,
    ogUrl: canonical,
    ogType: 'website',
    ogSiteName: SITE_NAME,
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: DEFAULT_IMAGE
  };
};

export const getNotFoundMetadata = (pathname: string): SEOMetadata => {
  const title = 'Page Not Found | Posterealm';
  const description = 'The page you are looking for does not exist.';
  const canonical = `${SITE_URL}${pathname}`;

  return {
    title,
    description,
    canonical,
    ogTitle: title,
    ogDescription: description,
    ogImage: DEFAULT_IMAGE,
    ogUrl: canonical,
    ogType: 'website',
    ogSiteName: SITE_NAME,
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: DEFAULT_IMAGE,
    noindex: true
  };
};

export const getNonIndexableMetadata = (pageName: string, pathname: string): SEOMetadata => {
  const title = `${pageName} | Posterealm`;
  const description = `Access your ${pageName} on Posterealm.`;
  const canonical = `${SITE_URL}${pathname}`;

  return {
    title,
    description,
    canonical,
    ogTitle: title,
    ogDescription: description,
    ogImage: DEFAULT_IMAGE,
    ogUrl: canonical,
    ogType: 'website',
    ogSiteName: SITE_NAME,
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: DEFAULT_IMAGE,
    noindex: true
  };
};
