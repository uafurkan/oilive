const RESEND_API = 'https://api.resend.com';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FROM_ADDRESS = 'OILIVE <hello@oilive.co>';
const WELCOME_SUBJECT = "You're on the list.";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const raw = req.body?.email;
  const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  const headers = {
    Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  };
  const audienceId = process.env.RESEND_AUDIENCE_ID;

  try {
    const subscribed = await addToAudience(headers, audienceId, email);
    if (!subscribed) {
      return res.status(502).json({ error: 'Upstream error' });
    }

    // Position first: the welcome email carries the subscriber's number
    // ("Your place — No. N"), mirroring the hand-numbered bottles.
    const position = await getWaitlistPosition(headers, audienceId);
    await sendWelcomeEmail(headers, email, position);

    return res.status(200).json({ ok: true, position });
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
}

/**
 * Adds the contact to the Resend audience.
 * Returns true when the contact is in the audience after the call —
 * including the case where it was already registered.
 */
async function addToAudience(headers, audienceId, email) {
  const resp = await fetch(`${RESEND_API}/audiences/${audienceId}/contacts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, unsubscribed: false }),
  });
  if (resp.ok) return true;

  const detail = await resp.json().catch(() => ({}));
  return resp.status === 409 || detail.name === 'validation_error';
}

/**
 * Sends the branded welcome email. Failures are deliberately swallowed:
 * a missing email must never surface as a failed signup.
 */
function sendWelcomeEmail(headers, email, position) {
  return fetch(`${RESEND_API}/emails`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: email,
      subject: WELCOME_SUBJECT,
      html: buildWelcomeEmail(position),
    }),
  }).catch(() => null);
}

/**
 * Returns the contact's position on the waitlist (current audience size),
 * or null when it can't be determined — the caller treats null as "omit".
 */
async function getWaitlistPosition(headers, audienceId) {
  try {
    const resp = await fetch(`${RESEND_API}/audiences/${audienceId}/contacts`, {
      headers: { Authorization: headers.Authorization },
    });
    if (!resp.ok) return null;
    const { data } = await resp.json();
    return Array.isArray(data) ? data.length : null;
  } catch {
    return null;
  }
}

/**
 * Renders the welcome email. When the subscriber's waitlist position is
 * known, a "Your place — No. N" line is added under the headline,
 * echoing the hand-numbered bottles; otherwise the row is omitted.
 */
function buildWelcomeEmail(position) {
  const placeRow = Number.isInteger(position) && position > 0
    ? `
    <tr>
      <td bgcolor="#ffffff" class="oilive-card" style="text-align:center;padding:0 32px 26px;background:#ffffff;">
        <p class="oilive-ink-sub" style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:#1A1A1A99;margin:0;">
          Your place &mdash; <span class="oilive-green" style="color:#556B2F;font-weight:600;">No. ${position}</span>
        </p>
      </td>
    </tr>`
    : '';
  return WELCOME_EMAIL_TEMPLATE.replace('<!--PLACE_ROW-->', placeRow);
}

const WELCOME_EMAIL_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
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
<div class="oilive-bg" style="background:#FAFAF7;padding:64px 24px;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" bgcolor="#ffffff" class="oilive-card" style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #1A1A1A14;border-radius:2px;">
    <tr>
      <td bgcolor="#ffffff" class="oilive-card" style="text-align:center;padding:56px 40px 6px;background:#ffffff;">
        <img src="https://oilive.co/assets/oilive-logo-email.png" width="158" alt="Oilive" style="display:inline-block;height:auto;background:#ffffff;">
      </td>
    </tr>
    <tr>
      <td bgcolor="#ffffff" class="oilive-card" style="text-align:center;padding:18px 40px 30px;background:#ffffff;">
        <p class="oilive-green" style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;letter-spacing:0.38em;color:#556B2F;font-weight:600;margin:0;">
          C&nbsp;O&nbsp;M&nbsp;I&nbsp;N&nbsp;G&nbsp;&nbsp;&nbsp;S&nbsp;O&nbsp;O&nbsp;N
        </p>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:0 40px;">
        <table role="presentation" width="36" cellpadding="0" cellspacing="0" style="border-top:1px solid #556B2F55;width:36px;"><tr><td></td></tr></table>
      </td>
    </tr>
    <tr>
      <td bgcolor="#ffffff" class="oilive-card" style="text-align:center;padding:28px 40px 22px;background:#ffffff;">
        <p class="oilive-ink" style="font-size:27px;line-height:1.45;color:#1A1A1A;margin:0;letter-spacing:0.01em;">
          Something green is coming.
        </p>
      </td>
    </tr><!--PLACE_ROW-->
    <tr>
      <td bgcolor="#ffffff" class="oilive-card" style="text-align:center;padding:0 40px 44px;background:#ffffff;">
        <p class="oilive-ink-sub" style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;line-height:1.8;color:#1A1A1A99;margin:0;">
          Thank you for joining the list. You'll be the first to know<br>
          when our first pressing arrives &mdash; a single-estate, cold-extracted<br>
          olive oil from the Aegean coast of Turkey.
        </p>
      </td>
    </tr>
    <tr>
      <td bgcolor="#ffffff" class="oilive-card" style="text-align:center;padding:32px 40px 52px;background:#ffffff;border-top:1px solid #1A1A1A0F;">
        <p class="oilive-ink-foot" style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:13px;letter-spacing:0.02em;color:#1A1A1A88;margin:26px 0 0;">
          &mdash; The Oilive Team
        </p>
      </td>
    </tr>
  </table>
  <p style="text-align:center;font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;letter-spacing:0.15em;color:#1A1A1A55;margin:28px 0 0;">
    OILIVE &nbsp;&middot;&nbsp; AEGEAN COAST, TURKEY
  </p>
</div>
</body>
</html>
`;
