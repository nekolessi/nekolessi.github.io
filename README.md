# Nekolessi Profile (GitHub Pages)

A goth-neko profile site for GitHub Pages with live Discord status, social links, and a tiny Cloudflare-powered reaction counter tucked under the lace.

## What The Site Includes

- hero card and social links
- live Discord status and activity through Lanyard
- Cloudflare Worker page views and reactions

## Project Structure

- `index.html`: page markup
- `styles.css`: layout, visuals, and responsiveness
- `script.js`: profile config and live data logic
- `images/`: local assets such as `background.jpg` and `profile.png`
- `cloudflare-worker/src/index.js`: `/views` and `/reactions` API backed by a Durable Object

## Quick Config In `script.js`

Update these constants:

- `DISCORD_USER_ID`
- `PROFILE_LOCATION`
- `HERO_PROFILE_IMAGE_URL`
- `VIEW_COUNTER_WORKER_URL`
- `PROFILE_LINKS`

Notes:

- if `HERO_PROFILE_IMAGE_URL` is empty, the site uses `images/profile.png`
- the reactions endpoint is auto-derived from `VIEW_COUNTER_WORKER_URL`
- social links use **Simple Icons only**

### `PROFILE_LINKS` shape

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

## Publish On GitHub Pages

1. Open repo `Settings`.
2. Go to `Pages`.
3. Choose `Deploy from a branch`.
4. Set branch to `main` and folder to `/ (root)`.
5. Save and wait for deployment.

## Cloudflare Worker Setup

Worker files live in `cloudflare-worker/`.

1. Login:
   ```powershell
   npx wrangler login
   npx wrangler whoami
   ```
2. Review `cloudflare-worker/wrangler.toml`:
   - set `ALLOWED_ORIGINS` to your site origin if you use a custom domain
   - adjust `REACTION_MIN_INTERVAL_MS` if you want a looser or stricter reaction cooldown
3. Deploy:
   ```powershell
   cd cloudflare-worker
   npx wrangler deploy
   ```
4. Set the worker URL in `script.js`:
   ```js
   const VIEW_COUNTER_WORKER_URL = "https://your-worker.workers.dev/views";
   ```

Important behavior:

- page views and reactions are stored through a Durable Object so concurrent requests do not lose counts
- view increments require an allowed site origin
- reaction posts require an allowed site origin and are rate-limited per client IP
- missing Durable Object bindings return a clear JSON error

## Troubleshooting

- Counter blank:
  - check that `VIEW_COUNTER_WORKER_URL` ends with `/views`
  - check that the worker is deployed and KV is bound
- Discord status not updating:
  - check `DISCORD_USER_ID`
  - confirm Lanyard can see that user
- Style not updating:
  - hard refresh with `Ctrl+F5` after Pages deploy finishes
