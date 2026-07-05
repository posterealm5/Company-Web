import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useCart } from './CartContext';

export interface WishlistProduct {
  product_id: number;
  product_slug: string;
  title: string;
  image: string;
  price: number;
  genre?: string;
}

interface WishlistContextType {
  wishlist: WishlistProduct[];
  addToWishlist: (product: any) => Promise<void>;
  removeFromWishlist: (productId: number) => Promise<void>;
  isWishlisted: (productId: number) => boolean;
  wishlistCount: number;
  loading: boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { triggerNotification } = useCart();
  const [wishlist, setWishlist] = useState<WishlistProduct[]>([]);
  const [loading, setLoading] = useState(true);



  const mergeLocalWishlist = async (userId: string) => {
    const local = localStorage.getItem('wishlist');
    if (!local) return;
    try {
      const localItems: WishlistProduct[] = JSON.parse(local);
      if (localItems.length === 0) return;

      

      // Fetch existing DB wishlist to avoid duplicates
      const { data: dbItems, error } = await supabase
        .from('wishlists')
        .select('product_id')
        .eq('user_id', userId);

      if (error) throw error;

      const dbProductIds = new Set(dbItems?.map(item => Number(item.product_id)) || []);
      const toInsert = localItems
        .filter(item => !dbProductIds.has(item.product_id))
        .map(item => ({
          user_id: userId,
          product_id: item.product_id
        }));

      if (toInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('wishlists')
          .insert(toInsert);
        if (insertError) throw insertError;
        
      }

      // Clear localStorage wishlist after successful merge
      localStorage.removeItem('wishlist');
    } catch (err) {
      console.error('[WISHLIST STORAGE] Error merging wishlist:', err);
    }
  };

  // Load wishlist
  const loadWishlist = async () => {
    setLoading(true);
    if (user && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('wishlists')
          .select('product_id, products(id, name, image, price, genre)')
          .eq('user_id', user.id);

        if (error) throw error;

        const items: WishlistProduct[] = (data || [])
          .filter(item => item.products)
          .map(item => {
            const p = item.products as any;
            return {
              product_id: Number(p.id),
              product_slug: p.slug || '',
              title: p.display_name || p.name,
              image: p.image,
              price: Number(p.price),
              genre: p.genre
            };
          });
        
        
        
        
        setWishlist(items);
      } catch (err) {
        console.error('[WISHLIST LOAD] Error loading from Supabase:', err);
        
        setWishlist([]);
      }
    } else {
      // Guest: load from localStorage
      const local = localStorage.getItem('wishlist');
      if (local) {
        try {
          const items = JSON.parse(local);
          
          
          
          
          setWishlist(items);
        } catch (e) {
          console.error('[WISHLIST LOAD] Error parsing local wishlist:', e);
          
          setWishlist([]);
        }
      } else {
        
        
        
        
        setWishlist([]);
      }
    }
    setLoading(false);
  };

  // Sync / load when user changes
  useEffect(() => {
    const syncAndLoad = async () => {
      if (user && isSupabaseConfigured()) {
        await mergeLocalWishlist(user.id);
      }
      await loadWishlist();
    };
    syncAndLoad();
  }, [user]);

  const addToWishlist = useCallback(async (product: any) => {
    
    

    const slug = product.slug || '';
    const item: WishlistProduct = {
      product_id: Number(product.id),
      product_slug: slug,
      title: product.display_name || product.name || product.title,
      image: product.image,
      price: Number(product.price),
      genre: product.genre
    };

    if (user && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('wishlists')
          .insert({
            user_id: user.id,
            product_id: Number(product.id)
          })
          .select();
        
        
        if (error) throw error;
        
        const updatedWishlist = [...wishlist, item];
        
        setWishlist(updatedWishlist);
      } catch (err) {
        console.error('[WISHLIST STORAGE] Supabase error:', err);
      }
    } else {
      // Guest
      const local = localStorage.getItem('wishlist');
      let localItems: WishlistProduct[] = [];
      if (local) {
        try {
          localItems = JSON.parse(local);
        } catch (e) {
          localItems = [];
        }
      }
      if (!localItems.some(i => i.product_id === Number(product.id))) {
        localItems.push(item);
        localStorage.setItem('wishlist', JSON.stringify(localItems));
        
        
        const updatedWishlist = localItems;
        
        setWishlist(updatedWishlist);
      }
    }
    triggerNotification("Added to Wishlist ❤️");
  }, [user, wishlist, triggerNotification]);

  const removeFromWishlist = useCallback(async (productId: number) => {
    if (user && isSupabaseConfigured()) {
      try {
        const { error } = await supabase
          .from('wishlists')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', productId);
        if (error) throw error;
        setWishlist(prev => prev.filter(i => i.product_id !== productId));
      } catch (err) {
        console.error('Error removing from wishlist in Supabase:', err);
      }
    } else {
      // Guest
      const local = localStorage.getItem('wishlist');
      if (local) {
        try {
          const localItems: WishlistProduct[] = JSON.parse(local);
          const updated = localItems.filter(i => i.product_id !== productId);
          localStorage.setItem('wishlist', JSON.stringify(updated));
          setWishlist(updated);
        } catch (e) {
          // ignore
        }
      }
    }
    triggerNotification("Removed from Wishlist");
  }, [user, triggerNotification]);

  const wishlistSet = useMemo(() => {
    return new Set(wishlist.map(item => item.product_id));
  }, [wishlist]);

  const isWishlisted = useCallback((productId: number) => {
    return wishlistSet.has(productId);
  }, [wishlistSet]);

  const wishlistCount = useMemo(() => wishlist.length, [wishlist]);

  const contextValue = useMemo(() => ({
    wishlist,
    addToWishlist,
    removeFromWishlist,
    isWishlisted,
    wishlistCount,
    loading
  }), [
    wishlist,
    addToWishlist,
    removeFromWishlist,
    isWishlisted,
    wishlistCount,
    loading
  ]);

  return (
    <WishlistContext.Provider value={contextValue}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (context === undefined) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
};
