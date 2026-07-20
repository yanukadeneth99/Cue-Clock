import type { Metadata } from "next";
import Link from "next/link";

/**
 * SEO landing page for churches searching for a countdown timer.
 *
 * This is a standalone, statically-rendered page (no client JS): the whole
 * point is that search engines see the copy and headings directly. It reuses
 * the site's design tokens (page → bg-app → card surfaces, blue accent) so it
 * looks like the rest of Cue Clock, but it is written for one audience -
 * churches counting down to a service.
 */

// The layout adds " | Cue Clock" via its title template, so the browser tab
// reads exactly: "Free Church Countdown Timer | Cue Clock".
export const metadata: Metadata = {
  title: "Free Church Countdown Timer",
  description:
    "A free, open-source countdown timer for church services. Count down to service start, run multiple cues, and show a full-screen countdown. No ads, no login, no subscription.",
  keywords: [
    "church countdown timer",
    "free church countdown timer",
    "service countdown",
    "worship countdown",
    "countdown clock for church service",
  ],
  alternates: { canonical: "https://cueclock.app/church-countdown-timer" },
  openGraph: {
    title: "Free Church Countdown Timer | Cue Clock",
    description:
      "A free, open-source countdown timer for church services. Count down to service start, run multiple cues, and show a full-screen countdown. No ads, no login, no subscription.",
    url: "https://cueclock.app/church-countdown-timer",
    siteName: "Cue Clock",
    type: "website",
    images: [
      {
        url: "/logo_cropped.png",
        width: 512,
        height: 512,
        alt: "Cue Clock - Free Church Countdown Timer",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Church Countdown Timer | Cue Clock",
    description:
      "A free, open-source countdown timer for church services. Count down to service start and show a full-screen countdown. No ads, no login.",
    images: ["/logo_cropped.png"],
  },
  robots: { index: true, follow: true },
};

const APP_URL = "https://live.cueclock.app";
const PLAY_URL =
  "https://play.google.com/store/apps/details?id=com.yanukadeneth99.cueclock";

export default function ChurchCountdownTimer() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-page text-fg selection:bg-accent/30">
      {/* Top bar - brand on the left, a link back home and a live-app button */}
      <nav className="sticky top-0 z-50 border-b border-card-border/60 bg-page/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-screen-xl items-center justify-between px-4 py-4 md:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="text-[15px] font-semibold tracking-[-0.01em] text-fg">
              Cue Clock
            </span>
          </Link>
          <a
            href={APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="cta-primary px-5 py-2.5 text-sm"
          >
            Open the timer
          </a>
        </div>
      </nav>

      <main>
        {/* ─── Hero ──────────────────────────────────────────────── */}
        <section className="relative overflow-hidden px-4 pt-16 pb-16 md:px-6 md:pt-24 md:pb-24">
          <div className="absolute top-0 right-0 h-[420px] w-[420px] rounded-full bg-accent/[0.07] blur-[120px]" />
          <div className="relative z-10 mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-accent" />
              <span className="font-sans text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
                Free · No login · No ads
              </span>
            </div>
            <h1 className="mb-6 font-sans text-[32px] font-semibold leading-[1.08] tracking-[-0.02em] text-fg sm:text-5xl md:text-6xl">
              A free church countdown timer for your service
            </h1>
            <p className="mx-auto mb-6 max-w-xl text-base leading-relaxed text-fg-muted md:text-lg">
              Cue Clock is a free church countdown timer that counts down to
              your service start. Set your worship countdown, run multiple cues,
              and put a giant countdown clock for your church service on the
              screen so everyone can see it.
            </p>

            {/* The most important thing to say up front: this is a real clock,
                not a video. A lot of church searches want a music video loop. */}
            <div className="mx-auto mb-10 max-w-xl rounded-[16px] border border-countdown/30 bg-countdown/[0.08] px-5 py-4">
              <p className="text-sm leading-relaxed text-fg md:text-base">
                <span className="font-semibold text-countdown">
                  This is a live countdown clock, not a countdown video.
                </span>{" "}
                It counts down in real time to the exact minute your service
                starts - so it is always accurate, never a fixed 5-minute loop.
              </p>
            </div>

            <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <a
                href={APP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="cta-primary inline-flex items-center justify-center gap-2.5 px-7 py-4 text-sm transition-all hover:brightness-110 active:scale-[0.98]"
              >
                Start your countdown
                <span className="material-symbols-outlined text-base">
                  arrow_forward
                </span>
              </a>
              <a
                href="#how-to-use"
                className="inline-flex items-center justify-center rounded-[14px] border border-card-border px-7 py-4 text-sm font-semibold text-fg transition-colors hover:bg-card"
              >
                See how it works
              </a>
            </div>
          </div>
        </section>

        {/* ─── Features ──────────────────────────────────────────── */}
        <section className="border-y border-card-border bg-bg-app px-4 py-20 md:px-6 md:py-28">
          <div className="mx-auto max-w-screen-xl">
            <div className="mb-14 text-center">
              <div className="mb-4 inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-accent" />
                <span className="font-sans text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
                  Built for church services
                </span>
              </div>
              <h2 className="font-sans text-3xl font-semibold tracking-[-0.02em] text-fg md:text-5xl">
                Everything your service countdown needs
              </h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <FeatureCard key={f.title} {...f} />
              ))}
            </div>
          </div>
        </section>

        {/* ─── How to use ────────────────────────────────────────── */}
        <section
          id="how-to-use"
          className="px-4 py-20 md:px-6 md:py-28"
        >
          <div className="mx-auto max-w-3xl">
            <div className="mb-12 text-center">
              <div className="mb-4 inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-accent" />
                <span className="font-sans text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
                  Quick guide
                </span>
              </div>
              <h2 className="font-sans text-3xl font-semibold tracking-[-0.02em] text-fg md:text-5xl">
                Set up a worship countdown in a minute
              </h2>
            </div>
            <ol className="space-y-4">
              {STEPS.map((step, i) => (
                <li
                  key={step.title}
                  className="surface-card flex items-start gap-5 p-6"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent font-mono text-[15px] font-bold text-page tabular-nums">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="mb-1 font-sans text-lg font-semibold tracking-[-0.01em] text-fg">
                      {step.title}
                    </h3>
                    <p className="text-[15px] leading-relaxed text-fg-muted">
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ─── Get started ───────────────────────────────────────── */}
        <section className="relative overflow-hidden border-t border-card-border bg-bg-app px-4 py-20 text-center md:px-6 md:py-28">
          <div className="absolute bottom-0 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-accent/[0.07] blur-[120px]" />
          <div className="relative z-10 mx-auto max-w-2xl">
            <h2 className="mb-5 font-sans text-3xl font-semibold tracking-[-0.02em] text-fg md:text-5xl">
              Get started now
            </h2>
            <p className="mx-auto mb-10 max-w-lg text-base leading-relaxed text-fg-muted md:text-lg">
              Open Cue Clock in your browser and start your first service
              countdown - no sign-up, no download needed. Prefer an app? It is
              on Android too, and it keeps working even with no internet.
            </p>
            <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <a
                href={APP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="cta-primary inline-flex items-center justify-center gap-2.5 px-7 py-4 text-sm transition-all hover:brightness-110 active:scale-[0.98]"
              >
                Open the free countdown timer
                <span className="material-symbols-outlined text-base">
                  arrow_forward
                </span>
              </a>
              <a
                href={PLAY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 rounded-[14px] border border-card-border px-7 py-4 text-sm font-semibold text-fg transition-colors hover:bg-card"
              >
                Get it on Android
                <span className="material-symbols-outlined text-base">
                  phone_android
                </span>
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ─── Footer ────────────────────────────────────────────── */}
      <footer className="border-t border-card-border">
        <div className="mx-auto flex w-full max-w-screen-xl flex-col items-center justify-between gap-4 px-6 py-8 md:flex-row">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="font-sans text-[13px] font-medium text-fg-muted">
              Cue Clock · AGPL-3.0
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-[12px] font-medium tracking-wide text-fg-muted uppercase transition-colors hover:text-accent"
            >
              Home
            </Link>
            <Link
              href="/privacy"
              className="text-[12px] font-medium tracking-wide text-fg-muted uppercase transition-colors hover:text-accent"
            >
              Privacy policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─── Content ─────────────────────────────────────────────────────── */

const FEATURES: { title: string; icon: string; description: string }[] = [
  {
    title: "Count down to service start",
    icon: "schedule",
    description:
      "Pick the exact time your service begins and Cue Clock counts down to it live, to the second.",
  },
  {
    title: "Full-screen countdown",
    icon: "fullscreen",
    description:
      "Show one giant countdown clock for your church service, big enough to read from the back of the room.",
  },
  {
    title: "Run multiple cues",
    icon: "more_time",
    description:
      "Add as many timers as you need - welcome, worship, sermon, and more - each with its own start time.",
  },
  {
    title: "Pre-service buffer",
    icon: "exposure_neg_1",
    description:
      "Subtract a few minutes so your team is ready and in place before the countdown reaches zero.",
  },
  {
    title: "Works offline",
    icon: "wifi_off",
    description:
      "Once loaded, the worship countdown keeps running with no internet - handy for older church tech.",
  },
  {
    title: "Free and open-source",
    icon: "volunteer_activism",
    description:
      "No ads, no login, no subscription. Cue Clock is open-source under the AGPL-3.0 license.",
  },
];

const STEPS: { title: string; description: string }[] = [
  {
    title: "Open Cue Clock",
    description:
      "Open the web app in any browser, or install it on Android. There is no account to create.",
  },
  {
    title: "Add your service countdown",
    description:
      "Add a cue, name it (like 'Service starts'), and set the time your service begins.",
  },
  {
    title: "Go full-screen",
    description:
      "Tap the full-screen button to show one large countdown clock for your church service on the display.",
  },
];

function FeatureCard({
  title,
  icon,
  description,
}: (typeof FEATURES)[number]) {
  return (
    <div className="surface-card group p-7 transition-colors hover:bg-page md:p-9">
      <div className="mb-6 h-1 w-8 rounded-full bg-accent" />
      <h3 className="mb-3 font-sans text-lg font-semibold tracking-[-0.01em] text-fg transition-colors group-hover:text-accent md:text-xl">
        {title}
      </h3>
      <p className="mb-5 text-[13.5px] leading-relaxed text-fg-muted">
        {description}
      </p>
      <span className="material-symbols-outlined text-fg-muted/60 transition-colors group-hover:text-accent">
        {icon}
      </span>
    </div>
  );
}
