import React from 'react';

export default function Home() {
  return (
    <div className="selection:bg-primary/30 min-h-screen">
      {/* TopNavBar */}
      <nav className="bg-[#101319] dark:bg-[#101319] docked full-width top-0 sticky z-50">
        <div className="flex justify-between items-center w-full px-6 py-4 max-w-screen-2xl mx-auto">
          <div className="text-xl font-bold tracking-tighter text-[#a4c9ff] font-headline uppercase">
            Cue Clock
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a 
              className="font-headline uppercase tracking-[0.05em] text-[0.6875rem] font-bold text-[#a4c9ff] border-b-2 border-[#60a5fa] pb-1 hover:text-[#a4c9ff] transition-colors duration-200" 
              href="#"
            >
              Features
            </a>
            <a 
              className="font-headline uppercase tracking-[0.05em] text-[0.6875rem] font-bold text-[#414751] hover:text-[#a4c9ff] transition-colors duration-200" 
              href="#"
            >
              Why it's Free
            </a>
            <a 
              className="font-headline uppercase tracking-[0.05em] text-[0.6875rem] font-bold text-[#414751] hover:text-[#a4c9ff] transition-colors duration-200" 
              href="#"
            >
              Download
            </a>
          </div>
          <button className="bg-primary-container text-on-primary-container px-4 py-1.5 font-label text-[0.6875rem] font-bold uppercase tracking-widest rounded-sm active:opacity-80 active:scale-[0.99] transition-all">
            Get Started
          </button>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="relative pt-20 pb-32 overflow-hidden px-6">
          <div className="max-w-screen-xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
            <div className="z-10">
              <span className="font-label text-primary text-[0.6875rem] font-bold tracking-[0.2em] uppercase mb-4 block">
                Professional Grade Timing
              </span>
              <h1 className="font-headline text-5xl md:text-7xl font-bold leading-[0.95] tracking-tighter mb-6 text-on-surface">
                Cue Clock: Precision <br />
                <span className="text-primary">Time Management</span> <br />
                for the Gallery.
              </h1>
              <p className="text-on-surface-variant text-lg md:text-xl max-w-lg mb-10 font-body leading-relaxed">
                Available for Web, Android, and iOS. Completely free, no ads, ever. Built for broadcast professionals who demand millisecond accuracy.
              </p>
              <div className="flex flex-wrap gap-4">
                <button className="bg-gradient-to-br from-primary to-primary-container text-on-primary-container font-label font-bold uppercase tracking-widest px-8 py-4 rounded-sm flex items-center gap-3 hover:brightness-110 transition-all shadow-xl shadow-primary/10">
                  Download Now <span className="material-symbols-outlined text-sm">download</span>
                </button>
                <button className="bg-surface-bright/10 border border-primary/20 text-on-surface font-label font-bold uppercase tracking-widest px-8 py-4 rounded-sm hover:bg-surface-bright/20 transition-all">
                  Live Demo
                </button>
              </div>
            </div>

            {/* App Mockup Visual */}
            <div className="relative lg:scale-110">
              <div className="absolute -inset-4 bg-primary/5 blur-3xl rounded-full"></div>
              <div className="relative bg-surface-container rounded-lg p-3 shadow-2xl border border-outline-variant/20">
                {/* Top Bar Mockup */}
                <div className="flex justify-between items-center mb-6 px-4 py-2 border-b border-outline-variant/10">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-error/40"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-tertiary/40"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-secondary/40"></div>
                  </div>
                  <div className="font-mono-data text-[0.6rem] text-outline uppercase tracking-widest">Master Gallery Clock</div>
                </div>

                {/* Dual Clock Visual */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-surface-container-low p-6 rounded-sm border-l-2 border-secondary shadow-inner">
                    <label className="font-label text-[0.5rem] uppercase tracking-widest text-secondary block mb-2">Zone 1: London (GMT)</label>
                    <div className="font-mono-data text-4xl text-on-surface font-bold tracking-tight">14:24:08</div>
                  </div>
                  <div className="bg-surface-container-low p-6 rounded-sm border-l-2 border-error shadow-inner">
                    <label className="font-label text-[0.5rem] uppercase tracking-widest text-error block mb-2">Zone 2: New York (EST)</label>
                    <div className="font-mono-data text-4xl text-on-surface font-bold tracking-tight">09:24:08</div>
                  </div>
                </div>

                {/* Timer visual */}
                <div className="bg-surface-container-high p-8 rounded-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-2 opacity-20">
                    <span className="material-symbols-outlined text-4xl">timer</span>
                  </div>
                  <label className="font-label text-[0.6rem] uppercase tracking-widest text-tertiary block mb-4">Countdown: Segment 01 - Intro</label>
                  <div className="font-mono-data text-7xl text-tertiary text-glow font-bold leading-none tracking-tighter mb-4">
                    00:04:<span className="text-tertiary/60">52</span>
                  </div>
                  <div className="w-full bg-surface-variant h-1 rounded-full overflow-hidden">
                    <div className="bg-tertiary h-full w-2/3"></div>
                  </div>
                </div>
              </div>

              {/* Floating Overlay */}
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

        {/* Features Grid */}
        <section className="py-24 bg-surface-container-low relative px-6">
          <div className="max-w-screen-xl mx-auto">
            <div className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <span className="font-label text-primary text-[0.6875rem] font-bold tracking-[0.2em] uppercase mb-4 block">The Command Suite</span>
                <h2 className="font-headline text-4xl md:text-5xl font-bold tracking-tight text-on-surface">Engineered for Accuracy.</h2>
              </div>
              <p className="text-on-surface-variant max-w-sm font-body text-lg leading-relaxed">Every feature is designed to reduce cognitive load during high-pressure live broadcasts.</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-0.5 bg-outline-variant/10 border border-outline-variant/10 rounded-lg overflow-hidden">
              {/* Dual Live Clocks */}
              <div className="bg-surface p-10 hover:bg-surface-container-high transition-all group">
                <div className="flex gap-2 mb-8">
                  <div className="w-8 h-1 bg-secondary"></div>
                  <div className="w-8 h-1 bg-error"></div>
                </div>
                <h3 className="font-headline text-xl font-bold mb-4 text-on-surface group-hover:text-primary transition-colors">Dual Live Clocks</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed mb-6 font-body">Two side-by-side clocks configurable to 18 broadcast timezones for international productions.</p>
                <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">schedule</span>
              </div>
              {/* Multiple Countdowns */}
              <div className="bg-surface p-10 hover:bg-surface-container-high transition-all group">
                <div className="w-8 h-1 bg-tertiary mb-8"></div>
                <h3 className="font-headline text-xl font-bold mb-4 text-on-surface group-hover:text-primary transition-colors">Multiple Countdowns</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed mb-6 font-body">Infinite timers tied to specific zones with simultaneous readout capabilities.</p>
                <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">more_time</span>
              </div>
              {/* Deduction Offsets */}
              <div className="bg-surface p-10 hover:bg-surface-container-high transition-all group">
                <div className="w-8 h-1 bg-primary mb-8"></div>
                <h3 className="font-headline text-xl font-bold mb-4 text-on-surface group-hover:text-primary transition-colors">Deduction Offsets</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed mb-6 font-body">Subtract "pre-show buffer" durations from countdown targets with single-tap logic.</p>
                <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">exposure_neg_1</span>
              </div>
              {/* On-Air Mode */}
              <div className="bg-surface p-10 hover:bg-surface-container-high transition-all group">
                <div className="w-8 h-1 bg-secondary-container mb-8"></div>
                <h3 className="font-headline text-xl font-bold mb-4 text-on-surface group-hover:text-primary transition-colors">On-Air Mode</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed mb-6 font-body">Distraction-free, full-screen display optimized for low-light studio environments.</p>
                <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">fullscreen</span>
              </div>
              {/* Persistent State */}
              <div className="bg-surface p-10 hover:bg-surface-container-high transition-all group">
                <div className="w-8 h-1 bg-outline-variant mb-8"></div>
                <h3 className="font-headline text-xl font-bold mb-4 text-on-surface group-hover:text-primary transition-colors">Persistent State</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed mb-6 font-body">Settings saved locally across sessions via robust asynchronous storage hooks.</p>
                <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">save</span>
              </div>
              {/* Per-Timer Alerts */}
              <div className="bg-surface p-10 hover:bg-surface-container-high transition-all group">
                <div className="w-8 h-1 bg-error mb-8"></div>
                <h3 className="font-headline text-xl font-bold mb-4 text-on-surface group-hover:text-primary transition-colors">Per-Timer Alerts</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed mb-6 font-body">Configurable push notifications and high-visibility in-app visual alerts.</p>
                <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">notifications_active</span>
              </div>
            </div>
          </div>
        </section>

        {/* The Story */}
        <section className="py-32 px-6">
          <div className="max-w-screen-xl mx-auto">
            <div className="bg-surface-container rounded-sm overflow-hidden grid md:grid-cols-2 items-center">
              <div className="p-12 md:p-20 border-l-4 border-primary">
                <span className="font-label text-primary text-[0.6875rem] font-bold tracking-[0.2em] uppercase mb-4 block">The Mission</span>
                <h2 className="font-headline text-4xl font-bold tracking-tight text-on-surface mb-8">Built for the Gallery, <br />by the Gallery.</h2>
                <div className="space-y-6">
                  <p className="text-on-surface-variant text-lg leading-relaxed font-body">
                    Cue Clock was born from the need for a reliable, no-nonsense timing tool in live broadcast. In a world of over-complicated and expensive software, simplicity is a superpower.
                  </p>
                  <p className="text-on-surface-variant text-lg leading-relaxed font-body">
                    It's free because I believe the best tools should be accessible to everyone in the industry—from indie streamers to network technicians. It will stay free and ad-free, supported by the developer directly.
                  </p>
                </div>
              </div>
              <div className="h-full min-h-[400px] relative">
                <img 
                  alt="Professional broadcast control room gallery" 
                  className="absolute inset-0 w-full h-full object-cover grayscale opacity-50 contrast-125" 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuD9Jh2PPDwWXSz7OTJTgR_agK_XHh3wOmqMp65nsIBAXYkbqBs7_RLlnS5PaL0wVYta859tgrzsZUkMHW49-m4PXBxphAQ0YGTo8tI39uVqPau9qEV6QKmjg28ee5Obq09CvRX0HV5YFVHwEbB_iFdUXqMfSP8uP4SXBlEcNFTHRGXQ97na_-Q4nvneYiLxqa3uLyiDbO13QA_xmBvM1iQe_2BFRQ-X0OXoqFZ3Mtk5iZFcAMYsJKMFPW7koUL4fMJtezBr-Y5PUv4"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-surface-container via-surface-container/20 to-transparent"></div>
              </div>
            </div>
          </div>
        </section>

        {/* Download Section */}
        <section className="py-24 bg-surface-container-lowest relative overflow-hidden px-6">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[120px]"></div>
          <div className="max-w-screen-xl mx-auto text-center relative z-10">
            <h2 className="font-headline text-5xl md:text-6xl font-bold tracking-tighter text-on-surface mb-12">Get Cue Clock</h2>
            <div className="inline-flex flex-col md:flex-row gap-8 p-4 bg-surface-container rounded-lg border border-outline-variant/10">
              <div className="flex items-center gap-12 px-8 py-6">
                <div className="flex flex-col items-center gap-2 group cursor-pointer">
                  <span className="material-symbols-outlined text-4xl text-outline group-hover:text-primary transition-colors">language</span>
                  <span className="font-label text-[0.6rem] font-bold uppercase tracking-widest text-outline group-hover:text-on-surface">Web</span>
                </div>
                <div className="flex flex-col items-center gap-2 group cursor-pointer">
                  <span className="material-symbols-outlined text-4xl text-outline group-hover:text-primary transition-colors">phone_android</span>
                  <span className="font-label text-[0.6rem] font-bold uppercase tracking-widest text-outline group-hover:text-on-surface">Android</span>
                </div>
                <div className="flex flex-col items-center gap-2 group cursor-pointer">
                  <span className="material-symbols-outlined text-4xl text-primary transition-colors">phone_iphone</span>
                  <span className="font-label text-[0.6rem] font-bold uppercase tracking-widest text-on-surface">iOS</span>
                </div>
              </div>
              <div className="h-px md:h-20 w-full md:w-px bg-outline-variant/20"></div>
              <div className="flex items-center px-8 py-6">
                <button className="bg-primary text-on-primary font-label font-bold uppercase tracking-widest px-10 py-5 rounded-sm flex items-center gap-3 hover:bg-primary-fixed-dim transition-all shadow-lg active:scale-95">
                  Download for iOS <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </div>
            </div>
            <div className="mt-16 flex justify-center gap-12 opacity-40 grayscale">
              <span className="font-headline font-bold text-2xl">STUDIO-A</span>
              <span className="font-headline font-bold text-2xl">STREAM-TECH</span>
              <span className="font-headline font-bold text-2xl">BROADCAST-NET</span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#101319] border-t border-[#414751]/20">
        <div className="w-full py-12 px-8 flex flex-col md:flex-row justify-between items-center gap-6 max-w-screen-2xl mx-auto">
          <div className="flex flex-col items-center md:items-start gap-2">
            <div className="text-lg font-black text-[#a4c9ff] font-headline uppercase">Cue Clock</div>
            <div className="font-body text-[0.6875rem] tracking-wider uppercase font-bold text-[#414751]">© 2024 Cue Clock. Built for the Gallery.</div>
          </div>
          <div className="flex gap-8">
            <a className="font-body text-[0.6875rem] tracking-wider uppercase font-bold text-[#414751] hover:text-[#a4c9ff] underline underline-offset-4 transition-all duration-300" href="#">Developer Credits</a>
            <a className="font-body text-[0.6875rem] tracking-wider uppercase font-bold text-[#414751] hover:text-[#a4c9ff] underline underline-offset-4 transition-all duration-300" href="#">Privacy</a>
            <a className="font-body text-[0.6875rem] tracking-wider uppercase font-bold text-[#414751] hover:text-[#a4c9ff] underline underline-offset-4 transition-all duration-300" href="#">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
