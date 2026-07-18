const form = document.getElementById('send-form');
const sendBtn = document.getElementById('send-btn');
const progressSection = document.getElementById('progress-section');
const progressList = document.getElementById('progress-list');
const summaryEl = document.getElementById('summary');
const previewIframe = document.getElementById('preview-iframe');

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

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function safeColor(color, fallback) {
  return HEX_COLOR_RE.test(color || '') ? color : fallback;
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
                ${paragraphs || '<p style="margin:0;color:#999;">(Your message will appear here)</p>'}
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

const PREVIEW_FIELD_IDS = [
  'content', 'bannerImageUrl', 'bannerLinkUrl', 'confidentialityText',
  'senderName', 'senderTitle', 'companyName', 'companyTagline', 'contactEmail', 'websiteUrl',
  'facebookUrl', 'youtubeUrl', 'instagramUrl', 'pinterestUrl', 'tiktokUrl',
  'senderNameColor', 'senderTitleColor', 'companyNameColor', 'companyTaglineColor', 'linkColor',
];

function getSignatureFromForm() {
  return {
    senderName: document.getElementById('senderName').value.trim(),
    senderTitle: document.getElementById('senderTitle').value.trim(),
    companyName: document.getElementById('companyName').value.trim(),
    companyTagline: document.getElementById('companyTagline').value.trim(),
    contactEmail: document.getElementById('contactEmail').value.trim(),
    websiteUrl: document.getElementById('websiteUrl').value.trim(),
    facebookUrl: document.getElementById('facebookUrl').value.trim(),
    youtubeUrl: document.getElementById('youtubeUrl').value.trim(),
    instagramUrl: document.getElementById('instagramUrl').value.trim(),
    pinterestUrl: document.getElementById('pinterestUrl').value.trim(),
    tiktokUrl: document.getElementById('tiktokUrl').value.trim(),
    senderNameColor: document.getElementById('senderNameColor').value,
    senderTitleColor: document.getElementById('senderTitleColor').value,
    companyNameColor: document.getElementById('companyNameColor').value,
    companyTaglineColor: document.getElementById('companyTaglineColor').value,
    linkColor: document.getElementById('linkColor').value,
  };
}

function updatePreview() {
  const bannerImageUrl = document.getElementById('bannerImageUrl').value.trim();
  const bannerLinkUrl = document.getElementById('bannerLinkUrl').value.trim();
  const content = document.getElementById('content').value;
  const confidentialityText = document.getElementById('confidentialityText').value.trim();
  const html = buildEmailHtml({
    bannerImageUrl, bannerLinkUrl, content,
    signature: getSignatureFromForm(),
    confidentialityText,
  });
  previewIframe.srcdoc = html;
}

PREVIEW_FIELD_IDS.forEach((id) => {
  document.getElementById(id).addEventListener('input', updatePreview);
  document.getElementById(id).addEventListener('change', updatePreview);
});

const subjectExampleEl = document.getElementById('subject-example');

function updateSubjectExample() {
  const subjectTemplate = document.getElementById('subject').value;
  if (!subjectTemplate.includes('{handle}')) {
    subjectExampleEl.innerHTML = 'Use <code>{handle}</code> anywhere in the subject to auto-insert each recipient\'s Instagram handle.';
    return;
  }
  const recipients = parseRecipients(document.getElementById('recipients').value);
  const firstWithHandle = recipients.find((r) => r.handle);
  const sampleHandle = firstWithHandle ? firstWithHandle.handle : '@example_handle';
  subjectExampleEl.textContent = `Example: ${applySubjectTemplate(subjectTemplate, sampleHandle)}`;
}

['subject', 'recipients'].forEach((id) => {
  document.getElementById(id).addEventListener('input', updateSubjectExample);
});

const SAVED_DATA_ENDPOINT = '/api/saved-data';
const ALWAYS_SAVED_FIELD_IDS = [
  'gmailUser', 'subject', 'content', 'bannerImageUrl', 'bannerLinkUrl', 'confidentialityText',
  'senderName', 'senderTitle', 'companyName', 'companyTagline', 'contactEmail', 'websiteUrl',
  'facebookUrl', 'youtubeUrl', 'instagramUrl', 'pinterestUrl', 'tiktokUrl',
  'senderNameColor', 'senderTitleColor', 'companyNameColor', 'companyTaglineColor', 'linkColor',
  'delayMinSeconds', 'delayMaxSeconds',
];
const rememberCheckbox = document.getElementById('rememberPassword');
const saveStatusEl = document.getElementById('save-status');
let saveStatusTimer = null;
let persistTimer = null;

function showSaveStatus(text, isError) {
  saveStatusEl.textContent = text;
  saveStatusEl.style.color = isError ? '#d93025' : '';
  clearTimeout(saveStatusTimer);
  saveStatusTimer = setTimeout(() => { saveStatusEl.textContent = ''; }, 1500);
}

async function loadSavedData() {
  let saved = {};
  try {
    const res = await fetch(SAVED_DATA_ENDPOINT);
    if (res.ok) saved = await res.json();
  } catch {
    // server unreachable or file not yet created — fall through with defaults
  }
  ALWAYS_SAVED_FIELD_IDS.forEach((id) => {
    if (typeof saved[id] === 'string') document.getElementById(id).value = saved[id];
  });
  if (saved.rememberPassword) {
    rememberCheckbox.checked = true;
    if (typeof saved.appPassword === 'string') {
      document.getElementById('appPassword').value = saved.appPassword;
    }
  }
}

async function persistData() {
  const data = {};
  ALWAYS_SAVED_FIELD_IDS.forEach((id) => {
    data[id] = document.getElementById(id).value;
  });
  data.rememberPassword = rememberCheckbox.checked;
  data.appPassword = rememberCheckbox.checked ? document.getElementById('appPassword').value : '';
  try {
    const res = await fetch(SAVED_DATA_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    showSaveStatus('Saved on the server.', false);
  } catch {
    showSaveStatus('Failed to save.', true);
  }
}

function schedulePersist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persistData, 500);
}

