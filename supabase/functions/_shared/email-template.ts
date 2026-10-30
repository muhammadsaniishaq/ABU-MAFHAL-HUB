/**
 * Pixel-Exact Master Email Template for Abu Mafhal Sub
 *
 * Built directly from the official reference mock:
 * 1. Master High-Resolution Presentation Artwork:
 *    Displays the exact, stunning 3D phone graphic, service badges, AM brand crest,
 *    Open ABU MAFHAL SUB CTA, Store buttons, Support banner & Socials exactly as shown.
 * 2. Dedicated Dynamic Notification Card:
 *    Neatly inserted below the hero with recipient name, custom message body, and direct action link.
 * 3. 100% Email Client Compatibility:
 *    Works identically on Android Gmail (light & dark mode), iOS Apple Mail, and Web browsers.
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
    helpText?: string;
    supportUrl?: string;
    bannerUrl?: string;
}

export function renderAbuMafhalEmailTemplate(options: EmailTemplateOptions): string {
    const currentYear = new Date().getFullYear();
    const recipientName = options.recipientName || 'Valued Customer';
    const headlineBadge = options.headlineBadge || 'Welcome Aboard';
    const headlineTitle = options.headlineTitle || 'Your Digital Life, Simplified';
    const greeting = options.greeting || `Hi ${recipientName} 👋`;
    const messageBody = options.messageBody || "Welcome to <strong>ABU MAFHAL SUB</strong>! We're excited to have you on board. You can now enjoy fast, secure and affordable digital services all in one app.";
    const buttonText = options.buttonText || 'Open ABU MAFHAL SUB &rarr;';
    const buttonUrl = options.buttonUrl || 'https://abumafhal.com.ng';
    const supportUrl = options.supportUrl || 'https://wa.me/2348083833077';
    const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.muhammmadsaniishaq.abumafhalsub';

    // Direct GitHub Raw CDN link that is globally accessible by all mail clients
    const masterImageUrl = "https://raw.githubusercontent.com/muhammadsaniishaq/ABU-MAFHAL-HUB/main/public/official-email-template.png";

    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <title>ABU MAFHAL SUB</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    :root { color-scheme: light only; supported-color-schemes: light only; }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      background-color: #F1F4F9 !important;
      -webkit-font-smoothing: antialiased;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      border-collapse: collapse !important;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
      -ms-interpolation-mode: bicubic;
      display: block;
    }
    @media only screen and (max-width: 640px) {
      .email-wrapper { width: 100% !important; border-radius: 0 !important; }
      .mobile-pad { padding: 18px 16px !important; }
      .master-img { width: 100% !important; height: auto !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 20px 0; background-color: #F1F4F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F1F4F9;">
    <tr>
      <td align="center" style="padding: 10px 8px;">

        <!-- 600px Max Card -->
        <table class="email-wrapper" role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; width: 100%; background-color: #FFFFFF; border-radius: 24px; overflow: hidden; box-shadow: 0 16px 44px rgba(15, 23, 42, 0.08); border: 1px solid #E2E8F0; margin: 0 auto;">

          <!-- 1. OFFICIAL MASTER PRESENTATION ARTWORK (Pixel-Perfect from Reference Design) -->
          <tr>
            <td align="center" style="background-color: #FFFFFF; padding: 0; line-height: 0;">
              <a href="${buttonUrl}" target="_blank" style="display: block; text-decoration: none;">
                <img class="master-img" src="${masterImageUrl}" width="600" alt="ABU MAFHAL SUB - Your Trusted Digital Partner" style="width: 100%; max-width: 600px; height: auto; display: block; border: 0;" />
              </a>
            </td>
          </tr>

          <!-- 2. DYNAMIC NOTIFICATION CARD (If specific message is passed) -->
          <tr>
            <td class="mobile-pad" style="padding: 26px 32px 30px; background-color: #FFFFFF;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8FAFC; border-radius: 18px; border: 1.5px solid #E2E8F0; padding: 22px 24px;">
                <tr>
                  <td>
                    <!-- Notification Badge -->
                    <div style="display: inline-block; background-color: #FEF3C7; color: #92400E; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 20px; border: 1px solid #FDE047; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
                      ✦ ${headlineBadge}
                    </div>

                    <!-- Greeting -->
                    <h2 style="margin: 0 0 10px; font-size: 20px; font-weight: 900; color: #0A192F; letter-spacing: -0.3px;">
                      ${greeting}
                    </h2>

                    <!-- Body Content -->
                    <div style="font-size: 14.5px; line-height: 1.68; color: #334155; font-weight: 400; margin-bottom: 20px;">
                      ${messageBody}
                    </div>

                    <!-- Interactive CTA Button -->
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center">
                          <a href="${buttonUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: #071329; font-size: 14.5px; font-weight: 900; padding: 13px 28px; border-radius: 30px; text-decoration: none; box-shadow: 0 6px 20px rgba(217, 119, 6, 0.35); letter-spacing: 0.3px;">
                            ${buttonText}
                          </a>
                        </td>
                        <td style="padding-left: 14px;">
                          <a href="${supportUrl}" target="_blank" style="display: inline-block; background-color: #FFFFFF; color: #0284C7; font-size: 13px; font-weight: 800; padding: 12px 20px; border-radius: 30px; text-decoration: none; border: 1.5px solid #BAE6FD;">
                            💬 Get Help
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 3. FOOTER LEGAL & QUICK LINKS -->
          <tr>
            <td class="mobile-pad" style="padding: 0 32px 24px; background-color: #FFFFFF;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left" style="font-size: 11px; color: #64748B;">
                    <a href="https://abumafhal.com.ng" style="color: #64748B; text-decoration: none;">Help Center</a> &nbsp;|&nbsp;
                    <a href="https://abumafhal.com.ng/privacy" style="color: #64748B; text-decoration: none;">Privacy Policy</a> &nbsp;|&nbsp;
                    <a href="https://abumafhal.com.ng/terms" style="color: #64748B; text-decoration: none;">Terms of Service</a> &nbsp;|&nbsp;
                    <a href="https://abumafhal.com.ng/unsubscribe" style="color: #64748B; text-decoration: none;">Unsubscribe</a>
                  </td>
                  <td align="right" style="font-size: 11px; color: #0A192F; font-weight: 700;">
                    🌐 <a href="https://abumafhal.com.ng" style="color: #0A192F; text-decoration: none;">abumafhal.com</a>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top: 10px; font-size: 10.5px; color: #94A3B8;">
                    &copy; ${currentYear} ABU MAFHAL SUB. All rights reserved.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- END 600px Card -->

      </td>
    </tr>
  </table>

</body>
</html>`;
}
