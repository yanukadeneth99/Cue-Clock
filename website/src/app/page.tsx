"use client";

import React, { useRef, useState, useEffect } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Landing page for Cue Clock — restyled to the same design language as the
 * mobile app:
 *
 *  - Three-tier surface stack: page (deepest) → bg-app (sections) → card
 *  - Single blue accent for CTA/brand; amber `countdown` reserved for the
 *    time-urgency demo only; red `danger` only on destructive copy
 *  - Inter for all UI, Space Mono for all numerics (tabular-nums) — applied
 *    via `font-sans` / `font-mono` Tailwind utilities, which resolve to the
 *    `--font-inter` / `--font-space-mono` CSS vars set in layout.tsx
 *
 * Data hooks (GitHub contributors / repo stats), the mobile menu, the
 * platform picker, and GSAP animations are unchanged from the previous
 * implementation; only the visual chrome was rewritten.
 */
export default function Home() {
  const container = useRef<HTMLDivElement>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<
    "web" | "android" | "ios"
  >(() => {
    if (typeof window === "undefined") return "ios";
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return "android";
    if (/iphone|ipad|ipod/i.test(ua)) return "ios";
    return "web";
  });
  const [contributors, setContributors] = useState<
    { id: number; login: string; avatar_url: string; html_url: string; contributions: number }[]
  >([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [repoStats, setRepoStats] = useState<{
    stars: number;
    forks: number;
    openIssues: number;
    lastCommit: string | null;
    lastWorkflowStatus: string | null;
    lastWorkflowDuration: number | null;
  } | null>(null);

  useEffect(() => {
    const fetchContributors = async () => {
      try {
        const response = await fetch(
          "https://api.github.com/repos/yanukadeneth99/Cue-Clock/contributors",
        );
        if (response.ok) {
          const data: unknown = await response.json();
          if (Array.isArray(data)) {
            setContributors(
              data.filter(
                (c): c is { id: number; login: string; avatar_url: string; html_url: string; contributions: number } =>
                  c !== null &&
                  typeof c === "object" &&
                  typeof (c as Record<string, unknown>).html_url === "string" &&
                  ((c as Record<string, unknown>).html_url as string).startsWith(
                    "https://github.com/",
                  ),
              ),
            );
          }
        }
      } catch {
        // Non-critical — contributors section degrades gracefully on fetch failure
      }
    };

    const fetchRepoStats = async () => {
      try {
        const [repoRes, commitsRes, runsRes] = await Promise.all([
          fetch("https://api.github.com/repos/yanukadeneth99/Cue-Clock"),
          fetch("https://api.github.com/repos/yanukadeneth99/Cue-Clock/commits/master"),
          fetch(
            "https://api.github.com/repos/yanukadeneth99/Cue-Clock/actions/runs?per_page=1&status=completed",
          ),
        ]);

        const repo = repoRes.ok ? ((await repoRes.json()) as Record<string, unknown>) : null;
        const commit = commitsRes.ok ? ((await commitsRes.json()) as Record<string, unknown>) : null;
        const runs = runsRes.ok ? ((await runsRes.json()) as Record<string, unknown>) : null;

        let lastCommit: string | null = null;
        if (commit?.commit && typeof commit.commit === "object") {
          const c = commit.commit as Record<string, unknown>;
          if (c.committer && typeof c.committer === "object") {
            const committer = c.committer as Record<string, unknown>;
            if (typeof committer.date === "string") lastCommit = committer.date;
          }
        }

        let lastWorkflowStatus: string | null = null;
        let lastWorkflowDuration: number | null = null;
        if (runs?.workflow_runs && Array.isArray(runs.workflow_runs) && runs.workflow_runs.length > 0) {
          const run = runs.workflow_runs[0] as Record<string, unknown>;
          if (typeof run.conclusion === "string") lastWorkflowStatus = run.conclusion;
          if (typeof run.created_at === "string" && typeof run.updated_at === "string") {
            const duration = Math.round(
              (new Date(run.updated_at as string).getTime() -
                new Date(run.created_at as string).getTime()) /
                1000,
            );
            lastWorkflowDuration = duration;
          }
        }

        setRepoStats({
          stars: typeof repo?.stargazers_count === "number" ? repo.stargazers_count : 0,
          forks: typeof repo?.forks_count === "number" ? repo.forks_count : 0,
          openIssues: typeof repo?.open_issues_count === "number" ? repo.open_issues_count : 0,
          lastCommit,
          lastWorkflowStatus,
          lastWorkflowDuration,
        });
      } catch {
        // Non-critical — stats degrade gracefully
      }
    };

    fetchContributors();
    fetchRepoStats();
  }, []);

  const platforms = {
    web: {
      label: "Web",
      icon: "language",
      buttonText: "Start Now",
      action: () => window.open("https://live.cueclock.app", "_blank"),
    },
    android: {
      label: "Android",
      icon: "phone_android",
      buttonText: "Coming Soon",
      action: () => {},
    },
    ios: {
      label: "iOS",
      icon: "phone_iphone",
      buttonText: "Coming Soon",
      action: () => {},
    },
  } as const;

  useGSAP(
    () => {
      const introTl = gsap.timeline({ defaults: { ease: "power3.out" } });

      gsap.set(".feature-card", { y: 30, opacity: 0 });
      gsap.set(".hero-mockup", { scale: 0.95, opacity: 0, y: 20 });

      introTl
        .from("nav", { yPercent: -100, duration: 0.9, ease: "power4.out" })
        .from(
          ".hero-content > *",
          { y: 20, opacity: 0, duration: 0.7, stagger: 0.08 },
          "-=0.4",
        )
        .to(
          ".hero-mockup",
          { scale: 1, opacity: 1, y: 0, duration: 1, ease: "back.out(1.4)" },
          "-=0.6",
        );

      // Subtle hover float for the mock; pauses as we scroll past.
      const float = gsap.to(".hero-mockup", {
        y: 12,
        duration: 2.2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });

      gsap.fromTo(
        ".hero-mockup",
        { opacity: 1, scale: 1, xPercent: 0 },
        {
          scrollTrigger: {
            trigger: ".hero-section",
            start: "top top",
            end: "bottom top",
            scrub: 1,
            onUpdate: (self) => float.timeScale(1 - self.progress),
          },
          xPercent: 6,
          opacity: 0.7,
          scale: 0.94,
          ease: "none",
          immediateRender: false,
        },
      );

      ScrollTrigger.batch(".feature-card", {
        start: "top 90%",
        onEnter: (batch) =>
          gsap.to(batch, { opacity: 1, y: 0, stagger: 0.12, overwrite: true }),
      });

      gsap.from(".story-image", {
        scrollTrigger: { trigger: ".story-section", start: "top 80%", once: true },
        scale: 1.3,
        filter: "blur(16px)",
        opacity: 0,
        duration: 1.4,
        ease: "power2.inOut",
      });

      gsap.from(".story-text", {
        scrollTrigger: { trigger: ".story-section", start: "top 80%" },
        x: -32,
        opacity: 0,
        duration: 0.9,
        ease: "power3.out",
      });
    },
    { scope: container },
  );

  return (
    <div
      ref={container}
      className="selection:bg-accent/30 min-h-screen overflow-x-hidden bg-page text-fg"
    >
      {/* Top nav — brand dot + wordmark on the left, anchor links on the right.
          Mirrors the app's `Header` component vocabulary. */}
      <nav className="sticky top-0 z-50 bg-page/85 backdrop-blur border-b border-card-border/60">
        <div className="flex justify-between items-center w-full px-4 md:px-6 py-4 max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-[15px] font-semibold tracking-[-0.01em] text-fg">
              Cue Clock
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <NavLink href="#features">Features</NavLink>
            <NavLink href="#why-its-free">Why it&apos;s free</NavLink>
            <NavLink href="#download">Download</NavLink>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-fg-muted hover:text-fg transition-colors p-1"
            aria-label="Menu"
          >
            <span className="material-symbols-outlined text-2xl">
              {mobileMenuOpen ? "close" : "menu"}
            </span>
          </button>
        </div>
      </nav>

      {/* Mobile menu — full-screen overlay outside nav to avoid stacking issues */}
      <div
        className={`fixed inset-0 z-[10000] md:hidden transition-all duration-300 flex flex-col bg-page ${
          mobileMenuOpen
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-4 pointer-events-none"
        }`}
      >
        <div className="flex justify-between items-center w-full px-4 py-4 border-b border-card-border/60">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-[15px] font-semibold tracking-[-0.01em] text-fg">
              Cue Clock
            </span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="text-fg-muted p-1"
            aria-label="Close menu"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 gap-10 px-6 text-center">
          <MobileLink onClick={() => setMobileMenuOpen(false)} href="#features">
            Features
          </MobileLink>
          <MobileLink onClick={() => setMobileMenuOpen(false)} href="#why-its-free">
            Why it&apos;s free
          </MobileLink>
          <MobileLink onClick={() => setMobileMenuOpen(false)} href="#download">
            Download
          </MobileLink>
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              window.open("https://live.cueclock.app", "_blank");
            }}
            className="cta-primary mt-6 px-8 py-4 text-sm"
          >
            Start now
          </button>
        </div>
      </div>

      <main>
        {/* ─── Hero ──────────────────────────────────────────────── */}
        <section className="hero-section relative pt-16 md:pt-24 pb-20 md:pb-32 px-4 md:px-6 overflow-hidden">
          <div className="max-w-screen-xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="hero-content z-10 text-center lg:text-left">
              {/* Up Next-style chip */}
              <div className="inline-flex items-center gap-2 mb-6">
                <span className="w-2 h-2 rounded-full bg-accent" />
                <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                  Broadcast-grade · v1.5.0
                </span>
              </div>
              <h1 className="font-sans text-4xl sm:text-5xl md:text-6xl font-semibold leading-[1.05] tracking-[-0.02em] mb-6 text-fg">
                A timer dependable
                <br />
                enough for{" "}
                <span className="text-accent">live broadcast.</span>
              </h1>
              <p className="text-fg-muted text-base md:text-lg max-w-lg mb-10 leading-relaxed mx-auto lg:mx-0">
                Minimal, distraction-free clock for broadcast professionals. Two timezones,
                unlimited countdowns, full-screen alarms that wake the device — kept free
                and open source.
              </p>
              <div className="flex flex-wrap justify-center lg:justify-start gap-3">
                <button
                  onClick={() =>
                    document
                      .getElementById("download")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="cta-primary px-7 py-4 text-sm inline-flex items-center gap-2.5 cursor-pointer"
                >
                  Download free
                  <span className="material-symbols-outlined text-base">arrow_downward</span>
                </button>
                <button
                  onClick={() => window.open("https://live.cueclock.app", "_blank")}
                  className="px-7 py-4 text-sm font-semibold tracking-[-0.005em] rounded-[14px] border border-card-border text-fg hover:bg-card transition-colors cursor-pointer"
                >
                  Open web app
                </button>
              </div>
            </div>

            {/* Hero device mock — rebuilds the in-app PrimaryCard so the
                marketing visual stays in sync with the product. */}
            <div className="hero-mockup relative lg:scale-105 will-change-transform mt-12 lg:mt-0">
              <div className="absolute -inset-6 bg-accent/[0.06] blur-3xl rounded-full pointer-events-none" />
              <div className="relative max-w-[460px] mx-auto bg-bg-app rounded-[28px] p-3 shadow-2xl border border-card-border/70">
                {/* Inner viewport — mirrors the app's safe area */}
                <div className="bg-bg-app rounded-[20px] overflow-hidden">
                  {/* App header */}
                  <div className="flex items-center justify-between px-6 pt-5 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-accent" />
                      <span className="text-[15px] font-semibold tracking-[-0.01em] text-fg">
                        Cue Clock
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-fg-muted">
                      <span className="material-symbols-outlined text-[18px]">help</span>
                      <span className="material-symbols-outlined text-[18px]">settings</span>
                      <span className="material-symbols-outlined text-[20px]">fullscreen</span>
                    </div>
                  </div>

                  {/* Clock rail */}
                  <div className="mx-5 mt-1 mb-7 rounded-[16px] bg-card border border-card-border px-5 py-4 grid grid-cols-2">
                    <ClockCol
                      city="London"
                      time="14:24"
                      seconds="08"
                      ampm=""
                      abbr="BST"
                      dotClass="bg-zone1"
                      textClass="text-zone1"
                      align="left"
                    />
                    <ClockCol
                      city="New York"
                      time="09:24"
                      seconds="08"
                      ampm=""
                      abbr="EDT"
                      dotClass="bg-zone2"
                      textClass="text-zone2"
                      align="right"
                    />
                  </div>

                  {/* Primary cue card */}
                  <div className="mx-5 mb-4 rounded-[20px] bg-card border border-card-border px-6 pt-6 pb-5 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-countdown" />
                        <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-countdown">
                          Up Next
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-countdown/10">
                        <span className="material-symbols-outlined text-[12px] text-countdown">
                          notifications
                        </span>
                        <span className="text-[11px] font-semibold text-countdown">2m</span>
                      </div>
                    </div>
                    <div className="font-sans text-[19px] font-semibold tracking-[-0.01em] text-fg leading-tight">
                      Segment 01 — Show open
                    </div>
                    <div className="text-center mt-5">
                      <span className="font-mono font-bold text-[58px] leading-none tracking-[-0.03em] text-countdown tabular-nums">
                        04:52
                      </span>
                    </div>
                    <div className="flex items-center gap-3.5 mt-6 pt-4 border-t border-card-border">
                      <Meta label="Target" value="14:30" />
                      <Divider />
                      <Meta label="City" value="London" dotClass="bg-zone1" />
                      <Divider />
                      <Meta label="Buffer" value="−00:30" accent />
                      <div className="flex-1" />
                      <div className="border border-card-border rounded-[10px] px-3 py-1.5 text-[13px] text-fg">
                        Edit
                      </div>
                    </div>
                    {/* Progress hairline */}
                    <div className="absolute left-0 right-0 bottom-0 h-[3px] bg-card-border">
                      <div className="h-full bg-countdown" style={{ width: "67%" }} />
                    </div>
                  </div>

                  {/* Queued section */}
                  <div className="mx-5 mt-1.5 mb-3 flex justify-between items-baseline">
                    <span className="font-sans text-[12px] font-semibold uppercase tracking-[0.04em] text-fg-muted">
                      Queued
                    </span>
                    <span className="text-[12px] font-medium text-fg-muted">2 cues</span>
                  </div>
                  <div className="mx-5 space-y-2.5 pb-6">
                    <QueuedRow name="Sponsor break" zone="London" dot="zone1" time="14:45" left="21m left" alert="5m" />
                    <QueuedRow name="Live cross — Studio 3" zone="New York" dot="zone2" time="15:10" left="46m left" />
                  </div>

                  {/* Add CTA */}
                  <div className="px-5 pb-6 pt-1">
                    <div className="cta-primary py-3.5 text-center text-[15px] inline-flex items-center justify-center gap-2 w-full">
                      <span className="material-symbols-outlined text-[18px]">add</span>
                      Add a cue
                    </div>
                  </div>
                </div>
              </div>

              {/* Live-status floating badge */}
              <div className="hidden md:flex absolute -bottom-6 -left-6 items-center gap-3 px-4 py-3 rounded-[14px] bg-card border border-card-border shadow-2xl">
                <span className="w-2.5 h-2.5 rounded-full bg-zone1 animate-cue-pulse" />
                <div>
                  <div className="font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                    Status
                  </div>
                  <div className="text-[13px] font-semibold text-fg">Live studio link active</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Banner ────────────────────────────────────────────── */}
        <div className="bg-bg-app border-y border-card-border">
          <div className="max-w-screen-xl mx-auto flex flex-wrap justify-center gap-8 md:gap-24 px-4 md:px-6 py-5">
            <BannerItem icon="volunteer_activism" label="Completely free · no ads" />
            <BannerItem icon="code" label="Fully open-source · AGPL-3.0" />
            <BannerItem icon="shield" label="No tracking without consent" />
          </div>
        </div>

        {/* ─── Features ──────────────────────────────────────────── */}
        <section id="features" className="py-20 md:py-28 px-4 md:px-6">
          <div className="max-w-screen-xl mx-auto">
            <div className="mb-14 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 rounded-full bg-accent" />
                  <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                    Engineered for the gallery
                  </span>
                </div>
                <h2 className="font-sans text-3xl md:text-5xl font-semibold tracking-[-0.02em] text-fg">
                  Reduce cognitive load.
                </h2>
              </div>
              <p className="text-fg-muted max-w-sm text-base md:text-lg">
                Every feature is designed to keep the operator&apos;s attention on the show — not
                on the clock app.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {FEATURES.map((f, i) => (
                <FeatureCard key={i} {...f} />
              ))}
            </div>
          </div>
        </section>

        {/* ─── Why free ──────────────────────────────────────────── */}
        <section
          id="why-its-free"
          className="story-section py-20 md:py-28 px-4 md:px-6 bg-bg-app border-y border-card-border"
        >
          <div className="max-w-screen-xl mx-auto">
            <div className="rounded-[20px] overflow-hidden grid md:grid-cols-2 items-center bg-card border border-card-border">
              <div className="story-text p-8 md:p-16 border-l-2 border-accent order-2 md:order-1">
                <div className="inline-flex items-center gap-2 mb-5">
                  <span className="w-2 h-2 rounded-full bg-accent" />
                  <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                    The story
                  </span>
                </div>
                <h2 className="font-sans text-3xl md:text-4xl font-semibold tracking-[-0.02em] text-fg mb-6">
                  Why free?
                </h2>
                <div className="space-y-5 text-fg-muted text-base md:text-lg leading-relaxed">
                  <p>
                    Cue Clock started because I needed a reliable, straightforward timing
                    tool during live broadcast production. Everything else I tried felt
                    overly complicated and cost a fortune.
                  </p>
                  <p>
                    Great tools should be accessible to everyone — independent producers,
                    high-scale teams alike. Cost-free and ad-free, kept open source.
                  </p>
                </div>
              </div>
              <div className="h-48 md:h-full min-h-[200px] md:min-h-[420px] relative overflow-hidden order-1 md:order-2">
                <Image
                  alt="Professional broadcast control room"
                  className="story-image absolute inset-0 w-full h-full object-cover grayscale opacity-50 contrast-125"
                  src="https://images.unsplash.com/photo-1601506521937-0121a7fc2a6b?q=80&w=2071&auto=format&fit=crop"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-b md:bg-gradient-to-r from-card via-card/30 to-transparent" />
              </div>
            </div>
          </div>
        </section>

        {/* ─── Download ──────────────────────────────────────────── */}
        <section
          id="download"
          className="py-20 md:py-28 px-4 md:px-6 relative overflow-hidden text-center"
        >
          <div className="absolute top-0 right-0 w-[420px] h-[420px] bg-accent/[0.07] rounded-full blur-[120px] pointer-events-none" />
          <div className="max-w-screen-xl mx-auto relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/30 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                Completely free
              </span>
            </div>
            <h2 className="font-sans text-3xl md:text-5xl font-semibold tracking-[-0.02em] text-fg mb-10">
              Get Cue Clock
            </h2>
            <div className="inline-flex flex-col lg:flex-row items-stretch lg:items-center gap-4 lg:gap-6 p-4 bg-card rounded-[20px] border border-card-border w-full lg:w-auto">
              <div className="flex justify-around items-center gap-6 lg:gap-12 px-2 lg:px-6 py-3 lg:py-4">
                {(Object.keys(platforms) as Array<keyof typeof platforms>).map((p) => (
                  <button
                    key={p}
                    onClick={() => setSelectedPlatform(p)}
                    className={`flex flex-col items-center gap-2 transition-all ${
                      selectedPlatform === p
                        ? "scale-105"
                        : "opacity-55 hover:opacity-90"
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-3xl md:text-4xl ${
                        selectedPlatform === p ? "text-accent" : "text-fg-muted"
                      }`}
                    >
                      {platforms[p].icon}
                    </span>
                    <span
                      className={`font-sans text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.18em] ${
                        selectedPlatform === p ? "text-fg" : "text-fg-muted"
                      }`}
                    >
                      {platforms[p].label}
                    </span>
                  </button>
                ))}
              </div>
              <div className="h-px lg:h-16 w-full lg:w-px bg-card-border" />
              <div className="flex justify-center px-2 lg:px-6 py-3 lg:py-4">
                <button
                  onClick={platforms[selectedPlatform].action}
                  className={`download-btn relative overflow-hidden font-sans font-semibold text-sm tracking-[-0.005em] px-7 py-4 rounded-[14px] flex items-center gap-3 transition-all w-full lg:w-auto justify-center ${
                    platforms[selectedPlatform].buttonText === "Coming Soon"
                      ? "bg-card border border-card-border text-fg-muted cursor-default"
                      : "cta-primary cursor-pointer hover:brightness-110 active:scale-[0.98]"
                  }`}
                >
                  {platforms[selectedPlatform].buttonText}
                  <span className="material-symbols-outlined text-[18px]">
                    {platforms[selectedPlatform].buttonText === "Coming Soon" ? "schedule" : "arrow_forward"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Open source / contributors ────────────────────────── */}
        <section className="py-20 md:py-28 px-4 md:px-6 bg-bg-app border-t border-card-border">
          <div className="max-w-screen-xl mx-auto grid md:grid-cols-2 gap-12 items-start">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <svg className="w-9 h-9 fill-fg" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  />
                </svg>
                <h2 className="font-sans text-3xl md:text-4xl font-semibold tracking-[-0.02em] text-fg">
                  Completely open-source
                </h2>
              </div>
              <p className="text-fg-muted text-base md:text-lg leading-relaxed mb-8">
                Every line is public. No black boxes, no hidden telemetry beyond what you
                explicitly consent to. Fork it, audit it, self-host it. Broadcast
                infrastructure should be something the community owns — not rents.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
                {repoStats ? (
                  <>
                    <Stat value={String(repoStats.stars)} label="Stars" icon="star" />
                    <Stat value={String(repoStats.forks)} label="Forks" icon="fork_right" />
                    <Stat
                      value={String(repoStats.openIssues)}
                      label="Open issues"
                      icon="bug_report"
                    />
                    {repoStats.lastCommit ? (
                      <Stat
                        value={new Date(repoStats.lastCommit).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        label="Last commit"
                        icon="commit"
                        small
                      />
                    ) : null}
                    {repoStats.lastWorkflowStatus ? (
                      <Stat
                        value={repoStats.lastWorkflowStatus}
                        label="Last CI run"
                        icon="play_circle"
                        small
                        tone={
                          repoStats.lastWorkflowStatus === "success"
                            ? "zone1"
                            : repoStats.lastWorkflowStatus === "failure"
                            ? "danger"
                            : "countdown"
                        }
                      />
                    ) : null}
                    {repoStats.lastWorkflowDuration !== null ? (
                      <Stat
                        value={
                          repoStats.lastWorkflowDuration >= 60
                            ? `${Math.floor(repoStats.lastWorkflowDuration / 60)}m ${repoStats.lastWorkflowDuration % 60}s`
                            : `${repoStats.lastWorkflowDuration}s`
                        }
                        label="Build time"
                        icon="timer"
                        small
                      />
                    ) : null}
                  </>
                ) : (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="surface-card p-4 animate-pulse h-16"
                    />
                  ))
                )}
              </div>
              <a
                href="https://github.com/yanukadeneth99/Cue-Clock"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-sans text-[13px] font-semibold uppercase tracking-[0.18em] text-accent hover:underline"
              >
                View source code{" "}
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              </a>
            </div>
            <div>
              <h3 className="font-sans text-xl font-semibold mb-6 text-fg">Contributors</h3>
              <div className="flex flex-wrap gap-3">
                {contributors.length > 0 ? (
                  contributors.map((c) => (
                    <a
                      key={c.id}
                      href={c.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={c.login}
                      className="w-12 h-12 rounded-full overflow-hidden border border-card-border hover:border-accent transition-all"
                    >
                      <Image
                        src={c.avatar_url}
                        alt={c.login}
                        className="w-full h-full object-cover"
                        width={48}
                        height={48}
                      />
                    </a>
                  ))
                ) : (
                  <div className="flex gap-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-12 h-12 rounded-full bg-card animate-pulse"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ─── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-card-border">
        <div className="w-full py-8 px-6 md:px-8 flex flex-col md:flex-row justify-between items-center gap-4 max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-accent" />
            <span className="font-sans text-[13px] font-medium text-fg-muted">
              Cue Clock · v1.5.0 · AGPL-3.0
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <a
              className="text-[12px] tracking-wide uppercase font-medium text-fg-muted hover:text-accent transition-colors"
              href="https://yashura.io"
              target="_blank"
              rel="noopener noreferrer"
            >
              Made by{" "}
              <span className="text-accent underline underline-offset-4">YASHURA</span>
            </a>
            <div className="flex items-center gap-3">
              <a
                href="https://x.com/yanukadeneth99"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X (Twitter)"
                className="text-fg-muted hover:text-accent transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.736l7.73-8.835L1.254 2.25H8.08l4.258 5.63 5.906-5.63Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="https://linkedin.com/in/yanukadeneth99"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="text-fg-muted hover:text-accent transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
          </div>
          <a
            href="/privacy"
            className="text-[12px] tracking-wide uppercase font-medium text-fg-muted hover:text-accent transition-colors"
          >
            Privacy policy
          </a>
        </div>
      </footer>
    </div>
  );
}

/* ─── Small presentational primitives ─────────────────────────────── */

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="font-sans text-[12px] font-semibold uppercase tracking-[0.16em] text-fg-muted hover:text-fg transition-colors"
    >
      {children}
    </a>
  );
}

function MobileLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      className="font-sans text-2xl font-semibold tracking-[-0.01em] text-fg hover:text-accent transition-colors"
    >
      {children}
    </a>
  );
}

function ClockCol({
  city,
  time,
  seconds,
  ampm,
  abbr,
  dotClass,
  textClass,
  align,
}: {
  city: string;
  time: string;
  seconds: string;
  ampm: string;
  abbr: string;
  dotClass: string;
  textClass: string;
  align: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <div
        className={`flex items-center gap-2 ${align === "right" ? "justify-end" : ""}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
        <span className={`text-[12px] font-medium ${textClass}`}>{city}</span>
      </div>
      <div className="font-mono tabular-nums text-[34px] font-bold tracking-[-0.04em] text-fg mt-2 leading-none">
        {time}
        <span className="text-fg-muted text-[20px]">:{seconds}</span>
        {ampm ? (
          <span className="font-sans text-fg-muted text-[15px] font-medium ml-1.5">
            {ampm}
          </span>
        ) : null}
      </div>
      <div className="text-[11px] font-medium text-fg-muted mt-1.5">{abbr}</div>
    </div>
  );
}

function Meta({
  label,
  value,
  accent,
  dotClass,
}: {
  label: string;
  value: string;
  accent?: boolean;
  dotClass?: string;
}) {
  return (
    <div>
      <div className="font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
        {label}
      </div>
      <div className="flex items-center gap-1.5 mt-0.5">
        {dotClass ? (
          <span className={`w-[7px] h-[7px] rounded-full ${dotClass}`} />
        ) : null}
        <span className={`text-[13px] font-semibold ${accent ? "text-accent" : "text-fg"}`}>
          {value}
        </span>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-[22px] bg-card-border" />;
}

function QueuedRow({
  name,
  zone,
  dot,
  time,
  left,
  alert,
}: {
  name: string;
  zone: string;
  dot: "zone1" | "zone2";
  time: string;
  left: string;
  alert?: string;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-[14px] border border-card-border">
      <div className="flex-1 min-w-0">
        <div className="text-[14.5px] font-medium text-fg truncate">{name}</div>
        <div className="flex items-center gap-2 mt-1">
          <span className={`w-1.5 h-1.5 rounded-full ${dot === "zone1" ? "bg-zone1" : "bg-zone2"}`} />
          <span className="text-[12px] font-medium text-fg-muted">{zone}</span>
          {alert ? (
            <>
              <span className="w-[3px] h-[3px] rounded-full bg-fg-muted/50" />
              <span className="material-symbols-outlined text-[11px] text-fg-muted">
                notifications
              </span>
              <span className="text-[11px] text-fg-muted">{alert}</span>
            </>
          ) : null}
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono tabular-nums text-[22px] font-bold tracking-[-0.03em] text-fg">
          {time}
        </div>
        <div className="text-[10px] font-medium text-fg-muted mt-0.5">{left}</div>
      </div>
    </div>
  );
}

function BannerItem({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="material-symbols-outlined text-accent text-base">{icon}</span>
      <span className="font-sans text-[11px] md:text-[12px] font-semibold uppercase tracking-[0.12em] text-fg">
        {label}
      </span>
    </div>
  );
}

const FEATURES: { title: string; icon: string; description: string; tone: "accent" | "zone1" | "zone2" | "countdown" }[] = [
  {
    title: "Dual live clocks",
    icon: "schedule",
    description: "Two side-by-side clocks across 23 broadcast timezones for international productions.",
    tone: "zone1",
  },
  {
    title: "Unlimited countdowns",
    icon: "more_time",
    description: "As many cue timers as the show needs, each tied to either zone with independent alert offsets.",
    tone: "accent",
  },
  {
    title: "Buffer offsets",
    icon: "exposure_neg_1",
    description: "Subtract a pre-show buffer from the countdown so you're ready before the actual cue lands.",
    tone: "countdown",
  },
  {
    title: "On-Air mode",
    icon: "fullscreen",
    description: "Strip the UI to a giant countdown readable from across the gallery.",
    tone: "zone2",
  },
  {
    title: "Persistent state",
    icon: "save",
    description: "Cues, zones, and preferences survive restarts — no re-entering setup before every show.",
    tone: "accent",
  },
  {
    title: "Full-screen alarms",
    icon: "notifications_active",
    description: "Android alarms wake the device, take over the lock screen, and must be explicitly dismissed.",
    tone: "countdown",
  },
];

function FeatureCard({
  title,
  icon,
  description,
  tone,
}: (typeof FEATURES)[number]) {
  const toneClass =
    tone === "zone1"
      ? "bg-zone1"
      : tone === "zone2"
      ? "bg-zone2"
      : tone === "countdown"
      ? "bg-countdown"
      : "bg-accent";
  return (
    <div className="feature-card surface-card p-7 md:p-9 hover:bg-bg-app transition-colors group">
      <div className={`w-8 h-1 ${toneClass} mb-6 rounded-full`} />
      <h3 className="font-sans text-lg md:text-xl font-semibold tracking-[-0.01em] mb-3 text-fg group-hover:text-accent transition-colors">
        {title}
      </h3>
      <p className="text-fg-muted text-[13.5px] leading-relaxed mb-5">{description}</p>
      <span className="material-symbols-outlined text-fg-muted/60 group-hover:text-accent transition-colors">
        {icon}
      </span>
    </div>
  );
}

function Stat({
  value,
  label,
  icon,
  small,
  tone,
}: {
  value: string;
  label: string;
  icon: string;
  small?: boolean;
  tone?: "zone1" | "danger" | "countdown";
}) {
  const toneClass =
    tone === "zone1"
      ? "text-zone1"
      : tone === "danger"
      ? "text-danger"
      : tone === "countdown"
      ? "text-countdown"
      : "text-accent";
  return (
    <div className="surface-card p-4">
      <div
        className={`font-mono tabular-nums font-bold mb-1 capitalize ${
          small ? "text-sm" : "text-2xl"
        } ${toneClass}`}
      >
        {value}
      </div>
      <div className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-muted flex items-center gap-1">
        <span className="material-symbols-outlined text-sm">{icon}</span>
        {label}
      </div>
    </div>
  );
}
