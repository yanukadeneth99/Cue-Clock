import type { Metadata } from "next";
import { Space_Mono, Inter } from "next/font/google";
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
      name: "Cue Clock",
      alternateName: ["CueClock", "Cue-Clock"],
      url: "https://cueclock.app",
      applicationCategory: "UtilitiesApplication",
      applicationSubCategory: "Broadcast Studio Clock",
      operatingSystem: "Web, Android, iOS",
      browserRequirements: "Requires JavaScript. Modern evergreen browser.",
      description:
        "A free, open-source stage timer and countdown clock. Run unlimited cues across two timezones with alarms and a full-screen on-air view. No ads, no login. Built for anyone who runs a show on a clock: live broadcast, church services, conferences, and streams.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      },
      author: { "@id": "https://yashura.io/#org" },
      publisher: { "@id": "https://yashura.io/#org" },
      creator: { "@id": "https://yashura.io/#org" },
      license: "https://www.gnu.org/licenses/agpl-3.0.html",
      isAccessibleForFree: true,
      logo: {
        "@type": "ImageObject",
        url: "https://cueclock.app/logo_cropped.png",
      },
      image: "https://cueclock.app/logo_cropped.png",
      screenshot: "https://cueclock.app/logo_cropped.png",
      downloadUrl: "https://cueclock.app",
      installUrl:
        "https://play.google.com/store/apps/details?id=com.yanukadeneth99.cueclock",
      softwareHelp: "https://cueclock.app",
      featureList: [
        "Dual live clocks across 18 broadcast timezones",
        "Unlimited named countdown timers",
        "Deduction offsets for pre-show buffer",
        "On-Air full-screen distraction-free mode",
        "Per-timer minutes-before alerts and notifications",
        "12/24-hour clock format toggle",
        "Persistent local state via AsyncStorage",
        "Works offline, no account required",
        "Open-source under AGPL-3.0",
        "Publicly documented AI-maintained development pipeline with a monthly health scoreboard",
      ],
      keywords:
        "stage timer, countdown clock, church countdown timer, conference timer, broadcast clock, studio clock, countdown timer, on-air timer, production timer, master clock, multi-timezone clock",
      audience: {
        "@type": "Audience",
        audienceType:
          "Broadcast Professionals, Live Production Crews, Studio Operators, Radio Hosts",
      },
      sameAs: [
        "https://github.com/yanukadeneth99/Cue-Clock",
        "https://yashura.io",
      ],
    },
    {
      "@type": "Organization",
      "@id": "https://yashura.io/#org",
      name: "YASHURA",
      url: "https://yashura.io",
      email: "hello@yashura.io",
      logo: "https://cueclock.app/logo_cropped.png",
      founder: {
        "@type": "Person",
        name: "Yanuka Deneth",
        url: "https://github.com/yanukadeneth99",
      },
      sameAs: ["https://github.com/yanukadeneth99"],
    },
    {
      "@type": "WebSite",
      "@id": "https://cueclock.app/#website",
      url: "https://cueclock.app",
      name: "Cue Clock",
      description:
        "Official site for Cue Clock - a free, open-source broadcast studio clock and countdown timer.",
      publisher: { "@id": "https://yashura.io/#org" },
      inLanguage: "en-US",
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://cueclock.app/#breadcrumb",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "https://cueclock.app",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Privacy",
          item: "https://cueclock.app/privacy",
        },
      ],
    },
    {
      "@type": "FAQPage",
      "@id": "https://cueclock.app/#faq",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is Cue Clock?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Cue Clock is a free, open-source broadcast studio clock and countdown timer for live production. It shows two live clocks across 18 broadcast timezones and unlimited named countdowns, with a distraction-free on-air full-screen mode. It runs as a web app and as native Android and iOS apps.",
          },
        },
        {
          "@type": "Question",
          name: "Who is Cue Clock for?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Cue Clock is built for anyone who runs a show on a clock - TV and radio control room operators, vision mixers, producers, live-stream directors, podcast hosts, church and worship teams, and conference crews who need a reliable, no-frills timing tool during a live show.",
          },
        },
        {
          "@type": "Question",
          name: "Is Cue Clock free?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Cue Clock is completely free with no ads, no subscriptions, and no in-app purchases. It is open-source under the AGPL-3.0 license. Commercial licensing is available by contacting hello@yashura.io.",
          },
        },
        {
          "@type": "Question",
          name: "Does Cue Clock work offline?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. All timers, settings, and timezone selections are stored locally on your device using AsyncStorage on mobile and localStorage on web. Cue Clock works fully offline once loaded and never requires an account.",
          },
        },
        {
          "@type": "Question",
          name: "What is a deduction offset?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "A deduction offset subtracts a fixed duration (for example, 5 minutes of pre-show buffer) from a countdown's target time. This lets producers count down to the moment they actually need to be ready, not the on-air moment itself.",
          },
        },
        {
          "@type": "Question",
          name: "What platforms does Cue Clock support?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Cue Clock runs in any modern web browser at live.cueclock.app and is also available as native Android and iOS apps built with React Native and Expo.",
          },
        },
        {
          "@type": "Question",
          name: "Does Cue Clock collect personal data?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. Cue Clock does not collect, store, or transmit personal data or timer information to any server. Optional, anonymous usage analytics (Microsoft Clarity and Firebase Analytics) only run after you explicitly opt in on first launch and can be turned off at any time.",
          },
        },
        {
          "@type": "Question",
          name: "How many countdowns can I create?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Unlimited. You can create, name, and configure as many countdown timers as you need, each tied to its own timezone and optional minutes-before alert.",
          },
        },
        {
          "@type": "Question",
          name: "Is Cue Clock really free?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes, genuinely. Cue Clock is completely free with no ads, no subscriptions, and no in-app purchases, and it always will be. It is open-source under the AGPL-3.0 license, so you can read every line, fork it, or self-host it. Commercial licensing is available if you need it - just email hello@yashura.io.",
          },
        },
        {
          "@type": "Question",
          name: "Can I use Cue Clock as a church countdown timer?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Absolutely. Cue Clock works for any show that runs on a clock - church services, worship sets, conferences, and live streams included. Create a countdown to your service start, subtract a pre-show buffer, and switch to full-screen on-air mode so the countdown is readable from the stage or the back of the room.",
          },
        },
        {
          "@type": "Question",
          name: "Does Cue Clock sync across devices?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Not yet. Every timer and setting is stored locally on the device it was created on, so cues do not currently sync between your phone, tablet, and the web app. Cross-device sync is not available today - for now, set up your cues on the device you will actually use during the show.",
          },
        },
        {
          "@type": "Question",
          name: "How is Cue Clock different from Stagetimer?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Cue Clock is free and open-source, runs fully offline, and stores everything locally with no account required. Stagetimer is a paid, cloud-based service focused on operator-to-presenter remote control. If you need multi-user cloud sync and remote control, tools like Stagetimer fit better; if you want a free, private, no-login stage timer with dual timezones and full-screen alarms, that is what Cue Clock is built for.",
          },
        },
        {
          "@type": "Question",
          name: "Can I self-host Cue Clock?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Cue Clock is open-source under AGPL-3.0 and the web app is a static export, so you can clone the repository from GitHub and host it anywhere that serves static files. The full source, including build instructions, is public at github.com/yanukadeneth99/Cue-Clock.",
          },
        },
        {
          "@type": "Question",
          name: "Is Cue Clock maintained by AI?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Largely, yes, under human review. Issues, crash reports, and dependency updates flow through automated triage, implementation, and adversarial code review, but it's a human that presses the final Publish button for every release after testing it on Internal Release track. The project publishes a monthly AI health scoreboard, tracking merge rate, human rescues, and repair churn, in its GitHub README. This is an experiment to measure how good AI really is in a loop.",
          },
        },
      ],
    },
  ],
};

