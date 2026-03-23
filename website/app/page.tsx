import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen font-sans">
      <main className="max-w-5xl mx-auto px-6 py-12 md:py-24">
        {/* Hero Section */}
        <section className="text-center space-y-8 mb-24">
          <div className="inline-block bg-surface px-4 py-1.5 rounded-full text-sm font-medium text-foreground border border-surface-border mb-4">
            Available on iOS, Android, and Web
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground">
            <span className="text-zone1">Time.</span> Under{" "}
            <span className="text-zone2">Control.</span>
          </h1>
          <p className="text-xl text-muted max-w-2xl mx-auto leading-relaxed">
            A minimal, distraction-free clock app built for broadcast
            professionals who need to monitor multiple timezones and track
            countdown timers simultaneously.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            <button className="bg-accent hover:opacity-90 text-white font-semibold py-3 px-8 rounded-lg transition-all shadow-lg shadow-accent/20">
              Get Cue Clock
            </button>
            <button className="bg-surface hover:bg-surface-border text-foreground font-medium py-3 px-8 rounded-lg transition-colors border border-surface-border">
              View Documentation
            </button>
          </div>
        </section>

        {/* Features Grid */}
        <section className="grid md:grid-cols-2 gap-8 mb-24">
          {/* Feature 1 */}
          <div className="bg-surface p-8 rounded-2xl border border-surface-border hover:border-zone1/50 transition-colors">
            <div className="w-12 h-12 bg-zone1/10 rounded-xl flex items-center justify-center mb-6">
              <svg className="w-6 h-6 text-zone1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold text-foreground mb-3">Dual Timezone Clocks</h3>
            <p className="text-muted leading-relaxed">
              Two live clocks side by side. Configure each to any of the 18 most common broadcast timezones globally. Perfect for coordinating remote teams.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-surface p-8 rounded-2xl border border-surface-border hover:border-countdown/50 transition-colors">
            <div className="w-12 h-12 bg-countdown/10 rounded-xl flex items-center justify-center mb-6">
              <svg className="w-6 h-6 text-countdown" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold text-foreground mb-3">Infinite Countdowns</h3>
            <p className="text-muted leading-relaxed">
              Create as many named countdowns as you need. Each is tied to a specific timezone and target time. Includes support for deduction offsets (pre-show buffers).
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-surface p-8 rounded-2xl border border-surface-border hover:border-accent/50 transition-colors">
            <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mb-6">
              <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold text-foreground mb-3">On-Air Mode</h3>
            <p className="text-muted leading-relaxed">
              A dedicated full-screen mode that strips away all controls, leaving only the clocks and countdowns. Built specifically for on-air broadcast displays.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="bg-surface p-8 rounded-2xl border border-surface-border hover:border-zone2/50 transition-colors">
            <div className="w-12 h-12 bg-zone2/10 rounded-xl flex items-center justify-center mb-6">
              <svg className="w-6 h-6 text-zone2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold text-foreground mb-3">Lightning Fast</h3>
            <p className="text-muted leading-relaxed">
              Live broadcast environments demand speed. Cue Clock has minimal overhead, updating every second flawlessly. Your data is instantly saved locally.
            </p>
          </div>
        </section>

        {/* Call to Action */}
        <section className="bg-surface rounded-3xl p-12 text-center border border-surface-border">
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready for your next broadcast?</h2>
          <p className="text-muted mb-8 max-w-xl mx-auto">
            Join the professionals who trust Cue Clock for their time management and live shows.
          </p>
          <button className="bg-foreground hover:bg-white text-background font-bold py-3 px-8 rounded-lg transition-colors">
            Download the App
          </button>
        </section>
      </main>

      <footer className="border-t border-surface-border py-8 text-center text-muted text-sm mt-12">
        <p>&copy; {new Date().getFullYear()} YASHURA. All rights reserved.</p>
        <p className="mt-2 text-muted/50">Licensed under AGPL-3.0</p>
      </footer>
    </div>
  );
}
