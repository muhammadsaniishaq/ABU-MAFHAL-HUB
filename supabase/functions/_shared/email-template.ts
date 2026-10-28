/**
 * Premium Email Template Generator for Abu Mafhal Sub
 * Matches the official design specification:
 * - Top brand bar: Logo, "ABU MAFHAL SUB", "Your Trusted Digital Partner", "Simple • Secure • Reliable"
 * - Hero 3D Card: "✨ Welcome Aboard", "Your Digital Life, Simplified", with 3D smartphone, Floating badges (Airtime, Bills, Data, SIM)
 * - Personal Greeting & Message: "Hi {{user_name}} 👋"
 * - Feature Quick-Pill Badges: Airtime (Top up instantly), Data (Stay connected), Wallet (Safe & secure), SIM (Buy & manage)
 * - Primary Action Button: "Open ABU MAFHAL SUB ➔"
 * - Store Badges: Google Play & Apple App Store
 * - Need Help / Support Card: Shield icon, "Need Help? Our support team is always here for you", "💬 Contact Support" button
 * - Footer: Logo + "ABU MAFHAL SUB Your Trusted Digital Partner", Social icons (Facebook, Instagram, X, YouTube, TikTok)
 * - Navigation links: Help Center | Privacy Policy | Terms of Service | Unsubscribe | abumafhal.com
 */

export interface EmailTemplateOptions {
    recipientName?: string;
    headlineBadge?: string;
    headlineTitle?: string;
    headlineSubtitle?: string;
    greeting?: string;
    messageBody?: string;
    heroImageUrl?: string;
    buttonText?: string;
    buttonUrl?: string;
    helpText?: string;
    supportUrl?: string;
    bannerUrl?: string;
}

