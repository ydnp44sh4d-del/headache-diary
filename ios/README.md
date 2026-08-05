# Mallock Expenses — iOS App

Native SwiftUI iOS app for Mallock Automotive expense logging: receipt OCR scan,
manual entry, monthly FX rate table, dashboard stats, and audit-ready Excel
export with embedded receipt images.

## Requirements

- macOS with Xcode 15+ (targets iOS 17, uses SwiftData)
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`)
- An iPhone or Simulator running iOS 17+

This project ships as source + an `XcodeGen` spec (`project.yml`) rather than a
committed `.xcodeproj`, so the generated project always matches the file tree
and stays mergeable. It was built and reviewed without access to Xcode/macOS —
generate the project and do a first build before relying on it; see
**Known gaps** below for the things most likely to need a small fix.

## Build

```sh
cd ios
xcodegen generate
open MallockExpenseTracker.xcodeproj
```

Then build & run onto a device or simulator (`Cmd+R`). On first launch,
grant camera and photo library access when prompted (used only for receipt
capture — nothing leaves the device).

## Project layout

```
MallockExpenseTracker/
  App/                 App entry point
  Models/              Expense, MonthlyFXRate (SwiftData), Currency, Category, AppSettings
  Services/             OCR, FX conversion, Excel (.xlsx) export
  Persistence/          SwiftData ModelContainer
  DesignSystem/         Brand colors, typography, buttons, twin-triangle mark
  Views/
    Dashboard/           Summary stats + recent activity
    Expenses/             Full list, manual/scan entry form, row view
    Scan/                 Camera + photo library capture, OCR review hand-off
    Rates/                 Monthly FX rate table, starting-rate defaults
    Export/                Share-sheet Excel export button
```

## Data & persistence

- `Expense` and `MonthlyFXRate` are SwiftData models, persisted locally on
  device (no backend, no login, single user — per spec).
- Receipt images are stored with `@Attribute(.externalStorage)` on the
  `Expense` record itself, so they live and die with the expense and are
  never discarded after OCR.
- The default starting FX rate set (used to seed a brand-new month) is
  stored in `UserDefaults` via `AppSettings`, editable from the FX Rates tab.

## Known gaps to close before shipping

1. **Brand fonts.** Space Grotesk and Inter are referenced by name
   (`Theme.swift`) with an automatic fallback to the system font if the
   `.ttf` files aren't present, so the app still builds and looks reasonable
   without them. Add the actual font files to the target and they'll be
   picked up automatically — `project.yml` already lists them under
   `UIAppFonts`:
   - `SpaceGrotesk-Bold.ttf`, `SpaceGrotesk-SemiBold.ttf`
   - `Inter-Regular.ttf`, `Inter-Medium.ttf`
2. **App icon.** `Assets.xcassets/AppIcon.appiconset` has an empty single-size
   (1024×1024) slot ready — drop in the twin-triangle mark artwork on black.
3. **ZIPFoundation dependency.** The Excel exporter hand-builds the OOXML
   spreadsheet parts itself and uses [ZIPFoundation](https://github.com/weichsel/ZIPFoundation)
   purely to zip them into a `.xlsx` container (`project.yml` pins
   `from: 0.9.19`). Resolve packages on first open (Xcode does this
   automatically) and confirm the `Archive(url:accessMode:)` call in
   `ExcelExportService.swift` still matches whatever version SPM resolves —
   this hasn't been exercised against a live Xcode/SPM resolution.
4. **First real build.** None of this has been compiled — there's no Swift
   toolchain in the environment this was written in. Expect a small number
   of straightforward fixes (a typo, an API name drift) on the first build
   in Xcode.

## Feature notes

- **OCR** (`Services/ReceiptOCRService.swift`) uses on-device Vision text
  recognition, then regex/heuristics to guess amount, date, currency symbol
  and a description from the first non-empty line. Results only prefill the
  entry form — nothing is auto-saved, and a clear message is shown if
  recognition fails or finds no text.
- **FX conversion**: an expense in a non-GBP currency is converted using the
  rate recorded for *its transaction month*. If that month/currency has no
  rate yet, the expense is flagged (dashboard + list) rather than silently
  treated as zero, and excluded from totals until a rate is entered.
- **Excel export** (`Services/ExcelExportService.swift`) writes the `.xlsx`
  OOXML parts by hand (workbook, sheet, shared strings, styles, drawing) and
  anchors each expense's receipt image inline in its row, so the exported
  file is a complete record on its own.
