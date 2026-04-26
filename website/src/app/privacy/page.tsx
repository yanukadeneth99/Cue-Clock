import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for Cue Clock. Cue Clock stores all timers and settings locally on your device and never transmits personal data. Optional analytics are opt-in only.",
  alternates: { canonical: "https://cueclock.app/privacy" },
  openGraph: {
    title: "Privacy Policy | Cue Clock",
    description: "How Cue Clock handles your data: local-only storage, opt-in anonymous analytics, no personal data collection.",
    url: "https://cueclock.app/privacy",
    type: "article",
  },
  robots: { index: true, follow: true },
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      {/* Header */}
      <header className="border-b border-border bg-surface sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <Link href="/" className="text-accent hover:text-accent/80 transition-colors font-medium">
            ← Back to Cue Clock
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold font-headline mb-2">Privacy Policy</h1>
        <p className="text-muted mb-8">Last updated: March 31, 2026</p>

        <div className="space-y-8 prose prose-invert max-w-none">
          {/* Overview */}
          <section>
            <h2 className="text-2xl font-bold font-headline mb-4">Overview</h2>
            <p className="text-base leading-relaxed">
              Cue Clock (&quot;the App&quot;) is a minimal, distraction-free time management tool for broadcast professionals. We are committed to protecting your privacy and being transparent about how we handle data.
            </p>
            <p className="text-base leading-relaxed mt-4">
              <strong>The most important thing to know:</strong> Cue Clock does not collect, store, or transmit your personal data or timer information to our servers. All timers, settings, and preferences are stored locally on your device using encrypted local storage.
            </p>
          </section>

          {/* What We Collect */}
          <section>
            <h2 className="text-2xl font-bold font-headline mb-4">What Data Do We Collect?</h2>

            <div className="space-y-6">
              {/* Local Data */}
              <div>
                <h3 className="text-xl font-semibold font-headline mb-2">Data Stored Locally (On Your Device)</h3>
                <p className="text-base leading-relaxed mb-3">
                  The following information is stored exclusively on your device and never sent to our servers:
                </p>
                <ul className="list-disc list-inside space-y-2 text-base leading-relaxed ml-2">
                  <li>Timezone selections for your two live clocks</li>
                  <li>Names and settings for your countdown timers</li>
                  <li>Alert notification preferences</li>
                  <li>Fullscreen mode preferences</li>
                  <li>User interface settings and customizations</li>
                </ul>
                <p className="text-base leading-relaxed mt-4 text-muted italic">
                  This data persists across sessions via AsyncStorage (mobile) or localStorage (web) and can be cleared at any time by uninstalling the app or clearing app data.
                </p>
              </div>

              {/* Analytics */}
              <div>
                <h3 className="text-xl font-semibold font-headline mb-2">Analytics & Usage Data</h3>
                <p className="text-base leading-relaxed mb-4">
                  <strong>Only if you consent on first launch</strong>, we use two analytics services that collect <strong>anonymous, non-personally identifiable usage data</strong>. No analytics data is collected before you give explicit consent:
                </p>

                {/* Microsoft Clarity */}
                <div className="ml-4 mb-4 p-4 bg-surface-variant rounded border border-border">
                  <h4 className="font-semibold mb-2">Microsoft Clarity</h4>
                  <p className="text-sm leading-relaxed mb-2">
                    Microsoft Clarity is a web analytics service that helps us understand how users interact with our App.
                  </p>
                  <ul className="text-sm space-y-1 list-disc list-inside">
                    <li>Session recordings (anonymized interactions and clicks)</li>
                    <li>Page load times and performance metrics</li>
                    <li>Device type and browser information</li>
                    <li>Geographic region (country-level, not precise location)</li>
                  </ul>
                  <p className="text-xs text-muted mt-2">
                    <strong>No personal information is tracked.</strong> Clarity does not capture timer names, alert times, or any user-entered data. Learn more at{" "}
                    <a href="https://clarity.microsoft.com/" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                      clarity.microsoft.com
                    </a>
                  </p>
                </div>

                {/* Firebase Analytics */}
                <div className="ml-4 p-4 bg-surface-variant rounded border border-border">
                  <h4 className="font-semibold mb-2">Firebase Analytics (Google)</h4>
                  <p className="text-sm leading-relaxed mb-2">
                    Firebase Analytics helps us track app usage patterns and identify issues.
                  </p>
                  <ul className="text-sm space-y-1 list-disc list-inside">
                    <li>App launch frequency</li>
                    <li>Feature usage (e.g., which screens are visited)</li>
                    <li>App crashes and errors</li>
                    <li>Device model and OS version</li>
                  </ul>
                  <p className="text-xs text-muted mt-2">
                    <strong>No personal information is tracked.</strong> Firebase does not capture timer configurations, timezone selections, or any custom user data. Learn more at{" "}
                    <a href="https://firebase.google.com/docs/analytics" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                      firebase.google.com/docs/analytics
                    </a>
                  </p>
                </div>
              </div>

              {/* What We Don't Collect */}
              <div>
                <h3 className="text-xl font-semibold font-headline mb-2">What We Do Not Collect</h3>
                <ul className="list-disc list-inside space-y-2 text-base leading-relaxed ml-2">
                  <li>Your name, email, or contact information</li>
                  <li>Payment information (the App is free; no purchases)</li>
                  <li>Precise location data or GPS coordinates</li>
                  <li>Your timer names, target times, or countdown configurations</li>
                  <li>Contacts, calendar data, or other personal files</li>
                  <li>Biometric data (face ID, fingerprint, etc.)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Analytics Controls */}
          <section>
            <h2 className="text-2xl font-bold font-headline mb-4">Your Privacy Controls</h2>
            <div className="space-y-4 text-base leading-relaxed">
              <p>
                <strong>First Launch. Explicit Consent:</strong> On first launch, Cue Clock shows a consent dialog before any analytics are collected. No data is sent until you explicitly choose <em>Allow Analytics</em>. You can decline and the app works fully without any data collection.
              </p>
              <p>
                <strong>Change Your Mind:</strong> You can toggle analytics on or off at any time using the <strong>Analytics toggle</strong> in the App (footer on mobile, header on web). Disabling analytics immediately stops Firebase data collection. Microsoft Clarity will stop initializing on the next app launch.
              </p>
              <p>
                <strong>Browser Privacy Settings:</strong> Modern browsers allow you to disable third-party analytics services. You can also use privacy-focused browser extensions to block tracking scripts.
              </p>
              <p>
                <strong>Clear Local Data:</strong> You can clear all locally stored App data (timers, settings, etc.) at any time:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li><strong>Android:</strong> Settings → Apps → Cue Clock → Storage → Clear Data</li>
                <li><strong>iOS:</strong> Settings → General → iPhone Storage → Cue Clock → Offload App (data cleared but app remains)</li>
                <li><strong>Web:</strong> Browser Developer Tools → Application → Clear Site Data</li>
              </ul>
            </div>
          </section>

          {/* Third-Party Services */}
          <section>
            <h2 className="text-2xl font-bold font-headline mb-4">Third-Party Services & Privacy Policies</h2>
            <p className="text-base leading-relaxed mb-4">
              Cue Clock uses the following third-party services. Please review their privacy policies:
            </p>
            <ul className="space-y-3 text-base">
              <li>
                <strong>Microsoft Clarity:</strong>{" "}
                <a href="https://privacy.microsoft.com/" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                  privacy.microsoft.com
                </a>
              </li>
              <li>
                <strong>Google Firebase:</strong>{" "}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                  policies.google.com/privacy
                </a>
              </li>
              <li>
                <strong>Google Play Services (Android):</strong>{" "}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                  policies.google.com/privacy
                </a>
              </li>
            </ul>
          </section>

          {/* Children's Privacy */}
          <section>
            <h2 className="text-2xl font-bold font-headline mb-4">Children&apos;s Privacy</h2>
            <p className="text-base leading-relaxed">
              Cue Clock is designed for broadcast professionals but is not intentionally targeted at children under 13 (or the applicable age of digital consent in your region). We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, please contact us immediately.
            </p>
          </section>

          {/* Data Security */}
          <section>
            <h2 className="text-2xl font-bold font-headline mb-4">Data Security</h2>
            <p className="text-base leading-relaxed mb-4">
              We take data security seriously:
            </p>
            <ul className="list-disc list-inside space-y-2 text-base leading-relaxed ml-2">
              <li><strong>Local Data:</strong> All data stored on your device is protected by your device&apos;s security (pin, password, biometric lock).</li>
              <li><strong>In Transit:</strong> Analytics data is transmitted over HTTPS with encryption.</li>
              <li><strong>No Server Storage:</strong> We do not store your timer data, settings, or personal information on our servers.</li>
              <li><strong>Open Source:</strong> The App&apos;s source code is publicly available on GitHub, allowing security researchers to audit the code. See <a href="https://github.com/yanukadeneth99/Cue-Clock" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">our GitHub repository</a>.</li>
            </ul>
          </section>

          {/* Your Rights */}
          <section>
            <h2 className="text-2xl font-bold font-headline mb-4">Your Privacy Rights</h2>
            <p className="text-base leading-relaxed mb-4">
              Depending on your location, you may have the following rights:
            </p>
            <ul className="list-disc list-inside space-y-2 text-base leading-relaxed ml-2">
              <li><strong>Right to Access:</strong> You can request what data we have about you (though we collect very little).</li>
              <li><strong>Right to Delete:</strong> You can request deletion of any analytics data associated with you.</li>
              <li><strong>Right to Opt-Out:</strong> You can disable analytics collection in the App settings.</li>
              <li><strong>Right to Portability:</strong> You can export your locally stored data by uninstalling the App (exported via device backup).</li>
            </ul>
            <p className="text-base leading-relaxed mt-4">
              To exercise these rights or ask questions about your data, contact us at{" "}
              <a href="mailto:hello@yashura.io" className="text-accent hover:underline">
                hello@yashura.io
              </a>
            </p>
          </section>

          {/* Policy Changes */}
          <section>
            <h2 className="text-2xl font-bold font-headline mb-4">Changes to This Policy</h2>
            <p className="text-base leading-relaxed">
              We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors. When we make material changes, we will:
            </p>
            <ul className="list-disc list-inside space-y-2 text-base leading-relaxed ml-2 mt-4">
              <li>Update the &quot;Last updated&quot; date at the top of this page.</li>
              <li>Post the revised policy on our website.</li>
              <li>For significant changes, we may provide notice in the App or via email (if you&apos;ve provided an email address).</li>
            </ul>
            <p className="text-base leading-relaxed mt-4">
              Your continued use of the App following the posting of revised Privacy Policy means that you accept and agree to the changes.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-bold font-headline mb-4">Contact Us</h2>
            <p className="text-base leading-relaxed mb-4">
              If you have questions about this Privacy Policy, our privacy practices, or your data, please contact us:
            </p>
            <div className="bg-surface-variant p-6 rounded border border-border">
              <p className="text-base mb-2">
                <strong>Email:</strong>{" "}
                <a href="mailto:hello@yashura.io" className="text-accent hover:underline">
                  hello@yashura.io
                </a>
              </p>
              <p className="text-base">
                <strong>Website:</strong>{" "}
                <a href="https://cueclock.app" className="text-accent hover:underline">
                  cueclock.app
                </a>
              </p>
            </div>
          </section>

          {/* Legal Notice */}
          <section className="border-t border-border pt-8">
            <p className="text-sm text-muted">
              Cue Clock is open-source software released under the AGPL-3.0 license. For commercial licensing inquiries, please contact{" "}
              <a href="mailto:hello@yashura.io" className="text-accent hover:underline">
                hello@yashura.io
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
