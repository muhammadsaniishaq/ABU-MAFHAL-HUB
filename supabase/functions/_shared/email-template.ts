/**
 * ABU MAFHAL SUB - Ultra-Premium Fintech Email Template v6.0
 * Pixel-Perfect Design Matching Official Reference
 * Clean Multi-Section Architecture · Table-Based · Light-Mode Enforced · Real SVG Icons
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
    const currentYear   = new Date().getFullYear();
    const recipientName = options.recipientName    || 'Valued Customer';
    const headlineBadge = options.headlineBadge    || 'Welcome Aboard';
    const headlineTitle = options.headlineTitle    || 'Your Digital Life, Simplified';
    const headlineSubtitle = options.headlineSubtitle || 'Fast, secure and affordable digital services in one app.';
    const greeting      = options.greeting         || `Hi ${recipientName} \u{1F44B}`;
    const messageBody   = options.messageBody      || `Welcome to <strong>ABU MAFHAL SUB</strong>! We\u2019re excited to have you on board. You can now enjoy fast, secure and affordable digital services all in one app.`;
    const buttonText    = options.buttonText       || 'Open ABU MAFHAL SUB &rarr;';
    const buttonUrl     = options.buttonUrl        || 'https://abumafhal.com.ng';
    const supportUrl    = options.supportUrl       || 'https://wa.me/2348083833077';
    const playStoreUrl  = 'https://play.google.com/store/apps/details?id=com.muhammmadsaniishaq.abumafhalsub';

    // Publicly accessible CDN assets via GitHub Raw
    const logoUrl  = 'https://raw.githubusercontent.com/muhammadsaniishaq/ABU-MAFHAL-HUB/main/assets/images/logo.png';
    const phoneUrl = 'https://raw.githubusercontent.com/muhammadsaniishaq/ABU-MAFHAL-HUB/main/assets/images/splash_hub_phone_3d.png';

    // ─── Inline SVG Icons (safe for email clients) ───────────────
    const icoPhone = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`;
    const icoWifi  = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366F1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>`;
    const icoWallet= `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>`;
    const icoSim   = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/></svg>`;
    const icoShield= `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
    const icoChat  = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0A192F" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
    const icoGlobe = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
    const icoPlay  = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" fill="#34D399"/></svg>`;
    const icoApple = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="17" viewBox="0 0 814 1000"><path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.5-167.2-37.5c-62.2 0-107.1-56.1-155.5-127.5C35.7 739.4-3.7 604.2-3.7 478.9c0-202.5 134.2-309.4 264.6-309.4 68.7 0 126.2 45.3 169.5 45.3 42 0 107.8-48 185.2-48 29.9 0 108.2 2.6 168.1 61.4zm-119.7-220.4c31.7-37.5 54.4-89.7 54.4-141.9 0-7.1-.6-14.3-1.9-20.1-51.6 1.9-113.4 34.4-149.8 75.8-28.5 32.4-55.1 84.7-55.1 137.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 46.5 0 102.8-31.1 136.9-70.7z" fill="#FFFFFF"/></svg>`;

    // Social Media Icons
    const icoFB = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#FFFFFF"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>`;
    const icoIG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>`;
    const icoX  = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="#FFFFFF"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.26 5.632 5.904-5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;
    const icoYT = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 24 24"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" fill="#FF0000"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#FFFFFF"/></svg>`;
    const icoTT = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="15" viewBox="0 0 24 24" fill="#FFFFFF"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.73a4.85 4.85 0 0 1-1.01-.04z"/></svg>`;

    // Trust & Feature Icons
    const icoBolt  = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EAB308" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
    const icoLock  = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
    const icoUsers = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366F1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;

    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>ABU MAFHAL SUB</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style type="text/css">
    :root { color-scheme: light; supported-color-schemes: light; }
    html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #EEF2F7 !important; -webkit-font-smoothing: antialiased; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; }
    table, td { border-collapse: collapse !important; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; display: block; }
    a { text-decoration: none; }
    @media (prefers-color-scheme: dark) {
      body, .outer-bg { background-color: #EEF2F7 !important; }
      .card-bg { background-color: #FFFFFF !important; color: #0A192F !important; }
    }
    @media only screen and (max-width: 600px) {
      .card-wrap { width: 100% !important; border-radius: 0 !important; }
      .hpad { padding-left: 18px !important; padding-right: 18px !important; }
      .hero-left { padding: 26px 18px 24px !important; width: 100% !important; display: block !important; }
      .hero-phone-col { display: none !important; width: 0 !important; overflow: hidden !important; }
      .svc-td { width: 50% !important; display: inline-block !important; }
      .trust-td { width: 100% !important; display: block !important; padding-bottom: 10px !important; }
    }
  </style>
</head>
<body class="outer-bg" style="margin:0;padding:24px 0;background-color:#EEF2F7;">

  <!-- Preheader text (hidden) -->
  <div style="display:none;font-size:1px;color:#EEF2F7;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${headlineTitle} &mdash; ABU MAFHAL SUB | Your Trusted Digital Partner &#847; &#847; &#847;</div>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#EEF2F7;">
    <tr><td align="center" style="padding:0 12px;">

      <!-- ╔══════════════════════════════════════╗ -->
      <!-- ║         600px MAIN EMAIL CARD        ║ -->
      <!-- ╚══════════════════════════════════════╝ -->
      <table role="presentation" class="card-wrap" border="0" cellpadding="0" cellspacing="0" width="600"
        style="max-width:600px;width:100%;background-color:#FFFFFF;border-radius:24px;overflow:hidden;
               box-shadow:0 20px 60px rgba(10,25,60,0.13);border:1px solid #DDE3EE;">

        <!-- ══════════════════════════════════════ -->
        <!--           1. HEADER BAR               -->
        <!-- ══════════════════════════════════════ -->
        <tr><td class="hpad card-bg" style="padding:22px 30px 18px;background-color:#FFFFFF;border-bottom:1px solid #F0F4FA;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <!-- Brand: Logo + Name -->
              <td style="vertical-align:middle;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-right:12px;vertical-align:middle;">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0"
                        style="width:48px;height:48px;border-radius:50%;
                               border:2px solid #EAB308;
                               box-shadow:0 4px 14px rgba(234,179,8,0.36);
                               overflow:hidden;background:#0A192F;">
                        <tr><td align="center" style="vertical-align:middle;">
                          <img src="${logoUrl}" width="44" height="44" alt="ABU MAFHAL SUB"
                            style="width:44px;height:44px;border-radius:50%;" />
                        </td></tr>
                      </table>
                    </td>
                    <td style="vertical-align:middle;">
                      <div style="font-size:18px;font-weight:900;color:#0A192F;letter-spacing:-0.2px;line-height:1.15;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">ABU MAFHAL <span style="color:#EAB308;">SUB</span></div>
                      <div style="font-size:10px;font-weight:600;color:#94A3B8;margin-top:2px;letter-spacing:0.5px;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">Your Trusted Digital Partner</div>
                    </td>
                  </tr>
                </table>
              </td>
              <!-- Tagline right -->
              <td align="right" style="vertical-align:middle;">
                <div style="font-size:11.5px;font-weight:600;color:#64748B;letter-spacing:0.3px;white-space:nowrap;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">Simple &nbsp;&middot;&nbsp; Secure &nbsp;&middot;&nbsp; Reliable</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- ══════════════════════════════════════ -->
        <!--           2. HERO BANNER              -->
        <!-- ══════════════════════════════════════ -->
        <tr><td class="hpad" style="padding:18px 24px 0;background-color:#FFFFFF;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
            style="background:linear-gradient(135deg,#050D1F 0%,#0A1E45 50%,#102D6A 100%);
                   border-radius:20px;overflow:hidden;
                   box-shadow:0 16px 48px rgba(5,13,31,0.5);">
            <tr>
              <!-- Hero LEFT: Badge + Title + Subtitle -->
              <td class="hero-left" style="padding:34px 10px 32px 30px;vertical-align:middle;width:58%;">
                <!-- Gold Badge Pill -->
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                  <tr><td style="background:linear-gradient(90deg,#F59E0B,#EAB308);border-radius:30px;
                                 padding:6px 16px;box-shadow:0 4px 14px rgba(245,158,11,0.45);">
                    <span style="font-size:11.5px;font-weight:900;color:#071329;letter-spacing:0.3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">&#10022; ${headlineBadge}</span>
                  </td></tr>
                </table>
                <!-- Headline Title -->
                <div style="font-size:27px;font-weight:900;color:#FFFFFF;line-height:1.2;
                            letter-spacing:-0.5px;margin-bottom:10px;
                            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">${headlineTitle}</div>
                <!-- Gold accent underline -->
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
                  <tr>
                    <td style="width:42px;height:3px;background:linear-gradient(90deg,#EAB308,#F59E0B);border-radius:2px;"></td>
                    <td style="width:6px;"></td>
                    <td style="width:16px;height:3px;background:rgba(255,255,255,0.18);border-radius:2px;"></td>
                  </tr>
                </table>
                <!-- Subtitle -->
                <div style="font-size:13px;color:#94A3B8;line-height:1.6;font-weight:400;
                            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">${headlineSubtitle}</div>
              </td>
              <!-- Hero RIGHT: 3D Phone Image -->
              <td class="hero-phone-col" style="vertical-align:bottom;padding:0;width:42%;text-align:center;" align="center">
                <img src="${phoneUrl}" width="185" alt="ABU MAFHAL SUB App"
                  style="width:185px;height:auto;display:block;margin:0 auto;vertical-align:bottom;" />
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- ══════════════════════════════════════ -->
        <!--       3. GREETING & MESSAGE CARD      -->
        <!-- ══════════════════════════════════════ -->
        <tr><td class="hpad card-bg" style="padding:28px 32px 14px;background-color:#FFFFFF;">
          <div style="font-size:21px;font-weight:900;color:#0A192F;margin-bottom:10px;letter-spacing:-0.2px;
                      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">${greeting}</div>
          <div style="font-size:15px;line-height:1.75;color:#475569;font-weight:400;
                      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">${messageBody}</div>
        </td></tr>

        <!-- ══════════════════════════════════════ -->
        <!--    4. WHY CHOOSE US (TRUST STATS)     -->
        <!-- ══════════════════════════════════════ -->
        <tr><td class="hpad" style="padding:4px 24px 16px;background-color:#FFFFFF;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
            style="background:#F1F5F9;border-radius:14px;border:1px solid #E2E8F0;padding:12px 16px;">
            <tr>
              <!-- Stat 1: Instant -->
              <td class="trust-td" style="vertical-align:middle;width:33.33%;padding:6px 8px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-right:8px;vertical-align:middle;">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0"
                        style="width:32px;height:32px;border-radius:8px;background:#FEF3C7;text-align:center;">
                        <tr><td align="center" style="vertical-align:middle;">${icoBolt}</td></tr>
                      </table>
                    </td>
                    <td style="vertical-align:middle;">
                      <div style="font-size:12px;font-weight:800;color:#0A192F;line-height:1.1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">Instant Delivery</div>
                      <div style="font-size:10px;color:#64748B;margin-top:2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">Under 10 seconds</div>
                    </td>
                  </tr>
                </table>
              </td>
              <!-- Stat 2: Secure -->
              <td class="trust-td" style="vertical-align:middle;width:33.33%;padding:6px 8px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-right:8px;vertical-align:middle;">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0"
                        style="width:32px;height:32px;border-radius:8px;background:#DCFCE7;text-align:center;">
                        <tr><td align="center" style="vertical-align:middle;">${icoLock}</td></tr>
                      </table>
                    </td>
                    <td style="vertical-align:middle;">
                      <div style="font-size:12px;font-weight:800;color:#0A192F;line-height:1.1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">100% Secure</div>
                      <div style="font-size:10px;color:#64748B;margin-top:2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">Encrypted wallet</div>
                    </td>
                  </tr>
                </table>
              </td>
              <!-- Stat 3: 24/7 -->
              <td class="trust-td" style="vertical-align:middle;width:33.33%;padding:6px 8px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-right:8px;vertical-align:middle;">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0"
                        style="width:32px;height:32px;border-radius:8px;background:#EEF2FF;text-align:center;">
                        <tr><td align="center" style="vertical-align:middle;">${icoUsers}</td></tr>
                      </table>
                    </td>
                    <td style="vertical-align:middle;">
                      <div style="font-size:12px;font-weight:800;color:#0A192F;line-height:1.1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">24/7 Support</div>
                      <div style="font-size:10px;color:#64748B;margin-top:2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">Always active</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- ══════════════════════════════════════ -->
        <!--       5. SERVICE FEATURE CARDS        -->
        <!-- ══════════════════════════════════════ -->
        <tr><td class="hpad" style="padding:10px 24px 24px;background-color:#FFFFFF;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
            style="background:#F8FAFF;border-radius:18px;border:1.5px solid #E4EAF8;
                   box-shadow:inset 0 1px 4px rgba(99,102,241,0.05);">
            <!-- Section label -->
            <tr><td colspan="4" style="padding:14px 20px 4px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <div style="font-size:10.5px;font-weight:800;color:#0A192F;text-transform:uppercase;
                                letter-spacing:1.2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">Popular Services</div>
                  </td>
                  <td align="right">
                    <span style="font-size:10px;color:#6366F1;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">All in one app &bull;</span>
                  </td>
                </tr>
              </table>
            </td></tr>
            <!-- 4 circular service icons -->
            <tr>
              <!-- Airtime -->
              <td class="svc-td" align="center" style="padding:10px 6px 20px;vertical-align:top;width:25%;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center">
                  <tr><td align="center">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0"
                      style="width:54px;height:54px;border-radius:50%;
                             background:linear-gradient(135deg,#FEF3C7,#FDE68A);
                             box-shadow:0 5px 16px rgba(245,158,11,0.28);">
                      <tr><td align="center" style="vertical-align:middle;">${icoPhone}</td></tr>
                    </table>
                  </td></tr>
                  <tr><td align="center" style="padding-top:9px;">
                    <div style="font-size:13px;font-weight:800;color:#0A192F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">Airtime</div>
                    <div style="font-size:10px;color:#94A3B8;margin-top:2px;font-weight:500;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">Top up instantly</div>
                  </td></tr>
                </table>
              </td>
              <!-- Data -->
              <td class="svc-td" align="center" style="padding:10px 6px 20px;vertical-align:top;width:25%;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center">
                  <tr><td align="center">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0"
                      style="width:54px;height:54px;border-radius:50%;
                             background:linear-gradient(135deg,#EEF2FF,#C7D2FE);
                             box-shadow:0 5px 16px rgba(99,102,241,0.24);">
                      <tr><td align="center" style="vertical-align:middle;">${icoWifi}</td></tr>
                    </table>
                  </td></tr>
                  <tr><td align="center" style="padding-top:9px;">
                    <div style="font-size:13px;font-weight:800;color:#0A192F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">Data</div>
                    <div style="font-size:10px;color:#94A3B8;margin-top:2px;font-weight:500;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">Stay connected</div>
                  </td></tr>
                </table>
              </td>
              <!-- Wallet -->
              <td class="svc-td" align="center" style="padding:10px 6px 20px;vertical-align:top;width:25%;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center">
                  <tr><td align="center">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0"
                      style="width:54px;height:54px;border-radius:50%;
                             background:linear-gradient(135deg,#DCFCE7,#A7F3D0);
                             box-shadow:0 5px 16px rgba(16,185,129,0.24);">
                      <tr><td align="center" style="vertical-align:middle;">${icoWallet}</td></tr>
                    </table>
                  </td></tr>
                  <tr><td align="center" style="padding-top:9px;">
                    <div style="font-size:13px;font-weight:800;color:#0A192F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">Wallet</div>
                    <div style="font-size:10px;color:#94A3B8;margin-top:2px;font-weight:500;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">Safe &amp; secure</div>
                  </td></tr>
                </table>
              </td>
              <!-- SIM -->
              <td class="svc-td" align="center" style="padding:10px 6px 20px;vertical-align:top;width:25%;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center">
                  <tr><td align="center">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0"
                      style="width:54px;height:54px;border-radius:50%;
                             background:linear-gradient(135deg,#E0F2FE,#BAE6FD);
                             box-shadow:0 5px 16px rgba(14,165,233,0.24);">
                      <tr><td align="center" style="vertical-align:middle;">${icoSim}</td></tr>
                    </table>
                  </td></tr>
                  <tr><td align="center" style="padding-top:9px;">
                    <div style="font-size:13px;font-weight:800;color:#0A192F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">SIM</div>
                    <div style="font-size:10px;color:#94A3B8;margin-top:2px;font-weight:500;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">Buy &amp; manage</div>
                  </td></tr>
                </table>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- ══════════════════════════════════════ -->
        <!--           6. GOLD CTA BUTTON          -->
        <!-- ══════════════════════════════════════ -->
        <tr><td align="center" class="hpad" style="padding:0 32px 18px;background-color:#FFFFFF;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0">
            <tr><td align="center"
              style="background:linear-gradient(135deg,#F59E0B,#D97706);
                     border-radius:50px;
                     box-shadow:0 10px 32px rgba(217,119,6,0.5),0 3px 8px rgba(217,119,6,0.28);">
              <a href="${buttonUrl}" target="_blank"
                style="display:inline-block;padding:16px 58px;font-size:16px;font-weight:900;
                       color:#071329;text-decoration:none;letter-spacing:0.2px;white-space:nowrap;
                       font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
                ${buttonText}
              </a>
            </td></tr>
          </table>
        </td></tr>

        <!-- ══════════════════════════════════════ -->
        <!--         7. APP STORE BADGES           -->
        <!-- ══════════════════════════════════════ -->
        <tr><td align="center" class="hpad" style="padding:0 32px 28px;background-color:#FFFFFF;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0">
            <tr>
              <!-- Google Play -->
              <td style="padding-right:10px;">
                <a href="${playStoreUrl}" target="_blank" style="display:inline-block;text-decoration:none;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0"
                    style="background:#0F1117;border-radius:12px;border:1px solid #1E3A5F;
                           box-shadow:0 4px 18px rgba(0,0,0,0.38);overflow:hidden;">
                    <tr><td style="padding:11px 20px;">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="padding-right:10px;vertical-align:middle;">${icoPlay}</td>
                          <td style="vertical-align:middle;">
                            <div style="font-size:8px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.7px;line-height:1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">GET IT ON</div>
                            <div style="font-size:14.5px;font-weight:800;color:#FFFFFF;line-height:1.2;margin-top:2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">Google Play</div>
                          </td>
                        </tr>
                      </table>
                    </td></tr>
                  </table>
                </a>
              </td>
              <!-- App Store -->
              <td>
                <a href="https://abumafhal.com.ng" target="_blank" style="display:inline-block;text-decoration:none;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0"
                    style="background:#0F1117;border-radius:12px;border:1px solid #1E3A5F;
                           box-shadow:0 4px 18px rgba(0,0,0,0.38);overflow:hidden;">
                    <tr><td style="padding:11px 20px;">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="padding-right:10px;vertical-align:middle;">${icoApple}</td>
                          <td style="vertical-align:middle;">
                            <div style="font-size:8px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.7px;line-height:1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">DOWNLOAD ON THE</div>
                            <div style="font-size:14.5px;font-weight:800;color:#FFFFFF;line-height:1.2;margin-top:2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">App Store</div>
                          </td>
                        </tr>
                      </table>
                    </td></tr>
                  </table>
                </a>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- ══════════════════════════════════════ -->
        <!--          8. SUPPORT CARD              -->
        <!-- ══════════════════════════════════════ -->
        <tr><td class="hpad" style="padding:0 24px 28px;background-color:#FFFFFF;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
            style="background:linear-gradient(135deg,#FFFBEB,#FEF3C7);
                   border:1.5px solid #FDE68A;border-radius:18px;
                   box-shadow:0 4px 18px rgba(245,158,11,0.1);">
            <tr>
              <!-- Gold Shield Icon -->
              <td style="vertical-align:middle;padding:16px 0 16px 18px;width:52px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0"
                  style="width:44px;height:44px;border-radius:13px;
                         background:linear-gradient(135deg,#F59E0B,#D97706);
                         box-shadow:0 4px 14px rgba(217,119,6,0.4);">
                  <tr><td align="center" style="vertical-align:middle;">${icoShield}</td></tr>
                </table>
              </td>
              <!-- Text -->
              <td style="vertical-align:middle;padding:16px 10px;">
                <div style="font-size:14.5px;font-weight:800;color:#0A192F;margin-bottom:2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">Need Help?</div>
                <div style="font-size:11.5px;color:#64748B;font-weight:400;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">Our support team is always here for you.</div>
              </td>
              <!-- Contact Support Button -->
              <td align="right" style="vertical-align:middle;padding:16px 18px 16px 0;">
                <a href="${supportUrl}" target="_blank"
                  style="display:inline-block;text-decoration:none;
                         background:#FFFFFF;border:1.5px solid #FDE047;
                         border-radius:24px;padding:10px 18px;
                         box-shadow:0 2px 10px rgba(245,158,11,0.18);">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding-right:6px;vertical-align:middle;">${icoChat}</td>
                      <td style="vertical-align:middle;font-size:12px;font-weight:900;color:#0A192F;white-space:nowrap;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">Contact Support</td>
                    </tr>
                  </table>
                </a>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- ══════════════════════════════════════ -->
        <!--           9. DIVIDER                  -->
        <!-- ══════════════════════════════════════ -->
        <tr><td class="hpad" style="padding:0 32px 6px;background-color:#FFFFFF;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="border-top:1.5px solid #F0F4FA;height:1px;"></td>
              <td style="padding:0 14px;white-space:nowrap;">
                <div style="font-size:10px;font-weight:700;color:#CBD5E1;text-transform:uppercase;
                            letter-spacing:1px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">&nbsp;Your Trusted Digital Partner&nbsp;</div>
              </td>
              <td style="border-top:1.5px solid #F0F4FA;height:1px;"></td>
            </tr>
          </table>
        </td></tr>

        <!-- ══════════════════════════════════════ -->
        <!--       10. FOOTER: BRAND + SOCIAL      -->
        <!-- ══════════════════════════════════════ -->
        <tr><td class="hpad card-bg" style="padding:18px 30px 14px;background-color:#FFFFFF;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <!-- Brand identity left -->
              <td style="vertical-align:middle;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-right:10px;vertical-align:middle;">
                      <img src="${logoUrl}" width="34" height="34" alt="ABU MAFHAL SUB"
                        style="width:34px;height:34px;border-radius:50%;
                               border:2px solid #EAB308;
                               box-shadow:0 3px 10px rgba(234,179,8,0.3);" />
                    </td>
                    <td style="vertical-align:middle;">
                      <div style="font-size:14px;font-weight:900;color:#0A192F;line-height:1.15;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">ABU MAFHAL <span style="color:#EAB308;">SUB</span></div>
                      <div style="font-size:9.5px;color:#94A3B8;margin-top:2px;font-weight:500;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">Your Trusted Digital Partner</div>
                    </td>
                  </tr>
                </table>
              </td>
              <!-- Social icons right (real SVG vectors) -->
              <td align="right" style="vertical-align:middle;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-left:6px;">
                      <a href="https://facebook.com" target="_blank"
                        style="display:inline-block;width:30px;height:30px;border-radius:8px;
                               background:#1877F2;text-align:center;line-height:32px;
                               text-decoration:none;box-shadow:0 2px 8px rgba(24,119,242,0.36);padding-top:2px;">${icoFB}</a>
                    </td>
                    <td style="padding-left:6px;">
                      <a href="https://instagram.com" target="_blank"
                        style="display:inline-block;width:30px;height:30px;border-radius:8px;
                               background:radial-gradient(circle at 30% 107%,#fdf497 0%,#fd5949 45%,#d6249f 60%,#285AEB 90%);
                               text-align:center;line-height:32px;text-decoration:none;
                               box-shadow:0 2px 8px rgba(214,36,159,0.32);padding-top:2px;">${icoIG}</a>
                    </td>
                    <td style="padding-left:6px;">
                      <a href="https://x.com" target="_blank"
                        style="display:inline-block;width:30px;height:30px;border-radius:8px;
                               background:#000000;text-align:center;line-height:32px;
                               text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,0.28);padding-top:2px;">${icoX}</a>
                    </td>
                    <td style="padding-left:6px;">
                      <a href="https://youtube.com" target="_blank"
                        style="display:inline-block;width:30px;height:30px;border-radius:8px;
                               background:#FFFFFF;text-align:center;line-height:32px;
                               text-decoration:none;box-shadow:0 2px 8px rgba(255,0,0,0.3);padding-top:2px;">${icoYT}</a>
                    </td>
                    <td style="padding-left:6px;">
                      <a href="https://tiktok.com" target="_blank"
                        style="display:inline-block;width:30px;height:30px;border-radius:8px;
                               background:#010101;text-align:center;line-height:32px;
                               text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,0.26);padding-top:2px;">${icoTT}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- ══════════════════════════════════════ -->
        <!--        11. LEGAL & COPYRIGHT          -->
        <!-- ══════════════════════════════════════ -->
        <tr><td class="hpad card-bg" style="padding:0 30px 26px;background-color:#FFFFFF;border-top:1px solid #F0F4FA;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr><td style="padding-top:14px;">
              <div style="font-size:11px;color:#94A3B8;margin-bottom:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
                <a href="https://abumafhal.com.ng" style="color:#64748B;text-decoration:none;font-weight:600;">Help Center</a>
                &nbsp;<span style="color:#CBD5E1;">|</span>&nbsp;
                <a href="https://abumafhal.com.ng/privacy" style="color:#64748B;text-decoration:none;font-weight:600;">Privacy Policy</a>
                &nbsp;<span style="color:#CBD5E1;">|</span>&nbsp;
                <a href="https://abumafhal.com.ng/terms" style="color:#64748B;text-decoration:none;font-weight:600;">Terms of Service</a>
                &nbsp;<span style="color:#CBD5E1;">|</span>&nbsp;
                <a href="https://abumafhal.com.ng/unsubscribe" style="color:#64748B;text-decoration:none;font-weight:600;">Unsubscribe</a>
              </div>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="font-size:10.5px;color:#94A3B8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">&copy; ${currentYear} ABU MAFHAL SUB. All rights reserved.</td>
                  <td align="right">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right:4px;vertical-align:middle;">${icoGlobe}</td>
                        <td style="vertical-align:middle;"><a href="https://abumafhal.com.ng" style="font-size:10.5px;color:#0A192F;font-weight:700;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">abumafhal.com.ng</a></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </td></tr>

      </table><!-- END 600px CARD -->

    </td></tr>
  </table>

</body>
</html>`;
}
