# Nekolessi Profile (GitHub Pages)

Purple-goth profile site with:
- Hero card + social links
- Live Discord status/activity via Lanyard
- Cloudflare Worker page views + reactions

## Project Structure
- `index.html`: page structure
- `styles.css`: design, layout, responsive behavior
- `script.js`: profile config + live data logic
- `images/`: local assets (`background.jpg`, `profile.png`)
- `cloudflare-worker/src/index.js`: `/views` and `/reactions` API

## Quick Config (`script.js`)
Update these constants:
- `DISCORD_USER_ID`
- `PROFILE_LOCATION`
- `HERO_PROFILE_IMAGE_URL` (optional external image)
- `VIEW_COUNTER_WORKER_URL`
- `PROFILE_LINKS`

Notes:
- If `HERO_PROFILE_IMAGE_URL` is empty, local `images/profile.png` is used.
- Reactions endpoint is auto-derived from `VIEW_COUNTER_WORKER_URL` (`/views` -> `/reactions`).
- Social links use **Simple Icons only**.

### `PROFILE_LINKS` format
Use this shape for each link:
```js
{
  label: "Ko-fi",
  simpleIcon: "kofi",
  iconColor: "72A5F2",
  href: "ko-fi.com/nekolessi"
}
```

Tips:
- `simpleIcon` is the Simple Icons slug (from `cdn.simpleicons.org/<slug>`).
- `iconColor` is a hex color without `#` (for example `1ED760`).
- Use `type: "email"` for email links so they become `mailto:`.

## Publish on GitHub Pages
1. Repo `Settings` -> `Pages`
2. Source: `Deploy from a branch`
3. Branch: `main`, folder: `/ (root)`
4. Save and wait for deployment

## Cloudflare Worker Setup (Views + Reactions)
Worker files live in `cloudflare-worker/`.

1. Login
```powershell
npx wrangler login
npx wrangler whoami
```

2. Create KV namespace
```powershell
npx wrangler kv namespace create PROFILE_COUNTER_KV
```

3. Copy the returned KV `id` into `cloudflare-worker/wrangler.toml`

4. Deploy
```powershell
cd cloudflare-worker
npx wrangler deploy
```

5. Set Worker URL in `script.js`
```js
const VIEW_COUNTER_WORKER_URL = "https://your-worker.workers.dev/views";
```

Important behavior:
- Page counter increments on each page load/refresh request.
- Reactions are stored in the same KV namespace.
- If KV binding is missing, Worker returns a clear JSON error.

## Troubleshooting
- Counter blank:
  - Confirm `VIEW_COUNTER_WORKER_URL` is correct and ends with `/views`
  - Confirm Worker is deployed and KV binding is configured
- Discord status not updating:
  - Check `DISCORD_USER_ID`
  - Verify Lanyard access is available for that user ID
- Style not updating on site:
  - Hard refresh (`Ctrl+F5`) after GitHub Pages finishes deploy
