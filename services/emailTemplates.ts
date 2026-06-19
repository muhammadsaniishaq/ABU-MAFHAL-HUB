export const generateHtmlEmail = (
  body: string,
  title: string = 'Notification'
) => {
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>

<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
<tr>
<td align="center">

<!-- MAIN CONTAINER -->
<table width="600" cellpadding="0" cellspacing="0"
  style="background:#ffffff;border-radius:18px;overflow:hidden;
  box-shadow:0 20px 45px rgba(0,0,0,0.08);max-width:100%;">

<!-- HEADER -->
<tr>
<td align="center"
  style="background:linear-gradient(135deg,#3B82F6,#6366F1);padding:40px 24px;">

<img
  src="https://lh3.googleusercontent.com/msqhVq_JQ6x04b9_cy87eDN3tXjT8lzXUkT_PwdVpVQWjODAAakIC0mw_G3mnOjiXT9dTkuNv6ZGSg6O=s265-w265-h265"
  alt="Abu Mafhal Hub Logo"
  width="72"
  height="72"
  style="display:block;border-radius:50%;margin-bottom:16px;"
/>

<h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">
  ABU MAFHAL HUB
</h1>

<p style="margin:8px 0 0;font-size:14px;color:#e0e7ff;">
  Secure • Fast • Reliable
</p>

</td>
</tr>

<!-- BODY -->
<tr>
<td style="padding:40px 32px;">

<h2 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0f172a;text-align:center;">
  ${title}
</h2>

<div style="font-size:16px;color:#475569;line-height:1.7;">
  ${body.replace(/\n/g, '<br/>')}
</div>

<div style="margin-top:32px;border-top:1px solid #e5e7eb;padding-top:20px;">
  <p style="font-size:14px;color:#64748b;">
    If you have any questions, please contact our support team directly via the app.
  </p>
</div>

</td>
</tr>

<!-- FOOTER -->
<tr>
<td align="center"
  style="background:#f8fafc;padding:20px;border-top:1px solid #e2e8f0;">

<p style="margin:0;font-size:12px;color:#94a3b8;">
  © ${currentYear} Abu Mafhal Hub. All rights reserved.
</p>

<p style="margin:6px 0 0;font-size:12px;color:#94a3b8;">
  Gashua, Yobe State, Nigeria
</p>

</td>
</tr>

</table>
</td>
</tr>
</table>

</body>
</html>
`;
};
