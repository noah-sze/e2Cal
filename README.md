# e2Cal.

[English](README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md)

> A minimalist, local-first PWA for tracking nutrition, strength training, and body metrics—engineered with high-contrast monochrome aesthetics, zero backend, and full data ownership.

[![Website](https://img.shields.io/badge/website-e2cal.pages.dev-black?style=flat-square&labelColor=white)](https://e2cal.pages.dev/)
![Version](https://img.shields.io/badge/version-1.0.0-black?style=flat-square&labelColor=white)
![Platform](https://img.shields.io/badge/platform-PWA%20%7C%20Web-black?style=flat-square&labelColor=white)
![License](https://img.shields.io/badge/license-AGPL--3.0-black?style=flat-square&labelColor=white)

## FEATURES

- **Monochrome Aesthetics**: Pure black-and-white high contrast, flat hairline borders, zero drop shadows, and self-hosted Geist, Inter, and JetBrains Mono typography with strict `tabular-nums`.
- **Local-First & Offline Ready**: All nutrition, workout, and body data resides directly on your device via IndexedDB (Dexie.js)—fully functional offline as an installable Progressive Web App (PWA) with zero proprietary backend.
- **Precision Nutrition Tracking**: Edible-portion `100 g` nutritional constants, net/gross weight conversion, composite recipes, quick dining estimates, and offline search across 18,635 entries from 6 authoritative food databases (USDA, CFCT, TFDA, MEXT, AFCD, CoFID).
- **Strength & Muscle Recovery**: Brzycki estimated 1RM (`e1RM`), completed training volume, and a 17-muscle anatomical heatmap (male/female, front/back) driven by 48h/72h physiological recovery windows.
- **Body Metrics & Thermodynamic Math**: EWMA noise-smoothed trend weight (`α = 0.15`), daily thermodynamic energy balance, BMI, FFMI, Lean Body Mass, Fat Mass, V-Taper, and WHR.
- **Open Data Export (BYO-AI)**: One-click structured export of daily or full records in Markdown/Plain Text, lossless JSON, or high-DPI monochrome PNG snapshot cards for your preferred external AI or coach.
- **Dropbox Sync & ZIP Backup**: Direct browser-to-Dropbox OAuth PKCE incremental sync with LWW conflict resolution, plus human-readable full ZIP backup and restore.
- **Global Ready (i18n & Units)**: Full support for English, Traditional Chinese (`zh-TW`), and Simplified Chinese (`zh-CN`), with SI metric storage and seamless display conversion (`kg/lbs`, `g/oz`, `ml/fl oz`, `cm/in`, `kcal/kJ`).

## TECH STACK

- **Framework**: React 19 / TypeScript / Vite
- **UI & Styling**: Tailwind CSS v4 / Base UI / Radix UI / Lucide Icons
- **State Management**: Zustand
- **Local Database**: IndexedDB (Dexie.js)
- **Sync & Backup**: Dropbox API (OAuth PKCE) / JSZip
- **PWA**: vite-plugin-pwa (Workbox Service Workers & Offline Precaching)
- **Internationalization**: react-i18next
- **Testing & Linting**: Vitest / Oxlint

## INSTALLATION

### Live Web App (Instant Access)

Experience e2Cal directly in your browser or install it as a PWA:
👉 **[https://e2cal.pages.dev](https://e2cal.pages.dev/)**

### Prerequisites

Ensure you have Node.js (>= 20.0.0) and npm installed on your system.

### Quick Start (Development)

```bash
git clone https://github.com/noah-sze/e2Cal.git
cd e2Cal
npm install
npm run dev
```

### Build & Verify

```bash
npm run check:all
```

Or build production assets only:

```bash
npm run build
```

### PWA & Self-Hosting Deployment

Deploy the generated `dist/` directory to any static hosting provider supporting HTTPS (such as Cloudflare Pages, Vercel, Netlify, or GitHub Pages), or self-host using the included `Dockerfile` and `deploy/` Nginx/Caddy configurations.

## ARCHITECTURE

e2Cal follows a clean, layered architecture separating presentation, state, domain services, and local persistence:

- `src/components/`: Atomic UI primitives, precision modal dialogs, anatomical heatmaps, and domain widgets.
- `src/pages/`: Primary application views (`Dashboard`, `Diet`, `Workout`, `Body`, `Settings`, and `LandingPage`).
- `src/hooks/`: Reactive Dexie queries and decoupled business operation hooks.
- `src/services/`: IndexedDB schema & migrations, Dropbox incremental sync engine, ZIP backup/restore, authoritative food lookup, and multi-format AI export.
- `src/store/`: Lightweight global client state powered by Zustand.
- `src/utils/`: Pure, unit-tested math engines (nutrition, strength e1RM/recovery, EWMA body metrics, unit conversion, and multilingual search).
- `src/i18n/`: Localization configuration and dictionaries (`en`, `zh-TW`, `zh-CN`).

## LICENSE

This project is licensed under the GNU Affero General Public License v3 (AGPLv3). See the [LICENSE](LICENSE) file for details.
