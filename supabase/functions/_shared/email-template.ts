/**
 * ABU MAFHAL SUB - Simple Clean Official Email Template
 * Original classic layout: Professional Navy Top Banner, Floating White Notification Card,
 * Gold Accents, Clean Typography & Direct Message Delivery.
 */

export interface EmailTemplateOptions {
    recipientName?: string;
    headlineBadge?: string;
    headlineTitle?: string;
    headlineSubtitle?: string;
    greeting?: string;
    messageBody?: string;
    buttonText?: string;
    buttonUrl?: string;
    supportUrl?: string;
}

export function renderAbuMafhalEmailTemplate(options: EmailTemplateOptions): string {
    const currentYear = new Date().getFullYear();
    const recipientName = options.recipientName || 'Valued Customer';
    const title = options.headlineTitle || 'Abu Mafhal Sub Notification';
    const greeting = options.greeting || `Hi ${recipientName},`;
    const messageBody = options.messageBody || '';
    const buttonText = options.buttonText;
    const buttonUrl = options.buttonUrl;
    const logoUrl = 'https://raw.githubusercontent.com/muhammadsaniishaq/ABU-MAFHAL-HUB/main/assets/images/logo.png';

    // Optional CTA button if provided
    const buttonHtml = (buttonText && buttonUrl) ? `
      <table cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0 10px 0;">
        <tr>
          <td align="center" style="background-color: #D9A73A; border-radius: 8px;">
            <a href="${buttonUrl}" target="_blank" style="display: inline-block; padding: 12px 28px; font-size: 14px; font-weight: bold; color: #0E1A2E; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              ${buttonText} &rarr;
            </a>
          </td>
        </tr>
      </table>
    ` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#F4F7FA;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;-webkit-font-smoothing:antialiased;">
  <!-- OUTER WRAPPER WITH NAVY TOP BANNER -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F7FA; padding-bottom:50px;">
    <tr>
      <td align="center" style="background-color:#0E1A2E; height:120px; vertical-align:top; padding-top:28px;">
        <!-- FLOATING HEADER -->
        <table width="480" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto; max-width:480px; width:100%;">
          <tr>
            <td align="center">
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                <tr>
                  <td style="padding-right:12px; vertical-align:middle;">
                    <img src="${logoUrl}" alt="Abu Mafhal Sub" width="40" height="40" style="display:block; border-radius:50%; border:2px solid #D9A73A; width:40px; height:40px;" />
                  </td>
                  <td style="vertical-align:middle; text-align:left;">
                    <span style="font-size:20px; font-weight:800; color:#ffffff; letter-spacing:0.5px;">Abu Mafhal <span style="color:#D9A73A;">Sub</span></span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 0 16px;">
        <!-- FLOATING WHITE CARD -->
        <table width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px; width:100%; background:#ffffff; border-radius:12px; box-shadow:0 10px 30px rgba(14,26,46,0.1); margin-top:-45px; border-top:4px solid #D9A73A;">
          <tr>
            <td style="padding:32px 30px; text-align:left;">
              <h2 style="margin:0 0 14px 0; font-size:18px; font-weight:700; color:#0E1A2E;">${title}</h2>
              <p style="margin:0 0 16px 0; font-size:14px; font-weight:600; color:#0E1A2E;">${greeting}</p>
              <div style="font-size:14px; color:#475569; line-height:1.75;">
                ${messageBody}
              </div>
              ${buttonHtml}
            </td>
          </tr>
          <!-- FOOTER INSIDE CARD -->
          <tr>
            <td style="padding:20px 30px; background-color:#FAFCFF; border-top:1px solid #F1F5F9; border-bottom-left-radius:12px; border-bottom-right-radius:12px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="text-align:center;">
                    <p style="margin:0; font-size:12px; color:#64748b; font-weight:500;">&copy; ${currentYear} Abu Mafhal Sub. All rights reserved.</p>
                    <p style="margin:6px 0 0; font-size:11px; color:#94A3B8;">This is an automated notification from Abu Mafhal Sub.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
