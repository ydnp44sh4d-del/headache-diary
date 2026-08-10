# Mallock Expenses — Web App

A self-contained, installable web app for Mallock Automotive expense
logging: receipt photo scan, manual entry, category breakdown, and
Excel/PDF export. Built as a PWA so it can be added to an iPhone home
screen and used like a native app, without needing Xcode or an App Store
release.

## Run it

```sh
cd web
npm ci
npm run build      # bundles src/ into js/expense-app.bundle.js
python3 -m http.server 8080
# open http://localhost:8080
```

To use it like an app on iPhone: open the deployed URL in Safari, tap
Share → **Add to Home Screen**. It launches full-screen (no browser
chrome), works offline for the core app shell, and keeps its data between
launches.

## What's implemented

- **Receipt scan** — camera capture or photo library picker, read
  on-device with Tesseract.js (vendored locally, no server round-trip, no
  API key). Vendor/category are best-effort guesses from the OCR text;
  amount/date/currency come from `web/js/ocr.js`'s heuristics. Every scan
  opens an editable review sheet — nothing saves until you confirm.
- **Manual entry** — same review sheet, opened blank, for logging without
  a photo.
- **Category breakdown** — a stacked bar + legend across the nine expense
  categories, tap a category to filter the list.
- **Payment method** — toggle each entry between Corp Card and
  Cash/Personal; filter the list by either.
- **Excel export** — one tap builds a `.xlsx` (via SheetJS) with all
  entries and a total row, downloaded with an auto-dated filename.
- **Receipts as PDF** — opens a print-ready page with every receipt photo
  and its details, one per page, ready for "Print to PDF".

## Why there's no AI-powered auto-fill

An earlier version of this app sent the receipt photo to Claude's API for
extraction. That only works inside Claude's own artifact sandbox, which
proxies the API call and provides `window.storage` for free. Deployed as
a public static site (GitHub Pages), there's no proxy and no safe way to
hold an API key in client-side code — anyone could read it out of the
page source and run up charges on the account it belongs to. So this
version reads receipts entirely on-device with Tesseract.js instead: no
key, no server, works offline, and nothing ever leaves the phone.

## Data & persistence

Everything is local to the device/browser — no backend, no login, single
user:

- `src/main.jsx` shims `window.storage` to `localStorage` when not running
  inside Claude's artifact environment, so the same code works standalone.
- Expenses (including their receipt thumbnail as a data URL) are stored as
  a single JSON blob under the `mallock-expenses` key.

## Source layout

- `src/` — React source (`ExpenseTracker.jsx`, `receiptGuess.js`,
  `main.jsx`). Built with `npm run build` (esbuild) into
  `js/expense-app.bundle.js`, which is what `index.html` actually loads —
  React, ReactDOM and SheetJS are bundled in, so the shipped app has no
  CDN dependency and works offline once installed.
- `js/ocr.js` — the on-device OCR pipeline (lazy-loads the vendored
  Tesseract.js engine on first scan).
- `vendor/tesseract/` — vendored Tesseract.js build (Apache-2.0),
  including the English trained-data file. See its `LICENSE` file.

The GitHub Pages deploy workflow (`.github/workflows/deploy-web.yml`) runs
`npm ci && npm run build` before publishing, so the committed
`js/expense-app.bundle.js` is always rebuilt from current source rather
than deployed stale.
