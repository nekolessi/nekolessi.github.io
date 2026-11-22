# Project Setup & Guide 🐾

All the technical setup notes, worker instructions, and configuration details for the catgirl profile site live here so the main README stays cute and uncluttered! 🎀

---

## The File Situation

```text
index.html                 the bones
styles.css                 the outfit
script.js                  presses the big start button
src/config.js              words, links, ids, little settings, etc.
src/app.js                 wires the page together
src/presence.js            discord/lanyard stuff
src/reactions.js           the clicky heart situation
src/helpers.js             useful utility functions
scripts/check.mjs          checks if anything obvious is broken
scripts/site.test.mjs      tests the browser-side DOM behavior
scripts/worker.test.mjs    tests the worker behavior
images/                    profile avatar and background artwork
cloudflare-worker/         views, reactions, admin api + discord app proxy
```

---

## Local Verification & Testing

Requires Node `>=20.19.0`.

```bash
npm install
npm run verify
```

`npm run verify` runs the static site check, ESLint, Prettier format check, and automated tests.

---

## Customizing Profile Data

All site customizations live in `src/config.js`:

- `APP_CONFIG.discordUserId`: Your Discord snowflake ID (used for live presence via Lanyard).
- `APP_CONFIG.heroProfileImageUrl`: Optional URL for avatar (falls back to `images/profile.png` if empty).
- `APP_CONFIG.viewCounterWorkerUrl`: Your Cloudflare Worker endpoint (e.g., `https://your-worker.workers.dev/views`).
- `PROFILE.location`: Location text (default: `"USA"`).
- `PROFILE.bioBlocks`: Array of bio sentences.
- `PROFILE.links`: Social/external profile link definitions.
- `UI_TEXT`: Section labels, fallback text, and accessibility captions.

### Adding a Link

```js
{
  label: "Guestbook",
  simpleIcon: "gleam",
  iconColor: "FF9ACB",
  href: "https://your-link.com",
}
```

- `simpleIcon`: Icon slug from [Simple Icons](https://simpleicons.org/) (`cdn.simpleicons.org/<slug>`).
- `iconColor`: Hex color code without the `#`.
- `type: "email"`: Optional, automatically creates a `mailto:` link.

---

## Deploying to GitHub Pages

1. In the repository on GitHub, open **Settings**.
2. Navigate to **Pages** (under Code and automation).
3. Under **Build and deployment**, set Source to **Deploy from a branch**.
4. Choose the `main` branch and `/ (root)` folder.
5. Save. The site will publish to `https://<username>.github.io/`.

---

## Cloudflare Worker Setup (Page Counter & Reactions)

The worker lives in `cloudflare-worker/` and handles `/views`, `/reactions`, `/admin/views`, and `/discord-app/:id`.

### 1. Authenticate & Configure

```bash
npx wrangler login
npx wrangler whoami
```

Review `cloudflare-worker/wrangler.toml`:

- `ALLOWED_ORIGINS`: Set to your site domain (e.g., `https://nekolessi.github.io`).
- `VIEW_MIN_INTERVAL_MS`: Cooldown between view increments per client IP (default: `120000`).
- `REACTION_MIN_INTERVAL_MS`: Cooldown between reaction clicks per client IP (default: `10000`).

### 2. Deploy

```bash
cd cloudflare-worker
npx wrangler deploy
```

*(Optional)* If you want admin reset access to adjust the view counter:

```bash
npx wrangler secret put ADMIN_API_TOKEN
```

### 3. Link Worker to Site

Add the worker URL into `src/config.js`:

```js
export const APP_CONFIG = {
  viewCounterWorkerUrl: "https://your-worker.workers.dev/views",
};
```

### 4. Admin API Commands

To inspect or reset the counter:

```powershell
# Read current views
curl.exe -i -H "Authorization: Bearer YOUR_ADMIN_API_TOKEN" https://your-worker.workers.dev/admin/views

# Reset/set view count
curl.exe -i -X POST -H "Authorization: Bearer YOUR_ADMIN_API_TOKEN" -H "Content-Type: application/json" https://your-worker.workers.dev/admin/views -d "{\"count\":299}"
```

---

## Troubleshooting

- **Counter is blank:** Ensure `viewCounterWorkerUrl` ends with `/views` and that `ALLOWED_ORIGINS` in `wrangler.toml` matches your GitHub Pages domain.
- **Discord status not updating:** Confirm `discordUserId` is correct and that your Discord account has joined the Lanyard Discord server so it can track your presence.
- **Changes not showing on the live site:** GitHub Pages may take 1–2 minutes to build. Once built, perform a cache-clearing hard reload (`Ctrl + F5` or `Cmd + Shift + R`).
