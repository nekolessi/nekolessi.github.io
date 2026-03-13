# GitHub Pages Profile Template

Spicy purple-goth profile page with live Discord presence blocks.

## Files
- `index.html` - page structure
- `styles.css` - visuals and responsive styling
- `script.js` - Discord status/activity integration (Lanyard API)

## Important setup
1. Open `script.js`.
2. Replace `images/profile.png` if you want to change the default right-side photo.
3. Optional: set `HERO_PROFILE_IMAGE_URL` in `script.js` if you want to use an external image link instead of local file.
4. Edit `PROFILE_LOCATION` and the view counter constants if you want to customize the top-right hero stats.
5. Edit `DISCORD_USER_ID` if you need to change your Discord account.
6. Edit the `PROFILE_LINKS` array to add/remove/reorder social icons and links.
7. Commit and push.

Without a valid Discord ID, the middle/bottom cards show placeholder text.

## Publish on GitHub Pages
1. In the repo, go to `Settings` -> `Pages`.
2. Use `Deploy from a branch`.
3. Set branch to `main` and folder to `/ (root)`.
4. Save and wait about 1-2 minutes.
