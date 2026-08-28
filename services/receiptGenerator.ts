import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

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
 * Generate ultra-luxurious HTML template for Platinum Navy & Gold Receipts
 */
export function generateModernReceiptHTML(data: ReceiptData): string {
  const ref = String(data.reference || `TXN-${Date.now()}`);
  const dateStr = typeof data.date === 'string' ? data.date : (data.date ? new Date(data.date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : new Date().toLocaleString());
  const numAmount = typeof data.amount === 'number' ? data.amount : parseFloat(String(data.amount).replace(/[^0-9.]/g, '')) || 0;
  const formattedAmount = `₦${numAmount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const statusUpper = (data.status || 'SUCCESSFUL').toUpperCase();
  const isSuccess = statusUpper === 'SUCCESS' || statusUpper === 'SUCCESSFUL' || statusUpper === 'COMPLETED';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(`https://abumafhal.com.ng/verify?ref=${ref}`)}`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Official Transaction Receipt - ${ref}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: #F8FAFC;
      color: #0F172A;
      padding: 24px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    
    .receipt-container {
      width: 100%;
      max-width: 540px;
      background: #FFFFFF;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 20px 40px -15px rgba(15, 23, 42, 0.12), 0 0 0 1px #E2E8F0;
      position: relative;
    }
    
    /* Header Gradient */
    .receipt-header {
      background: linear-gradient(135deg, #030712 0%, #0F172A 50%, #1E293B 100%);
      color: #FFFFFF;
      padding: 32px 28px 28px;
      position: relative;
      border-bottom: 3px solid #DAA520;
    }
    
    .brand-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    
    .brand-name {
      font-size: 20px;
      font-weight: 900;
      letter-spacing: 0.5px;
      background: linear-gradient(90deg, #FFFFFF, #FEF3C7, #FFD700);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    
    .verified-seal {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid #10B981;
      color: #10B981;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 800;
      display: flex;
      align-items: center;
      gap: 5px;
      text-transform: uppercase;
    }
    
    .amount-box {
      text-align: center;
      padding: 12px 0 4px;
    }
    
    .amount-label {
      font-size: 11px;
      color: #94A3B8;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 4px;
    }
    
    .amount-value {
      font-size: 36px;
      font-weight: 900;
      color: #FFD700;
      letter-spacing: -0.5px;
    }
    
    .status-badge-row {
      display: flex;
      justify-content: center;
      margin-top: 10px;
    }
    
    .status-pill {
      background: ${isSuccess ? '#ECFDF5' : '#FEF2F2'};
      color: ${isSuccess ? '#059669' : '#DC2626'};
      border: 1px solid ${isSuccess ? '#A7F3D0' : '#FECDD3'};
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.5px;
    }

    /* Body Details */
    .receipt-body {
      padding: 24px 28px;
    }
    
    .section-title {
      font-size: 11px;
      color: #64748B;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 12px;
    }
    
    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    
    .details-table tr {
      border-bottom: 1px dashed #E2E8F0;
    }
    
    .details-table tr:last-child {
      border-bottom: none;
    }
    
    .details-table td {
      padding: 11px 0;
      font-size: 12.5px;
    }
    
    .label-col {
      color: #64748B;
      font-weight: 600;
      width: 40%;
    }
    
    .val-col {
      color: #0F172A;
      font-weight: 800;
      text-align: right;
      width: 60%;
      word-break: break-word;
    }
    
    .monospace {
      font-family: 'JetBrains Mono', monospace;
      color: #1E293B;
      font-size: 11.5px;
    }

    /* QR Code & Verification Row */
    .verification-row {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 16px;
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
    }
    
    .qr-box {
      width: 70px;
      height: 70px;
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
      font-size: 12px;
      font-weight: 800;
      color: #0F172A;
      margin-bottom: 3px;
    }
    
    .verif-desc {
      font-size: 10px;
      color: #64748B;
      line-height: 14px;
    }
    
    /* Footer */
    .receipt-footer {
      background: #F8FAFC;
      border-top: 1px solid #E2E8F0;
      padding: 18px 28px;
      text-align: center;
    }
    
    .footer-note {
      font-size: 10px;
      color: #94A3B8;
      line-height: 14px;
      margin-bottom: 6px;
    }
    
    .support-link {
      color: #D97706;
      font-weight: 800;
      text-decoration: none;
      font-size: 11px;
    }
    
    @media print {
      body {
        background: #FFFFFF;
        padding: 0;
      }
      .receipt-container {
        box-shadow: none;
        max-width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <!-- Header -->
    <div class="receipt-header">
      <div class="brand-row">
        <div class="brand-name">ABU MAFHAL HUB</div>
        <div class="verified-seal">
          <span>✓</span> Official Receipt
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
      <div class="section-title">Transaction Information</div>
      <table class="details-table">
        <tr>
          <td class="label-col">Reference ID</td>
          <td class="val-col monospace">${ref}</td>
        </tr>
        <tr>
          <td class="label-col">Service Type</td>
          <td class="val-col">${data.type ? data.type.toUpperCase() : 'TRANSACTION'}</td>
        </tr>
        <tr>
          <td class="label-col">Description</td>
          <td class="val-col">${data.description || 'Digital Payment Service'}</td>
        </tr>
        ${data.beneficiary ? `
        <tr>
          <td class="label-col">Beneficiary</td>
          <td class="val-col monospace">${data.beneficiary}</td>
        </tr>` : ''}
        <tr>
          <td class="label-col">Payment Channel</td>
          <td class="val-col">${data.paymentMethod || 'Wallet Balance'}</td>
        </tr>
        <tr>
          <td class="label-col">Transaction Date</td>
          <td class="val-col">${dateStr}</td>
        </tr>
      </table>
      
      <!-- QR Verification -->
      <div class="verification-row">
        <div class="qr-box">
          <img src="${qrUrl}" alt="Verification QR Code" />
        </div>
        <div class="verif-info">
          <div class="verif-title">Authentic Digital Receipt</div>
          <div class="verif-desc">Scan QR code or visit <span style="color:#D97706;font-weight:700;">abumafhal.com.ng</span> to independently verify this transaction on our secure ledger.</div>
        </div>
      </div>
    </div>
    
    <!-- Footer -->
    <div class="receipt-footer">
      <div class="footer-note">This is a system-generated electronic receipt issued by Abu Mafhal Telecommunications & Digital Services Ltd.</div>
      <div>
        <a href="https://abumafhal.com.ng" class="support-link">abumafhal.com.ng</a> • Support: <span style="font-weight:700;color:#0F172A;">24/7 Live Desk</span>
      </div>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Print or Export PDF Receipt
 */
export async function downloadReceiptAsPDF(data: ReceiptData): Promise<string | null> {
  const html = generateModernReceiptHTML(data);
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
        }, 500);
      }
      return 'web_printed';
    } else {
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          UTI: '.pdf',
          mimeType: 'application/pdf',
          dialogTitle: `Transaction Receipt - ${data.reference || 'AbuMafhal'}`,
        });
      }
      return uri;
    }
  } catch (error) {
    console.error('Error generating PDF receipt:', error);
    return null;
  }
}
