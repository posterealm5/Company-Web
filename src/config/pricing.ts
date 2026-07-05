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

export const CUSTOM_POSTER_RATE = 0.7;

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

/** Calculate custom poster base price using piecewise linear interpolation of area with containment floor */
export function calculateCustomPosterBasePrice(width: number, height: number): number {
  const area = width * height;
  
  // Standard size areas (inches)
  const AREA_A5 = 5.8 * 8.3;    // 48.14
  const AREA_A4 = 8.3 * 11.7;   // 97.11
  const AREA_A3 = 11.7 * 16.5;  // 193.05
  const AREA_A2 = 16.5 * 23.4;  // 386.10
  
  // Standard size prices
  const PRICE_A5 = POSTER_PRICING.A5; // 89
  const PRICE_A4 = POSTER_PRICING.A4; // 220
  const PRICE_A3 = POSTER_PRICING.A3; // 299
  const PRICE_A2 = POSTER_PRICING.A2; // 390
  
  // 1. Calculate area-based base price using piecewise linear interpolation
  let basePrice = 0;
  if (area <= 0) {
    basePrice = 0;
  } else if (area < AREA_A5) {
    // Smaller than A5: linear interpolation from 0 to A5 price
    basePrice = area * (PRICE_A5 / AREA_A5);
  } else if (area < AREA_A4) {
    // Between A5 and A4
    basePrice = PRICE_A5 + (area - AREA_A5) * ((PRICE_A4 - PRICE_A5) / (AREA_A4 - AREA_A5));
  } else if (area < AREA_A3) {
    // Between A4 and A3
    basePrice = PRICE_A4 + (area - AREA_A4) * ((PRICE_A3 - PRICE_A4) / (AREA_A3 - AREA_A4));
  } else {
    // Larger than A3: calculate basePrice using ₹1 per additional square inch above A3
    basePrice = PRICE_A3 + (area - AREA_A3);
  }
  
  // 2. Apply containment floor price based on orientation-independent fit
  const wMin = Math.min(width, height);
  const wMax = Math.max(width, height);
  
  let floorPrice = 0;
  if (wMin <= 5.8 && wMax <= 8.3) {
    // Fits in A5
    floorPrice = 0; // No floor for sizes smaller than A5
  } else if (wMin <= 8.3 && wMax <= 11.7) {
    // Fits in A4 (but not A5)
    floorPrice = PRICE_A4;
  } else if (wMin <= 11.7 && wMax <= 16.5) {
    // Fits in A3 (but not A4)
    floorPrice = PRICE_A3;
  } else if (wMin <= 16.5 && wMax <= 23.4) {
    // Fits in A2 (but not A3)
    floorPrice = PRICE_A2;
  } else {
    // Larger than A2
    floorPrice = PRICE_A2;
  }
  
  return Math.round(Math.max(basePrice, floorPrice));
}

/** Calculate total price of custom poster including material premium */
export function calculateCustomPosterPrice(width: number, height: number, material: string): number {
  const base = calculateCustomPosterBasePrice(width, height);
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

    const isCustom = (selectedSize || '').toLowerCase().includes('x') || selectedSize === 'Custom';
    let unitPrice = 0;

    if (isCustom && item.width && item.height) {
      unitPrice = calculateCustomPosterPrice(item.width, item.height, selectedMaterial);
    } else {
      unitPrice = calculateSinglePosterPrice(selectedSize, selectedMaterial);
    }

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
