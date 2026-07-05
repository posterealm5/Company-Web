import { useNotification } from '../context/NotificationContext';
import type { Product } from '../types/database';
import { getProductShareUrl } from '../utils/productUrls';

export const useSharePoster = () => {
  const { triggerNotification } = useNotification();

  const sharePoster = async (product: Product) => {
    if (!product || !product.name) return;

    const url = getProductShareUrl(product);
    const title = product.name;
    const text = 'Check out this premium wall poster on Posterealm.';

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url,
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          triggerNotification('Sharing failed', err.message || 'An error occurred while sharing.', 'error');
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        triggerNotification('Link copied to clipboard.', '', 'success');
      } catch (err: any) {
        triggerNotification('Failed to copy', 'Could not copy link to clipboard.', 'error');
      }
    }
  };

  return sharePoster;
};
