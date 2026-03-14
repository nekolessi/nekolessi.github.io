# GitHub Pages Profile Template

Fancy purple profile page with live Discord presence blocks.

## Files
- `index.html` - page structure
- `styles.css` - visuals and responsive styling
- `script.js` - Discord status/activity integration (Lanyard API)

## Important setup
1. Open `script.js`.
2. Replace `images/profile.png` if you want to change the default right-side photo.
3. Optional: set `HERO_PROFILE_IMAGE_URL` in `script.js` if you want to use an external image link instead of local file.
4. Optional but recommended: set `VIEW_COUNTER_WORKER_URL` in `script.js` to your Cloudflare Worker endpoint for reliable live page views.
   If left blank, the page falls back to the visitor badge source (`VIEW_BADGE_URL`).
5. Edit `PROFILE_LOCATION` if you want to customize the top-right hero stats.
6. Edit `DISCORD_USER_ID` if you need to change your Discord account.
7. Edit the `PROFILE_LINKS` array to add/remove/reorder social icons and links.
8. Commit and push.

Without a valid Discord ID, the middle/bottom cards show placeholder text.

## Publish on GitHub Pages
1. In the repo, go to `Settings` -> `Pages`.
2. Use `Deploy from a branch`.
3. Set branch to `main` and folder to `/ (root)`.
4. Save and wait about 1-2 minutes.

## Cloudflare Worker Counter (recommended)
This repo includes a tiny Worker at `cloudflare-worker/src/index.js`.

1. Install and login:
   - `npx wrangler login`
   - `npx wrangler whoami`
2. Create KV namespace:
   - `npx wrangler kv namespace create PROFILE_COUNTER_KV`
3. Copy the returned namespace `id` into:
   - `cloudflare-worker/wrangler.toml` (`id = "..."`)
4. Deploy from the worker folder:
   - `cd cloudflare-worker`
   - `npx wrangler deploy`
5. Copy your Worker URL and set in `script.js`:
   - `const VIEW_COUNTER_WORKER_URL = "https://your-worker.workers.dev/views";`
6. Commit/push site changes.

Notes:
- This counter increments on each page load/refresh request (it is not unique-visitor tracking).
- The same Worker also serves profile reactions at `/reactions` (the site auto-derives this URL from `VIEW_COUNTER_WORKER_URL`).
- If you change Worker code, run `npx wrangler deploy` again to publish updates.
