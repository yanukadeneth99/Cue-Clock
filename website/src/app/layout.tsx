import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Cue Clock",
  "url": "https://cueclock.app",
  "applicationCategory": "UtilitiesApplication",
  "operatingSystem": "Web, Android, iOS",
  "description": "A minimal, distraction-free clock app built specifically for broadcast professionals who need to monitor multiple timezones and track countdown timers simultaneously. Completely free and open-source.",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
  "author": { "@type": "Person", "name": "YASHURA", "url": "https://yashura.io" },
  "publisher": { "@type": "Organization", "name": "YASHURA", "url": "https://yashura.io" },
  "logo": { "@type": "ImageObject", "url": "https://cueclock.app/logo_cropped.png" },
  "screenshot": "https://cueclock.app/logo_cropped.png",
  "featureList": ["Dual Live Clocks", "Multiple Countdowns", "Deduction Offsets", "On-Air Mode", "Persistent State", "Per-Timer Alerts"],
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
  keywords: ["broadcast clock", "studio clock", "countdown timer", "gallery clock", "live broadcast tool", "production timer", "time management", "broadcast professional"],
  authors: [{ name: "YASHURA", url: "https://yashura.io" }],
  creator: "YASHURA",
  publisher: "YASHURA",
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
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block" rel="stylesheet" />
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
