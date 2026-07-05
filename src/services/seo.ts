import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Product } from '../types/database';

export interface SEOValidationError {
  field: string;
  message: string;
  type: 'error' | 'warning';
}

export interface GeneratedSEO {
  display_name: string;
  slug: string;
  meta_description: string;
  alt_text: string;
}

// Sub-generator helpers
export const generateDisplayName = (name: string): string => {
  if (!name) return '';
  let core = name.split(/\s+[-|]\s+|\s*[\u2013\u2014\u2015]\s*/)[0].trim();
  const suffixesToRemove = [
    /Premium\s+Poster$/i,
    /Poster$/i,
    /Wall\s+Art$/i,
    /Home\s+Decor$/i,
    /Room\s+Decor$/i,
    /Decor$/i,
    /Art$/i
  ];
  let cleaned = core;
  let modified = true;
  while (modified) {
    modified = false;
    for (const suffixPattern of suffixesToRemove) {
      const before = cleaned;
      cleaned = cleaned.replace(suffixPattern, '').trim();
      if (cleaned !== before) {
        modified = true;
        break;
      }
    }
  }
  return cleaned || core;
};

export const generateSlug = (name: string): string => {
  if (!name) return '';
  return name
    .normalize('NFD') // Normalize accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens and collapse
    .replace(/^-+|-+$/g, ''); // Trim leading and trailing hyphens
};

export const cleanDescriptionText = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/\s+/g, ' ')    // Normalize all whitespace and newlines to a single space
    .trim();
};

export const generateMetaDescription = (description: string): string => {
  const cleaned = cleanDescriptionText(description);
  if (!cleaned) return '';

  // If already within or below recommended length, use as is
  if (cleaned.length <= 160) {
    return cleaned;
  }

  // Otherwise, trim intelligently to approx 150-160 characters.
  // Target 155 characters as a sweet spot.
  const targetLen = 155;
  let trimmed = cleaned.substring(0, targetLen);

  // Find the last space to avoid cutting a word in half
  const lastSpace = trimmed.lastIndexOf(' ');
  if (lastSpace > 0) {
    trimmed = trimmed.substring(0, lastSpace);
  }

  // Strip trailing punctuation like commas, colons or hyphens
  trimmed = trimmed.replace(/[,;:\-\s]+$/, '');

  // Add suspension dots since it actually truncated the original description
  return trimmed + '...';
};

export const generateAltText = (productName: string, genre: string): string => {
  return `Premium ${productName} wall art print from Posterealm's ${genre} collection.`;
};

/** Central SEO generation function */
export const generateProductSEO = (product: { name: string; genre: string; description: string }): GeneratedSEO => {
  const displayName = generateDisplayName(product.name);
  return {
    display_name: displayName,
    slug: generateSlug(displayName),
    meta_description: generateMetaDescription(product.description || ''),
    alt_text: generateAltText(product.name, product.genre)
  };
};

/** Validate Slug Uniqueness */
export const validateSlugUniqueness = async (slug: string, productId?: number): Promise<boolean> => {
  if (!isSupabaseConfigured()) return true;
  let query = supabase
    .from('products')
    .select('id')
    .eq('slug', slug);
  if (productId) {
    query = query.neq('id', productId);
  }
  const { data, error } = await query;
  if (error) {
    console.error('Error validating slug uniqueness:', error);
    return false;
  }
  return !data || data.length === 0;
};

