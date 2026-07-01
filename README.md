# 🍼 LactaLog

A static, installable progressive web app to track **baby feeding** and **pumped milk**, using a **Google Docs Sheet as the database**, built with SolidJS and Kobalte.

- **Reading** (dashboards/charts): a **private** sheet is read through the Sheets API once you sign in with a Google account that can access it. A sheet shared "Anyone with the link" is read via the public CSV endpoint with no sign-in.
- **Writing** (adding entries) uses a **"Sign in with Google" button**, because Google has no public write API: even a publicly-editable sheet can only be written through an authenticated call. The deployer creates **one** OAuth Client ID (public by design, no secret) and bakes it into the build via `VITE_GOOGLE_CLIENT_ID`. End users never see it, they just click sign in.

## The spreadsheet

Three sheets, with these columns (labels are not checked, only the order):

- **Feeding**: `Date` · `Time` · `Quantity (mL)` · `Milk type`
- **Milking**: `Date` · `Time` · `Quantity (mL)`
- **Sleeping**: `Date` · `Start` · `End` · `Duration (min)`

Missing tabs are created automatically (with a header row) the first time you add an entry to them.

Sharing options:

- **Private (recommended):** leave it private and sign in with a Google account that can edit it. Both reading and writing go through the Sheets API with your token.
- **Public:** **Share → Anyone with the link → Editor**. Charts then load without sign-in; adding entries still requires sign-in (Google has no anonymous write API).

## Features

- Add a feed (time prefilled to now, mL stepper, mother's milk / artificial)
- Add a pumping session
- Add a sleep session (start/end time, duration computed automatically)
- Dashboards: today totals, per-day volume, source split, time-of-day distribution, recent log
- **Expected intake** by age/weight: total mL/day, an age-based number of feeds, and the
  resulting per-bottle amount (the form prefills with it). Feeds/day auto-decreases with age
  (override in Settings). Rough guideline, not medical advice.
- **"Time for a feed?"** section: live countdown to the next feed from the last logged one
  using the age-based interval, with an alert when it's due
- Offline-capable, installable to the home screen

## Development

Install:

```bash
npm i
```

Start dev server:

```sh
npm run dev
```

Build static output in `dist/`:

```sh
npm run build && npm run preview
```

### New release

Choose the bump type: `patch`, `minor`, `major`

```sh
npm version patch
```

### Deploy to GitHub Pages

1. Push to a repo (the app is served under `/<repo-name>/`).
2. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Pushing to `main` runs `.github/workflows/deploy.yml`, which builds and publishes `dist/`.

Your app URL will be `https://<user>.github.io/<repo-name>/`.

### Google OAuth Client ID setup

Done **once by whoever deploys the app**. End users just click "Sign in with Google".

1. Go to <https://console.cloud.google.com/> and create (or pick) a project.
2. **APIs & Services → Library →** enable **Google Sheets API**.
3. **APIs & Services → OAuth consent screen**: choose _External_, fill the app name and your email. Add yourself (and anyone else who will add entries) under **Test users**. You can leave it in "Testing" mode; you'll just click through an "unverified app" notice.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**.
   Under **Authorized JavaScript origins** add:
   - `http://localhost:5173` (for local dev)
   - `https://<user>.github.io` (your Pages origin, no path)
5. [**Enable the Google Sheets API**](https://console.cloud.google.com/apis/library/sheets.googleapis.com) in the same project: **APIs & Services → Library → Google write**.)
6. Copy the **Client ID** (`...apps.googleusercontent.com`) and paste it into [`src/lib/storage.ts`](src/lib/storage.ts) (`GOOGLE_CLIENT_ID`), then commit. It's public by design (it ships in the bundle anyway), so committing it in plain text is fine.
   - Optional CI override: set a repo **Variable** `VITE_GOOGLE_CLIENT_ID` (used only if `GOOGLE_CLIENT_ID` is left at its placeholder). Local dev can use `.env` the same way.

Then anyone opening the app only pastes the **spreadsheet URL** and the **baby's birth date**
on the first-run screen, and clicks **Sign in with Google** to add entries.

## Notes

- Settings (spreadsheet URL, birth date) are stored only in your browser's `localStorage`. Nothing is sent anywhere except Google.
- **Staying signed in:** the OAuth access token is cached in `localStorage` and reused across reloads until it expires (~1h). After that the app tries a silent refresh (no popup) using your existing Google session, and only shows the Sign in button if that fails. Use the "Signed in" button to sign out.
- Expected-intake figures are a rough guideline, **not medical advice**.
