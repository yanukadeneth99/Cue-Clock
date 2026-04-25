# Cue Clock — Website

The Next.js landing page for [cueclock.app](https://cueclock.app). A fully animated, SEO-optimized marketing site for the Cue Clock broadcast tool.

> Looking for the mobile app? See [`../app/`](../app/README.md).
> Looking for the project overview? See the [root README](../README.md).

---

## What's in Here

| Route           | Description                                                           |
| --------------- | --------------------------------------------------------------------- |
| `/`             | Landing page — hero, feature highlights, story, download CTA, credits |
| `/privacy`      | Privacy policy (data collection, analytics opt-out)                   |
| `robots.ts`     | Dynamic `robots.txt` generation                                       |
| `sitemap.ts`    | Dynamic sitemap for `cueclock.app`                                    |

### Key Features

- **GSAP animations** — Hero entrance, scroll-triggered reveals via `ScrollTrigger`
- **Live GitHub stats** — Stars, forks, last commit, and CI run status fetched from the GitHub API at runtime
- **Contributor grid** — Pulls live contributor avatars from the GitHub API
- **Platform-aware download CTA** — Detects Android/iOS/Web and highlights the relevant download button
- **Full SEO** — OpenGraph, Twitter Card, JSON-LD structured data, canonical URL, sitemap
- **Dark broadcast theme** — Matches the mobile app's dark blue-gray palette

---

## Quick Start

```bash
cd website
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Scripts

| Command         | What it does                 |
| --------------- | ---------------------------- |
| `npm run dev`   | Start Next.js dev server     |
| `npm run build` | Production build             |
| `npm run start` | Serve the production build   |
| `npm run lint`  | Run ESLint                   |

---

## Tech Stack

| Layer      | Technology                    | Version  |
| ---------- | ----------------------------- | -------- |
| Framework  | Next.js (App Router)          | 16.2.3   |
| React      | React                         | 19.2.4   |
| Animations | GSAP + `@gsap/react`          | 3.14.2   |
| Styling    | Tailwind CSS                  | 4        |
| Fonts      | Space Grotesk (headings), Inter (body) | Google Fonts |
| Language   | TypeScript (strict)           | 6        |

---

## Project Layout

```
website/
├── src/app/
│   ├── page.tsx        # Landing page — all sections + GSAP animations
│   ├── layout.tsx      # Root layout: SEO metadata, fonts, JSON-LD, dark theme
│   ├── globals.css     # Tailwind 4, Material Icons, glassmorphism utilities
│   ├── robots.ts       # robots.txt generation
│   ├── sitemap.ts      # Sitemap generation (cueclock.app)
│   └── privacy/
│       └── page.tsx    # Privacy policy page
└── public/             # Static assets (SVGs, logo)
```

---

## 💛 Support

Cue Clock is free, open-source, and **will never have ads**. If you find it useful, consider supporting its development:

<a href="https://ko-fi.com/yanukadeneth99" target="_blank">
  <img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Support me on Ko-fi" height="36" />
</a>

---

## Contributing

Issues and PRs are welcome! Read [`../CONTRIBUTING.md`](../CONTRIBUTING.md) before starting work.

## License

AGPL-3.0. See [`../LICENSE`](../LICENSE). Commercial licensing: [hello@yashura.io](mailto:hello@yashura.io).
