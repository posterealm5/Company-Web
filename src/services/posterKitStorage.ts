import type { PlacedPoster, PosterSizeId, PosterOrientation, PosterArtworkSource, PosterMaterialId } from '../types/posterKit';
import { isStorefrontMockupUrl } from './posterArtwork';
import { normalizeMinimumPosterLayout } from '../utils/posterKitMath';

export const POSTER_KIT_STORAGE_KEY_V1 = 'posterealm_poster_kit_layout_v1';
export const POSTER_KIT_DB_NAME = 'posterealm_poster_kit_db';
export const POSTER_KIT_DB_STORE = 'custom_artworks';
export const POSTER_KIT_DB_VERSION = 1;

export interface PersistedPosterItem {
  id: string;
  sizeId: PosterSizeId;
  orientation: PosterOrientation;
  material?: PosterMaterialId;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  label: string;
  artworkSource?: PosterArtworkSource;
  artworkProductId?: number | string;
  artworkTitle?: string;
  artworkUrl?: string; // Stored for permanent Supabase URLs (collection or verified custom preview); never blob!
  originalArtworkUrl?: string; // Phase 3B: Permanent print master URL in uploads/
  customArtworkId?: string; // Stable reference to IndexedDB / Registry
  mockupUrl?: string; // Original storefront product image / mockup URL for collection artwork
  image_thumbnail_url?: string | null;
  image_card_url?: string | null;
  image_preview_url?: string | null;
  customArtworkFileName?: string;
}

export interface PersistedPosterKitLayout {
  version: 1;
  timestamp: number;
  activeSizeToAdd: PosterSizeId;
  posters: PersistedPosterItem[];
}

const VALID_SIZES: PosterSizeId[] = ['A6', 'A5', 'A4', 'A3'];
const VALID_ORIENTATIONS: PosterOrientation[] = ['portrait', 'landscape'];
const VALID_MATERIALS: PosterMaterialId[] = ['matte', 'glossy', 'rigid_board'];

// In-memory fallbacks for non-browser / SSR / test environments
const memoryStorage = new Map<string, string>();
const memoryIndexedDB = new Map<string, { id: string; blob: Blob; filename?: string }>();

function getLocalStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return {
    getItem: (key: string) => memoryStorage.get(key) ?? null,
    setItem: (key: string, val: string) => memoryStorage.set(key, val),
    removeItem: (key: string) => memoryStorage.delete(key),
    clear: () => memoryStorage.clear(),
  };
}

// ============================================================================
// IndexedDB Storage for Durable Custom Artwork Blobs
// ============================================================================

function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return reject(new Error('IndexedDB is not available in this environment'));
    }

    const request = window.indexedDB.open(POSTER_KIT_DB_NAME, POSTER_KIT_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(POSTER_KIT_DB_STORE)) {
        db.createObjectStore(POSTER_KIT_DB_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

/**
 * Saves a custom uploaded image Blob into IndexedDB.
 */
export async function saveCustomArtworkBlob(id: string, blob: Blob, filename?: string): Promise<void> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    memoryIndexedDB.set(id, { id, blob, filename });
    return;
  }

  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(POSTER_KIT_DB_STORE, 'readwrite');
      const store = transaction.objectStore(POSTER_KIT_DB_STORE);
      const record = {
        id,
        blob,
        filename,
        createdAt: Date.now(),
      };
      const putRequest = store.put(record);

      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error || new Error('Failed to store artwork blob'));
    });
  } catch (err) {
    // Fallback to memory
    memoryIndexedDB.set(id, { id, blob, filename });
  }
}

/**
 * Retrieves a custom uploaded image Blob from IndexedDB.
 */
export async function getCustomArtworkBlob(id: string): Promise<Blob | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return memoryIndexedDB.get(id)?.blob || null;
  }

  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(POSTER_KIT_DB_STORE, 'readonly');
      const store = transaction.objectStore(POSTER_KIT_DB_STORE);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const result = getRequest.result;
        if (result && result.blob instanceof Blob) {
          resolve(result.blob);
        } else {
          resolve(memoryIndexedDB.get(id)?.blob || null);
        }
      };
      getRequest.onerror = () => resolve(memoryIndexedDB.get(id)?.blob || null);
    });
  } catch {
    return memoryIndexedDB.get(id)?.blob || null;
  }
}

/**
 * Deletes a custom uploaded image Blob from IndexedDB.
 */
export async function deleteCustomArtworkBlob(id: string): Promise<void> {
  memoryIndexedDB.delete(id);

  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return;
  }

  try {
    const db = await openIndexedDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(POSTER_KIT_DB_STORE, 'readwrite');
      const store = transaction.objectStore(POSTER_KIT_DB_STORE);
      const deleteRequest = store.delete(id);

      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => resolve();
    });
  } catch {
    // Safe ignore
  }
}

/**
 * Clears all custom uploaded image Blobs from IndexedDB.
 */
