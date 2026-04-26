import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";

/**
 * Structured data graph (JSON-LD) for SEO + GEO (Generative Engine Optimization).
 * Combines WebApplication, SoftwareApplication, Organization, WebSite, FAQPage, and
 * BreadcrumbList into a single @graph so AI answer engines (ChatGPT, Claude, Perplexity,
 * Gemini) can extract canonical facts, FAQs, and authorship with high confidence.
 */
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["WebApplication", "SoftwareApplication"],
      "@id": "https://cueclock.app/#app",
      "name": "Cue Clock",
      "alternateName": ["CueClock", "Cue-Clock"],
      "url": "https://cueclock.app",
      "applicationCategory": "UtilitiesApplication",
      "applicationSubCategory": "Broadcast Studio Clock",
      "operatingSystem": "Web, Android, iOS",
      "browserRequirements": "Requires JavaScript. Modern evergreen browser.",
      "softwareVersion": "1.0",
      "description": "A minimal, distraction-free clock app built specifically for broadcast professionals who need to monitor multiple timezones and track countdown timers simultaneously. Completely free and open-source.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD", "availability": "https://schema.org/InStock" },
      "author": { "@id": "https://yashura.io/#org" },
      "publisher": { "@id": "https://yashura.io/#org" },
      "creator": { "@id": "https://yashura.io/#org" },
      "license": "https://www.gnu.org/licenses/agpl-3.0.html",
      "isAccessibleForFree": true,
      "logo": { "@type": "ImageObject", "url": "https://cueclock.app/logo_cropped.png" },
      "image": "https://cueclock.app/logo_cropped.png",
      "screenshot": "https://cueclock.app/logo_cropped.png",
      "downloadUrl": "https://cueclock.app",
      "installUrl": "https://play.google.com/store/apps/details?id=com.yanukadeneth99.cueclock",
      "softwareHelp": "https://cueclock.app",
      "featureList": [
        "Dual live clocks across 18 broadcast timezones",
        "Unlimited named countdown timers",
        "Deduction offsets for pre-show buffer",
        "On-Air full-screen distraction-free mode",
        "Per-timer minutes-before alerts and notifications",
        "12/24-hour clock format toggle",
        "Persistent local state via AsyncStorage",
        "Works offline, no account required",
        "Open-source under AGPL-3.0",
      ],
      "keywords": "broadcast clock, studio clock, countdown timer, gallery clock, on-air timer, production timer, master clock, multi-timezone clock",
      "audience": { "@type": "Audience", "audienceType": "Broadcast Professionals, Live Production Crews, Studio Operators, Radio Hosts" },
      "sameAs": [
        "https://github.com/yanukadeneth99/Cue-Clock",
        "https://yashura.io",
      ],
    },
    {
      "@type": "Organization",
      "@id": "https://yashura.io/#org",
      "name": "YASHURA",
      "url": "https://yashura.io",
      "email": "hello@yashura.io",
      "logo": "https://cueclock.app/logo_cropped.png",
      "founder": { "@type": "Person", "name": "Yanuka Deneth", "url": "https://github.com/yanukadeneth99" },
      "sameAs": ["https://github.com/yanukadeneth99"],
    },
    {
      "@type": "WebSite",
      "@id": "https://cueclock.app/#website",
      "url": "https://cueclock.app",
      "name": "Cue Clock",
      "description": "Official site for Cue Clock — a free, open-source broadcast studio clock and countdown timer.",
      "publisher": { "@id": "https://yashura.io/#org" },
      "inLanguage": "en-US",
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://cueclock.app/#breadcrumb",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://cueclock.app" },
        { "@type": "ListItem", "position": 2, "name": "Privacy", "item": "https://cueclock.app/privacy" },
      ],
    },
    {
      "@type": "FAQPage",
      "@id": "https://cueclock.app/#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is Cue Clock?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Cue Clock is a free, open-source broadcast studio clock and countdown timer for live production. It shows two live clocks across 18 broadcast timezones and unlimited named countdowns, with a distraction-free on-air full-screen mode. It runs as a web app and as native Android and iOS apps.",
          },
        },
        {
          "@type": "Question",
          "name": "Who is Cue Clock for?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Cue Clock is built for broadcast professionals — TV and radio gallery operators, vision mixers, producers, live-stream directors, podcast hosts, and studio crews who need a reliable, no-frills timing tool during live production.",
          },
        },
        {
          "@type": "Question",
          "name": "Is Cue Clock free?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Cue Clock is completely free with no ads, no subscriptions, and no in-app purchases. It is open-source under the AGPL-3.0 license. Commercial licensing is available by contacting hello@yashura.io.",
          },
        },
        {
          "@type": "Question",
          "name": "Does Cue Clock work offline?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. All timers, settings, and timezone selections are stored locally on your device using AsyncStorage on mobile and localStorage on web. Cue Clock works fully offline once loaded and never requires an account.",
          },
        },
        {
          "@type": "Question",
          "name": "What is a deduction offset?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "A deduction offset subtracts a fixed duration (for example, 5 minutes of pre-show buffer) from a countdown's target time. This lets producers count down to the moment they actually need to be ready, not the on-air moment itself.",
          },
        },
        {
          "@type": "Question",
          "name": "What platforms does Cue Clock support?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Cue Clock runs in any modern web browser at live.cueclock.app and is also available as native Android and iOS apps built with React Native and Expo.",
          },
        },
        {
          "@type": "Question",
          "name": "Does Cue Clock collect personal data?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "No. Cue Clock does not collect, store, or transmit personal data or timer information to any server. Optional, anonymous usage analytics (Microsoft Clarity and Firebase Analytics) only run after you explicitly opt in on first launch and can be turned off at any time.",
          },
        },
        {
          "@type": "Question",
          "name": "How many countdowns can I create?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Unlimited. You can create, name, and configure as many countdown timers as you need, each tied to its own timezone and optional minutes-before alert.",
          },
        },
      ],
    },
  ],
};

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://cueclock.app"),
  title: {
    default: "Cue Clock | Simple Timer for Live Broadcasts",
    template: "%s | Cue Clock"
  },
  description: "A minimal, distraction-free clock app built specifically for broadcast professionals who need to monitor multiple timezones and track countdown timers simultaneously. Completely free and open-source.",
  applicationName: "Cue Clock",
  category: "productivity",
  keywords: [
    "broadcast clock", "studio clock", "countdown timer", "gallery clock",
    "live broadcast tool", "production timer", "on-air timer", "master clock",
    "multi-timezone clock", "radio studio timer", "podcast countdown",
    "TV gallery clock", "live show timer", "show prep timer", "pre-show buffer",
    "broadcast professional", "free studio clock app", "open source studio clock",
    "react native clock app", "expo clock app",
  ],
  authors: [{ name: "YASHURA", url: "https://yashura.io" }],
  creator: "YASHURA",
  publisher: "YASHURA",
  referrer: "origin-when-cross-origin",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "Cue Clock | Simple Timer for Live Broadcasts",
    description: "Minimal, distraction-free clock app for broadcast professionals. Monitor multiple timezones and track countdowns simultaneously.",
    url: "https://cueclock.app",
    siteName: "Cue Clock",
    images: [
      {
        url: "/logo_cropped.png",
        width: 512,
        height: 512,
        alt: "Cue Clock - Simple Timer for Live Broadcasts",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cue Clock | Simple Timer for Live Broadcasts",
    description: "Minimal, distraction-free clock app for broadcast professionals. Monitor multiple timezones and track countdowns simultaneously.",
    creator: "@yanukadeneth99",
    images: ["/logo_cropped.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://cueclock.app",
  },
};

/**
 * Root layout for the Next.js app.
 * Applies global fonts, metadata, and base CSS.
 * @param children - Page content rendered inside the layout.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet" />
        <link rel="icon" href="/logo_cropped.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo_cropped.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
      </head>
      <body className={`${spaceGrotesk.variable} ${inter.variable} font-body bg-surface text-on-surface antialiased`}>
        {children}
      </body>
    </html>
  );
}
