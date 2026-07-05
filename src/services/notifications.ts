import { OrderStatus } from '../types/database';

/**
 * Formats a phone number for use in a WhatsApp deep link.
 * Strips all non-numeric characters, and prefixes with 91 if it's a 10-digit number.
 */
export function formatWhatsAppPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `91${cleaned}`;
  }
  return cleaned;
}

interface WhatsAppOrderData {
  id: number;
  customer_name: string;
  total: number;
  courier_name?: string | null;
  tracking_number?: string | null;
  delivery_method?: 'local' | 'courier';
}

/**
 * Generates a WhatsApp deep link for manual customer notification or direct contact.
 */
export function generateWhatsAppLink(
  phone: string,
  template: 'confirmed' | 'processing' | 'out_for_delivery' | 'shipped' | 'delivered' | 'contact',
  order?: WhatsAppOrderData
): string {
  const formattedPhone = formatWhatsAppPhone(phone);
  
  if (template === 'contact') {
    return `https://wa.me/${formattedPhone}`;
  }

  if (!order) {
    return `https://wa.me/${formattedPhone}`;
  }

  let message = '';
  const orderIdStr = order.id.toString().padStart(6, '0');

  switch (template) {
    case 'confirmed':
      message = `Hi ${order.customer_name},\n\nYour Posterealm order #${orderIdStr} of ₹${order.total} is confirmed! We will start preparing it soon. Thank you!\n\nTeam Posterealm`;
      break;
    case 'processing':
      message = `Hi ${order.customer_name},\n\nWe are now printing/preparing your Posterealm order #${orderIdStr} of ₹${order.total}. We'll notify you once it's ${order.delivery_method === 'local' ? 'out for delivery' : 'shipped'}!\n\nTeam Posterealm`;
      break;
    case 'out_for_delivery':
      message = `Hi ${order.customer_name},\n\nYour Posterealm order #${orderIdStr} is out for delivery today.\n\nIt should reach you shortly.\n\nTeam Posterealm`;
      break;
    case 'shipped':
      message = `Hi ${order.customer_name},\n\nYour Posterealm order #${orderIdStr} has been shipped.\n\nCourier:\n${order.courier_name || 'Delhivery'}\n\nTracking Number:\n${order.tracking_number || 'N/A'}\n\nThank you for shopping with Posterealm.\n\nTeam Posterealm`;
      break;
    case 'delivered':
      message = `Hi ${order.customer_name},\n\nYour Posterealm order #${orderIdStr} has been delivered.\n\nWe hope you love your new poster ❤️\n\nThank you for supporting Posterealm.\n\nTeam Posterealm`;
      break;
  }

  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Prepares and logs order status change notifications.
 */
export async function triggerOrderStatusNotification(
  orderId: number,
  status: OrderStatus,
  trackingData?: {
    courierName?: string | null;
    trackingNumber?: string | null;
    deliveryMethod?: 'local' | 'courier';
  }
): Promise<void> {
  
  if (trackingData) {
    
  }
}
