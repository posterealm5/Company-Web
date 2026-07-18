/**
 * Centralized Pricing Configuration
 * Posterealm E-Commerce System
 */

export const POSTER_PRICING = {
  A5: 89,
  A4: 220,
  A3: 299,
  A2: 390
};

export const FLAGSHIP_PREMIUM = 100;

export const SHIPPING_CHARGE = 150;

// Standalone Bundle Options
export const BUNDLE_OPTIONS = [
  { id: 'b52', name: 'Buy 5 Get 2 Free', postersCount: 7, price: 599 },
  { id: 'b63', name: 'Buy 6 Get 3 Free', postersCount: 9, price: 699 },
  { id: 'b75', name: 'Buy 7 Get 5 Free', postersCount: 12, price: 849 }
];

/** Get base price of poster size */
export function getPosterBasePrice(size: string): number {
  const sz = (size || '').toUpperCase();
  if (sz === 'A2') return POSTER_PRICING.A2;
  if (sz === 'A3') return POSTER_PRICING.A3;
  if (sz === 'A4') return POSTER_PRICING.A4;
  if (sz === 'A5') return POSTER_PRICING.A5;
  
  // Check if size matches a bundle option name
  const bundle = BUNDLE_OPTIONS.find(b => b.name.toLowerCase() === size.toLowerCase());
  if (bundle) return bundle.price;

  return POSTER_PRICING.A5; // Default fallback
}

/** Get material premium */
export function getMaterialPremium(material: string): number {
  const mat = (material || '').toLowerCase();
  if (mat.includes('flagship')) {
    return FLAGSHIP_PREMIUM;
  }
  return 0;
}

/** Calculate pricing of a single poster */
export function calculateSinglePosterPrice(size: string, material: string): number {
  const base = getPosterBasePrice(size);
  const premium = getMaterialPremium(material);
  return base + premium;
}

/**
 * Recalculate Cart Items Prices and Line Totals dynamically.
 * All pricing derives from centralized rules.
 */
export function recalculateCartPrices(items: any[]): any[] {
  return items.map(item => {
    const selectedSize = item.selected_size || item.size;
    const selectedMaterial = item.selected_material || item.material;

    const unitPrice = calculateSinglePosterPrice(selectedSize, selectedMaterial);
    const lineTotal = unitPrice * item.quantity;

    return {
      ...item,
      selected_size: selectedSize,
      selected_material: selectedMaterial,
      unit_price: unitPrice,
      price: unitPrice, // keep legacy field in sync
      line_total: lineTotal
    };
  });
}

/**
 * Determine the most common size and material among selected paid posters.
 * Breaks ties by choosing the higher-priced size/material.
 */
export function getMajoritySizeAndMaterial(paidItems: any[]): { size: string; material: string } {
  if (!paidItems || paidItems.length === 0) {
    return { size: 'A3', material: 'Matte' };
  }

  const sizeCounts: Record<string, number> = {};
  const materialCounts: Record<string, number> = {};

  paidItems.forEach(item => {
    const qty = item.quantity || 1;
    const sz = item.selected_size || item.size || 'A3';
    const mat = item.selected_material || item.material || 'Matte';

    sizeCounts[sz] = (sizeCounts[sz] || 0) + qty;
    materialCounts[mat] = (materialCounts[mat] || 0) + qty;
  });

  // Determine majority size
  let majoritySize = '';
  let maxSizeCount = 0;
  Object.entries(sizeCounts).forEach(([size, count]) => {
    if (count > maxSizeCount) {
      maxSizeCount = count;
      majoritySize = size;
    } else if (count === maxSizeCount) {
      // Tie-breaker: choose cheapest size
      const priceCurrent = getPosterBasePrice(size);
      const priceMajority = getPosterBasePrice(majoritySize);
      if (priceCurrent < priceMajority) {
        majoritySize = size;
      }
    }
  });

  // Determine majority material
  let majorityMaterial = '';
  let maxMatCount = 0;
  Object.entries(materialCounts).forEach(([material, count]) => {
    if (count > maxMatCount) {
      maxMatCount = count;
      majorityMaterial = material;
    } else if (count === maxMatCount) {
      // Tie-breaker: choose cheapest material
      const priceCurrent = getMaterialPremium(material);
      const priceMajority = getMaterialPremium(majorityMaterial);
      if (priceCurrent < priceMajority) {
        majorityMaterial = material;
      }
    }
  });

  return {
    size: majoritySize || 'A3',
    material: majorityMaterial || 'Matte'
  };
}
