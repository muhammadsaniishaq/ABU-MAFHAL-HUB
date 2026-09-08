import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { ABU_MAFHAL_LOGO_B64 } from '../assets/images/logoB64';

export interface ReceiptData {
  reference: string;
  type: string;
  description: string;
  amount: number | string;
  status: string;
  date: string | Date;
  beneficiary?: string;
  recipientName?: string;
  bankName?: string;
  accountNumber?: string;
  transferAmount?: number | string;
  fee?: number | string;
  totalDebit?: number | string;
  sessionId?: string;
  senderName?: string;
  paymentMethod?: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: string;
}

// Formats dates to authentic Moniepoint format: "Monday, January 20th | 7:53 PM"
export function formatMoniepointDate(rawDate?: any): string {
  if (!rawDate) return 'Today';
  let d = new Date(rawDate);
  if (isNaN(d.getTime())) {
    d = new Date();
  }

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayName = days[d.getDay()];
  const monthName = months[d.getMonth()];
  const dateNum = d.getDate();

  const suffix = (n: number) => {
    if (n >= 11 && n <= 13) return `${n}th`;
    switch (n % 10) {
      case 1: return `${n}st`;
      case 2: return `${n}nd`;
      case 3: return `${n}rd`;
      default: return `${n}th`;
    }
  };

  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minStr = minutes < 10 ? `0${minutes}` : `${minutes}`;

  return `${dayName}, ${monthName} ${dateNum}${suffix(dateNum)} | ${hours}:${minStr} ${ampm}`;
}

/**
 * Generate authentic Moniepoint ticket style A5 HTML receipt for Abu Mafhal Hub
 */
