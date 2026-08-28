import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
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
  senderName?: string;
  paymentMethod?: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: string;
}

/**
 * Generate ultra-luxurious full-bleed A5 HTML template for ABU MAFHAL SUB (ABU MAFHAL LTD - RC-8979939)
 * Formatted edge-to-edge without excess margins to fill the A5 paper perfectly.
 */
export function generateModernReceiptHTML(data: ReceiptData): string {
  const ref = String(data.reference || `TXN-${Date.now()}`);
  const dateStr = typeof data.date === 'string' ? data.date : (data.date ? new Date(data.date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : new Date().toLocaleString());
  const numAmount = typeof data.amount === 'number' ? data.amount : parseFloat(String(data.amount).replace(/[^0-9.]/g, '')) || 0;
  const formattedAmount = `₦${numAmount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const statusUpper = (data.status || 'SUCCESSFUL').toUpperCase();
  const isSuccess = statusUpper === 'SUCCESS' || statusUpper === 'SUCCESSFUL' || statusUpper === 'COMPLETED';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`https://abumafhal.com.ng/verify?ref=${ref}`)}`;

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
      background: linear-gradient(135deg, #020617 0%, #0F172A 45%, #1E293B 100%);
      color: #FFFFFF;
      padding: 24px 22px 20px;
      position: relative;
      border-bottom: 3.5px solid #DAA520;
    }
    
    .brand-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
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
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 0.5px;
      color: #FFFFFF;
      text-transform: uppercase;
    }
    
    .brand-sub {
      font-size: 9.5px;
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
      padding: 5px 9px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 5px;
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
    
    .amount-hero {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 14px;
      padding: 16px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      backdrop-filter: blur(10px);
    }
    
    .amount-label {
      font-size: 9.5px;
      font-weight: 700;
      color: #94A3B8;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-bottom: 2px;
    }
    
    .amount-val {
      font-size: 26px;
      font-weight: 900;
      color: #FFFFFF;
      letter-spacing: -0.5px;
      font-family: 'JetBrains+Mono', monospace;
    }
    
    .status-pill {
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 9.5px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.6px;
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
      padding: 20px 22px 14px;
      flex: 1;
    }
    
    .section-title {
      font-size: 10px;
      font-weight: 800;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
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
      margin-bottom: 16px;
    }
    
    .details-table tr {
      border-bottom: 1px solid #F1F5F9;
    }
    
    .details-table tr:last-child {
      border-bottom: none;
    }
    
    .details-table td {
      padding: 9px 0;
      font-size: 11px;
      vertical-align: middle;
    }
    
    .td-label {
      color: #64748B;
      font-weight: 600;
      width: 38%;
    }
    
    .td-value {
      color: #0F172A;
      font-weight: 700;
      text-align: right;
      width: 62%;
      word-break: break-word;
    }
    
    .mono-val {
      font-family: 'JetBrains+Mono', monospace;
      font-size: 10.5px;
      color: #0F172A;
    }
    
    .qr-card {
      background: #F8FAFC;
      border: 1px dashed #CBD5E1;
      border-radius: 12px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 6px;
    }
    
    .qr-left {
      display: flex;
      flex-direction: column;
      gap: 3px;
      max-width: 70%;
    }
    
    .qr-title {
      font-size: 10.5px;
      font-weight: 800;
      color: #0F172A;
    }
    
    .qr-desc {
      font-size: 8.5px;
      color: #64748B;
      line-height: 12px;
    }
    
    .qr-img {
      width: 56px;
      height: 56px;
      border-radius: 6px;
      border: 1px solid #E2E8F0;
      background: #FFFFFF;
      padding: 2px;
    }
    
    /* Footer */
    .receipt-footer {
      background: #F8FAFC;
      border-top: 1px solid #E2E8F0;
      padding: 14px 22px 16px;
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
          <div class="amount-label">Transaction Total</div>
          <div class="amount-val">${formattedAmount}</div>
        </div>
        <div class="status-pill ${isSuccess ? 'status-success' : 'status-other'}">
          ${statusUpper}
        </div>
      </div>
    </div>
    
    <!-- Body Details -->
    <div class="receipt-body">
      <div class="section-title">Transaction Information</div>
      <table class="details-table">
        <tr>
          <td class="td-label">Transaction Reference</td>
          <td class="td-value mono-val">${ref}</td>
        </tr>
        <tr>
          <td class="td-label">Service Description</td>
          <td class="td-value">${data.description || data.type}</td>
        </tr>
        <tr>
          <td class="td-label">Service Category</td>
          <td class="td-value">${data.type?.toUpperCase() || 'PAYMENT'}</td>
        </tr>
        <tr>
          <td class="td-label">Payment Date & Time</td>
          <td class="td-value">${dateStr}</td>
        </tr>
        <tr>
          <td class="td-label">Payment Channel</td>
          <td class="td-value">${data.paymentMethod || 'Wallet Balance'}</td>
        </tr>
        ${data.beneficiary ? `
        <tr>
          <td class="td-label">Beneficiary / Target</td>
          <td class="td-value mono-val">${data.beneficiary}</td>
        </tr>
        ` : ''}
        ${data.customerPhone ? `
        <tr>
          <td class="td-label">Customer Phone</td>
          <td class="td-value">${data.customerPhone}</td>
        </tr>
        ` : ''}
      </table>
      
      <div class="qr-card">
        <div class="qr-left">
          <div class="qr-title">Official Cryptographic Receipt</div>
          <div class="qr-desc">Scan this QR code to verify this transaction directly on the Abu Mafhal secure verification portal.</div>
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
 * Download PDF Receipt directly to phone / device (A5 Full Bleed)
 */
export async function downloadReceiptAsPDF(data: ReceiptData): Promise<string | null> {
  const html = generateModernReceiptHTML(data);
  const fileName = `Receipt_${data.reference || Date.now()}.pdf`;

  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
        }, 400);
      }
      return fileName;
    } else {
      // Native A5 Print
      const { uri } = await Print.printToFileAsync({
        html,
        width: 420,  // Exact A5 width in points (148mm)
        height: 595, // Exact A5 height in points (210mm)
        base64: false,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          UTI: 'com.adobe.pdf',
          mimeType: 'application/pdf',
          dialogTitle: `Download Receipt - ${data.reference || 'AbuMafhalSub'}`,
        });
      }
      return uri;
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
  const fileName = `Receipt_${data.reference || Date.now()}.png`;

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
      // Native Image generation via high-res A5 Print & Share
      const { uri } = await Print.printToFileAsync({
        html,
        width: 420,
        height: 595,
        base64: false,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          UTI: 'public.image',
          mimeType: 'image/png',
          dialogTitle: `Download Image Receipt - ${data.reference || 'AbuMafhalSub'}`,
        });
      }
      return uri;
    }
  } catch (error) {
    console.error('Error downloading PNG receipt:', error);
    return null;
  }
}
