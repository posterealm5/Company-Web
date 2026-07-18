import { POSTER_PRICING } from '../config/pricing';

export const SIZE_DIMENSIONS: Record<string, string> = {
  A5: '5.8" × 8.3"',
  A4: '8.3" × 11.7"',
  A3: '11.7" × 16.5"',
  A2: '16" × 23"',
};

export const SIZES = [
  { id: 'a5', name: 'A5', dimensions: '5.8" × 8.3"', price: POSTER_PRICING.A5 },
  { id: 'a4', name: 'A4', dimensions: '8.3" × 11.7"', price: POSTER_PRICING.A4 },
  { id: 'a3', name: 'A3', dimensions: '11.7" × 16.5"', price: POSTER_PRICING.A3 },
  { id: 'a2', name: 'A2', dimensions: '16" × 23"', price: POSTER_PRICING.A2 },
];

export function getSizeDimension(sizeName: string): string {
  if (!sizeName) return '';
  const upper = sizeName.toUpperCase();
  if (upper.includes('A2')) return '16" × 23"';
  if (upper.includes('A3')) return '11.7" × 16.5"';
  if (upper.includes('A4')) return '8.3" × 11.7"';
  if (upper.includes('A5')) return '5.8" × 8.3"';
  return sizeName;
}

export function getSizeDisplayLabel(sizeName: string): string {
  if (!sizeName) return '';
  const upper = sizeName.toUpperCase();
  if (upper.includes('A2')) return 'A2 (16" × 23")';
  if (upper.includes('A3')) return 'A3 (11.7" × 16.5")';
  if (upper.includes('A4')) return 'A4 (8.3" × 11.7")';
  if (upper.includes('A5')) return 'A5 (5.8" × 8.3")';
  return sizeName;
}