// Canonical typography pair: Inter for UI, Space Mono for all numerics
// (clocks, countdowns, internal tags). Both expose CSS variables consumed
// by globals.css `--font-sans` / `--font-mono` in @theme.
const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://cueclock.app"),
  title: {
    default: "Free Stage Timer & Countdown Clock | Cue Clock",
    template: "%s | Cue Clock",
  },
  description:
    "A free, open-source stage timer and countdown clock. Run unlimited cues across two timezones with alarms and a full-screen on-air view. No ads, no login.",
  applicationName: "Cue Clock",
  category: "productivity",
  keywords: [
    "stage timer",
    "countdown clock",
    "church countdown timer",
    "conference timer",
    "broadcast clock",
    "studio clock",
    "countdown timer",
    "stage clock",
    "live broadcast tool",
    "production timer",
    "on-air timer",
    "master clock",
    "multi-timezone clock",
    "radio studio timer",
    "podcast countdown",
    "TV studio clock",
    "live show timer",
    "show prep timer",
    "pre-show buffer",
    "broadcast professional",
    "free studio clock app",
    "open source studio clock",
    "react native clock app",
    "expo clock app",
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
    title: "Free Stage Timer & Countdown Clock | Cue Clock",
    description:
      "A free, open-source stage timer and countdown clock. Run unlimited cues across two timezones with alarms and a full-screen on-air view. No ads, no login.",
    url: "https://cueclock.app",
    siteName: "Cue Clock",
    images: [
      {
        url: "/logo_cropped.png",
        width: 512,
        height: 512,
        alt: "Cue Clock - Free Stage Timer & Countdown Clock",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Stage Timer & Countdown Clock | Cue Clock",
    description:
      "A free, open-source stage timer and countdown clock. Run unlimited cues across two timezones with alarms and a full-screen on-air view. No ads, no login.",
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
        {/*
          Dev-only CSP that permits `unsafe-eval`. React 19's dev bundle calls
          eval() once on startup to reconstruct async stack traces for DevTools;
          if the environment blocks it (browser extension CSP, strict sandbox)
          React logs a one-time warning. Production builds never use eval, so
          this meta is gated on NODE_ENV and never ships to users.
        */}
        {process.env.NODE_ENV === "development" ? (
          <meta
            httpEquiv="Content-Security-Policy"
            content="script-src 'self' 'unsafe-eval' 'unsafe-inline'"
          />
        ) : null}
        {/*
          Icons are now inline SVGs (see components/Icon.tsx), not a web font.
          That removed the Material Symbols <link> to Google Fonts, so on slow
          networks users no longer see the raw ligature words ("settings",
          "arrow_downward") or a stretched button before the font loaded. The
          Google preconnects went with it: our text fonts use next/font, which
          self-hosts them, so nothing else talks to Google Fonts at runtime.
        */}
        <link rel="icon" href="/logo_cropped.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo_cropped.png" />
        {/*
          The app-mockup's animation start-state (in globals.css) hides it
          until GSAP fades it in. If a visitor has JavaScript disabled, GSAP
          never runs, so this override paints the mockup normally for them.
          Visitors with JavaScript on ignore <noscript>, so the animation is
          unaffected.
        */}
        <noscript>
          <style
            dangerouslySetInnerHTML={{
              __html:
                ".hero-mockup{opacity:1!important;transform:none!important}",
            }}
          />
        </noscript>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
      </head>
      <body
        className={`${spaceMono.variable} ${inter.variable} font-body bg-bg-app text-fg antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
