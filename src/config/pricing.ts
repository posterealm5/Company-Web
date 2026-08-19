/**
 * Centralized Pricing Configuration
 * Posterealm E-Commerce System
 */

export const POSTER_PRICING: Record<string, number> = {
  A5: 79,
  A4: 129,
  A3: 179,
  A2: 299
};

export const RIGID_BOARD_PRICING: Record<string, number> = {
  A5: 175,
  A4: 280,
  A3: 330,
  A2: 400
};

// Legacy pricing constant alias for backward compatibility
export const FLAGSHIP_PRICING = RIGID_BOARD_PRICING;

export const SHIPPING_CHARGE = 99;

// Standalone Bundle Options
export const BUNDLE_OPTIONS = [
  { id: 'b52', name: 'Buy 5 Get 2 Free', postersCount: 7, price: 599 },
  { id: 'b63', name: 'Buy 6 Get 3 Free', postersCount: 9, price: 699 },
  { id: 'b75', name: 'Buy 7 Get 5 Free', postersCount: 12, price: 849 }
];

/**
 * Normalizes material identifiers and user inputs into canonical material IDs.
 * Canonical IDs: 'rigid_board' | 'matte' | 'glossy'
 */
export function normalizeMaterialId(material: string): string {
  if (!material) return 'matte';
  const mat = material.trim().toLowerCase();
  if (
    mat === 'rigid_board' ||
    mat === 'rigid board' ||
    mat === 'rigidboard' ||
    mat === 'rigid' ||
    mat === 'flagship' ||
    mat === 'flagship material' ||
    mat.includes('rigid') ||
    mat.includes('flagship')
  ) {
    return 'rigid_board';
  }
  if (mat.includes('glossy')) return 'glossy';
  if (mat.includes('matte')) return 'matte';
  return mat;
}

/** Get base price of poster size */
export function getPosterBasePrice(size: string): number {
  const sz = (size || '').toUpperCase();
  if (sz in POSTER_PRICING) return POSTER_PRICING[sz];
  
  // Check if size matches a bundle option name
  const bundle = BUNDLE_OPTIONS.find(b => b.name.toLowerCase() === size.toLowerCase());
  if (bundle) return bundle.price;

  return POSTER_PRICING.A5; // Default fallback
}

/** Get material premium over Glossy/Matte base price */
export function getMaterialPremium(material: string, size?: string): number {
  const normId = normalizeMaterialId(material);
  if (normId === 'rigid_board') {
    const sz = (size || 'A5').toUpperCase();
    const rigidBoardPrice = RIGID_BOARD_PRICING[sz] || RIGID_BOARD_PRICING.A5;
    const basePrice = POSTER_PRICING[sz] || POSTER_PRICING.A5;
    return rigidBoardPrice - basePrice;
  }
  return 0;
}

/** Calculate pricing of a single poster */
export function calculateSinglePosterPrice(size: string, material: string): number {
  const sz = (size || '').toUpperCase();
  const normId = normalizeMaterialId(material);
  if (normId === 'rigid_board') {
    if (sz in RIGID_BOARD_PRICING) {
      return RIGID_BOARD_PRICING[sz];
    }
    return RIGID_BOARD_PRICING.A5;
  }
  return getPosterBasePrice(size);
}

/**
 * Recalculate Cart Items Prices and Line Totals dynamically.
 * All pricing derives from centralized rules.
 */
export function recalculateCartPrices(items: any[]): any[] {
  return items.map(item => {
    const selectedSize = item.selected_size || item.size;
    let selectedMaterial = item.selected_material || item.material;

    // Normalize legacy material identifiers to Rigid Board display string if applicable
    if (selectedMaterial) {
      const normId = normalizeMaterialId(selectedMaterial);
      if (normId === 'rigid_board' && selectedMaterial.toLowerCase().includes('flagship')) {
        selectedMaterial = 'Rigid Board';
      }
    }

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
 * Breaks ties by choosing the cheaper size/material.
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
      // Tie-breaker: choose cheapest material (Glossy/Matte over Rigid Board)
      const isCurrentRigidBoard = normalizeMaterialId(material) === 'rigid_board';
      const isMajorityRigidBoard = normalizeMaterialId(majorityMaterial) === 'rigid_board';
      if (!isCurrentRigidBoard && isMajorityRigidBoard) {
        majorityMaterial = material;
      }
    }
  });

  return {
    size: majoritySize || 'A3',
    material: majorityMaterial || 'Matte'
  };
}