export function generateModernReceiptHTML(data: ReceiptData): string {
  const ref = String(data.reference || `TXN-${Date.now()}`);
  const formattedDate = formatMoniepointDate(data.date);
  
  // Amount computations
  const numTotalDebit = typeof data.totalDebit === 'number'
    ? data.totalDebit
    : (data.totalDebit ? parseFloat(String(data.totalDebit).replace(/[^0-9.]/g, '')) : null);
  const numAmount = typeof data.amount === 'number'
    ? data.amount
    : parseFloat(String(data.amount).replace(/[^0-9.]/g, '')) || 0;

  const displayTotalAmount = numTotalDebit ?? numAmount;
  const formattedTotal = `₦${displayTotalAmount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  const isDebit = data.type !== 'deposit';
  const recipientDisplay = data.recipientName || data.beneficiary || 'Beneficiary';
  const fullRefText = data.sessionId ? `TRF|${ref}|${data.sessionId}` : `TRF|${ref}`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt_${ref}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700;800&display=swap');
    
    @page {
      size: A5 portrait;
      margin: 0;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    html, body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: #0056D2;
      color: #0F172A;
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    #receipt-page {
      width: 100%;
      min-height: 100%;
      background: #0056D2;
      padding: 24px 20px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-sizing: border-box;
      position: relative;
      overflow: hidden;
    }

    /* Decorative Moniepoint Background Gold Accents */
    .bg-accent-1 {
      position: absolute;
      top: -60px;
      right: -60px;
      width: 180px;
      height: 180px;
      border: 8px solid #F59E0B;
      border-radius: 50%;
      opacity: 0.25;
      pointer-events: none;
    }
    .bg-accent-2 {
      position: absolute;
      bottom: -40px;
      left: -40px;
      width: 160px;
      height: 160px;
      border: 8px solid #F59E0B;
      border-radius: 50%;
      opacity: 0.25;
      pointer-events: none;
    }
    
    /* Moniepoint Pill Header */
    .mp-brand-capsule {
      background: #FFFFFF;
      border-radius: 30px;
      padding: 6px 18px;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 20px;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
      z-index: 2;
    }
    
    .mp-brand-logo {
      width: 20px;
      height: 20px;
      border-radius: 4px;
      object-fit: cover;
    }
    
    .mp-brand-title {
      font-size: 14px;
      font-weight: 900;
      color: #0056D2;
      letter-spacing: 0.3px;
    }
    
    /* White Ticket Paper Card */
    .mp-ticket-card {
      background: #FFFFFF;
      border-top-left-radius: 20px;
      border-top-right-radius: 20px;
      width: 100%;
      max-width: 380px;
      padding: 20px 20px 0;
      box-sizing: border-box;
      position: relative;
      z-index: 2;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
    }
    
    /* Header Row: DEBIT pill & 'M' avatar */
    .mp-ticket-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    
    .mp-debit-badge {
      background: #EFF6FF;
      border: 1px solid #BFDBFE;
      color: #1D4ED8;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.8px;
      padding: 4px 10px;
      border-radius: 6px;
      text-transform: uppercase;
    }
    
    .mp-avatar-circle {
      width: 36px;
      height: 36px;
      border-radius: 18px;
      background: #0056D2;
      color: #FFFFFF;
      font-size: 19px;
      font-weight: 900;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 3px 8px rgba(0, 86, 210, 0.3);
    }
    
    /* Amount Hero */
    .mp-amount-hero {
      font-size: 32px;
      font-weight: 900;
      color: #000000;
      letter-spacing: -0.8px;
      margin-bottom: 14px;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
    
    /* Divider */
    .mp-divider {
      height: 1px;
      background: #F1F5F9;
      width: 100%;
      margin-bottom: 14px;
    }
    
    /* Inner Details Container (Label Above, Value Below) */
    .mp-details-box {
      background: #F8FAFC;
      border-radius: 14px;
      padding: 16px;
      border: 1px solid #E2E8F0;
    }
    
    .mp-field-block {
      margin-bottom: 13px;
    }
    
    .mp-field-block:last-child {
      margin-bottom: 0;
    }
    
    .mp-field-label {
      font-size: 11px;
      color: #8E9BAE;
      font-weight: 600;
      margin-bottom: 2px;
    }
    
    .mp-field-value {
      font-size: 13px;
      color: #0F172A;
      font-weight: 800;
      word-break: break-word;
    }
    
    .mp-type-pill {
      background: #E0F2FE;
      color: #0284C7;
      font-size: 11.5px;
      font-weight: 800;
      padding: 3px 10px;
      border-radius: 5px;
      display: inline-block;
      margin-top: 2px;
    }
    
    .mp-ref-text {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      color: #0F172A;
      background: #F1F5F9;
      padding: 4px 8px;
      border-radius: 5px;
      border: 1px solid #CBD5E1;
      display: inline-block;
      margin-top: 2px;
    }
    
    /* Perforated Scalloped Ticket Bottom Teeth */
    .mp-scallops-wrapper {
      display: flex;
      justify-content: space-between;
      width: calc(100% + 40px);
      margin-left: -20px;
      margin-top: 14px;
      margin-bottom: -10px;
      overflow: hidden;
    }
    
    .mp-scallop-dot {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #0056D2;
      flex-shrink: 0;
    }
    
    /* Footer Security */
    .mp-footer {
      margin-top: 18px;
      text-align: center;
      color: rgba(255, 255, 255, 0.85);
      font-size: 9px;
      font-weight: 600;
      line-height: 14px;
      z-index: 2;
    }
    .mp-footer b {
      color: #FFFFFF;
    }
  </style>
</head>
<body>
  <div id="receipt-page">
    <div class="bg-accent-1"></div>
    <div class="bg-accent-2"></div>

    <!-- Centered Brand Capsule -->
    <div class="mp-brand-capsule">
      <img src="${ABU_MAFHAL_LOGO_B64}" class="mp-brand-logo" alt="Logo" />
      <span class="mp-brand-title">Abu Mafhal Hub</span>
    </div>

    <!-- White Ticket Paper Card -->
    <div class="mp-ticket-card">
      <!-- Header Row: DEBIT pill & 'M' avatar -->
      <div class="mp-ticket-header">
        <div class="mp-debit-badge">${isDebit ? 'DEBIT' : 'CREDIT'}</div>
        <div class="mp-avatar-circle">M</div>
      </div>

      <!-- Amount Hero -->
      <div class="mp-amount-hero">${formattedTotal}</div>

      <!-- Hairline Divider -->
      <div class="mp-divider"></div>

      <!-- Inner Details Card (Label on top, Value below) -->
      <div class="mp-details-box">
        <!-- 1. Transaction Type -->
        <div class="mp-field-block">
          <div class="mp-field-label">Transaction Type</div>
          <div><span class="mp-type-pill">${data.type === 'p2p' ? 'Wallet Transfer' : 'Transfer'}</span></div>
        </div>

        <!-- 2. Sender Name -->
        <div class="mp-field-block">
          <div class="mp-field-label">Sender Name</div>
          <div class="mp-field-value">${data.senderName || 'Abu Mafhal User'}</div>
        </div>

        <!-- 3. Source Institution -->
        <div class="mp-field-block">
          <div class="mp-field-label">Source Institution</div>
          <div class="mp-field-value">Abu Mafhal Hub Wallet</div>
        </div>

        <!-- 4. Beneficiary -->
        <div class="mp-field-block">
          <div class="mp-field-label">Beneficiary</div>
          <div class="mp-field-value" style="text-transform: uppercase;">${recipientDisplay}</div>
        </div>

        <!-- 5. Beneficiary Institution -->
        <div class="mp-field-block">
          <div class="mp-field-label">Beneficiary Institution</div>
          <div class="mp-field-value">${data.bankName || 'Abu Mafhal Wallet Member'}</div>
        </div>

        <!-- 6. Transaction Date -->
        <div class="mp-field-block">
          <div class="mp-field-label">Transaction Date</div>
          <div class="mp-field-value">${formattedDate}</div>
        </div>

        <!-- 7. Transaction Reference -->
        <div class="mp-field-block">
          <div class="mp-field-label">Transaction Reference</div>
          <div><span class="mp-ref-text">${fullRefText}</span></div>
        </div>

        <!-- 8. Business Name -->
        <div class="mp-field-block">
          <div class="mp-field-label">Business Name</div>
          <div class="mp-field-value">${data.notes || data.senderName || 'Abu Mafhal Instant Settlement'}</div>
        </div>
      </div>

      <!-- Scalloped Perforated Ticket Teeth Cut at the Bottom -->
      <div class="mp-scallops-wrapper">
        ${Array.from({ length: 18 }).map(() => '<div class="mp-scallop-dot"></div>').join('')}
      </div>
    </div>

    <!-- Official Footer Note -->
    <div class="mp-footer">
      <b>Official Proof of Payment</b> • Issued by <b>ABU MAFHAL LTD</b> (RC-8979939)<br/>
      Support: help@abumafhal.com • https://abumafhal.com.ng
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate official A5 PDF receipt file on device
 */
export async function generateReceiptPdfFile(data: ReceiptData): Promise<string | null> {
  const html = generateModernReceiptHTML(data);
  const cleanRef = String(data.reference || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Receipt_${cleanRef}.pdf`;

  try {
    const { uri } = await Print.printToFileAsync({
      html,
      width: 420,  // Exact A5 width in points (148mm)
      height: 595, // Exact A5 height in points (210mm)
      base64: false,
    });

    if (Platform.OS !== 'web') {
      const cacheDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || '';
      if (cacheDir) {
        const targetUri = `${cacheDir}${fileName}`;
        try {
          await FileSystem.copyAsync({ from: uri, to: targetUri });
          return targetUri;
        } catch (_) {
          return uri;
        }
      }
    }
    return uri;
  } catch (error) {
    console.error('Error generating PDF receipt file:', error);
    return null;
  }
}

