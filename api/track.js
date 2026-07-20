const GEO_API = 'http://ip-api.com/json';
const TELEGRAM_API = 'https://api.telegram.org';
const BOT_NAME = 'OILIVE';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Always respond fast — this is a fire-and-forget beacon from the client.
  res.status(204).end();

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    const ip = getClientIp(req);
    const ua = req.headers['user-agent'] || '';
    const page = typeof req.body?.page === 'string' ? req.body.page : '/';
    const referrer = typeof req.body?.referrer === 'string' ? req.body.referrer : '';

    if (isKnownBot(ua)) return;

    const geo = await lookupGeo(ip);
    const message = buildMessage({ ip, ua, page, referrer, geo });
    await sendTelegramMessage(token, chatId, message);
  } catch {
    // Never let tracking failures affect the visitor's experience.
  }
}

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || '';
}

function isKnownBot(ua) {
  return /bot|spider|crawler|slurp|facebookexternalhit|vercel-screenshot/i.test(ua);
}

async function lookupGeo(ip) {
  if (!ip || ip === '::1' || ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('192.168.')) {
    return null;
  }
  const fields = 'status,country,countryCode,regionName,city,lat,lon,isp,org,query';
  const resp = await fetch(`${GEO_API}/${encodeURIComponent(ip)}?fields=${fields}`);
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.status === 'success' ? data : null;
}

function buildMessage({ ip, ua, page, referrer, geo }) {
  const flag = geo?.countryCode ? countryFlag(geo.countryCode) : '🌍';
  const location = geo
    ? `${flag} ${[geo.city, geo.regionName, geo.country].filter(Boolean).join(', ')}`
    : `${flag} Unknown location`;
  const network = geo?.isp || geo?.org || 'Unknown network';
  const device = parseDevice(ua);
  const source = referrer ? shortenUrl(referrer) : 'Direkt / URL';
  const timestamp = formatIstanbulTime(new Date());
  const mapLine = geo?.lat && geo?.lon
    ? `\n🗺 Haritada gör (https://maps.google.com/?q=${geo.lat},${geo.lon})`
    : '';

  return (
    `👁 ${BOT_NAME} Ziyareti\n\n` +
    `📍 ${location}\n` +
    `🌐 ${network}\n` +
    `📱 ${device}\n` +
    `🔗 ${source}\n` +
    `📄 ${page}\n` +
    `⏰ ${timestamp}` +
    mapLine +
    (ip ? `\n${ip}` : '')
  );
}

function countryFlag(countryCode) {
  const code = countryCode.toUpperCase();
  if (code.length !== 2) return '🌍';
  const points = [...code].map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...points);
}

function parseDevice(ua) {
  let os = 'Unknown OS';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/iphone|ipad|ios/i.test(ua)) os = 'iOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/mac os x/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  let browser = 'Unknown browser';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/chrome\//i.test(ua)) browser = 'Chrome';
  else if (/safari\//i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/firefox\//i.test(ua)) browser = 'Firefox';

  return `${browser}/${os}`;
}

function shortenUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function formatIstanbulTime(date) {
  const parts = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

function sendTelegramMessage(token, chatId, text) {
  return fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  }).catch(() => null);
}
