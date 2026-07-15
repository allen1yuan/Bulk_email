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
- **Server-side template/login persistence** — your Gmail address, signature, banner, and delay settings are saved to a local JSON file on the server (`data/saved-template.json`, git-ignored, `0600` permissions). The App Password is only saved if you explicitly check "Remember my address and App Password." Note this file is shared by anyone using the same running instance — see [Security notes](#security-notes).
- **Shipped default template** — `default-template.json` (tracked in git) provides the starting subject/message/signature/banner/delay values on a fresh deploy, before anyone has saved anything through the form. It never contains credentials — the Gmail address field there is a public-facing business contact, not a secret, and the App Password always starts blank regardless of what this file contains.
- **Shared access gate** — when deployed for a team, gate the whole app behind a shared username/password (HTTP Basic Auth) so it isn't an open relay to anyone who finds the link.

## Download the desktop app (no Node.js required)

For Windows and macOS, prebuilt standalone binaries are attached to each [GitHub Release](../../releases) — no Node.js or `npm install` needed.

1. Go to the [Releases page](../../releases) and download the file for your OS:
   - Windows: `gmail-bulk-sender-win-x64.exe`
   - macOS: `gmail-bulk-sender-macos-x64` (Intel) or `gmail-bulk-sender-macos-arm64` (Apple Silicon/M-series)
2. Double-click it. It starts a local server on your machine and opens your default browser to it automatically.
3. **First-run security warning is expected** — these binaries aren't code-signed, so:
   - **Windows**: SmartScreen will say "Windows protected your PC." Click **More info → Run anyway**.
   - **macOS**: Gatekeeper will block it on first launch. Right-click (or Control-click) the file → **Open** → confirm **Open** in the dialog. (A plain double-click after that works normally.)
4. Everything you save (template, login) is stored in a `data/` folder created next to wherever you put the executable — move the executable, and that folder should move with it if you want to keep your saved data.

This runs the exact same app as `npm run dev` below, just bundled with its own Node.js runtime so nothing needs to be installed first.

To build these yourself instead of using the Releases page: `npm install`, then `npm run package` (requires the `pkg` devDependency, already in `package.json`) — outputs to `dist/`.

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

## Deploying

### Railway (recommended)

Render's **free** tier blocks all outbound SMTP traffic (ports 25, 465, 587) as of September 2025, which breaks Gmail sending entirely — see [Render's changelog](https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports). Railway doesn't have this restriction, so it's the default recommendation here. This repo includes a `railway.json` config.

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. In the [Railway dashboard](https://railway.app/new), choose **Deploy from GitHub repo** and select this repo. Railway auto-detects the Node app via Nixpacks and picks up `railway.json`.
3. Under the service's **Variables** tab, set `ACCESS_USER` and `ACCESS_PASSWORD` to a username/password you share only with your team — without these set, anyone with the URL can send email through it using any credentials they enter.
4. Deploy. Railway provides a public `https://<service>.up.railway.app` URL (generate one under **Settings → Networking** if it isn't shown automatically).

### Render (paid tier only)

`render.yaml` is still included if you'd rather use Render — but you must select a **paid** instance type (not the free plan) when creating the service, since only paid Render instances allow outbound SMTP on ports 465/587. Port 25 stays blocked on all Render tiers, which is fine since this app doesn't use it. Otherwise, follow the same steps: **New → Blueprint** in the [Render dashboard](https://dashboard.render.com), connect the repo, set `ACCESS_USER`/`ACCESS_PASSWORD`, deploy.

## Environment variables

| Variable          | Required | Purpose                                                                 |
|--------------------|----------|--------------------------------------------------------------------------|
| `PORT`             | No       | Port to listen on (defaults to `3001`; Railway/Render set this automatically). |
| `ACCESS_USER`      | No       | Shared username for the HTTP Basic Auth gate. Leave unset to disable.   |
| `ACCESS_PASSWORD`  | No       | Shared password for the HTTP Basic Auth gate. Leave unset to disable.   |

## Security notes

- The Gmail App Password is only persisted if you check "Remember my address and App Password" — otherwise it's used to open an SMTP connection for the duration of a single send request and then discarded.
- The persisted-data file (`data/saved-template.json`) is written with `0600` permissions (owner read/write only) and is git-ignored so it's never committed, but it is **shared across every browser/user hitting the same running instance** — it is not per-device like browser storage would be. If you deploy this behind the shared access gate for a team, anyone with the link can see and overwrite the saved Gmail login. Only enable "Remember" on an instance you don't share, or leave it unchecked on shared deployments.
- Signature colors are validated against a strict hex-color pattern before being inserted into the email HTML, to prevent CSS/markup injection via the form.
- `ACCESS_USER`/`ACCESS_PASSWORD` gate access to the app itself, not to any individual's Gmail account — each user still supplies their own Gmail credentials.
- On Railway and Render, the filesystem is ephemeral by default, so the saved-template file (and anything in it) is lost on redeploys or restarts unless you attach a persistent volume.
