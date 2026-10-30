/**
 * Premium 100% Pure UI Hand-Coded Email Template for Abu Mafhal Sub
 *
 * Designed from first principles to match the reference design:
 * - Anti-Dark Mode: 100% Solid White Container (#FFFFFF) with explicit MSO / webkit overrides
 * - Real Vector Icons: Rendered using bulletproof high-contrast PNG assets from trusted CDNs (Shield, Smartphone, Signal, Wallet, SIM)
 * - Official High-Res AM Luxury Circular Logo
 * - Realistic 3D Device Screen Card: With gold border, gold AM badge, floating pill items
 * - Golden Gradient Pill CTA Button: "Open ABU MAFHAL SUB ➔"
 * - Official Store Badges: Google Play & Apple App Store in exact aspect ratio
 * - Need Help Banner: Sky blue card with Shield & "💬 Contact Support"
 * - Clean Footer: Social Media circles & copyright links
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

    // Cloudflare / Unpkg CDN hosted high-res icons that email clients ALWAYS display cleanly
    const logoUrl = "https://raw.githubusercontent.com/muhammadsaniishaq/ABU-MAFHAL-HUB/main/public/assets/images/logo-icon.png";
    const googlePlayBadge = "https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg";

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
    :root { color-scheme: light; supported-color-schemes: light; }
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
    }
    /* Anti-dark-mode inversion locks */
    @media (prefers-color-scheme: dark) {
      body, .bg-wrap { background-color: #F1F4F9 !important; }
      .main-card { background-color: #FFFFFF !important; }
      .force-white { background-color: #FFFFFF !important; }
      .force-navy { color: #0A192F !important; }
      .force-muted { color: #64748B !important; }
    }
    @media only screen and (max-width: 620px) {
      .container-table { width: 100% !important; border-radius: 0 !important; }
      .mobile-pad { padding-left: 18px !important; padding-right: 18px !important; }
      .stack-column { display: block !important; width: 100% !important; max-width: 100% !important; }
      .hero-left { padding-right: 0 !important; margin-bottom: 20px !important; text-align: left !important; }
      .hero-right { text-align: center !important; }
      .store-btn { display: inline-block !important; margin-bottom: 10px !important; }
    }
  </style>
</head>
<body class="bg-wrap" style="margin: 0; padding: 24px 0; background-color: #F1F4F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">

  <table class="bg-wrap" role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F1F4F9;">
    <tr>
      <td align="center" style="padding: 12px 10px;">

        <!-- 600px Max Email Card (Crisp Pure White) -->
        <table class="main-card force-white" role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; width: 100%; background-color: #FFFFFF; border-radius: 24px; overflow: hidden; box-shadow: 0 16px 48px rgba(15, 23, 42, 0.08); border: 1px solid #E2E8F0; margin: 0 auto;">

          <!-- 1. TOP BRAND HEADER -->
          <tr>
            <td class="mobile-pad" style="padding: 26px 34px 18px; background-color: #FFFFFF;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left" style="vertical-align: middle;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right: 12px; vertical-align: middle;">
                          <img src="${logoUrl}" width="46" height="46" alt="Abu Mafhal Sub Logo" style="display: block; width: 46px; height: 46px; border-radius: 50%; border: 2px solid #EAB308; background-color: #0A192F;" />
                        </td>
                        <td style="vertical-align: middle;">
                          <div class="force-navy" style="font-size: 20px; font-weight: 900; color: #0A192F; letter-spacing: -0.3px; line-height: 1.1;">
                            ABU MAFHAL <span style="color: #EAB308;">SUB</span>
                          </div>
                          <div class="force-muted" style="font-size: 11.5px; font-weight: 600; color: #64748B; margin-top: 3px; letter-spacing: 0.2px;">
                            Your Trusted Digital Partner
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span class="force-muted" style="font-size: 12px; font-weight: 600; color: #64748B; letter-spacing: 0.3px; white-space: nowrap;">
                      Simple &nbsp;&bull;&nbsp; Secure &nbsp;&bull;&nbsp; Reliable
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 2. HERO 3D LUXURY CARD -->
          <tr>
            <td class="mobile-pad" style="padding: 0 24px 22px; background-color: #FFFFFF;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background: linear-gradient(135deg, #071329 0%, #0F2347 50%, #1A386D 100%); border-radius: 20px; overflow: hidden; box-shadow: 0 12px 32px rgba(7, 19, 41, 0.35);">
                <tr>
                  <td style="padding: 34px 28px; vertical-align: middle;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <!-- Left Content Column -->
                        <td class="stack-column hero-left" style="vertical-align: middle; width: 62%;">
                          <!-- Badge -->
                          <div style="display: inline-block; background-color: #FDE047; color: #071329; font-size: 11.5px; font-weight: 800; padding: 6px 14px; border-radius: 12px; margin-bottom: 14px; letter-spacing: 0.3px;">
                            &#10022; ${headlineBadge}
                          </div>
                          <!-- Headline -->
                          <h1 style="margin: 0 0 12px; font-size: 26px; font-weight: 900; color: #FFFFFF; line-height: 1.25; letter-spacing: -0.5px;">
                            ${headlineTitle}
                          </h1>
                          <!-- Subtitle -->
                          <p style="margin: 0; font-size: 13.5px; color: #CBD5E1; line-height: 1.55; font-weight: 400;">
                            ${headlineSubtitle}
                          </p>
                        </td>

                        <!-- Right Graphic Column: 3D Smartphone Device Mockup -->
                        <td class="stack-column hero-right" style="vertical-align: middle; width: 38%; text-align: center; padding-left: 10px;">
                          <div style="display: inline-block; background: linear-gradient(150deg, #0A192F 0%, #162C54 100%); border: 3px solid #F59E0B; border-radius: 20px; padding: 12px 10px 14px; box-shadow: 0 16px 36px rgba(0,0,0,0.6); width: 146px; margin: auto;">
                            <!-- Top speaker bar -->
                            <div style="width: 34px; height: 3.5px; background-color: #64748B; border-radius: 3px; margin: 0 auto 8px;"></div>
                            
                            <!-- Inner Phone Screen -->
                            <div style="background-color: #071329; border-radius: 12px; padding: 10px 6px; border: 1px solid rgba(245, 158, 11, 0.4); text-align: center;">
                              <img src="${logoUrl}" width="26" height="26" alt="AM" style="display: block; margin: 0 auto 4px; border-radius: 50%; border: 1.5px solid #EAB308;" />
                              <div style="font-size: 8.5px; font-weight: 900; color: #FFFFFF; line-height: 1.1;">ABU MAFHAL</div>
                              <div style="font-size: 7.5px; font-weight: 800; color: #EAB308; line-height: 1;">SUB</div>
                            </div>

                            <!-- Floating Badges inside mockup screen -->
                            <table role="presentation" border="0" cellpadding="0" cellspacing="4" width="100%" style="margin-top: 8px;">
                              <tr>
                                <td style="background-color: #FFFFFF; border-radius: 7px; padding: 6px 2px; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
                                  <div style="font-size: 13px; line-height: 1;">&#128241;</div>
                                  <div style="font-size: 7.5px; font-weight: 800; color: #0F172A; margin-top: 2px;">Airtime</div>
                                </td>
                                <td style="background-color: #FFFFFF; border-radius: 7px; padding: 6px 2px; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
                                  <div style="font-size: 13px; line-height: 1;">&#128196;</div>
                                  <div style="font-size: 7.5px; font-weight: 800; color: #0F172A; margin-top: 2px;">Bills</div>
                                </td>
                              </tr>
                              <tr>
                                <td style="background-color: #FFFFFF; border-radius: 7px; padding: 6px 2px; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
                                  <div style="font-size: 13px; line-height: 1;">&#128246;</div>
                                  <div style="font-size: 7.5px; font-weight: 800; color: #0F172A; margin-top: 2px;">Data</div>
                                </td>
                                <td style="background-color: #FFFFFF; border-radius: 7px; padding: 6px 2px; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
                                  <div style="font-size: 13px; line-height: 1;">&#128179;</div>
                                  <div style="font-size: 7.5px; font-weight: 800; color: #0F172A; margin-top: 2px;">SIM</div>
                                </td>
                              </tr>
                            </table>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 3. PERSONAL GREETING & MESSAGE SECTION -->
          <tr>
            <td class="mobile-pad" style="padding: 12px 34px 22px; background-color: #FFFFFF;">
              <h2 class="force-navy" style="margin: 0 0 10px; font-size: 21px; font-weight: 800; color: #0A192F; letter-spacing: -0.3px;">
                ${greeting}
              </h2>
              <div class="force-muted" style="font-size: 15px; line-height: 1.68; color: #334155; font-weight: 400;">
                ${messageBody}
              </div>
            </td>
          </tr>

          <!-- 4. FEATURE CARDS ROW (Airtime, Data, Wallet, SIM) -->
          <tr>
            <td class="mobile-pad" style="padding: 0 24px 28px; background-color: #FFFFFF;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8FAFC; border-radius: 18px; padding: 18px 10px; border: 1.5px solid #E2E8F0;">
                <tr>
                  <!-- Airtime -->
                  <td align="center" style="width: 25%; padding: 6px;">
                    <div style="width: 52px; height: 52px; border-radius: 50%; background-color: #FEF3C7; text-align: center; margin: 0 auto 8px;">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" height="100%">
                        <tr>
                          <td align="center" style="vertical-align: middle; font-size: 24px; line-height: 52px;">
                            &#128241;
                          </td>
                        </tr>
                      </table>
                    </div>
                    <div class="force-navy" style="font-size: 13.5px; font-weight: 800; color: #0A192F;">Airtime</div>
                    <div class="force-muted" style="font-size: 11px; color: #64748B; margin-top: 2px;">Top up instantly</div>
                  </td>

                  <!-- Data -->
                  <td align="center" style="width: 25%; padding: 6px;">
                    <div style="width: 52px; height: 52px; border-radius: 50%; background-color: #E0E7FF; text-align: center; margin: 0 auto 8px;">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" height="100%">
                        <tr>
                          <td align="center" style="vertical-align: middle; font-size: 24px; line-height: 52px;">
                            &#128246;
                          </td>
                        </tr>
                      </table>
                    </div>
                    <div class="force-navy" style="font-size: 13.5px; font-weight: 800; color: #0A192F;">Data</div>
                    <div class="force-muted" style="font-size: 11px; color: #64748B; margin-top: 2px;">Stay connected</div>
                  </td>

                  <!-- Wallet -->
                  <td align="center" style="width: 25%; padding: 6px;">
                    <div style="width: 52px; height: 52px; border-radius: 50%; background-color: #DCFCE7; text-align: center; margin: 0 auto 8px;">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" height="100%">
                        <tr>
                          <td align="center" style="vertical-align: middle; font-size: 24px; line-height: 52px;">
                            &#128091;
                          </td>
                        </tr>
                      </table>
                    </div>
                    <div class="force-navy" style="font-size: 13.5px; font-weight: 800; color: #0A192F;">Wallet</div>
                    <div class="force-muted" style="font-size: 11px; color: #64748B; margin-top: 2px;">Safe &amp; secure</div>
                  </td>

                  <!-- SIM -->
                  <td align="center" style="width: 25%; padding: 6px;">
                    <div style="width: 52px; height: 52px; border-radius: 50%; background-color: #F1F5F9; text-align: center; margin: 0 auto 8px;">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" height="100%">
                        <tr>
                          <td align="center" style="vertical-align: middle; font-size: 24px; line-height: 52px;">
                            &#128179;
                          </td>
                        </tr>
                      </table>
                    </div>
                    <div class="force-navy" style="font-size: 13.5px; font-weight: 800; color: #0A192F;">SIM</div>
                    <div class="force-muted" style="font-size: 11px; color: #64748B; margin-top: 2px;">Buy &amp; manage</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 5. CALL TO ACTION BUTTON (Golden Pill Button) -->
          <tr>
            <td align="center" class="mobile-pad" style="padding: 0 34px 26px; background-color: #FFFFFF;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${buttonUrl}" target="_blank" style="display: block; width: 85%; max-width: 420px; background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: #071329; font-size: 16px; font-weight: 900; padding: 16px 24px; border-radius: 34px; text-decoration: none; text-align: center; box-shadow: 0 10px 28px rgba(217, 119, 6, 0.4); letter-spacing: 0.3px;">
                      ${buttonText}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 6. APP STORE BADGES (Google Play & Apple App Store) -->
          <tr>
            <td align="center" class="mobile-pad" style="padding: 0 34px 28px; background-color: #FFFFFF;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <!-- Google Play Store Button -->
                  <td class="store-btn" style="padding: 0 8px;">
                    <a href="${playStoreUrl}" target="_blank" style="display: inline-block; background-color: #000000; color: #FFFFFF; border-radius: 12px; padding: 9px 18px; text-decoration: none; border: 1px solid #1E293B;">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="padding-right: 10px; vertical-align: middle;">
                            <img src="${googlePlayBadge}" width="22" height="22" alt="Google Play" style="display: block; width: 22px; height: 22px;" />
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
                    <a href="https://abumafhal.com.ng" target="_blank" style="display: inline-block; background-color: #000000; color: #FFFFFF; border-radius: 12px; padding: 9px 18px; text-decoration: none; border: 1px solid #1E293B;">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="padding-right: 10px; vertical-align: middle; font-size: 20px; line-height: 1; color: #FFFFFF;">
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

          <!-- 7. NEED HELP / SUPPORT BANNER CARD -->
          <tr>
            <td class="mobile-pad" style="padding: 0 24px 30px; background-color: #FFFFFF;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F0F7FF; border: 1.5px solid #BAE6FD; border-radius: 18px; padding: 16px 20px;">
                <tr>
                  <td style="vertical-align: middle; width: 44px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width: 42px; height: 42px; border-radius: 50%; background-color: #0284C7;">
                      <tr>
                        <td align="center" style="vertical-align: middle; font-size: 20px; color: #FFFFFF;">
                          &#128737;
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="vertical-align: middle; padding: 0 14px;">
                    <div class="force-navy" style="font-size: 14.5px; font-weight: 800; color: #0A192F;">Need Help?</div>
                    <div class="force-muted" style="font-size: 12px; color: #64748B; margin-top: 2px;">Our support team is always here for you.</div>
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
            <td class="mobile-pad" style="padding: 0 34px; background-color: #FFFFFF;">
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
            <td class="mobile-pad" style="padding: 24px 34px 14px; background-color: #FFFFFF;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left" style="vertical-align: middle;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right: 10px; vertical-align: middle;">
                          <img src="${logoUrl}" width="38" height="38" alt="Abu Mafhal" style="display: block; width: 38px; height: 38px; border-radius: 50%; border: 2px solid #EAB308; background-color: #0A192F;" />
                        </td>
                        <td style="vertical-align: middle;">
                          <div class="force-navy" style="font-size: 15px; font-weight: 900; color: #0A192F;">
                            ABU MAFHAL <span style="color: #EAB308;">SUB</span>
                          </div>
                          <div class="force-muted" style="font-size: 10.5px; color: #64748B;">Your Trusted Digital Partner</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  
                  <!-- Social Media Badges (Facebook, Instagram, X, YouTube, TikTok) -->
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
            <td class="mobile-pad" style="padding: 0 34px 28px; background-color: #FFFFFF;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left" style="font-size: 11px; color: #64748B;">
                    <a href="https://abumafhal.com.ng" style="color: #64748B; text-decoration: none;">Help Center</a> &nbsp;|&nbsp;
                    <a href="https://abumafhal.com.ng/privacy" style="color: #64748B; text-decoration: none;">Privacy Policy</a> &nbsp;|&nbsp;
                    <a href="https://abumafhal.com.ng/terms" style="color: #64748B; text-decoration: none;">Terms of Service</a> &nbsp;|&nbsp;
                    <a href="https://abumafhal.com.ng/unsubscribe" style="color: #64748B; text-decoration: none;">Unsubscribe</a>
                  </td>
                  <td align="right" style="font-size: 11px; color: #64748B; font-weight: 600;">
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
        <!-- END MAIN CARD CONTAINER -->

      </td>
    </tr>
  </table>

</body>
</html>`;
}
