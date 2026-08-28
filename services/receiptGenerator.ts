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
  senderName?: string;
  paymentMethod?: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: string;
}

/**
 * Generate ultra-luxurious HTML template for ABU MAFHAL SUB (ABU MAFHAL LTD - RC-8979939)
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
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&family=JetBrains+Mono:wght@500;700;800&display=swap');
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: #0B0F19;
      color: #0F172A;
      padding: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    
    #receipt-card {
      width: 100%;
      max-width: 520px;
      background: #FFFFFF;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px #E2E8F0;
      position: relative;
    }
    
    /* Header Gradient */
    .receipt-header {
      background: linear-gradient(135deg, #020617 0%, #0F172A 45%, #1E293B 100%);
      color: #FFFFFF;
      padding: 28px 24px 24px;
      position: relative;
      border-bottom: 3.5px solid #DAA520;
    }
    
    .brand-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 18px;
    }
    
    .brand-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .brand-logo-img {
      width: 46px;
      height: 46px;
      border-radius: 12px;
      object-fit: cover;
      border: 1.5px solid #DAA520;
      background: #FFFFFF;
      padding: 2px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    
    .brand-titles {
      display: flex;
      flex-direction: column;
    }
    
    .brand-name {
      font-size: 19px;
      font-weight: 900;
      letter-spacing: 0.6px;
      color: #FFFFFF;
      text-transform: uppercase;
    }
    
    .brand-sub {
      font-size: 10px;
      color: #FFD700;
      font-weight: 800;
      letter-spacing: 0.4px;
      margin-top: 1px;
    }
    
    .brand-cac {
      font-size: 9.5px;
      color: #94A3B8;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
    }
    
    .verified-seal {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid #10B981;
      color: #10B981;
      padding: 5px 11px;
      border-radius: 20px;
      font-size: 10.5px;
      font-weight: 900;
      display: flex;
      align-items: center;
      gap: 5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .amount-box {
      text-align: center;
      padding: 10px 0 2px;
    }
    
    .amount-label {
      font-size: 11px;
      color: #94A3B8;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 3px;
    }
    
    .amount-value {
      font-size: 34px;
      font-weight: 900;
      color: #FFD700;
      letter-spacing: -0.5px;
      text-shadow: 0 2px 10px rgba(255, 215, 0, 0.2);
    }
    
    .status-badge-row {
      display: flex;
      justify-content: center;
      margin-top: 8px;
    }
    
    .status-pill {
      background: ${isSuccess ? '#ECFDF5' : '#FEF2F2'};
      color: ${isSuccess ? '#059669' : '#DC2626'};
      border: 1px solid ${isSuccess ? '#A7F3D0' : '#FECDD3'};
      padding: 4px 14px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.6px;
    }

    /* Body Details */
    .receipt-body {
      padding: 22px 24px;
    }
    
    .section-title {
      font-size: 10.5px;
      color: #64748B;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 10px;
    }
    
    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
    }
    
    .details-table tr {
      border-bottom: 1px dashed #E2E8F0;
    }
    
    .details-table tr:last-child {
      border-bottom: none;
    }
    
    .details-table td {
      padding: 10px 0;
      font-size: 12px;
    }
    
    .label-col {
      color: #64748B;
      font-weight: 600;
      width: 38%;
    }
    
    .val-col {
      color: #0F172A;
      font-weight: 800;
      text-align: right;
      width: 62%;
      word-break: break-word;
    }
    
    .monospace {
      font-family: 'JetBrains Mono', monospace;
      color: #0F172A;
      font-size: 11px;
      font-weight: 700;
    }

    /* QR Code & Verification Row */
    .verification-row {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 14px;
      padding: 14px;
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 16px;
    }
    
    .qr-box {
      width: 68px;
      height: 68px;
      border-radius: 10px;
      background: #FFFFFF;
      padding: 4px;
      border: 1px solid #CBD5E1;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    
    .qr-box img {
      width: 100%;
      height: 100%;
      border-radius: 6px;
    }
    
    .verif-info {
      flex: 1;
    }
    
    .verif-title {
      font-size: 11.5px;
      font-weight: 800;
      color: #0F172A;
      margin-bottom: 2px;
    }
    
    .verif-desc {
      font-size: 9.5px;
      color: #64748B;
      line-height: 14px;
    }
    
    /* Footer */
    .receipt-footer {
      background: #F8FAFC;
      border-top: 1px solid #E2E8F0;
      padding: 16px 24px;
      text-align: center;
    }
    
    .footer-note {
      font-size: 9.5px;
      color: #94A3B8;
      line-height: 14px;
      margin-bottom: 4px;
    }
    
    .corporate-line {
      font-size: 10px;
      font-weight: 800;
      color: #0F172A;
      margin-bottom: 3px;
    }
    
    .support-link {
      color: #D97706;
      font-weight: 800;
      text-decoration: none;
      font-size: 10.5px;
    }
    
    @media print {
      body {
        background: #FFFFFF;
        padding: 0;
      }
      #receipt-card {
        box-shadow: none;
        max-width: 100%;
      }
    }
  </style>
</head>
<body>
  <div id="receipt-card">
    <!-- Header -->
    <div class="receipt-header">
      <div class="brand-row">
        <div class="brand-left">
          <img src="${ABU_MAFHAL_LOGO_B64}" alt="Logo" class="brand-logo-img" />
          <div class="brand-titles">
            <div class="brand-name">ABU MAFHAL SUB</div>
            <div class="brand-sub">ABU MAFHAL LTD</div>
            <div class="brand-cac">CAC: RC-8979939</div>
          </div>
        </div>
        <div class="verified-seal">
          <span>✓</span> VERIFIED
        </div>
      </div>
      
      <div class="amount-box">
        <div class="amount-label">Total Amount Paid</div>
        <div class="amount-value">${formattedAmount}</div>
      </div>
      
      <div class="status-badge-row">
        <div class="status-pill">${statusUpper}</div>
      </div>
    </div>
    
    <!-- Body -->
    <div class="receipt-body">
      <div class="section-title">Transaction Ledger Details</div>
      <table class="details-table">
        <tr>
          <td class="label-col">Reference ID</td>
          <td class="val-col monospace">${ref}</td>
        </tr>
        <tr>
          <td class="label-col">Service Category</td>
          <td class="val-col">${data.type ? data.type.toUpperCase() : 'TRANSACTION'}</td>
        </tr>
        <tr>
          <td class="label-col">Description</td>
          <td class="val-col">${data.description || 'Digital Payment Service'}</td>
        </tr>
        ${data.beneficiary ? `
        <tr>
          <td class="label-col">Beneficiary / Link</td>
          <td class="val-col monospace">${data.beneficiary}</td>
        </tr>` : ''}
        <tr>
          <td class="label-col">Payment Channel</td>
          <td class="val-col">${data.paymentMethod || 'Wallet Balance'}</td>
        </tr>
        <tr>
          <td class="label-col">Date & Time</td>
          <td class="val-col">${dateStr}</td>
        </tr>
      </table>
      
      <!-- QR Verification -->
      <div class="verification-row">
        <div class="qr-box">
          <img src="${qrUrl}" alt="Verification QR Code" />
        </div>
        <div class="verif-info">
          <div class="verif-title">Authentic Secure Receipt</div>
          <div class="verif-desc">Issued by <b>ABU MAFHAL LTD (RC-8979939)</b>. Scan to verify transaction authenticity on the master ledger.</div>
        </div>
      </div>
    </div>
    
    <!-- Footer -->
    <div class="receipt-footer">
      <div class="corporate-line">ABU MAFHAL LTD • RC-8979939</div>
      <div class="footer-note">Official Electronic Transaction Receipt • Issued under federal regulations</div>
      <div>
        <a href="https://abumafhal.com.ng" class="support-link">abumafhal.com.ng</a> • 24/7 Support Desk
      </div>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Download PDF Receipt directly to phone / device
 */
export async function downloadReceiptAsPDF(data: ReceiptData): Promise<string | null> {
  const html = generateModernReceiptHTML(data);
  const fileName = `Receipt_${data.reference || Date.now()}.pdf`;

  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return new Promise((resolve) => {
        const generate = () => {
          const opt = {
            margin: 0,
            filename: fileName,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 3, useCORS: true, logging: false },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
          };

          const container = document.createElement('div');
          container.innerHTML = html;
          const element = container.querySelector('#receipt-card') || container;
          document.body.appendChild(container);

          (window as any).html2pdf().from(element).set(opt).save().then(() => {
            document.body.removeChild(container);
            resolve(fileName);
          }).catch((err: any) => {
            console.error('html2pdf save error:', err);
            document.body.removeChild(container);
            resolve(null);
          });
        };

        if ((window as any).html2pdf) {
          generate();
        } else {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
          script.onload = generate;
          script.onerror = () => {
            const printWin = window.open('', '_blank');
            if (printWin) {
              printWin.document.write(html);
              printWin.document.close();
              printWin.print();
            }
            resolve(null);
          };
          document.head.appendChild(script);
        }
      });
    } else {
      // Native (iOS / Android)
      const { uri } = await Print.printToFileAsync({
        html,
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
 * Download PNG Image Receipt directly to phone / device
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
          container.style.width = '520px';
          container.innerHTML = html;
          const element = container.querySelector('#receipt-card') as HTMLElement || container;
          document.body.appendChild(container);

          (window as any).html2canvas(element, {
            scale: 3,
            useCORS: true,
            logging: false,
            backgroundColor: '#0B0F19'
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
      // Native Image generation via high-res PDF Print & Share as Image format
      const { uri } = await Print.printToFileAsync({
        html,
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
