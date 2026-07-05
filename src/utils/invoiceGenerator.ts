import { jsPDF } from 'jspdf';
import type { Order } from '../types/database';

interface LoadedImage {
  dataUrl: string;
  width: number;
  height: number;
}

// Global caching variable to ensure the logo is only loaded once per session
let cachedLogo: LoadedImage | null = null;

/**
 * Loads an image from a URL and returns a Promise with its base64 Data URL and natural dimensions.
 */
const loadImage = (url: string): Promise<LoadedImage> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve({
          dataUrl: canvas.toDataURL('image/png'),
          width: img.naturalWidth,
          height: img.naturalHeight
        });
      } else {
        reject(new Error('Failed to get canvas 2D context'));
      }
    };
    img.onerror = () => reject(new Error(`Failed to load image at ${url}`));
    img.src = url;
  });
};

/**
 * Generates and downloads a professional PDF invoice for a PosterRealm order.
 * Redesigned visually for a premium, clean look (inspired by Stripe/Apple).
 */
export const downloadInvoice = async (order: Order, options?: { isTaxInvoice?: boolean }) => {
  const isTaxInvoice = options?.isTaxInvoice || false;
  
  // Create document: A4 (210mm x 297mm), portrait orientation
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Color Palette
  const brandRed = [230, 57, 70]; // #E63946
  const brandBlack = [0, 0, 0];   // #000000
  const darkGrey = [100, 100, 100];
  const subtleGrey = [140, 140, 140];
  const borderGrey = [220, 220, 220];

  // 1. Load Logo Image
  if (!cachedLogo) {
    try {
      cachedLogo = await loadImage('/logo.png');
    } catch (e) {
      console.error('Failed to load logo image', e);
    }
  }

  // Use built-in Helvetica font directly for standard Western text & numbers
  const fontFamily = 'Helvetica';
  doc.setFont(fontFamily, 'normal');

  // Helper formatting functions
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    } catch (e) {
      return dateStr;
    }
  };

  const formatCurrency = (amount: number) => {
    // Only display numeric values to ensure maximum PDF compatibility and clean layout
    return amount.toFixed(2);
  };

  // Generate Unique Invoice Number (PR-INV-XXXXXX)
  const invoiceNumber = `PR-INV-${order.id.toString().padStart(6, '0')}`;
  const orderNumber = `#${order.id.toString().padStart(6, '0')}`;

  // 2. Header Section - Center Aligned
  let logoEndY = 3;
  if (cachedLogo) {
    const logoWidth = 110; // Keep the current enlarged size
    const logoHeight = (cachedLogo.height / cachedLogo.width) * logoWidth;
    const logoX = 105 - (logoWidth / 2);
    // Shift logo upward to crop the top transparent padding off-page
    doc.addImage(cachedLogo.dataUrl, 'PNG', logoX, -24, logoWidth, logoHeight);
    // Explicitly set logoEndY to 66 to crop the bottom transparent padding and add comfortable premium spacing above heading
    logoEndY = 66;
  } else {
    // Fallback Text Logo if image fails to load
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(26);
    doc.setTextColor(brandBlack[0], brandBlack[1], brandBlack[2]);
    const logoText1 = 'POSTE';
    const logoText2 = 'REALM';
    const w1 = doc.getTextWidth(logoText1);
    const w2 = doc.getTextWidth(logoText2);
    const totalLogoWidth = w1 + w2;
    const logoStartX = 105 - (totalLogoWidth / 2);
    doc.text(logoText1, logoStartX, 15);
    doc.setTextColor(brandRed[0], brandRed[1], brandRed[2]);
    doc.text(logoText2, logoStartX + w1, 15);
    logoEndY = 20;
  }

  // Invoice Heading - Large & Centered
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(16);
  doc.setTextColor(brandBlack[0], brandBlack[1], brandBlack[2]);
  doc.text(isTaxInvoice ? 'TAX INVOICE' : 'INVOICE', 105, logoEndY + 2, { align: 'center' });

  // Invoice heading accent - Red line
  const headingText = isTaxInvoice ? 'TAX INVOICE' : 'INVOICE';
  const headingWidth = doc.getTextWidth(headingText);
  doc.setDrawColor(brandRed[0], brandRed[1], brandRed[2]);
  doc.setLineWidth(0.6);
  doc.line(105 - (headingWidth / 2), logoEndY + 4.5, 105 + (headingWidth / 2), logoEndY + 4.5);

  let infoStartY = logoEndY + 11;

  // 3. Top Information Section - Two Equal Columns
  // LEFT COLUMN: Bill To Customer Details
  const leftColX = 20;
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(brandBlack[0], brandBlack[1], brandBlack[2]);
  doc.text('Bill To', leftColX, infoStartY);
  
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(9);
  doc.text(order.customer_name || 'N/A', leftColX, infoStartY + 5);

  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(darkGrey[0], darkGrey[1], darkGrey[2]);
  doc.text(`Phone: ${order.customer_phone || 'N/A'}`, leftColX, infoStartY + 9.5);
  doc.text(`Email: ${order.customer_email || 'N/A'}`, leftColX, infoStartY + 14);

  // Complete Shipping Address
  const addressLines = doc.splitTextToSize(order.shipping_address || 'N/A', 80);
  let addressY = infoStartY + 18.5;
  addressLines.forEach((line: string) => {
    doc.text(line, leftColX, addressY);
    addressY += 4;
  });

  // RIGHT COLUMN: Invoice Metadata
  const payMethod = (order.payment_method || 'N/A').toUpperCase();
  const displayPayMethod = payMethod.includes('COD') ? 'COD' : 'ONLINE';
  
  const rightItems = [
    { label: 'Invoice Number:', val: invoiceNumber },
    { label: 'Order Number:', val: orderNumber },
    { label: 'Invoice Date:', val: formatDate(order.created_at) },
    { label: 'Payment Method:', val: displayPayMethod },
    { label: 'Payment Status:', val: order.payment_status || 'Pending' },
    { label: 'Order Status:', val: order.status.charAt(0).toUpperCase() + order.status.slice(1) }
  ];

  const rightLabelColX = 115;
  const rightValueColX = 190;
  let rightY = infoStartY;
  rightItems.forEach(item => {
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(darkGrey[0], darkGrey[1], darkGrey[2]);
    doc.text(item.label, rightLabelColX, rightY);

    doc.setFont(fontFamily, 'normal');
    doc.setTextColor(brandBlack[0], brandBlack[1], brandBlack[2]);
    doc.text(item.val, rightValueColX, rightY, { align: 'right' });
    rightY += 4.5;
  });

  // Determine starting position of table based on taller column to ensure perfect spacing
  let tableStartY = Math.max(addressY, rightY) + 12;

  // 4. Product Table - Clean, Minimal Horizontal Dividers
  interface TableColumn {
    x: number;
    width: number;
    name: string;
    align?: 'left' | 'center' | 'right';
  }

  const columns: Record<string, TableColumn> = {
    product: { x: 20, width: 65, name: 'Product', align: 'left' },
    size: { x: 90, width: 23, name: 'Size', align: 'left' },
    material: { x: 115, width: 23, name: 'Material', align: 'left' },
    qty: { x: 142, width: 10, name: 'Qty', align: 'center' },
    unitPrice: { x: 155, width: 15, name: 'Unit Price', align: 'right' },
    totalPrice: { x: 175, width: 15, name: 'Total', align: 'right' }
  };

  // Thin Black Line above table headers
  doc.setDrawColor(brandBlack[0], brandBlack[1], brandBlack[2]);
  doc.setLineWidth(0.4);
  doc.line(20, tableStartY, 190, tableStartY);

  // Table Headers (No background, clean black text)
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(brandBlack[0], brandBlack[1], brandBlack[2]);

  Object.values(columns).forEach(col => {
    if (col.align === 'right') {
      doc.text(col.name, col.x + col.width, tableStartY + 5, { align: 'right' });
    } else if (col.align === 'center') {
      doc.text(col.name, col.x + (col.width / 2), tableStartY + 5, { align: 'center' });
    } else {
      doc.text(col.name, col.x, tableStartY + 5);
    }
  });

  // Thin line below headers
  doc.line(20, tableStartY + 7, 190, tableStartY + 7);
  let currentY = tableStartY + 7;

  // Print Table Body
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(8);
  
  order.items.forEach((item, idx) => {
    const isCustomSize = (item.width && item.width > 0) && (item.height && item.height > 0);
    const sizeVal = isCustomSize 
      ? `Custom (${item.width}" x ${item.height}")` 
      : (item.selected_size || item.size || 'N/A');
    
    const materialVal = item.selected_material || item.material || 'N/A';
    const qtyVal = item.quantity.toString();
    const unitPriceVal = item.isFreeItem ? 'Free' : formatCurrency(Number(item.unit_price || item.price));
    const totalPriceVal = item.isFreeItem ? 'Free' : formatCurrency(Number(item.line_total || ((item.price || item.unit_price) * item.quantity)));

    // Wrap product name to prevent overflow
    const nameLines: string[] = doc.splitTextToSize(item.name, columns.product.width - 2);
    const lineCount = nameLines.length;
    const rowHeight = (lineCount * 4) + 3;

    // Check if new page is needed
    if (currentY + rowHeight > 260) {
      doc.addPage();
      currentY = 20;
      
      // Table headers on new page
      doc.setDrawColor(brandBlack[0], brandBlack[1], brandBlack[2]);
      doc.setLineWidth(0.4);
      doc.line(20, currentY, 190, currentY);
      
      doc.setFont(fontFamily, 'bold');
      Object.values(columns).forEach(col => {
        if (col.align === 'right') {
          doc.text(col.name, col.x + col.width, currentY + 5, { align: 'right' });
        } else if (col.align === 'center') {
          doc.text(col.name, col.x + (col.width / 2), currentY + 5, { align: 'center' });
        } else {
          doc.text(col.name, col.x, currentY + 5);
        }
      });
      doc.line(20, currentY + 7, 190, currentY + 7);
      doc.setFont(fontFamily, 'normal');
      currentY += 7;
    }

    // Print Product name lines
    nameLines.forEach((line, lineIdx) => {
      doc.text(line, columns.product.x, currentY + 4 + (lineIdx * 4));
    });

    const valOffset = 4;
    doc.text(sizeVal, columns.size.x, currentY + valOffset);
    doc.text(materialVal, columns.material.x, currentY + valOffset);
    doc.text(qtyVal, columns.qty.x + (columns.qty.width / 2), currentY + valOffset, { align: 'center' });
    doc.text(unitPriceVal, columns.unitPrice.x + columns.unitPrice.width, currentY + valOffset, { align: 'right' });
    doc.text(totalPriceVal, columns.totalPrice.x + columns.totalPrice.width, currentY + valOffset, { align: 'right' });

    // Draw row bottom thin divider
    doc.setDrawColor(borderGrey[0], borderGrey[1], borderGrey[2]);
    doc.setLineWidth(0.2);
    doc.line(20, currentY + rowHeight, 190, currentY + rowHeight);

    currentY += rowHeight;
  });

  // Solid table bottom line
  doc.setDrawColor(brandBlack[0], brandBlack[1], brandBlack[2]);
  doc.setLineWidth(0.4);
  doc.line(20, currentY, 190, currentY);
  currentY += 8;

  // 5. Order Summary - Right Aligned (with white space and clean typography)
  if (currentY > 230) {
    doc.addPage();
    currentY = 20;
  }

  const summaryColX = 140;
  const valueColX = 190;
  let summaryY = currentY;

  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(8.5);
  // Set summary label and values color to solid black to improve readability
  doc.setTextColor(brandBlack[0], brandBlack[1], brandBlack[2]);

  // Subtotal
  doc.text('Subtotal:', summaryColX, summaryY);
  doc.text(formatCurrency(Number(order.subtotal)), valueColX, summaryY, { align: 'right' });
  summaryY += 4.5;

  // Coupon (if exists)
  if (order.coupon_code && order.discount_amount && Number(order.discount_amount) > 0) {
    doc.text(`Coupon (${order.coupon_code}):`, summaryColX, summaryY);
    doc.text(`-${formatCurrency(Number(order.discount_amount))}`, valueColX, summaryY, { align: 'right' });
    summaryY += 4.5;
  }

  // Shipping
  doc.text('Shipping Charge:', summaryColX, summaryY);
  doc.text(formatCurrency(Number(order.shipping_charge)), valueColX, summaryY, { align: 'right' });
  summaryY += 4.5;

  // Future-Proof Tax Section (CGST/SGST/IGST placeholders)
  if (isTaxInvoice) {
    doc.text('CGST (9%):', summaryColX, summaryY);
    doc.text(formatCurrency(0), valueColX, summaryY, { align: 'right' });
    summaryY += 4.5;

    doc.text('SGST (9%):', summaryColX, summaryY);
    doc.text(formatCurrency(0), valueColX, summaryY, { align: 'right' });
    summaryY += 4.5;
  }

  // Divider before Grand Total
  doc.setDrawColor(borderGrey[0], borderGrey[1], borderGrey[2]);
  doc.setLineWidth(0.3);
  doc.line(summaryColX - 5, summaryY, valueColX, summaryY);
  summaryY += 4;

  // Grand Total - Prominent and highlighted in brand red
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(brandBlack[0], brandBlack[1], brandBlack[2]);
  doc.text('Grand Total:', summaryColX, summaryY);

  // Grand total amount in brand red
  doc.setTextColor(brandRed[0], brandRed[1], brandRed[2]);
  doc.text(formatCurrency(Number(order.total)), valueColX, summaryY, { align: 'right' });

  // 6. Professional Footer
  const footerY = 272;
  
  // Thin footer top line
  doc.setDrawColor(borderGrey[0], borderGrey[1], borderGrey[2]);
  doc.setLineWidth(0.2);
  doc.line(20, footerY - 4, 190, footerY - 4);

  // Footer left info
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(8);
  doc.setTextColor(brandBlack[0], brandBlack[1], brandBlack[2]);
  doc.text('Thank you for shopping with Posterealm.', 20, footerY);

  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(subtleGrey[0], subtleGrey[1], subtleGrey[2]);
  doc.text('For assistance: support@posterealm.com', 20, footerY + 4);

  // Footer right info (Website & Social handle)
  doc.setFont(fontFamily, 'bold');
  doc.setTextColor(brandBlack[0], brandBlack[1], brandBlack[2]);
  doc.text('posterealm.store', 190, footerY, { align: 'right' });

  doc.setFont(fontFamily, 'normal');
  doc.setTextColor(subtleGrey[0], subtleGrey[1], subtleGrey[2]);
  doc.text('IG: @posterealm.store', 190, footerY + 4, { align: 'right' });

  // 7. Trigger immediate download
  const pdfFileName = `${invoiceNumber}.pdf`;
  doc.save(pdfFileName);
};
