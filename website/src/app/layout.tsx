import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://cueclock.app"),
  title: {
    default: "Cue Clock | Simple Timer for Live Broadcasts",
    template: "%s | Cue Clock"
  },
  description: "A minimal, distraction-free clock app built specifically for broadcast professionals who need to monitor multiple timezones and track countdown timers simultaneously. Completely free and open-source.",
  keywords: ["broadcast clock", "studio clock", "countdown timer", "gallery clock", "live broadcast tool", "production timer", "time management", "broadcast professional"],
  authors: [{ name: "Yanuka Deneth", url: "https://yanukadeneth.com" }],
  creator: "Yanuka Deneth",
  publisher: "Yanuka Deneth",
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
        url: "/og-image.png", // User should add this file to public
        width: 1200,
        height: 630,
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
    creator: "@yanukadeneth",
    images: ["/og-image.png"],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link 
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body className={`${spaceGrotesk.variable} ${inter.variable} font-body bg-surface text-on-surface antialiased`}>
        {children}
      </body>
    </html>
  );
}
