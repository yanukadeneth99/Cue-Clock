"use client";

import React, { useRef, useState, useEffect } from 'react';
import Image from 'next/image';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Landing page for Cue Clock.
 * Renders hero, features, story, download, and credits sections with GSAP animations.
 */
export default function Home() {
  const container = useRef<HTMLDivElement>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<'web' | 'android' | 'ios'>('ios');
  const [contributors, setContributors] = useState<{ id: number; login: string; avatar_url: string; html_url: string; contributions: number }[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const fetchContributors = async () => {
      try {
        const response = await fetch('https://api.github.com/repos/yanukadeneth99/Cue-Clock/contributors');
        if (response.ok) {
          const data = await response.json();
          setContributors(data);
        }
      } catch {
        // Non-critical: contributors section degrades gracefully on fetch failure
      }
    };
    fetchContributors();
  }, []);

  const platforms = {
    web: {
      label: 'Web',
      icon: 'language',
      buttonText: 'Start Now',
      action: () => window.open('https://live.cueclock.app', '_blank'),
      theme: 'bg-primary text-on-primary hover:brightness-110 active:scale-95 cursor-pointer',
      logo: <span className="material-symbols-outlined">timer</span>
    },
    android: {
      label: 'Android',
      icon: 'phone_android',
      buttonText: 'Coming Soon',
      action: () => {},
      theme: 'bg-black text-white border border-white/10 opacity-80 cursor-default',
      logo: (
        <svg viewBox="0 0 512 512" className="w-6 h-6">
          <path fill="#4285f4" d="M103.196 57.703c-5.022 5.29-8.114 13.12-8.114 22.84v351.48c0 9.72 3.092 17.55 8.114 22.84l2.06 1.83 194.51-194.51v-4.12l-194.51-194.51-2.06 1.83z"/>
          <path fill="#34a853" d="M363.856 318.843l-64.08-64.08-2.73-2.73-2.73 2.73-64.08 64.08-2.06 2.06 66.14 66.14 2.73 2.73c18.53 10.63 48.97 4.12 66.84-6.18l-2.06-2.06-2.06-2.06z"/>
          <path fill="#fbbc04" d="M363.856 193.157l2.06-2.06c17.87-10.3 48.31-16.81 66.84-6.18l-66.14 66.14-2.73 2.73 2.73 2.73 66.14 66.14c-18.53 10.63-48.97 4.12-66.84-6.18l-2.06-2.06-2.06-2.06z"/>
          <path fill="#ea4335" d="M302.506 254.763l-2.73-2.73v-4.12l2.73-2.73 61.35-61.35 2.73-2.73 2.06-2.06-66.14-66.14c-17.87-10.3-48.31-16.81-66.84-6.18l-2.06 2.06L302.506 254.763z"/>
        </svg>
      )
    },
    ios: {
      label: 'iOS',
      icon: 'phone_iphone',
      buttonText: 'Coming Soon',
      action: () => {},
      theme: 'bg-black text-white border border-white/10 opacity-80 cursor-default',
      logo: (
        <svg viewBox="0 0 384 512" className="w-6 h-6 fill-current">
          <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
        </svg>
      )
    }
  };

  useGSAP(() => {
    // 1. Entrance Animations - Use a single timeline for the intro
    const introTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    
    // Set initial states to avoid flashes
    gsap.set('.feature-card', { y: 50, opacity: 0 });
    gsap.set('.hero-mockup', { scale: 0.9, opacity: 0, y: 30 });

    introTl.from('nav', {
      yPercent: -100,
      duration: 1,
      ease: 'power4.out',
    })
    .from('.hero-content > *', {
      y: 30,
      opacity: 0,
      duration: 0.8,
      stagger: 0.1,
    }, '-=0.5')
    .to('.hero-mockup', {
      scale: 1,
      opacity: 1,
      y: 0,
      duration: 1.2,
      ease: 'back.out(1.7)',
    }, '-=0.8');

    // 2. Continuous Floating Animation
    const float = gsap.to('.hero-mockup', {
      y: 15,
      duration: 2,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });

    // 3. Scroll Animation for Mockup - Using fromTo to prevent capturing initial opacity: 0
    gsap.fromTo('.hero-mockup', 
      { opacity: 1, scale: 1, rotation: 0, xPercent: 0 },
      {
        scrollTrigger: {
          trigger: '.hero-section',
          start: 'top top',
          end: 'bottom top',
          scrub: 1,
          onUpdate: (self) => {
            // Slowly pause floating as we scroll deep
            float.timeScale(1 - self.progress);
          }
        },
        xPercent: 10,
        rotation: 3,
        opacity: 0.6, // Keep it visible enough
        scale: 0.9,
        ease: 'none',
        immediateRender: false
      }
    );

    // 4. Feature Cards staggered entrance - Removed onLeaveBack to keep them visible
    ScrollTrigger.batch('.feature-card', {
      start: 'top 90%',
      onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, stagger: 0.15, overwrite: true }),
    });

    // 5. Image Reveal in Story Section
    gsap.from('.story-image', {
      scrollTrigger: {
        trigger: '.story-section',
        start: 'top 80%',
        once: true
      },
      scale: 1.4,
      filter: 'blur(20px)',
      opacity: 0,
      duration: 1.5,
      ease: 'power2.inOut',
    });

    // 6. Story Text slide-in
    gsap.from('.story-text', {
      scrollTrigger: {
        trigger: '.story-section',
        start: 'top 80%',
      },
      x: -40,
      opacity: 0,
      duration: 1,
      ease: 'power3.out',
    });

    // 7. Ripple Effect for Download Button
    const downloadBtn = document.querySelector('.download-btn');
    if (downloadBtn) {
      (downloadBtn as HTMLElement).addEventListener('mousemove', (e: MouseEvent) => {
        const rect = downloadBtn.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const ripple = document.createElement('span');
        ripple.className = 'absolute bg-white/30 rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2';
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        ripple.style.width = '0px';
        ripple.style.height = '0px';
        downloadBtn.appendChild(ripple);

        gsap.to(ripple, {
          width: 300,
          height: 300,
          opacity: 0,
          duration: 0.8,
          ease: 'power2.out',
          onComplete: () => ripple.remove()
        });
      });
    }

  }, { scope: container });

  return (
    <div ref={container} className="selection:bg-primary/30 min-h-screen overflow-x-hidden">
      {/* TopNavBar */}
      <nav className="bg-[#101319] docked full-width top-0 sticky z-50 border-b border-outline-variant/10">
        <div className="flex justify-between items-center w-full px-4 md:px-6 py-4 max-w-screen-2xl mx-auto">
          <div className="text-xl font-bold tracking-tighter text-[#a4c9ff] font-headline uppercase">
            Cue Clock
          </div>
          
          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-8">
            <a className="font-headline uppercase tracking-[0.05em] text-[0.6875rem] font-bold text-[#414751] hover:text-[#a4c9ff] hover:border-b-2 hover:border-[#60a5fa] pb-1 transition-all" href="#features">Features</a>
            <a className="font-headline uppercase tracking-[0.05em] text-[0.6875rem] font-bold text-[#414751] hover:text-[#a4c9ff] hover:border-b-2 hover:border-[#60a5fa] pb-1 transition-all" href="#why-its-free">Why it&apos;s Free</a>
            <a className="font-headline uppercase tracking-[0.05em] text-[0.6875rem] font-bold text-[#414751] hover:text-[#a4c9ff] hover:border-b-2 hover:border-[#60a5fa] pb-1 transition-all" href="#download">Download</a>
          </div>

          <div className="flex items-center gap-4">
            {/* Mobile Menu Toggle */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-[#a4c9ff] p-1"
            >
              <span className="material-symbols-outlined text-2xl">
                {mobileMenuOpen ? 'close' : 'menu'}
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay - Moved OUTSIDE of nav to prevent stacking issues */}
      <div 
        className={`fixed inset-0 z-[10000] md:hidden transition-all duration-300 flex flex-col bg-[#101319] ${
          mobileMenuOpen 
            ? 'opacity-100 translate-y-0 pointer-events-auto' 
            : 'opacity-0 -translate-y-4 pointer-events-none'
        }`}
      >
        <div className="flex justify-between items-center w-full px-4 py-4 border-b border-outline-variant/10">
          <div className="text-xl font-bold tracking-tighter text-[#a4c9ff] font-headline uppercase">
            Cue Clock
          </div>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="text-[#a4c9ff] p-1"
          >
            <span className="material-symbols-outlined text-2xl">
              close
            </span>
          </button>
        </div>
        
        <div className="flex flex-col items-center justify-center flex-1 gap-12 px-6 text-center">
          <a 
            className="font-headline uppercase tracking-[0.2em] text-2xl font-bold text-[#a4c9ff] hover:text-white transition-colors" 
            href="#features"
            onClick={() => setMobileMenuOpen(false)}
          >
            Features
          </a>
          <a 
            className="font-headline uppercase tracking-[0.2em] text-2xl font-bold text-[#a4c9ff] hover:text-white transition-colors" 
            href="#why-its-free"
            onClick={() => setMobileMenuOpen(false)}
          >
            Why it&apos;s Free
          </a>
          <a 
            className="font-headline uppercase tracking-[0.2em] text-2xl font-bold text-[#a4c9ff] hover:text-white transition-colors" 
            href="#download"
            onClick={() => setMobileMenuOpen(false)}
          >
            Download
          </a>
          
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              window.open('https://live.cueclock.app', '_blank');
            }}
            className="mt-8 bg-primary text-on-primary px-8 py-4 font-label text-sm font-bold uppercase tracking-widest rounded-sm shadow-2xl"
          >
            Start Now
          </button>
        </div>
      </div>

      <main>
        {/* Hero Section */}
        <section className="hero-section relative pt-12 md:pt-20 pb-20 md:pb-32 px-4 md:px-6 overflow-hidden">
          <div className="max-w-screen-xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="hero-content z-10 text-center lg:text-left">
              <h1 className="font-headline text-4xl sm:text-5xl md:text-7xl font-bold leading-[0.95] tracking-tighter mb-6 text-on-surface">
                Simple Timer <br />
                <span className="text-primary">for Live Broadcasts</span>
              </h1>
              <p className="text-on-surface-variant text-base md:text-xl max-w-lg mb-10 font-body leading-relaxed mx-auto lg:mx-0">
                A minimal, distraction-free clock app built specifically for broadcast professionals who need to monitor multiple timezones and track countdown timers simultaneously.
              </p>
              <div className="flex flex-wrap justify-center lg:justify-start gap-4">
                <button 
                  onClick={() => document.getElementById('download')?.scrollIntoView({ behavior: 'smooth' })}
                  className="bg-gradient-to-br from-primary to-primary-container text-on-primary-container font-label font-bold uppercase tracking-widest px-6 md:px-8 py-3 md:py-4 rounded-sm flex items-center gap-3 hover:brightness-110 transition-all shadow-xl shadow-primary/10 text-xs md:text-sm"
                >
                  Download Free Now <span className="material-symbols-outlined text-sm">download</span>
                </button>
                <button
                  onClick={() => window.open('https://live.cueclock.app', '_blank')}
                  className="bg-surface-bright/10 border border-primary/20 text-on-surface font-label font-bold uppercase tracking-widest px-6 md:px-8 py-3 md:py-4 rounded-sm hover:bg-surface-bright/20 transition-all text-xs md:text-sm"
                >
                  Start Now
                </button>
              </div>
            </div>

            {/* App Mockup Visual */}
            <div className="hero-mockup relative lg:scale-110 will-change-transform mt-12 lg:mt-0">
              <div className="absolute -inset-4 bg-primary/5 blur-3xl rounded-full"></div>
              <div className="relative bg-surface-container rounded-lg p-2 md:p-3 shadow-2xl border border-outline-variant/20 max-w-[500px] mx-auto">
                <div className="flex justify-between items-center mb-4 md:mb-6 px-3 md:px-4 py-2 border-b border-outline-variant/10">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-error/40"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-tertiary/40"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-secondary/40"></div>
                  </div>
                  <div className="font-mono-data text-[0.5rem] md:text-[0.6rem] text-outline uppercase tracking-widest">Master Gallery Clock</div>
                </div>

                <div className="grid grid-cols-2 gap-2 md:gap-4 mb-4 md:mb-6">
                  <div className="bg-surface-container-low p-3 md:p-6 rounded-sm border-l-2 border-secondary">
                    <label className="font-label text-[0.4rem] md:text-[0.5rem] uppercase tracking-widest text-secondary block mb-1 md:mb-2">London (GMT)</label>
                    <div className="font-mono-data text-xl md:text-4xl text-on-surface font-bold tracking-tight">14:24:08</div>
                  </div>
                  <div className="bg-surface-container-low p-3 md:p-6 rounded-sm border-l-2 border-error">
                    <label className="font-label text-[0.4rem] md:text-[0.5rem] uppercase tracking-widest text-error block mb-1 md:mb-2">New York (EST)</label>
                    <div className="font-mono-data text-xl md:text-4xl text-on-surface font-bold tracking-tight">09:24:08</div>
                  </div>
                </div>

                <div className="bg-surface-container-high p-4 md:p-8 rounded-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-2 opacity-20">
                    <span className="material-symbols-outlined text-2xl md:text-4xl">timer</span>
                  </div>
                  <label className="font-label text-[0.5rem] md:text-[0.6rem] uppercase tracking-widest text-tertiary block mb-2 md:mb-4">Countdown: Segment 01 - Intro</label>
                  <div className="font-mono-data text-3xl md:text-7xl text-tertiary text-glow font-bold leading-none tracking-tighter mb-2 md:mb-4">
                    00:04:<span className="text-tertiary/60">52</span>
                  </div>
                  <div className="w-full bg-surface-variant h-1 rounded-full overflow-hidden">
                    <div className="bg-tertiary h-full w-2/3"></div>
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-8 -left-8 glass-panel border border-outline-variant/30 p-4 rounded-lg shadow-2xl hidden md:block">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-sm bg-secondary-container flex items-center justify-center">
                    <span className="material-symbols-outlined text-on-secondary-container">sensors</span>
                  </div>
                  <div>
                    <div className="font-label text-[0.6rem] uppercase font-bold text-secondary">Status: Online</div>
                    <div className="font-headline text-xs font-bold text-on-surface">Live Studio Link Active</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Banner */}
        <div className="bg-surface-container-high border-y border-outline-variant/10 py-4 md:py-6">
          <div className="max-w-screen-xl mx-auto flex flex-wrap justify-center gap-6 md:gap-24 px-4 md:px-6">
            <div className="flex items-center gap-2 md:gap-3">
              <span className="material-symbols-outlined text-primary text-sm md:text-base">volunteer_activism</span>
              <span className="font-label text-[0.6rem] md:text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-on-surface">Completely Free (No Ads)</span>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <span className="material-symbols-outlined text-primary text-sm md:text-base">code</span>
              <span className="font-label text-[0.6rem] md:text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-on-surface">Fully Open-Source</span>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <section id="features" className="features-grid-section py-16 md:py-24 bg-surface-container-low relative px-4 md:px-6">
          <div className="max-w-screen-xl mx-auto">
            <div className="mb-12 md:mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <h2 className="font-headline text-3xl md:text-5xl font-bold tracking-tight text-on-surface">Engineered for Accuracy.</h2>
              </div>
              <p className="text-on-surface-variant max-w-sm font-body text-base md:text-lg">Every feature is designed to reduce cognitive load during high-pressure live broadcasts.</p>
            </div>
            <div className="features-grid grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-outline-variant/10 border border-outline-variant/10 rounded-lg overflow-hidden">
              {[
                { title: 'Dual Live Clocks', icon: 'schedule', color: 'bg-secondary', text: 'Two side-by-side clocks configurable to 18 broadcast timezones for international productions.' },
                { title: 'Multiple Countdowns', icon: 'more_time', color: 'bg-tertiary', text: 'Infinite timers tied to specific zones with simultaneous readout capabilities.' },
                { title: 'Deduction Offsets', icon: 'exposure_neg_1', color: 'bg-primary', text: 'Subtract "pre-show buffer" durations from countdown targets with single-tap logic.' },
                { title: 'On-Air Mode', icon: 'fullscreen', color: 'bg-secondary-container', text: 'Distraction-free, full-screen display optimized for low-light studio environments.' },
                { title: 'Persistent State', icon: 'save', color: 'bg-outline-variant', text: 'Settings saved locally across sessions via robust asynchronous storage hooks.' },
                { title: 'Per-Timer Alerts', icon: 'notifications_active', color: 'bg-error', text: 'Configurable push notifications and high-visibility in-app visual alerts.' },
              ].map((feature, i) => (
                <div key={i} className="feature-card bg-surface p-6 md:p-10 hover:bg-surface-container-high transition-all group">
                  <div className={`w-8 h-1 ${feature.color} mb-6 md:mb-8`}></div>
                  <h3 className="font-headline text-lg md:text-xl font-bold mb-3 md:mb-4 text-on-surface group-hover:text-primary transition-colors">{feature.title}</h3>
                  <p className="text-on-surface-variant text-xs md:text-sm leading-relaxed mb-4 md:mb-6 font-body">{feature.text}</p>
                  <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">{feature.icon}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* The Story */}
        <section id="why-its-free" className="story-section py-20 md:py-32 px-4 md:px-6">
          <div className="max-w-screen-xl mx-auto">
            <div className="bg-surface-container rounded-sm overflow-hidden grid md:grid-cols-2 items-center">
              <div className="story-text p-8 md:p-20 border-l-4 border-primary order-2 md:order-1">
                <div className="space-y-4 md:space-y-6">
                  <p className="text-on-surface-variant text-base md:text-lg leading-relaxed font-body">
                    Cue Clock started because I simply needed a reliable, straightforward, simple timing tool during live broadcast production. Everything else I used felt overly complicated and costs a fortune.
                  </p>
                  <p className="text-on-surface-variant text-base md:text-lg leading-relaxed font-body">
                    I made it free because I believe great tools should be accessible to everyone in the industry, from independent producers to seasoned high-scaled teams. It&apos;s going to stay cost free and ad-free!
                  </p>
                </div>
              </div>
              <div className="h-48 md:h-full min-h-[200px] md:min-h-[400px] relative overflow-hidden order-1 md:order-2">
                <Image
                  alt="Professional broadcast control room"
                  className="story-image absolute inset-0 w-full h-full object-cover grayscale opacity-50 contrast-125"
                  src="https://images.unsplash.com/photo-1601506521937-0121a7fc2a6b?q=80&w=2071&auto=format&fit=crop"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-b md:bg-gradient-to-r from-surface-container via-surface-container/20 to-transparent"></div>
              </div>
            </div>
          </div>
        </section>

        {/* Download Section */}
        <section id="download" className="py-16 md:py-24 bg-surface-container-lowest relative overflow-hidden px-4 md:px-6 text-center">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[120px]"></div>
          
          {/* Subtle Doodle Textures */}
          <div className="absolute inset-0 opacity-[0.08] pointer-events-none select-none">
            {/* Top Left - Squiggles and Circles */}
            <svg className="absolute top-10 left-10 w-24 md:w-48 h-24 md:h-48 text-white rotate-12" viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M20,50 Q40,20 60,50 T100,50 T140,50" />
              <circle cx="150" cy="30" r="15" strokeDasharray="4 4" />
              <path d="M30,120 L50,140 M50,120 L30,140" />
            </svg>
            
            {/* Bottom Right - Shapes and Sparkles */}
            <svg className="absolute bottom-10 right-10 w-32 md:w-64 h-32 md:h-64 text-white -rotate-6" viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M50,120 Q100,170 150,120" strokeDasharray="8 8" />
              <path d="M160,40 L180,60 M180,40 L160,60" />
            </svg>
          </div>

          <div className="max-w-screen-xl mx-auto relative z-10">
            <div className="inline-block bg-primary/10 text-primary border border-primary/20 font-label text-[0.6rem] md:text-[0.6875rem] font-bold uppercase tracking-[0.2em] px-3 md:px-4 py-1 rounded-full mb-6 md:mb-8">
              Completely Free
            </div>
            <h2 className="font-headline text-3xl md:text-6xl font-bold tracking-tighter text-on-surface mb-8 md:mb-12">Get Cue Clock</h2>
            
            <div className="inline-flex flex-col lg:flex-row items-stretch lg:items-center gap-4 lg:gap-8 p-4 bg-surface-container rounded-lg border border-outline-variant/10 w-full lg:w-auto">
              <div className="flex justify-around items-center gap-4 lg:gap-12 px-2 lg:px-8 py-4 lg:py-6">
                {(Object.keys(platforms) as Array<keyof typeof platforms>).map((p) => (
                  <div 
                    key={p}
                    onClick={() => setSelectedPlatform(p)}
                    className={`flex flex-col items-center gap-2 group cursor-pointer transition-all ${selectedPlatform === p ? 'scale-110' : 'opacity-50 hover:opacity-100'}`}
                  >
                    <span className={`material-symbols-outlined text-3xl md:text-4xl ${selectedPlatform === p ? 'text-primary' : 'text-outline group-hover:text-primary'} transition-colors`}>
                      {platforms[p].icon}
                    </span>
                    <span className={`font-label text-[0.5rem] md:text-[0.6rem] font-bold uppercase tracking-widest ${selectedPlatform === p ? 'text-on-surface' : 'text-outline group-hover:text-on-surface'}`}>
                      {platforms[p].label}
                    </span>
                  </div>
                ))}
              </div>
              <div className="h-px lg:h-20 w-full lg:w-px bg-outline-variant/20"></div>
              <div className="flex justify-center px-2 lg:px-8 py-4 lg:py-6">
                <button 
                  onClick={platforms[selectedPlatform].action}
                  className={`download-btn relative overflow-hidden ${platforms[selectedPlatform].theme} font-label font-bold uppercase tracking-widest px-6 md:px-10 py-4 md:py-5 rounded-sm flex items-center gap-3 transition-all shadow-lg active:scale-95 text-xs md:text-sm w-full lg:w-auto justify-center`}
                >
                  <span className="relative z-10 flex items-center gap-3 pointer-events-none">
                    {platforms[selectedPlatform].buttonText} {platforms[selectedPlatform].logo}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Credits Section */}
        <section className="py-24 bg-surface px-6 relative overflow-hidden">
          <div className="max-w-screen-xl mx-auto border-t border-outline-variant/20 pt-24">
            <div className="grid md:grid-cols-2 gap-16 items-start">
              <div>
                <div className="flex items-center gap-4 mb-8">
                  <svg className="w-10 h-10 fill-on-surface" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"></path></svg>
                  <h2 className="font-headline text-4xl font-bold tracking-tight text-on-surface">Completely Open-Source</h2>
                </div>
                <p className="text-on-surface-variant text-lg leading-relaxed font-body mb-8">
                  Cue Clock is fully open-source. I believe that critical broadcast tools should be transparent, community-driven, and accessible to everyone. You can audit the code, suggest features, or contribute directly on GitHub.
                </p>
                <a 
                  href="https://github.com/yanukadeneth99/Cue-Clock" 
                  target="_blank" 
                  className="inline-flex items-center gap-2 text-primary font-label font-bold uppercase tracking-widest text-[0.6875rem] hover:underline"
                >
                  View Source Code <span className="material-symbols-outlined text-sm">open_in_new</span>
                </a>
              </div>
              <div>
                <h3 className="font-headline text-xl font-bold mb-8 text-on-surface">Contributors</h3>
                <div className="flex flex-wrap gap-4">
                  {contributors.length > 0 ? (
                    contributors.map((c) => (
                      <a 
                        key={c.id} 
                        href={c.html_url} 
                        target="_blank" 
                        title={c.login}
                        className="w-12 h-12 rounded-full overflow-hidden border-2 border-outline-variant/30 hover:border-primary transition-all group relative"
                      >
                        <Image src={c.avatar_url} alt={c.login} className="w-full h-full object-cover" width={48} height={48} />
                      </a>
                    ))
                  ) : (
                    <div className="flex gap-4">
                      <div className="w-12 h-12 rounded-full bg-surface-container-high animate-pulse"></div>
                      <div className="w-12 h-12 rounded-full bg-surface-container-high animate-pulse"></div>
                      <div className="w-12 h-12 rounded-full bg-surface-container-high animate-pulse"></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#101319] border-t border-[#414751]/20">
        <div className="w-full py-8 px-6 md:px-8 flex flex-col md:flex-row justify-between items-center gap-4 max-w-screen-2xl mx-auto">
          <div className="text-lg font-black text-[#a4c9ff] font-headline uppercase">{new Date().getFullYear()} Cue Clock</div>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <a
              className="font-body text-[0.6875rem] tracking-wider uppercase font-bold text-[#414751] hover:text-[#a4c9ff] transition-all duration-300"
              href="https://yashura.io"
              target="_blank"
              rel="noopener noreferrer"
            >
              Created with ❤️ by <span className="text-primary underline underline-offset-4 decoration-[#414751] hover:decoration-primary">YASHURA</span>
            </a>
            <div className="flex items-center gap-3">
              {/* X (Twitter) */}
              <a
                href="https://x.com/yanukadeneth99"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X (Twitter)"
                className="text-[#414751] hover:text-[#a4c9ff] transition-colors duration-300"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.736l7.73-8.835L1.254 2.25H8.08l4.258 5.63 5.906-5.63Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              {/* LinkedIn */}
              <a
                href="https://linkedin.com/in/yanukadeneth99"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="text-[#414751] hover:text-[#a4c9ff] transition-colors duration-300"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
        <div className="w-full border-t border-[#414751]/20 py-4 px-6 md:px-8 flex justify-center items-center max-w-screen-2xl mx-auto">
          <a
            href="/privacy"
            className="font-body text-[0.6rem] md:text-[0.6875rem] tracking-wider uppercase font-bold text-[#414751] hover:text-[#a4c9ff] transition-all duration-300"
          >
            Privacy Policy
          </a>
        </div>
      </footer>
    </div>
  );
}