loadSavedData().then(() => {
  updatePreview();
  updateSubjectExample();
});

[...ALWAYS_SAVED_FIELD_IDS, 'appPassword'].forEach((id) => {
  document.getElementById(id).addEventListener('input', schedulePersist);
  document.getElementById(id).addEventListener('change', schedulePersist);
});
rememberCheckbox.addEventListener('change', schedulePersist);

document.getElementById('clear-saved-btn').addEventListener('click', async () => {
  clearTimeout(persistTimer);
  try {
    await fetch(SAVED_DATA_ENDPOINT, { method: 'DELETE' });
  } catch {
    // best-effort; fields are reset locally regardless
  }
  ALWAYS_SAVED_FIELD_IDS.forEach((id) => {
    const el = document.getElementById(id);
    el.value = el.defaultValue;
  });
  document.getElementById('appPassword').value = '';
  rememberCheckbox.checked = false;
  updatePreview();
  showSaveStatus('Saved data cleared.', false);
});

function parseRecipients(raw) {
  const seen = new Set();
  const result = [];
  for (const line of raw.split('\n')) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    // Excel/Sheets paste produces tab-separated columns; typed-in lists use
    // a comma. Split on whichever is present (tab takes priority since a
    // handle could plausibly contain a comma but never a tab).
    const separator = trimmedLine.includes('\t') ? '\t' : ',';
    const [emailPart, ...rest] = trimmedLine.split(separator);
    const email = (emailPart || '').trim();
    const handle = rest.join(separator).trim();
    if (!email || seen.has(email.toLowerCase())) continue;
    seen.add(email.toLowerCase());
    result.push({ email, handle });
  }
  return result;
}

function applySubjectTemplate(template, handle) {
  if (!template || !template.includes('{handle}')) return template;
  return template.split('{handle}').join(handle || '');
}

function renderPending(recipients) {
  progressList.innerHTML = '';
  for (const { email, handle } of recipients) {
    const li = document.createElement('li');
    li.className = 'pending';
    li.dataset.recipient = email;
    const label = handle ? `${email} (${handle})` : email;
    li.innerHTML = `<span>${escapeHtml(label)}</span><span class="status">waiting</span>`;
    progressList.appendChild(li);
  }
}

function updateRow(recipient, status, error) {
  const li = progressList.querySelector(`li[data-recipient="${CSS.escape(recipient)}"]`);
  if (!li) return;
  li.className = status;
  li.querySelector('.status').textContent = status === 'sent' ? 'sent' : `error${error ? ': ' + error : ''}`;
}

async function parseSSEStream(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const chunks = buffer.split('\n\n');
    buffer = chunks.pop();

    for (const chunk of chunks) {
      const lines = chunk.split('\n');
      let event = 'message';
      let data = '';
      for (const line of lines) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        if (line.startsWith('data:')) data = line.slice(5).trim();
      }
      if (data) {
        onEvent(event, JSON.parse(data));
      }
    }
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const gmailUser = document.getElementById('gmailUser').value.trim();
  const appPassword = document.getElementById('appPassword').value;
  const subject = document.getElementById('subject').value;
  const content = document.getElementById('content').value;
  const bannerImageUrl = document.getElementById('bannerImageUrl').value.trim();
  const bannerLinkUrl = document.getElementById('bannerLinkUrl').value.trim();
  const confidentialityText = document.getElementById('confidentialityText').value.trim();
  const signature = getSignatureFromForm();
  const delayMinSeconds = parseFloat(document.getElementById('delayMinSeconds').value);
  const delayMaxSeconds = parseFloat(document.getElementById('delayMaxSeconds').value);
  const recipients = parseRecipients(document.getElementById('recipients').value);

  if (recipients.length === 0) {
    alert('Please enter at least one recipient.');
    return;
  }

  if (!Number.isFinite(delayMinSeconds) || !Number.isFinite(delayMaxSeconds) || delayMinSeconds > delayMaxSeconds) {
    alert('Please set a valid delay range (minimum must not be greater than maximum).');
    return;
  }

  sendBtn.disabled = true;
  sendBtn.textContent = 'Sending...';
  progressSection.classList.remove('hidden');
  summaryEl.textContent = '';
  renderPending(recipients);

  try {
    const response = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gmailUser, appPassword, subject, content,
        bannerImageUrl, bannerLinkUrl, signature, confidentialityText, recipients,
        delayMinSeconds, delayMaxSeconds,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      summaryEl.textContent = body.error || `Request failed (${response.status})`;
      summaryEl.style.color = '#d93025';
      return;
    }

    await parseSSEStream(response, (event, data) => {
      if (event === 'progress') {
        updateRow(data.recipient, data.status, data.error);
      } else if (event === 'done') {
        summaryEl.style.color = '';
        summaryEl.textContent = `Done: ${data.sent} sent, ${data.failed} failed, ${data.total} total.`;
      }
    });
  } catch (err) {
    summaryEl.textContent = `Unexpected error: ${err.message}`;
    summaryEl.style.color = '#d93025';
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send';
  }
});