export async function clearAllCustomArtworkBlobs(): Promise<void> {
  memoryIndexedDB.clear();

  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return;
  }

  try {
    const db = await openIndexedDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(POSTER_KIT_DB_STORE, 'readwrite');
      const store = transaction.objectStore(POSTER_KIT_DB_STORE);
      const clearRequest = store.clear();

      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => resolve();
    });
  } catch {
    // Safe ignore
  }
}

// ============================================================================
// LocalStorage Persistence for Complete Poster Kit Layout
// ============================================================================

/**
 * Serializes and saves the complete Poster Kit layout to versioned localStorage.
 * Automatically excludes transient blob URLs and persists durable references.
 */
export function savePosterKitLayout(posters: PlacedPoster[], activeSizeToAdd: PosterSizeId = 'A4'): void {
  try {
    const storage = getLocalStorage();
    const serializedPosters: PersistedPosterItem[] = posters.map((poster) => {
      const item: PersistedPosterItem = {
        id: poster.id,
        sizeId: poster.sizeId,
        orientation: poster.orientation || 'portrait',
        material: poster.material || 'matte',
        xPercent: Number(poster.xPercent.toFixed(4)),
        yPercent: Number(poster.yPercent.toFixed(4)),
        widthPercent: Number(poster.widthPercent.toFixed(4)),
        heightPercent: Number(poster.heightPercent.toFixed(4)),
        label: poster.label,
      };

      if (poster.artworkSource === 'collection' && poster.artworkUrl && !poster.artworkUrl.startsWith('blob:')) {
        item.artworkSource = 'collection';
        item.artworkUrl = poster.artworkUrl;
        item.artworkProductId = poster.artworkProductId;
        item.artworkTitle = poster.artworkTitle;
        item.mockupUrl = poster.mockupUrl || poster.artwork?.mockupUrl;
        item.image_thumbnail_url = poster.image_thumbnail_url ?? poster.artwork?.image_thumbnail_url ?? null;
        item.image_card_url = poster.image_card_url ?? poster.artwork?.image_card_url ?? null;
        item.image_preview_url = poster.image_preview_url ?? poster.artwork?.image_preview_url ?? null;
      } else if (poster.artworkSource === 'custom' || poster.customArtworkId) {
        item.artworkSource = 'custom';
        item.customArtworkId = poster.customArtworkId || poster.artwork?.customArtworkId;
        item.artworkTitle = poster.artworkTitle;
        item.customArtworkFileName = poster.customArtworkFileName || poster.artwork?.customArtworkFileName;
        // Phase 3B: If artworkUrl is a verified permanent cloud URL (never blob!), persist it
        if (poster.artworkUrl && !poster.artworkUrl.startsWith('blob:') && poster.artworkUrl.startsWith('http')) {
          item.artworkUrl = poster.artworkUrl;
        }
        const masterUrl = poster.originalArtworkUrl || poster.artwork?.originalArtworkUrl;
        if (masterUrl && !masterUrl.startsWith('blob:') && masterUrl.startsWith('http')) {
          item.originalArtworkUrl = masterUrl;
        }
      }

      return item;
    });

    const payload: PersistedPosterKitLayout = {
      version: 1,
      timestamp: Date.now(),
      activeSizeToAdd: VALID_SIZES.includes(activeSizeToAdd) ? activeSizeToAdd : 'A4',
      posters: serializedPosters,
    };

    storage.setItem(POSTER_KIT_STORAGE_KEY_V1, JSON.stringify(payload));
  } catch (err) {
    console.warn('Failed to persist Poster Kit layout to localStorage:', err);
  }
}

/**
 * Validates and restores the saved Poster Kit layout from versioned localStorage.
 * Returns null if no valid state exists, triggering fallback to default layout.
 */