/**
 * Download PDF Receipt directly to phone / device (A5 Full Bleed)
 */
export async function downloadReceiptAsPDF(data: ReceiptData): Promise<string | null> {
  const fileUri = await generateReceiptPdfFile(data);
  if (!fileUri) return null;

  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const html = generateModernReceiptHTML(data);
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
        }, 400);
      }
      return fileUri;
    } else {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          UTI: 'com.adobe.pdf',
          mimeType: 'application/pdf',
          dialogTitle: `Download Receipt - ${data.reference || 'AbuMafhalSub'}`,
        });
      }
      return fileUri;
    }
  } catch (error) {
    console.error('Error downloading PDF receipt:', error);
    return null;
  }
}

/**
 * Download PNG Image Receipt directly to phone / device (A5 Full Bleed)
 */
export async function downloadReceiptAsPNG(data: ReceiptData): Promise<string | null> {
  const html = generateModernReceiptHTML(data);
  const cleanRef = String(data.reference || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Receipt_${cleanRef}.png`;

  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return new Promise((resolve) => {
        const generatePng = () => {
          const container = document.createElement('div');
          container.style.position = 'fixed';
          container.style.left = '-9999px';
          container.style.top = '0';
          container.style.width = '420px';
          container.innerHTML = html;
          const element = (container.querySelector('#receipt-page') || container.querySelector('#receipt-card') || container) as HTMLElement;
          document.body.appendChild(container);

          (window as any).html2canvas(element, {
            scale: 2.5,
            useCORS: true,
            logging: false,
            width: 420,
            windowWidth: 420,
            backgroundColor: '#FFFFFF'
          }).then((canvas: HTMLCanvasElement) => {
            const imgData = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = fileName;
            link.href = imgData;
            link.click();
            document.body.removeChild(container);
            resolve(fileName);
          }).catch((err: any) => {
            console.error('html2canvas error:', err);
            document.body.removeChild(container);
            resolve(null);
          });
        };

        if ((window as any).html2canvas) {
          generatePng();
        } else {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
          script.onload = generatePng;
          script.onerror = () => resolve(null);
          document.head.appendChild(script);
        }
      });
    } else {
      // For native image export fallback
      const fileUri = await generateReceiptPdfFile(data);
      if (fileUri && await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          UTI: 'com.adobe.pdf',
          mimeType: 'application/pdf',
          dialogTitle: `Official Receipt - ${data.reference || 'AbuMafhalSub'}`,
        });
      }
      return fileUri;
    }
  } catch (error) {
    console.error('Error downloading PNG receipt:', error);
    return null;
  }
}

/**
 * Share Receipt directly as File to WhatsApp / Native Apps (PDF or PNG)
 * Guaranteed to send the actual binary file (NEVER plaintext)
 */
export async function shareReceiptFile(
  data: ReceiptData,
  format: 'pdf' | 'png' = 'pdf',
  customPngUri?: string
): Promise<boolean> {
  try {
    if (format === 'png' && customPngUri) {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(customPngUri, {
          UTI: 'public.png',
          mimeType: 'image/png',
          dialogTitle: `Share Receipt via WhatsApp - ${data.reference || 'AbuMafhalSub'}`,
        });
        return true;
      }
    }

    // Default to official A5 PDF Document
    const pdfUri = await generateReceiptPdfFile(data);
    if (pdfUri && await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(pdfUri, {
        UTI: 'com.adobe.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `Share Receipt via WhatsApp - ${data.reference || 'AbuMafhalSub'}`,
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error sharing receipt file to WhatsApp:', error);
    return false;
  }
}

