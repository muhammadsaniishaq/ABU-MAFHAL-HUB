export const generateHtmlEmail = (
  body: string,
  title: string = 'Notification',
  logoUrl?: string
) => {
  const currentYear = new Date().getFullYear();

  const logoContent = logoUrl 
    ? `<img src="${logoUrl}" alt="Abu Mafhal Sub" width="32" height="32" style="display:inline-block; vertical-align:middle; border-radius:4px;" />`
    : `<div style="width:32px; height:32px; background-color:#f5a623; border-radius:4px; display:inline-block; vertical-align:middle; line-height:32px; color:#ffffff; font-size:16px; font-weight:bold;">AM</div>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>

<body style="margin:0;padding:0;background-color:#f4f6fb;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 10px; background-color:#f4f6fb;">
<tr>
<td align="center">

<!-- MAIN CONTAINER -->
<table width="600" cellpadding="0" cellspacing="0"
  style="background:#ffffff; max-width:100%; margin:0 auto; border:1px solid #e2e8f0;">

<!-- HEADER -->
<tr>
<td align="center" style="background-color:#f8fafc; padding:24px 20px; border-bottom:1px solid #e2e8f0;">
  <table cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding-right:10px;">
        ${logoContent}
      </td>
      <td align="center">
        <h1 style="margin:0; font-size:22px; font-weight:800; color:#0e1a2e; letter-spacing:0.5px;">
          Abu Mafhal Sub
        </h1>
      </td>
    </tr>
  </table>
</td>
</tr>

<!-- BODY -->
<tr>
<td style="padding:40px 40px; background-color:#ffffff;">

  <h2 style="margin:0 0 24px 0; font-size:18px; font-weight:700; color:#1e293b; text-align:center;">
    ${title}
  </h2>

  <div style="font-size:15px; color:#334155; line-height:1.6; text-align:left;">
    ${body.replace(/\n/g, '<br/>')}
  </div>

</td>
</tr>

<!-- FOOTER -->
<tr>
<td align="center" style="background-color:#0e1a2e; padding:32px 40px;">
  
  <p style="margin:0 0 16px 0; font-size:13px; color:#cbd5e1; line-height:1.5; font-style:italic;">
    Please do not reply to this email. You are receiving this email because you have an account or requested a service at <a href="#" style="color:#3b82f6; text-decoration:none;">Abu Mafhal Sub</a>.
  </p>
  
  <p style="margin:0; font-size:12px; color:#94a3b8;">
    Copyright &copy; ${currentYear} Abu Mafhal Sub. All rights reserved.
  </p>

</td>
</tr>

</table>
<!-- END MAIN CONTAINER -->

</td>
</tr>
</table>

</body>
</html>
`;
};