export function getSavedPosterKitLayout(): { posters: PlacedPoster[]; activeSizeToAdd?: PosterSizeId } | null {
  try {
    const storage = getLocalStorage();
    const raw = storage.getItem(POSTER_KIT_STORAGE_KEY_V1);
    if (!raw) return null;

    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || data.version !== 1 || !Array.isArray(data.posters)) {
      return null;
    }

    const validatedPosters: PlacedPoster[] = [];

    for (const item of data.posters) {
      if (!item || typeof item !== 'object') continue;

      // Validate required identifier and dimensions
      if (typeof item.id !== 'string' || !item.id) continue;
      if (!VALID_SIZES.includes(item.sizeId)) continue;

      const orientation: PosterOrientation = VALID_ORIENTATIONS.includes(item.orientation)
        ? item.orientation
        : 'portrait';

      const material: PosterMaterialId = VALID_MATERIALS.includes(item.material)
        ? item.material
        : 'matte';

      const xPercent = typeof item.xPercent === 'number' && Number.isFinite(item.xPercent) ? item.xPercent : 10;
      const yPercent = typeof item.yPercent === 'number' && Number.isFinite(item.yPercent) ? item.yPercent : 10;
      const widthPercent = typeof item.widthPercent === 'number' && Number.isFinite(item.widthPercent) ? item.widthPercent : 15;
      const heightPercent = typeof item.heightPercent === 'number' && Number.isFinite(item.heightPercent) ? item.heightPercent : 20;

      const poster: PlacedPoster = {
        id: item.id,
        sizeId: item.sizeId,
        orientation,
        material,
        xPercent,
        yPercent,
        widthPercent,
        heightPercent,
        label: typeof item.label === 'string' && item.label ? item.label : `Poster #${validatedPosters.length + 1}`,
      };


      // Validate artwork fields
      if (
        item.artworkSource === 'collection' &&
        typeof item.artworkUrl === 'string' &&
        item.artworkUrl.trim() &&
        !item.artworkUrl.startsWith('blob:') &&
        !isStorefrontMockupUrl(item.artworkUrl)
      ) {
        poster.artworkSource = 'collection';
        poster.artworkUrl = item.artworkUrl;
        poster.artworkProductId = item.artworkProductId;
        poster.collectionProductId = item.artworkProductId;
        poster.artworkTitle = item.artworkTitle;
        poster.mockupUrl = item.mockupUrl;
        poster.image_thumbnail_url = item.image_thumbnail_url;
        poster.image_card_url = item.image_card_url;
        poster.image_preview_url = item.image_preview_url;
        poster.artwork = {
          source: 'collection',
          url: item.artworkUrl,
          productId: item.artworkProductId,
          title: item.artworkTitle,
          isBlobUrl: false,
          mockupUrl: item.mockupUrl,
          image_thumbnail_url: item.image_thumbnail_url,
          image_card_url: item.image_card_url,
          image_preview_url: item.image_preview_url,
        };
      } else if (item.artworkSource === 'custom' && typeof item.customArtworkId === 'string' && item.customArtworkId) {
        const hasPermanentUrl = typeof item.artworkUrl === 'string' && item.artworkUrl.startsWith('http') && !item.artworkUrl.startsWith('blob:');
        const masterUrl = (typeof item.originalArtworkUrl === 'string' && item.originalArtworkUrl.startsWith('http') && !item.originalArtworkUrl.startsWith('blob:'))
          ? item.originalArtworkUrl
          : (hasPermanentUrl ? item.artworkUrl : undefined);

        poster.artworkSource = 'custom';
        poster.customArtworkId = item.customArtworkId;
        poster.artworkTitle = item.artworkTitle || 'Custom Artwork';
        poster.customArtworkFileName = item.customArtworkFileName;
        poster.artworkUrl = hasPermanentUrl ? item.artworkUrl : '';
        poster.originalArtworkUrl = masterUrl;
        poster.artwork = {
          source: 'custom',
          url: hasPermanentUrl ? item.artworkUrl! : '',
          originalArtworkUrl: masterUrl,
          title: item.artworkTitle || 'Custom Artwork',
          isBlobUrl: !hasPermanentUrl,
          customArtworkId: item.customArtworkId,
          customArtworkFileName: item.customArtworkFileName,
        };
      }

      validatedPosters.push(poster);
    }

    const activeSizeToAdd: PosterSizeId | undefined =
      VALID_SIZES.includes(data.activeSizeToAdd) ? data.activeSizeToAdd : undefined;

    return {
      posters: validatedPosters,
      activeSizeToAdd,
    };
  } catch (err) {
    console.warn('Failed to load saved Poster Kit layout from localStorage:', err);
    return null;
  }
}

/**
 * Clears the saved layout in localStorage to an explicit empty state.
 */
export function clearSavedPosterKitLayout(activeSizeToAdd: PosterSizeId = 'A4'): void {
  try {
    const storage = getLocalStorage();
    const payload: PersistedPosterKitLayout = {
      version: 1,
      timestamp: Date.now(),
      activeSizeToAdd,
      posters: [],
    };
    storage.setItem(POSTER_KIT_STORAGE_KEY_V1, JSON.stringify(payload));
  } catch (err) {
    console.warn('Failed to clear saved Poster Kit layout in localStorage:', err);
  }
}

/**
 * Resets the layout storage key completely.
 */
export function resetSavedPosterKitLayout(): void {
  try {
    const storage = getLocalStorage();
    storage.removeItem(POSTER_KIT_STORAGE_KEY_V1);
  } catch {
    // Safe ignore
  }
}

/**
 * Returns the raw persisted JSON string (for testing & verification).
 */
export function getRawSavedLayoutJson(): string | null {
  try {
    const storage = getLocalStorage();
    return storage.getItem(POSTER_KIT_STORAGE_KEY_V1);
  } catch {
    return null;
  }
}

/**
 * Sets raw persisted JSON string directly (for test validation of corruption/outdated versions).
 */
export function setRawSavedLayoutJson(raw: string): void {
  try {
    const storage = getLocalStorage();
    storage.setItem(POSTER_KIT_STORAGE_KEY_V1, raw);
  } catch {
    // Safe ignore
  }
}

