const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3001;

// When bundled with pkg, __dirname points inside a read-only virtual
// snapshot, so writable runtime data must live next to the actual
// executable on disk instead.
const IS_PACKAGED = typeof process.pkg !== 'undefined';
const RUNTIME_DIR = IS_PACKAGED ? path.dirname(process.execPath) : __dirname;

const DATA_DIR = path.join(RUNTIME_DIR, 'data');
const SAVED_DATA_PATH = path.join(DATA_DIR, 'saved-template.json');
const DEFAULT_TEMPLATE_PATH = path.join(__dirname, 'default-template.json');

function readDefaultTemplate() {
  try {
    return JSON.parse(fs.readFileSync(DEFAULT_TEMPLATE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function readSavedData() {
  try {
    return JSON.parse(fs.readFileSync(SAVED_DATA_PATH, 'utf8'));
  } catch {
    // No instance-specific save yet — fall back to the shipped template
    // defaults (never contains credentials; those always start blank).
    return readDefaultTemplate();
  }
}

function writeSavedData(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SAVED_DATA_PATH, JSON.stringify(data, null, 2), { mode: 0o600 });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_MIN_DELAY_MS = 3000;
const DEFAULT_MAX_DELAY_MS = 10000;
const MIN_SEND_DELAY_MS = 500;
const MAX_SEND_DELAY_MS = 300000;
const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function safeColor(color, fallback) {
  return HEX_COLOR_RE.test(color || '') ? color : fallback;
}

function resolveDelayRangeMs(delayMinSeconds, delayMaxSeconds) {
  let minMs = Number(delayMinSeconds) * 1000;
  let maxMs = Number(delayMaxSeconds) * 1000;
  if (!Number.isFinite(minMs)) minMs = DEFAULT_MIN_DELAY_MS;
  if (!Number.isFinite(maxMs)) maxMs = DEFAULT_MAX_DELAY_MS;
  minMs = Math.min(Math.max(minMs, MIN_SEND_DELAY_MS), MAX_SEND_DELAY_MS);
  maxMs = Math.min(Math.max(maxMs, MIN_SEND_DELAY_MS), MAX_SEND_DELAY_MS);
  if (minMs > maxMs) [minMs, maxMs] = [maxMs, minMs];
  return { minMs, maxMs };
}

function randomDelayMs(minMs, maxMs) {
  return Math.round(minMs + Math.random() * (maxMs - minMs));
}

function safeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function requireAccessCode(req, res, next) {
  const user = process.env.ACCESS_USER;
  const pass = process.env.ACCESS_PASSWORD;
  if (!user || !pass) return next(); // no gate configured (e.g. local dev)

  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const sepIndex = decoded.indexOf(':');
    const reqUser = decoded.slice(0, sepIndex);
    const reqPass = decoded.slice(sepIndex + 1);
    if (safeEqual(reqUser, user) && safeEqual(reqPass, pass)) {
      return next();
    }
  }
  res.set('WWW-Authenticate', 'Basic realm="Gmail Bulk Sender"');
  res.status(401).send('Authentication required.');
}

app.use(requireAccessCode);
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/saved-data', (req, res) => {
  res.json(readSavedData());
});

app.post('/api/saved-data', (req, res) => {
  writeSavedData(req.body || {});
  res.json({ ok: true });
});

app.delete('/api/saved-data', (req, res) => {
  try {
    fs.unlinkSync(SAVED_DATA_PATH);
  } catch {}
  res.json({ ok: true });
});

function parseRecipients(raw) {
  if (!raw) return [];
  const list = Array.isArray(raw)
    ? raw.map((item) => (typeof item === 'object' && item ? item : { email: item }))
    : String(raw).split(/[\n,]/).map((email) => ({ email }));
  const seen = new Set();
  const result = [];
  for (const item of list) {
    const email = String(item.email || '').trim();
    const handle = String(item.handle || '').trim();
    if (!email || seen.has(email.toLowerCase())) continue;
    seen.add(email.toLowerCase());
    result.push({ email, handle });
  }
  return result;
}

function applySubjectTemplate(template, handle) {
  const subject = template || '';
  if (!subject.includes('{handle}')) return subject;
  return subject.split('{handle}').join(handle || '');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidUrl(str) {
  if (!str) return false;
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const SOCIAL_ICONS = {
  facebook: 'https://img.icons8.com/ios-filled/50/555555/facebook-new.png',
  youtube: 'https://img.icons8.com/ios-filled/50/555555/youtube-play.png',
  instagram: 'https://img.icons8.com/ios-filled/50/555555/instagram-new.png',
  pinterest: 'https://img.icons8.com/ios-filled/50/555555/pinterest.png',
  tiktok: 'https://img.icons8.com/ios-filled/50/555555/tiktok.png',
};

function renderSocialIcon(key, url) {
  const iconImg = `<img src="${SOCIAL_ICONS[key]}" width="20" height="20" alt="${key}" style="display:block;border:0;" />`;
  const cell = isValidUrl(url)
    ? `<a href="${escapeHtml(url)}" target="_blank" style="display:block;">${iconImg}</a>`
    : iconImg;
  return `<td style="padding-right:10px;">${cell}</td>`;
}

function buildSignatureHtml(sig) {
  const {
    senderName, senderTitle, companyName, companyTagline,
    contactEmail, websiteUrl,
    facebookUrl, youtubeUrl, instagramUrl, pinterestUrl, tiktokUrl,
    senderNameColor, senderTitleColor, companyNameColor, companyTaglineColor, linkColor,
  } = sig || {};

  if (!senderName && !senderTitle && !companyName && !companyTagline && !contactEmail && !websiteUrl) {
    return '';
  }

  const nameColor = safeColor(senderNameColor, '#1a1a1a');
  const titleColor = safeColor(senderTitleColor, '#1a1a1a');
  const companyColor = safeColor(companyNameColor, '#1a73e8');
  const taglineColor = safeColor(companyTaglineColor, '#666666');
  const linkColorSafe = safeColor(linkColor, '#1a73e8');

  const lines = [];
  if (senderName) lines.push(`<strong style="color:${nameColor};">${escapeHtml(senderName)}</strong>`);
  if (senderTitle) lines.push(`<span style="color:${titleColor};">${escapeHtml(senderTitle)}</span>`);
  if (companyName) lines.push(`<strong style="color:${companyColor};">${escapeHtml(companyName)}</strong>`);
  if (companyTagline) lines.push(`<span style="color:${taglineColor};font-size:12px;">${escapeHtml(companyTagline)}</span>`);

  const contactLines = [];
  if (contactEmail) {
    contactLines.push(`E: <a href="mailto:${escapeHtml(contactEmail)}" style="color:${linkColorSafe};text-decoration:none;">${escapeHtml(contactEmail)}</a>`);
  }
  if (isValidUrl(websiteUrl)) {
    contactLines.push(`<a href="${escapeHtml(websiteUrl)}" style="color:${linkColorSafe};text-decoration:none;" target="_blank">${escapeHtml(websiteUrl)}</a>`);
  }

  const socialCells = [
    renderSocialIcon('facebook', facebookUrl),
    renderSocialIcon('youtube', youtubeUrl),
    renderSocialIcon('instagram', instagramUrl),
    renderSocialIcon('pinterest', pinterestUrl),
    renderSocialIcon('tiktok', tiktokUrl),
  ].join('');

  return `<tr>
    <td style="padding:24px 40px 0;border-top:1px solid #eee;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;color:#1a1a1a;line-height:1.6;">
        <tr><td>${lines.join('<br />')}</td></tr>
        ${contactLines.length ? `<tr><td style="padding-top:8px;">${contactLines.join('<br />')}</td></tr>` : ''}
        <tr><td style="padding-top:12px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>${socialCells}</tr></table></td></tr>
      </table>
    </td>
  </tr>`;
}

function buildEmailHtml({ bannerImageUrl, bannerLinkUrl, content, signature, confidentialityText }) {
  const paragraphs = String(content || '')
    .split(/\n{2,}/)
    .map((block) => escapeHtml(block).replace(/\n/g, '<br />'))
    .filter((block) => block.trim().length > 0)
    .map((block) => `<p style="margin:0 0 16px;">${block}</p>`)
    .join('');

  const bannerImg = `<img src="${escapeHtml(bannerImageUrl)}" alt="" width="600" style="width:100%;max-width:600px;display:block;border:0;" />`;
  const bannerHtml = isValidUrl(bannerImageUrl)
    ? `<tr><td style="padding-top:24px;">${
        isValidUrl(bannerLinkUrl)
          ? `<a href="${escapeHtml(bannerLinkUrl)}" target="_blank" style="display:block;">${bannerImg}</a>`
          : bannerImg
      }</td></tr>`
    : '';

  const signatureHtml = buildSignatureHtml(signature);

  const footerHtml = confidentialityText
    ? `<tr><td style="padding:20px 40px;border-top:1px solid #eee;color:#999;font-size:11px;line-height:1.5;">${escapeHtml(confidentialityText)}</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#f4f4f7;font-family:Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
            <tr>
              <td style="padding:32px 40px 0;color:#1a1a1a;font-size:15px;line-height:1.6;">
                ${paragraphs}
              </td>
            </tr>
            ${signatureHtml}
            ${bannerHtml}
            ${footerHtml}
            <tr><td style="height:24px;line-height:24px;font-size:0;">&nbsp;</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

app.post('/api/send', async (req, res) => {
  const {
    gmailUser, appPassword, subject, content,
    bannerImageUrl, bannerLinkUrl, signature, confidentialityText, recipients,
    delayMinSeconds, delayMaxSeconds,
  } = req.body || {};

  const { minMs: delayMinMs, maxMs: delayMaxMs } = resolveDelayRangeMs(delayMinSeconds, delayMaxSeconds);

  if (!gmailUser || !EMAIL_RE.test(gmailUser)) {
    return res.status(400).json({ error: 'A valid Gmail address is required.' });
  }
  if (!appPassword) {
    return res.status(400).json({ error: 'App Password is required.' });
  }

  const parsedRecipients = parseRecipients(recipients);
  if (parsedRecipients.length === 0) {
    return res.status(400).json({ error: 'At least one recipient is required.' });
  }

  const transporter = nodemailer.createTransport({
    // Explicit host/port 587 (STARTTLS) instead of the 'service: gmail'
    // shorthand (which defaults to port 465) — some hosts (e.g. Render)
    // block outbound 465 but allow 587.
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user: gmailUser, pass: appPassword },
    // Some hosts advertise outbound IPv6 that isn't actually routable to
    // Gmail's SMTP endpoints, causing ENETUNREACH. Force IPv4.
    family: 4,
  });

  try {
    await transporter.verify();
  } catch (err) {
    console.error('Gmail auth failed:', err.code || '', err.responseCode || '', err.message);
    return res.status(401).json({ error: 'Gmail login failed. Check your address and App Password.' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  let sentCount = 0;
  let failedCount = 0;

  const html = buildEmailHtml({ bannerImageUrl, bannerLinkUrl, content, signature, confidentialityText });

  for (let i = 0; i < parsedRecipients.length; i++) {
    const { email: recipient, handle } = parsedRecipients[i];

    if (!EMAIL_RE.test(recipient)) {
      failedCount++;
      sendEvent('progress', { recipient, status: 'error', error: 'Invalid email format' });
      continue;
    }

    try {
      await transporter.sendMail({
        from: gmailUser,
        to: recipient,
        subject: applySubjectTemplate(subject, handle) || '',
        text: content || '',
        html,
      });
      sentCount++;
      sendEvent('progress', { recipient, status: 'sent' });
    } catch (err) {
      failedCount++;
      sendEvent('progress', { recipient, status: 'error', error: err.message || 'Send failed' });
    }

    if (i < parsedRecipients.length - 1) {
      await sleep(randomDelayMs(delayMinMs, delayMaxMs));
    }
  }

  sendEvent('done', { total: parsedRecipients.length, sent: sentCount, failed: failedCount });
  res.end();
});

function openBrowser(url) {
  const platform = process.platform;
  const command =
    platform === 'win32' ? `start "" "${url}"` :
    platform === 'darwin' ? `open "${url}"` :
    `xdg-open "${url}"`;
  exec(command, (err) => {
    if (err) console.error('Could not auto-open browser:', err.message);
  });
}

app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Gmail bulk sender running at ${url}`);
  if (IS_PACKAGED) {
    openBrowser(url);
  }
});
