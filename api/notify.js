export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;

  try {
    const resp = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, unsubscribed: false }),
    });

    if (!resp.ok) {
      const detail = await resp.json().catch(() => ({}));
      const alreadyRegistered = resp.status === 409 || detail.name === 'validation_error';
      if (!alreadyRegistered) {
        return res.status(502).json({ error: 'Upstream error' });
      }
    }

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'OILIVE <onboarding@resend.dev>',
        to: email,
        subject: "You're on the list.",
        html: welcomeEmailHtml,
      }),
    }).catch(function () {});

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

const welcomeEmailHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<style>
  :root { color-scheme: light; supported-color-schemes: light; }
  body, .oilive-bg { background:#FAFAF7 !important; }
  .oilive-card { background:#ffffff !important; }
  .oilive-ink { color:#1A1A1A !important; }
  .oilive-ink-sub { color:#1A1A1A99 !important; }
  .oilive-ink-foot { color:#1A1A1A66 !important; }
  .oilive-green { color:#556B2F !important; }
  @media (prefers-color-scheme: dark) {
    body, .oilive-bg { background:#FAFAF7 !important; }
    .oilive-card { background:#ffffff !important; }
    .oilive-ink { color:#1A1A1A !important; }
    .oilive-ink-sub { color:#1A1A1A99 !important; }
    .oilive-ink-foot { color:#1A1A1A66 !important; }
    .oilive-green { color:#556B2F !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#FAFAF7;">
<div class="oilive-bg" style="background:#FAFAF7;padding:56px 24px;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" bgcolor="#ffffff" class="oilive-card" style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #1A1A1A14;border-radius:4px;">
    <tr>
      <td bgcolor="#ffffff" class="oilive-card" style="text-align:center;padding:48px 32px 8px;background:#ffffff;">
        <img src="https://oilives.vercel.app/assets/oilive-logo-email.png" width="170" alt="Oilive" style="display:inline-block;height:auto;background:#ffffff;">
      </td>
    </tr>
    <tr>
      <td bgcolor="#ffffff" class="oilive-card" style="text-align:center;padding:16px 32px 28px;background:#ffffff;">
        <p class="oilive-green" style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;letter-spacing:0.35em;text-transform:uppercase;color:#556B2F;font-weight:600;margin:0;">
          Coming Soon
        </p>
      </td>
    </tr>
    <tr>
      <td bgcolor="#ffffff" class="oilive-card" style="text-align:center;padding:0 32px 24px;background:#ffffff;">
        <p class="oilive-ink" style="font-size:26px;line-height:1.4;color:#1A1A1A;margin:0;">
          Something green is coming.
        </p>
      </td>
    </tr>
    <tr>
      <td bgcolor="#ffffff" class="oilive-card" style="text-align:center;padding:0 32px 40px;background:#ffffff;">
        <p class="oilive-ink-sub" style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;line-height:1.7;color:#1A1A1A99;margin:0;">
          Thank you for joining the list. You'll be the first to know<br>
          when our first pressing arrives &mdash; a single-estate, cold-extracted<br>
          olive oil from the Aegean coast of Turkey.
        </p>
      </td>
    </tr>
    <tr>
      <td bgcolor="#ffffff" class="oilive-card" style="text-align:center;padding:0 32px 48px;background:#ffffff;border-top:1px solid #1A1A1A0F;">
        <p class="oilive-ink-foot" style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#1A1A1A66;margin:24px 0 0;">
          &mdash; The Oilive Team
        </p>
      </td>
    </tr>
  </table>
</div>
</body>
</html>
`;
