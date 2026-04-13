# Nekolessi Profile ♡

A purrfectly cute catgirl profile page for GitHub Pages, with live Discord status, pretty social links, and a tiny Cloudflare-powered reaction counter tucked underneath it all. 🎀

## What This Little Site Has ✨

- a cute hero card with social links
- live Discord status and activity powered by Lanyard
- Cloudflare Worker-backed page views and reactions
- easy profile text + link editing from `src/config.js`

## Project Map 🗺️

- `index.html`: page markup and metadata
- `styles.css`: layout, visuals, and responsive styling
- `script.js`: browser entrypoint that boots the site app
- `src/config.js`: profile content and site settings
- `src/app.js`: app bootstrap and shared page wiring
- `src/presence.js`: Discord/Lanyard presence rendering
- `src/reactions.js`: reaction UI and counter behavior
- `src/helpers.js`: shared helpers for URLs, timing, and formatting
- `scripts/check.mjs`: static site and config validation
- `scripts/site.test.mjs`: browser-side DOM behavior tests
- `scripts/worker.test.mjs`: worker behavior tests
- `images/`: local assets like `background.jpg` and `profile.png`
- `cloudflare-worker/src/index.js`: `/views`, `/reactions`, `/admin/views`, and `/discord-app/:id` APIs

## Verify Before You Push 🧁

Use Node `>=20.19.0`.

Run the full check with:

```powershell
npm run verify
```

That runs:

- static site and config validation
- ESLint
- Prettier format check
- browser-side DOM tests
- worker behavior tests

## Quick Config In `src/config.js` 💖

The main things you will probably want to customize are:

- `APP_CONFIG.discordUserId`
- `APP_CONFIG.heroProfileImageUrl`
- `APP_CONFIG.viewCounterWorkerUrl`
- `APP_CONFIG.viewFetchTimeoutMs`
- `APP_CONFIG.presenceRefreshIntervalMs`
- `PROFILE_REACTIONS`
- `PROFILE.location`
- `PROFILE.bioBlocks`
- `PROFILE.links`
- `UI_TEXT`

Helpful notes:

- if `APP_CONFIG.heroProfileImageUrl` is empty, the site falls back to `images/profile.png`
- the reactions endpoint is auto-derived from `APP_CONFIG.viewCounterWorkerUrl`
- the Discord app icon endpoint is also auto-derived from `APP_CONFIG.viewCounterWorkerUrl`
- social links use **Simple Icons only**
- `UI_TEXT` holds section labels, fallback copy, and tiny status messages so you can retheme wording without digging through the logic

### `PROFILE.links` shape

```js
{
  label: "Ko-fi",
  simpleIcon: "kofi",
  iconColor: "72A5F2",
  href: "ko-fi.com/nekolessi"
}
```

Tips:

- `simpleIcon` is the Simple Icons slug from `cdn.simpleicons.org/<slug>`
- `iconColor` is a hex color without `#`
- use `type: "email"` for email links so they become `mailto:`

### `PROFILE` shape

```js
const PROFILE = {
  location: "USA",
  bioBlocks: ["line one", "line two"],
  links: [
    {
      label: "Ko-fi",
      simpleIcon: "kofi",
      iconColor: "72A5F2",
      href: "ko-fi.com/nekolessi",
    },
  ],
};
```

### `APP_CONFIG` shape

```js
const APP_CONFIG = {
  discordUserId: "1116207043544612985",
  lanyardBase: "https://api.lanyard.rest/v1/users/",
  heroProfileImageLocal: "images/profile.png",
  heroProfileImageUrl: "",
  viewCounterWorkerUrl: "https://your-worker.workers.dev/views",
  viewFetchTimeoutMs: 4500,
  presenceRefreshIntervalMs: 20_000,
  discordProfileBase: "https://discord.com/users/",
  defaultActivityArt: "images/activity-fallback.svg",
};
```

### `UI_TEXT` shape

