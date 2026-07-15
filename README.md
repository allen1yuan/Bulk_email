# Bulk Email

A small web app for sending a templated email to a list of recipients, one at a time, through your own Gmail account. Built for low-volume outreach (a few dozen recipients a day) — not a mass-marketing tool.

## Features

- **Gmail login via App Password** — no OAuth app to register, just a 16-character [App Password](https://myaccount.google.com/apppasswords).
- **Live HTML email preview** as you type, rendered in an iframe.
- **Fully customizable signature** — name, title, company, tagline, contact email, website, and social icons (Facebook/YouTube/Instagram/Pinterest/TikTok), each with its own text color.
- **Optional banner image** at the bottom of the email, with an optional click-through link.
- **Confidentiality/footer notice**, editable.
- **Randomized send delay** — set a min/max range (seconds); a random delay in that range is used before each send, so the pattern looks less mechanical to spam filters than a fixed interval.
- **Per-recipient progress stream** — see each send succeed or fail in real time via Server-Sent Events.
- **Local template/login persistence** — your Gmail address, signature, banner, and delay settings are remembered in the browser's local storage. The App Password is only remembered if you explicitly check "Remember my address and App Password on this device."
- **Shared access gate** — when deployed for a team, gate the whole app behind a shared username/password (HTTP Basic Auth) so it isn't an open relay to anyone who finds the link.

## Running locally

Requires Node.js 18.18+.

```bash
npm install
npm run dev
```

Open the printed URL (defaults to `http://localhost:3001`, or `PORT` if set). No access gate is applied locally unless you set `ACCESS_USER`/`ACCESS_PASSWORD` env vars yourself.

### Sending an email

1. Enter your Gmail address and an [App Password](https://myaccount.google.com/apppasswords) (requires 2-Step Verification enabled on the Google account).
2. Fill in the subject, recipients (one per line or comma-separated), and message body.
3. Customize the signature, banner, and footer as needed — the preview updates live.
4. Set a delay range for sends, then hit Send. Progress for each recipient streams in below the form.

## Gmail sending limits and risk

Personal Gmail accounts are capped at ~500 recipients/day (Google Workspace: ~2,000/day). Beyond the hard cap, Gmail's spam/abuse detection also looks at *pattern* — identical content blasted to many strangers in a tight loop is the classic signature it flags, independent of volume. For recurring outreach:

- Keep batches well under the daily cap.
- Use the randomized delay range rather than sending everything in one burst.
- Only email people you have a legitimate reason to contact, and keep the confidentiality/opt-out footer text.
- Prefer a Google Workspace domain address over a personal `@gmail.com` address for better sender reputation.

## Deploying (Render)

This repo includes a `render.yaml` blueprint.

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. In the [Render dashboard](https://dashboard.render.com), choose **New → Blueprint** and connect the repo. Render will pick up `render.yaml` automatically.
3. Set the `ACCESS_USER` and `ACCESS_PASSWORD` environment variables to a username/password you share only with your team — without these set, anyone with the URL can send email through it using any credentials they enter.
4. Deploy. Render provides a public `https://<service>.onrender.com` URL.

Note: the free Render plan spins down when idle, so the first request after a period of inactivity can take 30-60 seconds to wake up.

## Environment variables

| Variable          | Required | Purpose                                                                 |
|--------------------|----------|--------------------------------------------------------------------------|
| `PORT`             | No       | Port to listen on (defaults to `3001`; Render sets this automatically). |
| `ACCESS_USER`      | No       | Shared username for the HTTP Basic Auth gate. Leave unset to disable.   |
| `ACCESS_PASSWORD`  | No       | Shared password for the HTTP Basic Auth gate. Leave unset to disable.   |

## Security notes

- The Gmail App Password is never stored server-side — it's used to open an SMTP connection for the duration of a single send request and then discarded.
- Signature colors are validated against a strict hex-color pattern before being inserted into the email HTML, to prevent CSS/markup injection via the form.
- `ACCESS_USER`/`ACCESS_PASSWORD` gate access to the app itself, not to any individual's Gmail account — each user still supplies their own Gmail credentials.
