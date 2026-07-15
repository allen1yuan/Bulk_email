const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SEND_DELAY_MS = 1500;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function parseRecipients(raw) {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : String(raw).split(/[\n,]/);
  const seen = new Set();
  const result = [];
  for (const item of list) {
    const trimmed = String(item).trim();
    if (!trimmed || seen.has(trimmed.toLowerCase())) continue;
    seen.add(trimmed.toLowerCase());
    result.push(trimmed);
  }
  return result;
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
  } = sig || {};

  if (!senderName && !senderTitle && !companyName && !companyTagline && !contactEmail && !websiteUrl) {
    return '';
  }

  const lines = [];
  if (senderName) lines.push(`<strong>${escapeHtml(senderName)}</strong>`);
  if (senderTitle) lines.push(escapeHtml(senderTitle));
  if (companyName) lines.push(`<strong style="color:#1a73e8;">${escapeHtml(companyName)}</strong>`);
  if (companyTagline) lines.push(`<span style="color:#666;font-size:12px;">${escapeHtml(companyTagline)}</span>`);

  const contactLines = [];
  if (contactEmail) {
    contactLines.push(`e: <a href="mailto:${escapeHtml(contactEmail)}" style="color:#1a73e8;text-decoration:none;">${escapeHtml(contactEmail)}</a>`);
  }
  if (isValidUrl(websiteUrl)) {
    contactLines.push(`<a href="${escapeHtml(websiteUrl)}" style="color:#1a73e8;text-decoration:none;" target="_blank">${escapeHtml(websiteUrl)}</a>`);
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
  } = req.body || {};

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
    service: 'gmail',
    auth: { user: gmailUser, pass: appPassword },
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
    const recipient = parsedRecipients[i];

    if (!EMAIL_RE.test(recipient)) {
      failedCount++;
      sendEvent('progress', { recipient, status: 'error', error: 'Invalid email format' });
      continue;
    }

    try {
      await transporter.sendMail({
        from: gmailUser,
        to: recipient,
        subject: subject || '',
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
      await sleep(SEND_DELAY_MS);
    }
  }

  sendEvent('done', { total: parsedRecipients.length, sent: sentCount, failed: failedCount });
  res.end();
});

app.listen(PORT, () => {
  console.log(`Gmail bulk sender running at http://localhost:${PORT}`);
});