```js
const UI_TEXT = {
  statusEyebrow: "DISCORD STATUS",
  activityEyebrow: "NOW PLAYING / LISTENING",
  reactionsTitle: "click if you like catgirls",
  activityEmptyTitle: "Nothing active right now",
};
```

### `PROFILE_REACTIONS` shape

```js
const PROFILE_REACTIONS = [
  { id: "heart", emoji: "\\u{1F497}", label: "Like catgirls" },
];
```

Little notes:

- each reaction needs a stable `id`
- `emoji` is the button glyph shown in the UI
- `label` is used for accessible text and status copy

## Publish On GitHub Pages 🌷

1. Open repo `Settings`.
2. Go to `Pages`.
3. Choose `Deploy from a branch`.
4. Set branch to `main` and folder to `/ (root)`.
5. Save and wait for deployment.

## Cloudflare Worker Setup ☁️

Worker files live in `cloudflare-worker/`.

1. Login:

```powershell
npx wrangler login
npx wrangler whoami
```

2. Review `cloudflare-worker/wrangler.toml`:

- set `ALLOWED_ORIGINS` to your site origin if you use a custom domain
- adjust `VIEW_MIN_INTERVAL_MS` if you want a looser or stricter per-IP page view cooldown
- adjust `REACTION_MIN_INTERVAL_MS` if you want a looser or stricter reaction cooldown
- set an `ADMIN_API_TOKEN` secret if you want to read or reset the view counter safely

3. Deploy:

```powershell
cd cloudflare-worker
npx wrangler deploy
```

If you want admin reset access, set the secret before or after deploy:

```powershell
npx wrangler secret put ADMIN_API_TOKEN
```

4. Set the worker URL in `src/config.js`:

```js
const APP_CONFIG = {
  viewCounterWorkerUrl: "https://your-worker.workers.dev/views",
};
```

Important behavior:

- page views and reactions are stored through a Durable Object so concurrent requests do not lose counts
- view increments require an allowed site origin
- page views are rate-limited per client IP, so repeated refreshes inside the cooldown window return the current count without incrementing it
- reaction posts require an allowed site origin and are rate-limited per client IP
- admin counter reads/resets require a bearer token from `ADMIN_API_TOKEN`
- Discord app icon lookups are proxied through the worker so the site does not need to rely on `allorigins`
- missing Durable Object bindings return a clear JSON error

After deploy, these are nice little smoke checks:

```powershell
curl.exe -i -H "Origin: https://nekolessi.github.io" https://your-worker.workers.dev/views
curl.exe -i https://your-worker.workers.dev/reactions
curl.exe -i -H "Origin: https://nekolessi.github.io" https://your-worker.workers.dev/discord-app/1445976703066443846
```

The default page view cooldown is 2 minutes per IP:

- set `VIEW_MIN_INTERVAL_MS = "120000"` to keep the current behavior
- lower it if you want refreshes to count again sooner
- raise it if you want stricter spam resistance

To read or reset the stored view count:

```powershell
curl.exe -i -H "Authorization: Bearer YOUR_ADMIN_API_TOKEN" https://your-worker.workers.dev/admin/views
curl.exe -i -X POST -H "Authorization: Bearer YOUR_ADMIN_API_TOKEN" -H "Content-Type: application/json" https://your-worker.workers.dev/admin/views -d "{\"count\":299}"
```

Set the counter to `299` if you want the next real page load to show about `300`, because `/views` increments before it returns the count.

## Troubleshooting 🐾

### Counter is blank

- check that `APP_CONFIG.viewCounterWorkerUrl` ends with `/views`
- check that the worker is deployed and the `PROFILE_COUNTER` Durable Object binding exists
- check that `ALLOWED_ORIGINS` includes your site origin

### Discord status is not updating

- check `APP_CONFIG.discordUserId`
- confirm Lanyard can see that user

### Styles are not updating

- hard refresh with `Ctrl+F5` after GitHub Pages finishes deploying