/** Validate SEO Fields */
export const validateSEOData = async (
  data: { display_name?: string | null; slug?: string | null; meta_description?: string | null; alt_text?: string | null },
  productId?: number
): Promise<SEOValidationError[]> => {
  const errors: SEOValidationError[] = [];

  if (!data.display_name || !data.display_name.trim()) {
    errors.push({ field: 'display_name', message: 'Display Name is required.', type: 'error' });
  }

  if (!data.alt_text || !data.alt_text.trim()) {
    errors.push({ field: 'alt_text', message: 'Alt Text is required.', type: 'error' });
  }

  if (!data.meta_description || !data.meta_description.trim()) {
    errors.push({ field: 'meta_description', message: 'Meta Description is required.', type: 'error' });
  } else {
    const len = data.meta_description.trim().length;
    if (len < 150 || len > 160) {
      errors.push({
        field: 'meta_description',
        message: `Recommended meta description length is 150–160 characters (currently ${len}).`,
        type: 'warning'
      });
    }
  }

  if (!data.slug || !data.slug.trim()) {
    errors.push({ field: 'slug', message: 'Slug is required.', type: 'error' });
  } else {
    const slugStr = data.slug.trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugStr)) {
      errors.push({ field: 'slug', message: 'Slug must contain only lowercase letters, numbers, and hyphens.', type: 'error' });
    } else {
      const isUnique = await validateSlugUniqueness(slugStr, productId);
      if (!isUnique) {
        errors.push({ field: 'slug', message: 'Slug must be unique. This slug is already in use.', type: 'error' });
      }
    }
  }

  return errors;
};

/** Save SEO data to database */
export const saveProductSEO = async (
  productId: number,
  seoData: Partial<GeneratedSEO>
): Promise<{ success: boolean; error?: string }> => {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  const { error } = await supabase
    .from('products')
    .update({
      ...seoData,
      updated_at: new Date().toISOString()
    })
    .eq('id', productId);

  if (error) {
    console.error('Error saving product SEO:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
};

/**
 * Bulk generate and save SEO for a list of products.
 * Includes overwrite logic.
 */
export const bulkGenerateAndSaveSEO = async (
  products: Product[],
  overwrite: boolean
): Promise<{ successCount: number; failedCount: number }> => {
  let successCount = 0;
  let failedCount = 0;

  for (const product of products) {
    try {
      const updates: any = {};
      const generated = generateProductSEO(product);

      if (overwrite || !product.display_name) {
        updates.display_name = generated.display_name;
      }
      if (overwrite || !product.slug) {
        const sourceDisplayName = updates.display_name !== undefined ? updates.display_name : (product.display_name || generated.display_name);
        const baseSlug = generateSlug(sourceDisplayName);
        let finalSlug = baseSlug;
        let counter = 2;
        let isUnique = await validateSlugUniqueness(finalSlug, product.id);
        while (!isUnique) {
          finalSlug = `${baseSlug}-${counter}`;
          isUnique = await validateSlugUniqueness(finalSlug, product.id);
          counter++;
        }
        updates.slug = finalSlug;
      }
      if (overwrite || !product.meta_description) updates.meta_description = generated.meta_description;
      if (overwrite || !product.alt_text) updates.alt_text = generated.alt_text;

      if (Object.keys(updates).length > 0) {
        const { success } = await saveProductSEO(product.id, updates);
        if (success) {
          successCount++;
        } else {
          failedCount++;
        }
      } else {
        successCount++;
      }
    } catch (err) {
      console.error(`Error in bulk SEO generation for product ID ${product.id}:`, err);
      failedCount++;
    }
  }

  return { successCount, failedCount };
};

/** Bulk generate SEO for all products under a specific category */
export const bulkGenerateSEOForCategory = async (
  genre: string,
  overwrite: boolean
): Promise<{ successCount: number; failedCount: number }> => {
  if (!isSupabaseConfigured()) return { successCount: 0, failedCount: 0 };

  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .eq('genre', genre)
    .eq('is_active', true);

  if (error || !products) {
    console.error('Error fetching category products for bulk SEO:', error);
    return { successCount: 0, failedCount: 0 };
  }

  return bulkGenerateAndSaveSEO(products, overwrite);
};

/** Bulk generate SEO for all products */
export const bulkGenerateSEOForAll = async (
  overwrite: boolean
): Promise<{ successCount: number; failedCount: number }> => {
  if (!isSupabaseConfigured()) return { successCount: 0, failedCount: 0 };

  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true);

  if (error || !products) {
    console.error('Error fetching all products for bulk SEO:', error);
    return { successCount: 0, failedCount: 0 };
  }

  return bulkGenerateAndSaveSEO(products, overwrite);
};
