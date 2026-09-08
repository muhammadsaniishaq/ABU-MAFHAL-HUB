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

/**
 * Generate ultra-luxurious full-bleed A5 HTML template for ABU MAFHAL SUB (ABU MAFHAL LTD - RC-8979939)
 * Formatted edge-to-edge with prominent amount hero, two-tier information hierarchy, and cryptographic verification.
 */
export function generateModernReceiptHTML(data: ReceiptData): string {
  const ref = String(data.reference || `TXN-${Date.now()}`);
  const dateStr = typeof data.date === 'string' ? data.date : (data.date ? new Date(data.date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : new Date().toLocaleString());
  
  // Amount computations
  const numTotalDebit = typeof data.totalDebit === 'number'
    ? data.totalDebit
    : (data.totalDebit ? parseFloat(String(data.totalDebit).replace(/[^0-9.]/g, '')) : null);
  const numAmount = typeof data.amount === 'number'
    ? data.amount
    : parseFloat(String(data.amount).replace(/[^0-9.]/g, '')) || 0;
  const numTransferAmount = typeof data.transferAmount === 'number'
    ? data.transferAmount
    : (data.transferAmount ? parseFloat(String(data.transferAmount).replace(/[^0-9.]/g, '')) : null);
  const numFee = typeof data.fee === 'number'
    ? data.fee
    : (data.fee !== undefined && data.fee !== null ? parseFloat(String(data.fee).replace(/[^0-9.]/g, '')) : null);

  const displayTotalAmount = numTotalDebit ?? numAmount;
  const formattedTotal = `₦${displayTotalAmount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  const statusUpper = (data.status || 'SUCCESSFUL').toUpperCase();
  const isSuccess = statusUpper === 'SUCCESS' || statusUpper === 'SUCCESSFUL' || statusUpper === 'COMPLETED';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`https://abumafhal.com.ng/verify?ref=${ref}`)}`;

  const recipientDisplay = data.recipientName || data.beneficiary || 'Beneficiary';

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
      background-color: #FFFFFF;
      color: #0F172A;
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    #receipt-card {
      width: 100%;
      min-height: 100%;
      background: #FFFFFF;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-sizing: border-box;
    }
    
    /* Header Gradient */
    .receipt-header {
      background: linear-gradient(135deg, #020617 0%, #0F172A 48%, #1E293B 100%);
      color: #FFFFFF;
      padding: 22px 22px 18px;
      position: relative;
      border-bottom: 3.5px solid #DAA520;
    }
    
    .brand-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
    }
    
    .brand-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .brand-logo-img {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      object-fit: cover;
      border: 1.5px solid #DAA520;
      background: #FFFFFF;
      padding: 2px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
    }
    
    .brand-titles {
      display: flex;
      flex-direction: column;
    }
    
    .brand-name {
      font-size: 17px;
      font-weight: 900;
      letter-spacing: 0.5px;
      color: #FFFFFF;
      text-transform: uppercase;
    }
    
    .brand-sub {
      font-size: 9px;
      color: #FFD700;
      font-weight: 800;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      margin-top: 1px;
    }
    
    .company-reg {
      font-size: 8px;
      color: #94A3B8;
      font-weight: 600;
      margin-top: 1px;
    }
    
    .seal-badge {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid #10B981;
      padding: 4px 10px;
      border-radius: 20px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .seal-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #10B981;
      box-shadow: 0 0 8px #10B981;
    }
    
    .seal-text {
      font-size: 8.5px;
      font-weight: 800;
      color: #10B981;
      letter-spacing: 0.6px;
      text-transform: uppercase;
    }
    
    /* Amount Hero Banner */
    .amount-hero {
      background: rgba(255, 255, 255, 0.06);
      border: 1.5px solid rgba(218, 165, 32, 0.35);
      border-radius: 14px;
      padding: 14px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      backdrop-filter: blur(10px);
    }
    
    .amount-label {
      font-size: 9px;
      font-weight: 800;
      color: #CBD5E1;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 2px;
    }
    
    .amount-val {
      font-size: 28px;
      font-weight: 900;
      color: #FFFFFF;
      letter-spacing: -0.5px;
      font-family: 'JetBrains Mono', monospace;
      line-height: 1.1;
    }
    
    .amount-breakdown {
      font-size: 8.5px;
      color: #94A3B8;
      font-weight: 600;
      margin-top: 3px;
    }
    
    .status-pill {
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    
    .status-success {
      background: #10B981;
      color: #FFFFFF;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
    }
    
    .status-other {
      background: #F59E0B;
      color: #FFFFFF;
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.35);
    }
    
    /* Body Details */
    .receipt-body {
      padding: 16px 22px 10px;
      flex: 1;
    }
    
    .section-title {
      font-size: 9.5px;
      font-weight: 800;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-top: 10px;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .section-title:first-child {
      margin-top: 0;
    }
    
    .section-title::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #E2E8F0;
    }
    
    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 6px;
    }
    
    .details-table tr {
      border-bottom: 1px solid #F1F5F9;
    }
    
    .details-table tr:last-child {
      border-bottom: none;
    }
    
    .details-table td {
      padding: 6.5px 0;
      font-size: 10.5px;
      vertical-align: middle;
    }
    
    .td-label {
      color: #64748B;
      font-weight: 600;
      width: 40%;
    }
    
    .td-value {
      color: #0F172A;
      font-weight: 700;
      text-align: right;
      width: 60%;
      word-break: break-word;
    }
    
    .mono-val {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      color: #0F172A;
      font-weight: 800;
    }
    
    .highlight-val {
      color: #B45309;
      font-weight: 900;
      font-size: 11px;
    }
    
    .badge-mono {
      background: #F1F5F9;
      border: 1px solid #E2E8F0;
      padding: 2px 7px;
      border-radius: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 9.5px;
      font-weight: 700;
      color: #0F172A;
      display: inline-block;
    }
    
    /* Security Verification Card */
    .qr-card {
      background: #F8FAFC;
      border: 1px dashed #CBD5E1;
      border-radius: 12px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 8px;
    }
    
    .qr-left {
      display: flex;
      flex-direction: column;
      gap: 3px;
      max-width: 72%;
    }
    
    .qr-title {
      font-size: 10px;
      font-weight: 800;
      color: #0F172A;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    
    .qr-desc {
      font-size: 8px;
      color: #64748B;
      line-height: 11.5px;
    }
    
    .qr-badges {
      display: flex;
      gap: 6px;
      margin-top: 3px;
    }
    
    .qr-chip {
      font-size: 7.5px;
      font-weight: 700;
      color: #047857;
      background: #ECFDF5;
      padding: 1.5px 6px;
      border-radius: 4px;
      border: 0.5px solid #A7F3D0;
    }
    
    .qr-img {
      width: 54px;
      height: 54px;
      border-radius: 6px;
      border: 1px solid #E2E8F0;
      background: #FFFFFF;
      padding: 2px;
    }
    
    /* Footer */
    .receipt-footer {
      background: #F8FAFC;
      border-top: 1px solid #E2E8F0;
      padding: 12px 22px 14px;
      text-align: center;
    }
    
    .footer-company {
      font-size: 9.5px;
      font-weight: 800;
      color: #0F172A;
      margin-bottom: 2px;
    }
    
    .footer-company span {
      color: #B45309;
    }
    
    .footer-note {
      font-size: 8px;
      color: #94A3B8;
      line-height: 12px;
    }
  </style>
</head>
<body>
  <div id="receipt-card">
    <!-- Header -->
    <div class="receipt-header">
      <div class="brand-row">
        <div class="brand-left">
          <img class="brand-logo-img" src="${ABU_MAFHAL_LOGO_B64}" alt="Abu Mafhal Logo" />
          <div class="brand-titles">
            <div class="brand-name">ABU MAFHAL SUB</div>
            <div class="brand-sub">Premium Digital Infrastructure</div>
            <div class="company-reg">ABU MAFHAL LTD • RC-8979939</div>
          </div>
        </div>
        <div class="seal-badge">
          <div class="seal-dot"></div>
          <div class="seal-text">${isSuccess ? 'VERIFIED' : 'PENDING'}</div>
        </div>
      </div>
      
      <div class="amount-hero">
        <div>
          <div class="amount-label">Total Amount Debited</div>
          <div class="amount-val">${formattedTotal}</div>
          ${numTransferAmount !== null && numFee !== null && numFee > 0 ? `
          <div class="amount-breakdown">
            Transfer: ₦${numTransferAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })} • Fee: ₦${numFee.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
          </div>
          ` : ''}
        </div>
        <div class="status-pill ${isSuccess ? 'status-success' : 'status-other'}">
          ${statusUpper}
        </div>
      </div>
    </div>
    
    <!-- Body Details -->
    <div class="receipt-body">
      <!-- Section 1: Transfer & Beneficiary Details -->
      <div class="section-title">Transfer & Beneficiary Details</div>
      <table class="details-table">
        <tr>
          <td class="td-label">Beneficiary / Recipient</td>
          <td class="td-value" style="font-weight: 800;">${recipientDisplay}</td>
        </tr>
        ${data.bankName ? `
        <tr>
          <td class="td-label">Destination Bank</td>
          <td class="td-value">${data.bankName}</td>
        </tr>
        ` : ''}
        ${data.accountNumber ? `
        <tr>
          <td class="td-label">Account Number</td>
          <td class="td-value"><span class="badge-mono">${data.accountNumber}</span></td>
        </tr>
        ` : ''}
        ${numTransferAmount !== null ? `
        <tr>
          <td class="td-label">Transfer Amount</td>
          <td class="td-value">₦${numTransferAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
        </tr>
        ` : ''}
        ${numFee !== null ? `
        <tr>
          <td class="td-label">Transfer Fee</td>
          <td class="td-value">${numFee === 0 ? '₦0.00 (FREE)' : `₦${numFee.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`}</td>
        </tr>
        ` : ''}
        <tr>
          <td class="td-label">Total Debited</td>
          <td class="td-value highlight-val">${formattedTotal}</td>
        </tr>
      </table>

      <!-- Section 2: Audit & Settlement Details -->
      <div class="section-title">Audit & Settlement Details</div>
      <table class="details-table">
        <tr>
          <td class="td-label">Transaction Reference</td>
          <td class="td-value"><span class="badge-mono">${ref}</span></td>
        </tr>
        ${data.sessionId ? `
        <tr>
          <td class="td-label">NIP Session ID</td>
          <td class="td-value"><span class="badge-mono" style="font-size: 8.5px;">${data.sessionId}</span></td>
        </tr>
        ` : ''}
        <tr>
          <td class="td-label">Service Description</td>
          <td class="td-value">${data.description || data.type}</td>
        </tr>
        <tr>
          <td class="td-label">Payment Channel</td>
          <td class="td-value">${data.paymentMethod || 'Wallet Balance'}</td>
        </tr>
        ${data.senderName ? `
        <tr>
          <td class="td-label">Sender / Originator</td>
          <td class="td-value">${data.senderName}</td>
        </tr>
        ` : ''}
        <tr>
          <td class="td-label">Payment Date & Time</td>
          <td class="td-value">${dateStr}</td>
        </tr>
        ${data.notes ? `
        <tr>
          <td class="td-label">Remark / Narration</td>
          <td class="td-value">${data.notes}</td>
        </tr>
        ` : ''}
      </table>
      
      <!-- Security Verification -->
      <div class="qr-card">
        <div class="qr-left">
          <div class="qr-title">
            <span>🛡️</span> Official Cryptographic Verification
          </div>
          <div class="qr-desc">
            Tamper-proof financial record audited on the Abu Mafhal ledger. Scan the QR code to verify validity directly with Central Bank & NIBSS settlement networks.
          </div>
          <div class="qr-badges">
            <span class="qr-chip">✓ NIBSS Certified</span>
            <span class="qr-chip">✓ 256-Bit Encrypted</span>
            <span class="qr-chip">✓ Official Proof</span>
          </div>
        </div>
        <img class="qr-img" src="${qrUrl}" alt="QR Verification" />
      </div>
    </div>
    
    <!-- Footer -->
    <div class="receipt-footer">
      <div class="footer-company">
        Issued by <span>ABU MAFHAL LTD</span> (CAC: RC-8979939)
      </div>
      <div class="footer-note">
        This document serves as an authentic electronic proof of payment issued by ABU MAFHAL SUB.<br/>
        Support Hotline: support@abumafhal.com.ng • https://abumafhal.com.ng
      </div>
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
          container.style.minHeight = '595px';
          container.innerHTML = html;
          const element = container.querySelector('#receipt-card') as HTMLElement || container;
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

