/**
 * ABU MAFHAL SUB — Authentic Master Responsive HTML Email Template
 * 
 * 100% Native HTML & CSS (No static sample image mockups)
 * Engineered according to standard email client design systems:
 * 
 * 1. Clean Preheader & Global Wrapper (#F1F4F9 light grey background)
 * 2. Primary Card: 600px Max Solid White (#FFFFFF) with rounded 24px corners
 * 3. Top Brand Header:
 *    - Left: Circular Gold-Bordered AM Logo, "ABU MAFHAL SUB", "Your Trusted Digital Partner"
 *    - Right: "Simple • Secure • Reliable"
 * 4. Luxury 3D Hero Banner:
 *    - Gradient Deep Navy (#071329 -> #0F2347 -> #1A386D)
 *    - Gold Star Pill Badge: "✦ {{headlineBadge}}"
 *    - Dynamic Headline: "{{headlineTitle}}"
 *    - Subtitle: "Fast, secure and affordable digital services in one app."
 * 5. Dynamic Content Section:
 *    - Personalized Greeting: "Hi {{recipientName}} 👋"
 *    - Clean message body
 * 6. Quick Action Badges (4 Services):
 *    - 📱 Airtime (Top up instantly)
 *    - 📶 Data (Stay connected)
 *    - 👛 Wallet (Safe & secure)
 *    - 💳 SIM (Buy & manage)
 * 7. Primary CTA:
 *    - Golden curved pill button: "Open ABU MAFHAL SUB ➔"
 * 8. Official App Badges:
 *    - Google Play & App Store buttons
 * 9. Need Help / Customer Support:
 *    - Sky Blue Card with Shield & "💬 Contact Support"
 * 10. Footer:
 *     - AM Brand mark & Social Circles (Facebook, Instagram, X, YouTube, TikTok)
 *     - Legal & Copyright
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
    const headlineSubtitle = options.headlineSubtitle || 'Fast, secure and affordable digital services in one app.';
    const greeting = options.greeting || `Hi ${recipientName} 👋`;
    const messageBody = options.messageBody || "Welcome to <strong>ABU MAFHAL SUB</strong>! We're excited to have you on board. You can now enjoy fast, secure and affordable digital services all in one app.";
    const buttonText = options.buttonText || 'Open ABU MAFHAL SUB &rarr;';
    const buttonUrl = options.buttonUrl || 'https://abumafhal.com.ng';
    const supportUrl = options.supportUrl || 'https://wa.me/2348083833077';
    const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.muhammmadsaniishaq.abumafhalsub';

    // Official Authentic Abu Mafhal Sub Logo (Gold 3D Crest with Trust Quality Value)
    const logoUrl = "https://raw.githubusercontent.com/muhammadsaniishaq/ABU-MAFHAL-HUB/main/assets/images/logo.png";

    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
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
    :root {
      color-scheme: light;
      supported-color-schemes: light;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      background-color: #F1F4F9 !important;
      -webkit-font-smoothing: antialiased;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    table, td {
      border-collapse: collapse !important;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      border: 0;
      outline: none;
      text-decoration: none;
      -ms-interpolation-mode: bicubic;
    }
    a {
      text-decoration: none;
      color: inherit;
    }
    /* Anti Dark-Mode override rules */
    @media (prefers-color-scheme: dark) {
      body, .email-bg { background-color: #F1F4F9 !important; }
      .email-card { background-color: #FFFFFF !important; }
      .text-title { color: #0A192F !important; }
      .text-body { color: #334155 !important; }
      .text-sub { color: #64748B !important; }
    }
    @media only screen and (max-width: 620px) {
      .email-card { width: 100% !important; border-radius: 0 !important; }
      .p-responsive { padding-left: 20px !important; padding-right: 20px !important; }
      .hero-pad { padding: 26px 20px !important; }
      .grid-item { display: inline-block !important; width: 48% !important; margin-bottom: 12px !important; }
      .store-btn { display: block !important; margin: 0 auto 10px !important; width: 220px !important; }
    }
  </style>
</head>
<body class="email-bg" style="margin: 0; padding: 28px 0; background-color: #F1F4F9;">

  <!-- Preheader preview text for mail clients -->
  <div style="display: none; font-size: 1px; color: #F1F4F9; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${headlineTitle} &mdash; ABU MAFHAL SUB Telecom &amp; Digital Services
  </div>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-bg" style="background-color: #F1F4F9;">
    <tr>
      <td align="center" style="padding: 0 12px;">

        <!-- 600px Max Clean White Email Container -->
        <table role="presentation" class="email-card" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; width: 100%; background-color: #FFFFFF; border-radius: 24px; overflow: hidden; box-shadow: 0 16px 44px rgba(15, 23, 42, 0.08); border: 1px solid #E2E8F0; margin: 0 auto;">

          <!-- 1. TOP BRAND HEADER -->
          <tr>
            <td class="p-responsive" style="padding: 24px 34px 18px; background-color: #FFFFFF;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left" style="vertical-align: middle;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right: 12px; vertical-align: middle;">
                          <img src="${logoUrl}" width="46" height="46" alt="Abu Mafhal Sub Logo" style="display: block; width: 46px; height: 46px; border-radius: 50%; border: 2px solid #EAB308; background-color: #0A192F;" />
                        </td>
                        <td style="vertical-align: middle;">
                          <div class="text-title" style="font-size: 19px; font-weight: 900; color: #0A192F; letter-spacing: 0.1px; line-height: 1.15;">
                            ABU MAFHAL <span style="color: #EAB308;">SUB</span>
                          </div>
                          <div class="text-sub" style="font-size: 11px; font-weight: 600; color: #64748B; margin-top: 3px; letter-spacing: 0.3px;">
                            Your Trusted Digital Partner
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span class="text-sub" style="font-size: 11.5px; font-weight: 600; color: #64748B; letter-spacing: 0.3px; white-space: nowrap;">
                      Simple &nbsp;&bull;&nbsp; Secure &nbsp;&bull;&nbsp; Reliable
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 2. LUXURY 3D HERO CARD -->
          <tr>
            <td class="p-responsive" style="padding: 0 24px 22px; background-color: #FFFFFF;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background: linear-gradient(135deg, #071329 0%, #0F2347 50%, #1A386D 100%); border-radius: 20px; overflow: hidden; box-shadow: 0 12px 30px rgba(7, 19, 41, 0.35);">
                <tr>
                  <td class="hero-pad" style="padding: 34px 28px; vertical-align: middle;">
                    
                    <!-- Welcome / Announcement Badge -->
                    <div style="display: inline-block; background-color: #FDE047; color: #071329; font-size: 11.5px; font-weight: 800; padding: 6px 14px; border-radius: 12px; margin-bottom: 14px; letter-spacing: 0.3px;">
                      &#10022; ${headlineBadge}
                    </div>

                    <!-- Hero Title -->
                    <h1 style="margin: 0 0 12px; font-size: 26px; font-weight: 900; color: #FFFFFF; line-height: 1.25; letter-spacing: -0.4px;">
                      ${headlineTitle}
                    </h1>

                    <!-- Hero Subtitle -->
                    <p style="margin: 0; font-size: 13.5px; color: #CBD5E1; line-height: 1.55; font-weight: 400; max-width: 480px;">
                      ${headlineSubtitle}
                    </p>

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 3. PERSONAL GREETING & MESSAGE SECTION -->
          <tr>
            <td class="p-responsive" style="padding: 12px 34px 24px; background-color: #FFFFFF;">
              <h2 class="text-title" style="margin: 0 0 10px; font-size: 20px; font-weight: 800; color: #0A192F;">
                ${greeting}
              </h2>
              <div class="text-body" style="font-size: 15px; line-height: 1.68; color: #334155; font-weight: 400;">
                ${messageBody}
              </div>
            </td>
          </tr>

          <!-- 4. QUICK ACTION 4-FEATURE PILL CARDS -->
          <tr>
            <td class="p-responsive" style="padding: 0 24px 28px; background-color: #FFFFFF;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8FAFC; border-radius: 18px; padding: 18px 12px; border: 1.5px solid #E2E8F0;">
                <tr>
                  <!-- Airtime -->
                  <td align="center" class="grid-item" style="width: 25%; padding: 6px;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background-color: #FEF3C7; text-align: center; margin: 0 auto 8px; line-height: 48px; font-size: 22px;">
                      &#128241;
                    </div>
                    <div class="text-title" style="font-size: 13.5px; font-weight: 800; color: #0A192F;">Airtime</div>
                    <div class="text-sub" style="font-size: 11px; color: #64748B; margin-top: 2px;">Top up instantly</div>
                  </td>

                  <!-- Data -->
                  <td align="center" class="grid-item" style="width: 25%; padding: 6px;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background-color: #E0E7FF; text-align: center; margin: 0 auto 8px; line-height: 48px; font-size: 22px;">
                      &#128246;
                    </div>
                    <div class="text-title" style="font-size: 13.5px; font-weight: 800; color: #0A192F;">Data</div>
                    <div class="text-sub" style="font-size: 11px; color: #64748B; margin-top: 2px;">Stay connected</div>
                  </td>

                  <!-- Wallet -->
                  <td align="center" class="grid-item" style="width: 25%; padding: 6px;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background-color: #DCFCE7; text-align: center; margin: 0 auto 8px; line-height: 48px; font-size: 22px;">
                      &#128091;
                    </div>
                    <div class="text-title" style="font-size: 13.5px; font-weight: 800; color: #0A192F;">Wallet</div>
                    <div class="text-sub" style="font-size: 11px; color: #64748B; margin-top: 2px;">Safe &amp; secure</div>
                  </td>

                  <!-- SIM -->
                  <td align="center" class="grid-item" style="width: 25%; padding: 6px;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background-color: #F1F5F9; text-align: center; margin: 0 auto 8px; line-height: 48px; font-size: 22px;">
                      &#128179;
                    </div>
                    <div class="text-title" style="font-size: 13.5px; font-weight: 800; color: #0A192F;">SIM</div>
                    <div class="text-sub" style="font-size: 11px; color: #64748B; margin-top: 2px;">Buy &amp; manage</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 5. CALL TO ACTION BUTTON (Gold Curved Pill) -->
          <tr>
            <td align="center" class="p-responsive" style="padding: 0 34px 26px; background-color: #FFFFFF;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${buttonUrl}" target="_blank" style="display: block; width: 85%; max-width: 400px; background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: #071329; font-size: 16px; font-weight: 900; padding: 16px 24px; border-radius: 34px; text-decoration: none; text-align: center; box-shadow: 0 8px 24px rgba(217, 119, 6, 0.4); letter-spacing: 0.3px;">
                      ${buttonText}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 6. OFFICIAL APP STORE DOWNLOAD BADGES -->
          <tr>
            <td align="center" class="p-responsive" style="padding: 0 34px 28px; background-color: #FFFFFF;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <!-- Google Play Store Button -->
                  <td class="store-btn" style="padding: 0 8px;">
                    <a href="${playStoreUrl}" target="_blank" style="display: inline-block; background-color: #000000; color: #FFFFFF; border-radius: 12px; padding: 10px 18px; text-decoration: none; border: 1px solid #1E293B;">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="padding-right: 10px; vertical-align: middle; font-size: 18px; line-height: 1;">
                            &#9658;
                          </td>
                          <td style="vertical-align: middle; text-align: left;">
                            <div style="font-size: 8.5px; text-transform: uppercase; color: #94A3B8; font-weight: 700; letter-spacing: 0.5px; line-height: 1;">GET IT ON</div>
                            <div style="font-size: 14px; font-weight: 800; color: #FFFFFF; line-height: 1.2; margin-top: 2px;">Google Play</div>
                          </td>
                        </tr>
                      </table>
                    </a>
                  </td>

                  <!-- Apple App Store Button -->
                  <td class="store-btn" style="padding: 0 8px;">
                    <a href="https://abumafhal.com.ng" target="_blank" style="display: inline-block; background-color: #000000; color: #FFFFFF; border-radius: 12px; padding: 10px 18px; text-decoration: none; border: 1px solid #1E293B;">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="padding-right: 10px; vertical-align: middle; font-size: 19px; line-height: 1; color: #FFFFFF;">
                            &#63743;
                          </td>
                          <td style="vertical-align: middle; text-align: left;">
                            <div style="font-size: 8.5px; text-transform: uppercase; color: #94A3B8; font-weight: 700; letter-spacing: 0.5px; line-height: 1;">Download on the</div>
                            <div style="font-size: 14px; font-weight: 800; color: #FFFFFF; line-height: 1.2; margin-top: 2px;">App Store</div>
                          </td>
                        </tr>
                      </table>
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 7. NEED HELP / CUSTOMER SUPPORT BANNER -->
          <tr>
            <td class="p-responsive" style="padding: 0 24px 30px; background-color: #FFFFFF;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F0F7FF; border: 1.5px solid #BAE6FD; border-radius: 18px; padding: 16px 20px;">
                <tr>
                  <td style="vertical-align: middle; width: 44px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width: 40px; height: 40px; border-radius: 50%; background-color: #0284C7;">
                      <tr>
                        <td align="center" style="vertical-align: middle; font-size: 20px; color: #FFFFFF;">
                          &#128737;
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="vertical-align: middle; padding: 0 14px;">
                    <div class="text-title" style="font-size: 14.5px; font-weight: 800; color: #0A192F;">Need Help?</div>
                    <div class="text-sub" style="font-size: 12px; color: #64748B; margin-top: 2px;">Our support team is always here for you.</div>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <a href="${supportUrl}" target="_blank" style="display: inline-block; background-color: #FEF3C7; color: #0A192F; font-size: 12.5px; font-weight: 800; padding: 9px 18px; border-radius: 20px; text-decoration: none; border: 1px solid #FDE047; white-space: nowrap;">
                      &#128172; Contact Support
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 8. DIVIDER -->
          <tr>
            <td class="p-responsive" style="padding: 0 34px; background-color: #FFFFFF;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="border-top: 1px solid #E2E8F0;"></td>
                  <td style="width: 190px; text-align: center; font-size: 11px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.8px; padding: 0 10px;">
                    Your Trusted Digital Partner
                  </td>
                  <td style="border-top: 1px solid #E2E8F0;"></td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 9. FOOTER BRAND & SOCIAL ICONS -->
          <tr>
            <td class="p-responsive" style="padding: 24px 34px 14px; background-color: #FFFFFF;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left" style="vertical-align: middle;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right: 10px; vertical-align: middle;">
                          <img src="${logoUrl}" width="38" height="38" alt="Abu Mafhal" style="display: block; width: 38px; height: 38px; border-radius: 50%; border: 2px solid #EAB308; background-color: #0A192F;" />
                        </td>
                        <td style="vertical-align: middle;">
                          <div class="text-title" style="font-size: 15px; font-weight: 900; color: #0A192F;">
                            ABU MAFHAL <span style="color: #EAB308;">SUB</span>
                          </div>
                          <div class="text-sub" style="font-size: 10.5px; color: #64748B;">Your Trusted Digital Partner</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  
                  <!-- Social Media Badges -->
                  <td align="right" style="vertical-align: middle;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <!-- Facebook -->
                        <td style="padding-left: 6px;">
                          <a href="https://facebook.com" target="_blank" style="display: inline-block; width: 28px; height: 28px; border-radius: 50%; background-color: #1877F2; text-align: center; line-height: 28px; color: #FFFFFF; font-size: 13px; font-weight: 900; text-decoration: none;">f</a>
                        </td>
                        <!-- Instagram -->
                        <td style="padding-left: 6px;">
                          <a href="https://instagram.com" target="_blank" style="display: inline-block; width: 28px; height: 28px; border-radius: 50%; background: radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%); text-align: center; line-height: 28px; color: #FFFFFF; font-size: 11px; font-weight: 900; text-decoration: none;">ig</a>
                        </td>
                        <!-- X -->
                        <td style="padding-left: 6px;">
                          <a href="https://x.com" target="_blank" style="display: inline-block; width: 28px; height: 28px; border-radius: 50%; background-color: #000000; text-align: center; line-height: 28px; color: #FFFFFF; font-size: 12px; font-weight: 900; text-decoration: none;">&#120143;</a>
                        </td>
                        <!-- YouTube -->
                        <td style="padding-left: 6px;">
                          <a href="https://youtube.com" target="_blank" style="display: inline-block; width: 28px; height: 28px; border-radius: 50%; background-color: #FF0000; text-align: center; line-height: 28px; color: #FFFFFF; font-size: 11px; font-weight: 900; text-decoration: none;">&#9654;</a>
                        </td>
                        <!-- TikTok -->
                        <td style="padding-left: 6px;">
                          <a href="https://tiktok.com" target="_blank" style="display: inline-block; width: 28px; height: 28px; border-radius: 50%; background-color: #010101; text-align: center; line-height: 28px; color: #FFFFFF; font-size: 12px; font-weight: 900; text-decoration: none;">&#9835;</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 10. LEGAL LINKS & COPYRIGHT -->
          <tr>
            <td class="p-responsive" style="padding: 0 34px 28px; background-color: #FFFFFF;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left" style="font-size: 11px; color: #64748B;">
                    <a href="https://abumafhal.com.ng" style="color: #64748B; text-decoration: none;">Help Center</a> &nbsp;|&nbsp;
                    <a href="https://abumafhal.com.ng/privacy" style="color: #64748B; text-decoration: none;">Privacy Policy</a> &nbsp;|&nbsp;
                    <a href="https://abumafhal.com.ng/terms" style="color: #64748B; text-decoration: none;">Terms of Service</a> &nbsp;|&nbsp;
                    <a href="https://abumafhal.com.ng/unsubscribe" style="color: #64748B; text-decoration: none;">Unsubscribe</a>
                  </td>
                  <td align="right" style="font-size: 11px; color: #64748B; font-weight: 700;">
                    &#127760; <a href="https://abumafhal.com.ng" style="color: #0A192F; text-decoration: none;">abumafhal.com</a>
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
        <!-- END 600px CONTAINER -->

      </td>
    </tr>
  </table>

</body>
</html>`;
}