export function renderAbuMafhalEmailTemplate(options: EmailTemplateOptions): string {
    const currentYear = new Date().getFullYear();
    const recipientName = options.recipientName || 'Valued Partner';
    const headlineBadge = options.headlineBadge || 'Welcome Aboard';
    const headlineTitle = options.headlineTitle || 'Your Digital Life, Simplified';
    const headlineSubtitle = options.headlineSubtitle || 'Fast, secure and affordable digital services in one app.';
    const greeting = options.greeting || `Hi ${recipientName} 👋`;
    const messageBody = options.messageBody || "Welcome to <strong>ABU MAFHAL SUB</strong>! We're excited to have you on board. You can now enjoy fast, secure and affordable digital services all in one app.";
    const buttonText = options.buttonText || 'Open ABU MAFHAL SUB &rarr;';
    const buttonUrl = options.buttonUrl || 'https://abumafhal.com.ng';
    const supportUrl = options.supportUrl || 'https://wa.me/2348083833077';
    const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.muhammmadsaniishaq.abumafhalsub';

    // SVG Icons and Brand Assets encoded as clean, high-compatibility inline graphics
    const logoAmSvg = `https://uagcxrtdqttayulvgpwg.supabase.co/storage/v1/object/public/static/logo.png`;

    return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
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
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; background-color: #F1F4F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    a { color: inherit; text-decoration: none; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; margin: auto !important; }
      .mobile-stack { display: block !important; width: 100% !important; }
      .hero-pad { padding: 28px 20px !important; }
      .grid-item { display: inline-block !important; width: 46% !important; margin-bottom: 12px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #F1F4F9;">

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center">

        <!-- MAIN CONTAINER (600px Max) -->
        <table role="presentation" class="email-container" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(15, 23, 42, 0.08); border: 1px solid #E2E8F0; margin: 0 auto;">
          
          <!-- 1. TOP BRAND HEADER -->
          <tr>
            <td style="padding: 24px 32px 18px; background-color: #FFFFFF;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left" style="vertical-align: middle;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right: 12px; vertical-align: middle;">
                          <div style="width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #0A192F 0%, #1E3A8A 100%); border: 2px solid #EAB308; text-align: center; line-height: 44px; color: #EAB308; font-weight: 900; font-size: 18px; box-shadow: 0 2px 6px rgba(0,0,0,0.15);">
                            AM
                          </div>
                        </td>
                        <td style="vertical-align: middle;">
                          <div style="font-size: 19px; font-weight: 900; color: #0A192F; letter-spacing: 0.2px; line-height: 1.2;">
                            ABU MAFHAL <span style="color: #EAB308;">SUB</span>
                          </div>
                          <div style="font-size: 11px; font-weight: 600; color: #64748B; margin-top: 2px; letter-spacing: 0.3px;">
                            Your Trusted Digital Partner
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="font-size: 12px; font-weight: 600; color: #64748B; letter-spacing: 0.5px;">
                      Simple &nbsp;&bull;&nbsp; Secure &nbsp;&bull;&nbsp; Reliable
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 2. HERO LUXURY 3D CARD -->
          <tr>
            <td style="padding: 0 24px 24px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background: linear-gradient(135deg, #071329 0%, #0F2347 50%, #1A386D 100%); border-radius: 18px; overflow: hidden; position: relative;">
                <tr>
                  <td class="hero-pad" style="padding: 36px 32px; vertical-align: middle;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <!-- Left Content Column -->
                        <td class="mobile-stack" style="vertical-align: middle; width: 60%;">
                          <!-- Badge -->
                          <div style="display: inline-block; background-color: #FDE047; color: #071329; font-size: 11.5px; font-weight: 800; padding: 5px 12px; border-radius: 12px; margin-bottom: 16px; letter-spacing: 0.3px;">
                            ✦ ${headlineBadge}
                          </div>
                          <!-- Headline -->
                          <h1 style="margin: 0 0 14px; font-size: 27px; font-weight: 900; color: #FFFFFF; line-height: 1.2; letter-spacing: -0.5px;">
                            ${headlineTitle}
                          </h1>
                          <!-- Subtitle -->
                          <p style="margin: 0; font-size: 13.5px; color: #CBD5E1; line-height: 1.5; font-weight: 400;">
                            ${headlineSubtitle}
                          </p>
                        </td>

                        <!-- Right Graphic Column: 3D Floating Phone Mockup & Badges -->
                        <td class="mobile-stack" style="vertical-align: middle; width: 40%; text-align: center; padding-left: 12px;">
                          <!-- Phone Mockup Container -->
                          <div style="display: inline-block; background: linear-gradient(145deg, #0A192F, #1E3A8A); border: 2.5px solid #F59E0B; border-radius: 18px; padding: 14px 12px; box-shadow: 0 12px 30px rgba(0,0,0,0.5); width: 140px; margin: auto;">
                            <div style="width: 28px; height: 3px; background-color: #475569; border-radius: 2px; margin: 0 auto 8px;"></div>
                            <!-- Mini App Header inside screen -->
                            <div style="background-color: #071329; border-radius: 10px; padding: 8px 4px; border: 1px solid rgba(245, 158, 11, 0.3);">
                              <div style="width: 24px; height: 24px; border-radius: 50%; background: #EAB308; margin: 0 auto 4px; line-height: 24px; color: #071329; font-size: 11px; font-weight: 900; text-align: center;">AM</div>
                              <div style="font-size: 9px; font-weight: 800; color: #FFFFFF; line-height: 1;">ABU MAFHAL</div>
                              <div style="font-size: 8px; font-weight: 700; color: #EAB308;">SUB</div>
                            </div>

                            <!-- Floating Action Grid in phone screen -->
                            <table role="presentation" border="0" cellpadding="0" cellspacing="4" width="100%" style="margin-top: 8px;">
                              <tr>
                                <td style="background-color: #FFFFFF; border-radius: 6px; padding: 5px 2px; text-align: center;">
                                  <div style="font-size: 11px;">📱</div>
                                  <div style="font-size: 7.5px; font-weight: 700; color: #0F172A;">Airtime</div>
                                </td>
                                <td style="background-color: #FFFFFF; border-radius: 6px; padding: 5px 2px; text-align: center;">
                                  <div style="font-size: 11px;">📄</div>
                                  <div style="font-size: 7.5px; font-weight: 700; color: #0F172A;">Bills</div>
                                </td>
                              </tr>
                              <tr>
                                <td style="background-color: #FFFFFF; border-radius: 6px; padding: 5px 2px; text-align: center;">
                                  <div style="font-size: 11px;">📶</div>
                                  <div style="font-size: 7.5px; font-weight: 700; color: #0F172A;">Data</div>
                                </td>
                                <td style="background-color: #FFFFFF; border-radius: 6px; padding: 5px 2px; text-align: center;">
                                  <div style="font-size: 11px;">💳</div>
                                  <div style="font-size: 7.5px; font-weight: 700; color: #0F172A;">SIM</div>
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
            <td style="padding: 10px 32px 24px;">
              <h2 style="margin: 0 0 10px; font-size: 20px; font-weight: 800; color: #0A192F;">
                ${greeting}
              </h2>
              <div style="font-size: 15px; line-height: 1.65; color: #475569; font-weight: 400;">
                ${messageBody}
              </div>
            </td>
          </tr>

          <!-- 4. FEATURE PILL BADGES (Airtime, Data, Wallet, SIM) -->
          <tr>
            <td style="padding: 0 24px 28px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8FAFC; border-radius: 16px; padding: 18px 12px; border: 1px solid #E2E8F0;">
                <tr>
                  <!-- Airtime -->
                  <td align="center" class="grid-item" style="width: 25%; padding: 6px;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background-color: #FEF3C7; text-align: center; line-height: 48px; margin: 0 auto 8px; font-size: 22px;">
                      📱
                    </div>
                    <div style="font-size: 13.5px; font-weight: 800; color: #0A192F;">Airtime</div>
                    <div style="font-size: 11px; color: #64748B; margin-top: 2px;">Top up instantly</div>
                  </td>

                  <!-- Data -->
                  <td align="center" class="grid-item" style="width: 25%; padding: 6px;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background-color: #E0E7FF; text-align: center; line-height: 48px; margin: 0 auto 8px; font-size: 22px;">
                      📶
                    </div>
                    <div style="font-size: 13.5px; font-weight: 800; color: #0A192F;">Data</div>
                    <div style="font-size: 11px; color: #64748B; margin-top: 2px;">Stay connected</div>
                  </td>

                  <!-- Wallet -->
                  <td align="center" class="grid-item" style="width: 25%; padding: 6px;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background-color: #DCFCE7; text-align: center; line-height: 48px; margin: 0 auto 8px; font-size: 22px;">
                      👛
                    </div>
                    <div style="font-size: 13.5px; font-weight: 800; color: #0A192F;">Wallet</div>
                    <div style="font-size: 11px; color: #64748B; margin-top: 2px;">Safe &amp; secure</div>
                  </td>

                  <!-- SIM -->
                  <td align="center" class="grid-item" style="width: 25%; padding: 6px;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background-color: #F1F5F9; text-align: center; line-height: 48px; margin: 0 auto 8px; font-size: 22px;">
                      💳
                    </div>
                    <div style="font-size: 13.5px; font-weight: 800; color: #0A192F;">SIM</div>
                    <div style="font-size: 11px; color: #64748B; margin-top: 2px;">Buy &amp; manage</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 5. CALL TO ACTION BUTTON (Gold pill button) -->
          <tr>
            <td align="center" style="padding: 0 32px 24px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${buttonUrl}" target="_blank" style="display: block; width: 85%; max-width: 420px; background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: #071329; font-size: 16px; font-weight: 900; padding: 15px 24px; border-radius: 30px; text-decoration: none; text-align: center; box-shadow: 0 8px 24px rgba(217, 119, 6, 0.35); letter-spacing: 0.3px;">
                      ${buttonText}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 6. APP STORE BADGES (Google Play & Apple App Store) -->
          <tr>
            <td align="center" style="padding: 0 32px 28px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <!-- Google Play Store Button -->
                  <td style="padding: 0 8px;">
                    <a href="${playStoreUrl}" target="_blank" style="display: inline-block; background-color: #000000; color: #FFFFFF; border-radius: 10px; padding: 8px 18px; text-decoration: none; border: 1px solid #1E293B;">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="padding-right: 10px; vertical-align: middle;">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/d/d0/Google_Play_Arrow_logo.svg" width="22" height="22" alt="Google Play" style="display: block;" />
                          </td>
                          <td style="vertical-align: middle; text-align: left;">
                            <div style="font-size: 9px; text-transform: uppercase; color: #94A3B8; font-weight: 600; line-height: 1;">GET IT ON</div>
                            <div style="font-size: 13.5px; font-weight: 800; color: #FFFFFF; line-height: 1.2; margin-top: 2px;">Google Play</div>
                          </td>
                        </tr>
                      </table>
                    </a>
                  </td>

                  <!-- Apple App Store Button -->
                  <td style="padding: 0 8px;">
                    <a href="https://abumafhal.com.ng" target="_blank" style="display: inline-block; background-color: #000000; color: #FFFFFF; border-radius: 10px; padding: 8px 18px; text-decoration: none; border: 1px solid #1E293B;">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="padding-right: 10px; vertical-align: middle;">
                            <span style="font-size: 20px; line-height: 1; color: #FFFFFF;">🍎</span>
                          </td>
                          <td style="vertical-align: middle; text-align: left;">
                            <div style="font-size: 9px; text-transform: uppercase; color: #94A3B8; font-weight: 600; line-height: 1;">Download on the</div>
                            <div style="font-size: 13.5px; font-weight: 800; color: #FFFFFF; line-height: 1.2; margin-top: 2px;">App Store</div>
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
            <td style="padding: 0 24px 30px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F0F7FF; border: 1px solid #BAE6FD; border-radius: 16px; padding: 16px 20px;">
                <tr>
                  <td style="vertical-align: middle; width: 44px;">
                    <div style="width: 38px; height: 38px; border-radius: 50%; background-color: #0284C7; text-align: center; line-height: 38px; color: #FFFFFF; font-size: 18px;">
                      🛡️
                    </div>
                  </td>
                  <td style="vertical-align: middle; padding: 0 14px;">
                    <div style="font-size: 14.5px; font-weight: 800; color: #0A192F;">Need Help?</div>
                    <div style="font-size: 12px; color: #64748B; margin-top: 2px;">Our support team is always here for you.</div>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <a href="${supportUrl}" target="_blank" style="display: inline-block; background-color: #FEF3C7; color: #0A192F; font-size: 12px; font-weight: 800; padding: 8px 16px; border-radius: 20px; text-decoration: none; border: 1px solid #FDE047;">
                      💬 Contact Support
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 8. DIVIDER -->
          <tr>
            <td style="padding: 0 32px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="border-top: 1px solid #E2E8F0;"></td>
                  <td style="width: 170px; text-align: center; font-size: 11px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.8px; padding: 0 10px;">
                    Your Trusted Digital Partner
                  </td>
                  <td style="border-top: 1px solid #E2E8F0;"></td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 9. FOOTER BRAND & SOCIAL ICONS -->
          <tr>
            <td style="padding: 24px 32px 14px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left" style="vertical-align: middle;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right: 10px; vertical-align: middle;">
                          <div style="width: 36px; height: 36px; border-radius: 50%; background: #0A192F; border: 2px solid #EAB308; text-align: center; line-height: 36px; color: #EAB308; font-weight: 900; font-size: 15px;">
                            AM
                          </div>
                        </td>
                        <td style="vertical-align: middle;">
                          <div style="font-size: 15px; font-weight: 900; color: #0A192F;">
                            ABU MAFHAL <span style="color: #EAB308;">SUB</span>
                          </div>
                          <div style="font-size: 10.5px; color: #64748B;">Your Trusted Digital Partner</div>
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
                          <a href="https://instagram.com" target="_blank" style="display: inline-block; width: 28px; height: 28px; border-radius: 50%; background: radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%); text-align: center; line-height: 28px; color: #FFFFFF; font-size: 12px; font-weight: 900; text-decoration: none;">ig</a>
                        </td>
                        <!-- X -->
                        <td style="padding-left: 6px;">
                          <a href="https://x.com" target="_blank" style="display: inline-block; width: 28px; height: 28px; border-radius: 50%; background-color: #000000; text-align: center; line-height: 28px; color: #FFFFFF; font-size: 12px; font-weight: 900; text-decoration: none;">𝕏</a>
                        </td>
                        <!-- YouTube -->
                        <td style="padding-left: 6px;">
                          <a href="https://youtube.com" target="_blank" style="display: inline-block; width: 28px; height: 28px; border-radius: 50%; background-color: #FF0000; text-align: center; line-height: 28px; color: #FFFFFF; font-size: 11px; font-weight: 900; text-decoration: none;">▶</a>
                        </td>
                        <!-- TikTok -->
                        <td style="padding-left: 6px;">
                          <a href="https://tiktok.com" target="_blank" style="display: inline-block; width: 28px; height: 28px; border-radius: 50%; background-color: #010101; text-align: center; line-height: 28px; color: #FFFFFF; font-size: 12px; font-weight: 900; text-decoration: none;">♫</a>
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
            <td style="padding: 0 32px 28px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left" style="font-size: 11px; color: #64748B;">
                    <a href="https://abumafhal.com.ng" style="color: #64748B; text-decoration: none;">Help Center</a> &nbsp;|&nbsp;
                    <a href="https://abumafhal.com.ng/privacy" style="color: #64748B; text-decoration: none;">Privacy Policy</a> &nbsp;|&nbsp;
                    <a href="https://abumafhal.com.ng/terms" style="color: #64748B; text-decoration: none;">Terms of Service</a> &nbsp;|&nbsp;
                    <a href="https://abumafhal.com.ng/unsubscribe" style="color: #64748B; text-decoration: none;">Unsubscribe</a>
                  </td>
                  <td align="right" style="font-size: 11px; color: #64748B; font-weight: 600;">
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
        <!-- END CONTAINER -->

      </td>
    </tr>
  </table>

</body>
</html>`;
}
