import type { Product } from '../types/database';
import { POSTER_PRICING, BUNDLE_OPTIONS } from '../config/pricing';

import { SITE_URL } from '../config/seo';
export const BASE_URL = SITE_URL;

export interface BreadcrumbItem {
  name: string;
  url: string;
}

/**
 * Organization Schema
 */
export function getOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    'name': 'Posterealm',
    'url': BASE_URL,
    'logo': `${BASE_URL}/logo.png`,
    'sameAs': [
      'https://wa.me/918949923501',
      'https://wa.me/918955992262'
    ]
  };
}

/**
 * Website Schema
 */
export function getWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    'name': 'Posterealm',
    'url': BASE_URL,
    'potentialAction': {
      '@type': 'SearchAction',
      'target': `${BASE_URL}/collections?search={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  };
}

/**
 * Product Schema
 */
export function getProductSchema(product: Product | null) {
  if (!product) return null;

  const isBundle = product.genre?.toLowerCase() === 'bundle';
  const startPrice = isBundle ? BUNDLE_OPTIONS[0].price : POSTER_PRICING.A5;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    'name': product.display_name || product.name,
    'description': product.meta_description || product.description || '',
    'image': product.image ? [product.image] : [],
    'sku': product.id,
    'brand': {
      '@type': 'Brand',
      'name': 'Posterealm'
    },
    'category': product.genre || '',
    'url': `${BASE_URL}/products/${product.slug}`,
    'offers': {
      '@type': 'Offer',
      'price': startPrice,
      'priceCurrency': 'INR',
      'availability': 'https://schema.org/InStock',
      'url': `${BASE_URL}/products/${product.slug}`
    }
  };
}

/**
 * Collection Page Schema
 */
export function getCollectionSchema(category: string) {
  const formattedCategory = category || 'All';
  const categoryUrl = formattedCategory.toLowerCase() === 'all'
    ? `${BASE_URL}/collections`
    : `${BASE_URL}/collections?category=${formattedCategory.toLowerCase()}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    'name': `${formattedCategory} Wall Posters | Posterealm`,
    'description': `Browse our premium collection of ${formattedCategory} posters at Posterealm. High-quality prints ready for your walls.`,
    'url': categoryUrl
  };
}

/**
 * Breadcrumb Schema
 */
export function getBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': items.map((item, index) => ({
      '@type': 'ListItem',
      'position': index + 1,
      'name': item.name,
      'item': item.url.startsWith('http') ? item.url : `${BASE_URL}${item.url}`
    }))
  };
}

/**
 * Customize Page Schema (Service Schema)
 */
export function getCustomizeSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    'name': 'Custom Poster Printing Service',
    'description': 'Design your own premium custom wall poster. Upload your favorite photos, anime artwork, gaming art, car designs, or personal memories and create high-quality posters.',
    'provider': {
      '@type': 'Organization',
      'name': 'Posterealm',
      'url': BASE_URL
    },
    'serviceType': 'Custom Poster Printing',
    'areaServed': 'IN'
  };
}
