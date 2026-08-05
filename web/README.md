# Mallock Expenses — Web App

A self-contained, installable web app for Mallock Automotive expense
logging: receipt OCR scan, manual entry, monthly FX rate table, dashboard
stats, and audit-ready Excel export with embedded receipt images. Built as
a PWA so it can be added to an iPhone home screen and used like a native
app, without needing Xcode or an App Store release.

## Run it

Any static file server works — the app is plain HTML/CSS/JS, no build step.

```sh
cd web
python3 -m http.server 8080
# open http://localhost:8080
```

To use it like an app on iPhone: open that URL in Safari, tap Share →
**Add to Home Screen**. It launches full-screen (no browser chrome), works
offline for the core app shell, and keeps its data between launches.

## What's implemented

- **Dashboard** — total spend, this month's spend, entry count, top
  category, with a banner flagging entries excluded from totals due to a
  missing FX rate.
- **Manual entry** — Date, Description, Category, Amount, Currency, with a
  live GBP conversion preview.
- **Receipt scan** — camera capture or photo library picker
  (`<input type="file" capture>`), on-device OCR (Tesseract.js, vendored
  locally — no server round-trip), heuristics for amount/date/currency/
  description. Results only prefill the entry form; nothing auto-saves, and
  a clear message shows if recognition fails.
- **FX rate table** — editable EUR/USD/CHF → GBP rate per month. New months
  auto-seed from the closest earlier month, or a configurable starting rate
  set, editable from the gear icon.
- **Expenses list** — sortable by date, original + GBP shown side by side,
  inline delete, missing-rate badge.
- **Excel export** — one tap builds a `.xlsx` (via ExcelJS, vendored
  locally) with each row's receipt image embedded inline, and downloads it
  with an auto-dated filename.

## Data & persistence

Everything is local to the device/browser — no backend, no login, single
user, per the brief:

- `expenses` and `fxRates` are IndexedDB object stores (`web/js/db.js`).
  Receipt images are kept as `Blob`s attached to their expense record, never
  discarded after OCR.
- The default starting FX rate set is stored in `localStorage`
  (`web/js/fx.js`), editable from the FX Rates screen.

## Vendored libraries (no CDN dependency)

`web/vendor/` ships self-hosted builds of the two libraries the app needs,
so scanning and exporting work offline and don't depend on a third-party
CDN being reachable:

- **Tesseract.js** (`vendor/tesseract/`, Apache-2.0) — OCR engine, including
  the English trained-data file.
- **ExcelJS** (`vendor/exceljs/`, MIT) — `.xlsx` generation with embedded
  images.

Both were pulled from the npm registry, not modified. See each folder's
`LICENSE` file. They're only loaded (via a plain `<script>` tag) when the
scan or export feature is actually used, so normal browsing doesn't pay
their ~6MB combined weight.

## Verified

Exercised end-to-end with Playwright against a local server during
development: manual entry, dashboard totals/top-category math, FX rate
editing and month-seeding, the full scan → OCR → review-and-save flow
against a synthetic test receipt (correctly extracted date/description/
amount/currency), and the Excel export — the downloaded `.xlsx` was
unzipped and its OOXML drawing relationships inspected by hand to confirm
the embedded receipt image is wired up correctly (`sheet1.xml` →
`drawing1.xml` → `media/image1.jpeg`).

Not yet exercised: a real phone camera capture (only the file-input/OCR
pipeline was tested, via a synthetically generated receipt image) and the
actual "Add to Home Screen" install flow on an iPhone.
