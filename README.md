# nekolessi dot github dot io ♡

> a very serious website made by a very serious girl who definitely knew what she was doing the whole time

this is my little catgirl profile page!! it has live discord stuff, links, reactions, a page counter, and several technologies i introduced to each other and then begged to get along. somehow it works. mostly 🎀

[look at her live](https://nekolessi.github.io/) · [look at the code if u must](https://github.com/nekolessi/nekolessi.github.io)

## whats in here

- a cute profile card with my links
- live discord status/activity via [Lanyard](https://github.com/Phineas/lanyard)
- page views + little reaction buttons powered by a Cloudflare Worker
- everything important-ish lives in `src/config.js` so u dont have to go spelunking
- responsive styling because apparently people own phones
- hopes. dreams. javascript

## the file situation

```text
index.html                 the bones
styles.css                 the outfit
script.js                  presses the big start button
src/config.js              words, links, ids, little settings, etc
src/app.js                 wires the page together (emotionally unavailable)
src/presence.js            discord/lanyard stuff
src/reactions.js           the clicky heart situation
src/helpers.js             tiny useful guys
scripts/check.mjs          checks if i broke anything obvious
scripts/site.test.mjs      tests the browser-y bits
scripts/worker.test.mjs    tests the cloudy bits
images/                    png containment zone
cloudflare-worker/         views, reactions, admin api + discord app icons
```

## running it without crying

you need Node `>=20.19.0`.

```bash
npm install
npm run verify
```

`npm run verify` does validation, linting, formatting checks, site tests, and worker tests. if it passes then congrats the computer has forgiven u.

## changing the profile stuff

open `src/config.js`. this is where most of the things you actually care about are hiding:

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

if `heroProfileImageUrl` is empty it uses `images/profile.png`, which is very considerate of her. reaction and discord app-icon URLs are worked out from `viewCounterWorkerUrl`. `UI_TEXT` has all the little labels/fallback messages so u can change the vibe without touching the scary logic.

### adding a link

```js
{
  label: "Ko-fi",
  simpleIcon: "kofi",
  iconColor: "72A5F2",
  href: "ko-fi.com/nekolessi"
}
```

`simpleIcon` is the slug from `cdn.simpleicons.org/<slug>`. colors are hex without the `#` because of reasons. for email links add `type: "email"` and it becomes a `mailto:` link automagically.

### the profile-shaped object

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

### app config (danger drawer)

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

### changing the tiny words

```js
const UI_TEXT = {
  statusEyebrow: "DISCORD STATUS",
  activityEyebrow: "NOW PLAYING / LISTENING",
  reactionsTitle: "click if you like catgirls",
  activityEmptyTitle: "Nothing active right now",
};
```

### adding reactions (free dopamine)

```js
const PROFILE_REACTIONS = [
  { id: "heart", emoji: "\\u{1F497}", label: "Like catgirls" },
];
```

each reaction needs a stable `id`. `emoji` is what people mash and `label` is the accessible text/status copy. accessibility is cute actually.

## putting her on github pages

1. go to the repo's **Settings**
2. click **Pages**
3. choose **Deploy from a branch**
4. pick `main` and `/ (root)`
5. save and stare at the Actions tab until something happens

## cloudflare worker setup (ominous)

the worker lives in `cloudflare-worker/` and handles `/views`, `/reactions`, `/admin/views`, and `/discord-app/:id`.

first, log in:

```bash
npx wrangler login
npx wrangler whoami
```

then check `cloudflare-worker/wrangler.toml`:

- set `ALLOWED_ORIGINS` to your site origin if you use a custom domain
- change `VIEW_MIN_INTERVAL_MS` if you want a different per-IP view cooldown
- change `REACTION_MIN_INTERVAL_MS` for the reaction cooldown
- add an `ADMIN_API_TOKEN` secret if you want to read/reset the counter without letting every random creature on the internet do it too

deploy the beast:

```bash
cd cloudflare-worker
npx wrangler deploy
```

for admin access:

```bash
npx wrangler secret put ADMIN_API_TOKEN
```

and put the resulting URL in `src/config.js`:

```js
const APP_CONFIG = {
  viewCounterWorkerUrl: "https://your-worker.workers.dev/views",
};
```

important things i learned against my will:

- views and reactions use a Durable Object so simultaneous requests dont eat each other
- view increments and reaction posts need an allowed origin
- both are rate-limited by client IP
- admin reads/resets need the bearer token from `ADMIN_API_TOKEN`
- discord app icons go through the worker instead of relying on `allorigins`
- a missing Durable Object binding returns an actual JSON error instead of silently evaporating

### poke it with a stick

```powershell
curl.exe -i -H "Origin: https://nekolessi.github.io" https://your-worker.workers.dev/views
curl.exe -i https://your-worker.workers.dev/reactions
curl.exe -i -H "Origin: https://nekolessi.github.io" https://your-worker.workers.dev/discord-app/1445976703066443846
```

the default view cooldown is 2 minutes per IP (`VIEW_MIN_INTERVAL_MS = "120000"`). lower it if refreshes should count sooner. raise it if u wish to become more powerful than the spammers.

read or reset the stored view count:

```powershell
curl.exe -i -H "Authorization: Bearer YOUR_ADMIN_API_TOKEN" https://your-worker.workers.dev/admin/views
curl.exe -i -X POST -H "Authorization: Bearer YOUR_ADMIN_API_TOKEN" -H "Content-Type: application/json" https://your-worker.workers.dev/admin/views -d "{\"count\":299}"
```

setting it to `299` makes the next real page load show about `300` because `/views` increments before returning. yes this is slightly haunted.

## she isnt working help

### the counter is blank

- make sure `APP_CONFIG.viewCounterWorkerUrl` ends in `/views`
- make sure the worker is deployed and the `PROFILE_COUNTER` Durable Object binding exists
- make sure your origin is in `ALLOWED_ORIGINS`
- whisper “please” near the router (optional)

### discord status is lying / frozen

- check `APP_CONFIG.discordUserId`
- make sure Lanyard can see that user
- discord may simply be having a moment. relatable

### the css refuses to acknowledge my changes

wait for GitHub Pages to deploy, then hard refresh with `Ctrl+F5`. browsers love keeping an old stylesheet around like an emotional support ex.

## ok thats all

made with pink pixels, avoidable complexity, and the unearned confidence of someone typing `git push` at 2am ♡
