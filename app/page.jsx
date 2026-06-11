// app/page.jsx

import styles from "./page.module.css";
import pkg from "../package.json";

const CHROME_URL =
  "https://chromewebstore.google.com/detail/elbi-gradesim-uplb-gwa-ca/mlhklblbhkikcmobmmajckjcbmdinldb";
const FIREFOX_URL =
  "https://addons.mozilla.org/en-US/firefox/addon/elbi-gradesim/";
const EDGE_URL =
  "https://microsoftedge.microsoft.com/addons/detail/elbi-gradesim-uplb-gwa-/ebiakebpglddgmkdehdjiadnjgkmgnga";
const GITHUB_URL = "https://github.com/smmariquit/gradesim";

const DESKTOP_COMPAT = [
  { browser: "Google Chrome", icon: "/chrome.svg", support: "✅ Full", store: "Chrome Web Store", storeUrl: CHROME_URL, notes: "Native support" },
  { browser: "Mozilla Firefox", icon: "/firefox.svg", support: "✅ Full", store: "Firefox Add-ons", storeUrl: FIREFOX_URL, notes: "Native support" },
  { browser: "Microsoft Edge", icon: "/edge.svg", support: "✅ Full", store: "Edge Add-ons", storeUrl: EDGE_URL, notes: "Native support" },
  { browser: "Opera", icon: "/opera.svg", support: "✅ Full", store: "Chrome Web Store", storeUrl: CHROME_URL, notes: "Install via Chrome Web Store" },
  { browser: "Brave", icon: "/brave.svg", support: "✅ Full", store: "Chrome Web Store", storeUrl: CHROME_URL, notes: "Install via Chrome Web Store" },
  { browser: "Vivaldi", icon: "/vivaldi.svg", support: "✅ Full", store: "Chrome Web Store", storeUrl: CHROME_URL, notes: "Install via Chrome Web Store" },
  { browser: "Arc", icon: "/arc.svg", support: "✅ Full", store: "Chrome Web Store", storeUrl: CHROME_URL, notes: "Install via Chrome Web Store" },
  { browser: "Safari", icon: "/safari.svg", support: "❌ None", store: "—", storeUrl: null, notes: "Not supported" },
];

const MOBILE_COMPAT = [
  { browser: "Firefox Android", icon: "/firefox.svg", support: "✅ Works", notes: "Install from Firefox Add-ons" },
  { browser: "Kiwi Browser", icon: null, support: "⚠️ Untested", notes: "Supports Chrome extensions; should work" },
  { browser: "Samsung Internet", icon: null, support: "❌ None", notes: "No extension support" },
  { browser: "Chrome Android", icon: "/chrome.svg", support: "❌ None", notes: "Chrome mobile doesn't support extensions" },
  { browser: "Chrome iOS", icon: "/chrome.svg", support: "❌ None", notes: "iOS doesn't support browser extensions" },
  { browser: "Safari iOS", icon: "/safari.svg", support: "❌ None", notes: "Not supported" },
  { browser: "Edge Mobile", icon: "/edge.svg", support: "❌ None", notes: "Mobile Edge doesn't support add-ons" },
  { browser: "Opera Mobile", icon: "/opera.svg", support: "❌ None", notes: "No extension support on mobile" },
];

const FEATURES = [
  {
    icon: "📊",
    title: "Automatic GWA Calculation",
    description:
      "Captures your grades from AMIS and calculates your current GWA. Excludes NSTP, PE, and HK courses per UP policy.",
  },
  {
    icon: "🎯",
    title: '"What If?" Simulator',
    description:
      "Simulate the exact grades you need in remaining courses to hit Summa Cum Laude, Magna Cum Laude, Cum Laude, or any custom target.",
  },
  {
    icon: "📋",
    title: "Grades Overview",
    description:
      "View all your grades organized by semester or by year with color-coded visualization.",
  },
  {
    icon: "🔒",
    title: "100% Private",
    description:
      "All data stays on YOUR device. No servers, no analytics, no tracking. We never see your AMIS credentials.",
  },
  {
    icon: "🎓",
    title: "Multi-Program Support",
    description:
      "Supports 30+ programs across CAS, CAFS, CDC, CEM, CEAT, CFNR, CHE, and CVM. More added regularly.",
  },
  {
    icon: "📦",
    title: "Open Source",
    description:
      "The full source code is on GitHub. Inspect it, fork it, or contribute a missing curriculum.",
  },
];

const STEPS = [
  {
    number: "1",
    title: "Install the Extension",
    description:
      "Add Elbi GradeSim to Chrome, Firefox, or Edge. Free, takes a few seconds.",
  },
  {
    number: "2",
    title: "Log in to AMIS",
    description:
      "Go to amis.uplb.edu.ph and log in. The extension captures your grades automatically.",
  },
  {
    number: "3",
    title: "Simulate & Plan",
    description:
      "Click the extension icon to see your GWA and use the What If? simulator.",
  },
];

const PRIVACY_ITEMS = [
  {
    title: "Local Storage Only",
    description:
      "All data is stored locally using your browser's built-in storage. Nothing leaves your device.",
  },
  {
    title: "No External Servers",
    description:
      "Zero network requests to external servers. Everything runs in your browser.",
  },
  {
    title: "No Analytics or Tracking",
    description:
      "No Google Analytics, no telemetry, no usage tracking of any kind.",
  },
  {
    title: "Open Source",
    description:
      "The source code is public on GitHub. Verify our privacy practices yourself.",
  },
];

const TESTED_PROGRAMS = new Set(["BS Computer Science"]);

const PROGRAMS = [
  {
    college: "College of Arts and Sciences",
    programs: [
      "AA Sports Studies",
      "BA Communication Arts",
      "BA Philosophy",
      "BA Sociology",
      "BS Applied Mathematics",
      "BS Biology",
      "BS Chemistry",
      "BS Computer Science",
      "BS Mathematics",
      "BS Applied Physics",
      "BS Statistics",
    ],
  },
  {
    college: "College of Agriculture and Food Science",
    programs: [
      "BS Agricultural Biotechnology",
      "BS Agricultural Chemistry",
      "BS Agriculture",
      "BS Food Science and Technology",
    ],
  },
  {
    college: "College of Economics and Management",
    programs: [
      "AA Entrepreneurship",
      "BS Agribusiness Mgmt & Entrepreneurship",
      "BS Agricultural & Applied Economics",
      "BS Accountancy",
      "BS Economics",
    ],
  },
  {
    college: "College of Engineering and Agro-Industrial Technology",
    programs: [
      "BS Agricultural & Biosystems Engineering",
      "BS Chemical Engineering",
      "BS Civil Engineering",
      "BS Electrical Engineering",
      "BS Industrial Engineering",
      "BS Materials Engineering",
      "BS Mechanical Engineering",
    ],
  },
  {
    college: "College of Development Communication",
    programs: ["AS Development Communication", "BS Development Communication"],
  },
  {
    college: "College of Forestry and Natural Resources",
    programs: ["Associate in Forestry", "BS Forestry"],
  },
  {
    college: "College of Human Ecology",
    programs: ["BS Human Ecology", "BS Nutrition"],
  },
  {
    college: "College of Veterinary Medicine",
    programs: ["Doctor of Veterinary Medicine"],
  },
];

const CONTACT_EMAIL = "semariquit@gmail.com";

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" style={{ flexShrink: 0 }}>
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

export default function Home() {
  return (
    <>
      {/* Header */}
      <header className={styles.header} id="header">
        <div className={`container ${styles.headerContent}`}>
          <a href="/" className={styles.headerBrand}>
            <img src="/sims.png" alt="GradeSim" className={styles.headerLogo} />
            <span className={styles.headerName}>Elbi GradeSim</span>
          </a>
          <nav className={styles.headerNav}>
            <a href="#features" className={styles.headerLink}>Features</a>
            <a href="#download" className={styles.headerLink}>Download</a>
            <a href="#compatibility" className={styles.headerLink}>Compatibility</a>
            <a href="#programs" className={styles.headerLink}>Programs</a>
            <a href={CHROME_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ padding: '8px 20px', fontSize: '0.84rem' }} id="header-install-btn">
              Install Free
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className={styles.hero} id="hero">
        <div className={`container ${styles.heroContent}`}>
          <div className={styles.heroText}>
            <div className={styles.heroBadge}>
              <span className={styles.heroBadgeDot} />
              v{pkg.version} · Free &amp; Open Source
            </div>

            <h1 className={styles.heroTitle}>
              Know your path to{" "}
              <span className={styles.heroTitleHighlight}>Latin Honors</span>
            </h1>

            <p className={styles.heroDescription}>
              Calculate your GWA and simulate the grades you need to achieve
              Summa, Magna, or Cum Laude at UPLB. All data stays on your device.
            </p>

            <div className={styles.heroActions}>
              <a href={CHROME_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary" id="hero-chrome-btn">
                <img src="/chrome.svg" alt="" className="btn-icon" /> Add to Chrome
              </a>
              <a href={FIREFOX_URL} target="_blank" rel="noopener noreferrer" className="btn btn-outline" id="hero-firefox-btn">
                <img src="/firefox.svg" alt="" className="btn-icon" /> Add to Firefox
              </a>
              <a href={EDGE_URL} target="_blank" rel="noopener noreferrer" className="btn btn-outline" id="hero-edge-btn">
                <img src="/edge.svg" alt="" className="btn-icon" /> Add to Edge
              </a>
            </div>

            <div className={styles.heroStats}>
              <div>
                <div className={styles.heroStatValue}>5.0 ★</div>
                <div className={styles.heroStatLabel}>Chrome Web Store</div>
              </div>
              <div>
                <div className={styles.heroStatValue}>30+</div>
                <div className={styles.heroStatLabel}>Programs Supported</div>
              </div>
              <div>
                <div className={styles.heroStatValue}>0 bytes</div>
                <div className={styles.heroStatLabel}>Data Sent Out</div>
              </div>
            </div>
          </div>

          <div className={styles.heroVisual}>
            <div className={styles.heroMockup}>
              <div className={styles.heroMockupCard}>
                <div className={styles.mockupHeader}>
                  <img src="/sims.png" alt="GradeSim icon" className={styles.mockupIcon} />
                  <span className={styles.mockupTitle}>Elbi GradeSim</span>
                </div>

                <div className={styles.mockupGwaSection}>
                  <div className={styles.mockupGwaLabel}>Current GWA</div>
                  <div className={styles.mockupGwaValue}>1.18</div>
                  <div className={styles.mockupHonor}>🎓 Summa Cum Laude</div>
                </div>

                <div className={styles.mockupStats}>
                  <div className={styles.mockupStat}>
                    <div className={styles.mockupStatVal}>142</div>
                    <div className={styles.mockupStatLbl}>Units Passed</div>
                  </div>
                  <div className={styles.mockupStat}>
                    <div className={styles.mockupStatVal}>38</div>
                    <div className={styles.mockupStatLbl}>Courses Done</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section" id="features">
        <div className="container">
          <div className="section-label">Features</div>
          <h2 className="section-title">Everything you need to plan ahead</h2>
          <p className="section-subtitle">
            Built for UPLB students who want to track their academic progress and
            plan for Latin honors.
          </p>

          <div className={styles.featuresGrid}>
            {FEATURES.map((f, i) => (
              <div key={i} className={`card ${styles.featureCard}`}>
                <div className={styles.featureIcon}>{f.icon}</div>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureDescription}>{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="section" id="how-it-works">
        <div className="container">
          <div className="section-label">How It Works</div>
          <h2 className="section-title">Up and running in 60 seconds</h2>
          <p className="section-subtitle">
            No sign-up required. Install, log in to AMIS, and start planning.
          </p>

          <div className={styles.howItWorksSteps}>
            {STEPS.map((s, i) => (
              <div key={i} className={`card ${styles.stepCard}`}>
                <div className={styles.stepNumber}>{s.number}</div>
                <h3 className={styles.stepTitle}>{s.title}</h3>
                <p className={styles.stepDescription}>{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Download */}
      <section className="section" id="download">
        <div className="container">
          <div className="section-label">Download</div>
          <h2 className="section-title">Get Elbi GradeSim</h2>
          <p className="section-subtitle">
            Available on Chrome, Firefox, and Edge. Free, open-source, and privacy-first.
          </p>

          <div className={styles.downloadCards}>
            <div className={`card ${styles.downloadCard}`}>
              <img src="/chrome.svg" alt="Google Chrome" className={styles.downloadBrowserIcon} />
              <h3 className={styles.downloadBrowserName}>Google Chrome</h3>
              <p className={styles.downloadBrowserVersion}>
                Version {pkg.version} · 64.35 KiB · 5.0 ★ (2 ratings)
              </p>
              <a href={CHROME_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary" id="download-chrome-btn">
                Add to Chrome
              </a>
              <div className={styles.downloadBadge}>
                <span className={styles.downloadBadgeIcon}>✓</span>
                Verified on Chrome Web Store
              </div>
            </div>

            <div className={`card ${styles.downloadCard}`}>
              <img src="/firefox.svg" alt="Mozilla Firefox" className={styles.downloadBrowserIcon} />
              <h3 className={styles.downloadBrowserName}>Mozilla Firefox</h3>
              <p className={styles.downloadBrowserVersion}>
                Version {pkg.version} · Also available on Android
              </p>
              <a href={FIREFOX_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary" id="download-firefox-btn">
                Add to Firefox
              </a>
              <div className={styles.downloadBadge}>
                <span className={styles.downloadBadgeIcon}>✓</span>
                Verified on Firefox Add-ons
              </div>
            </div>

            <div className={`card ${styles.downloadCard}`}>
              <img src="/edge.svg" alt="Microsoft Edge" className={styles.downloadBrowserIcon} />
              <h3 className={styles.downloadBrowserName}>Microsoft Edge</h3>
              <p className={styles.downloadBrowserVersion}>
                Version {pkg.version} · Edge Add-ons
              </p>
              <a href={EDGE_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary" id="download-edge-btn">
                Add to Edge
              </a>
              <div className={styles.downloadBadge}>
                <span className={styles.downloadBadgeIcon}>✓</span>
                Verified on Edge Add-ons
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="section" id="privacy">
        <div className="container">
          <div className="section-label">Privacy</div>
          <h2 className="section-title">Your data never leaves your device</h2>
          <p className="section-subtitle">
            Elbi GradeSim works entirely offline after installation. No exceptions.
          </p>

          <div className={styles.privacyContent}>
            <div className={styles.privacyFeatures}>
              {PRIVACY_ITEMS.map((item, i) => (
                <div key={i} className={styles.privacyItem}>
                  <div className={styles.privacyCheck}>✓</div>
                  <div>
                    <div className={styles.privacyItemTitle}>{item.title}</div>
                    <div className={styles.privacyItemDescription}>{item.description}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.privacyVisual}>
              <span className={styles.privacyShield}>🛡️</span>
            </div>
          </div>
        </div>
      </section>

      {/* Programs */}
      <section className="section" id="programs">
        <div className="container">
          <div className="section-label">Supported Programs</div>
          <h2 className="section-title">30+ degree programs and growing</h2>
          <p className="section-subtitle">
            Curricula across all UPLB colleges. Missing yours? Contribute on GitHub.
          </p>

          <div className={styles.programsLegend}>
            <span className={styles.legendItem}><span className={styles.legendBadgeTested}>✅ Tested</span> Verified working</span>
            <span className={styles.legendItem}><span className={styles.legendBadgeUntested}>⚠️ Untested</span> Curriculum added, not yet verified</span>
          </div>

          <div className={styles.programsGrid}>
            {PROGRAMS.map((college, i) => (
              <div key={i} className={`card ${styles.programCollege}`}>
                <div className={styles.programCollegeName}>{college.college}</div>
                <ul className={styles.programList}>
                  {college.programs.map((p, j) => (
                    <li key={j} className={`${styles.programItem} ${TESTED_PROGRAMS.has(p) ? styles.programTested : ''}`}>
                      <span>{p}</span>
                      <span className={TESTED_PROGRAMS.has(p) ? styles.programBadgeTested : styles.programBadgeUntested}>
                        {TESTED_PROGRAMS.has(p) ? '✅' : '⚠️'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className={styles.programsContact}>
            <p>
              Found an issue with your program&apos;s curriculum? Want to help us test?
              Email us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className={styles.contactLink}>{CONTACT_EMAIL}</a>
            </p>
          </div>
        </div>
      </section>

      {/* Browser Compatibility */}
      <section className="section" id="compatibility">
        <div className="container">
          <div className="section-label">Compatibility</div>
          <h2 className="section-title">Desktop Browser Support</h2>
          <p className="section-subtitle">
            Works on all Chromium-based browsers via the Chrome Web Store, plus native Firefox and Edge support.
          </p>

          <div className={styles.compatTableWrapper}>
            <table className={styles.compatTable}>
              <thead>
                <tr>
                  <th>Browser</th>
                  <th>Support</th>
                  <th>Install From</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {DESKTOP_COMPAT.map((row, i) => (
                  <tr key={i}>
                    <td className={styles.compatBrowser}>
                      {row.icon ? <img src={row.icon} alt="" className={styles.compatIcon} /> : <span className={styles.compatIconPlaceholder}>🌐</span>}
                      {row.browser}
                    </td>
                    <td><span className={styles.compatSupport}>{row.support}</span></td>
                    <td>
                      {row.storeUrl ? (
                        <a href={row.storeUrl} target="_blank" rel="noopener noreferrer" className={styles.compatStoreLink}>
                          {row.store}
                        </a>
                      ) : (
                        <span className={styles.compatNoStore}>{row.store}</span>
                      )}
                    </td>
                    <td className={styles.compatNotes}>{row.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="section-title" style={{ marginTop: '64px' }}>Mobile Browser Support</h2>
          <p className="section-subtitle">
            Most mobile browsers don&apos;t support extensions. Firefox Android is the main exception.
          </p>

          <div className={styles.compatTableWrapper}>
            <table className={styles.compatTable}>
              <thead>
                <tr>
                  <th>Browser</th>
                  <th>Support</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {MOBILE_COMPAT.map((row, i) => (
                  <tr key={i}>
                    <td className={styles.compatBrowser}>
                      {row.icon ? <img src={row.icon} alt="" className={styles.compatIcon} /> : <span className={styles.compatIconPlaceholder}>📱</span>}
                      {row.browser}
                    </td>
                    <td><span className={styles.compatSupport}>{row.support}</span></td>
                    <td className={styles.compatNotes}>{row.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.cta} id="cta">
        <div className="container">
          <div className={styles.ctaCard}>
            <h2 className={styles.ctaTitle}>Ready to plan your path to honors?</h2>
            <p className={styles.ctaDescription}>
              Install Elbi GradeSim today — it&apos;s free, private, and takes less than a minute.
            </p>
            <div className={styles.ctaActions}>
              <a href={CHROME_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary" id="cta-chrome-btn">
                <img src="/chrome.svg" alt="" className="btn-icon" /> Add to Chrome
              </a>
              <a href={FIREFOX_URL} target="_blank" rel="noopener noreferrer" className="btn btn-outline" id="cta-firefox-btn">
                <img src="/firefox.svg" alt="" className="btn-icon" /> Add to Firefox
              </a>
              <a href={EDGE_URL} target="_blank" rel="noopener noreferrer" className="btn btn-outline" id="cta-edge-btn">
                <img src="/edge.svg" alt="" className="btn-icon" /> Add to Edge
              </a>
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="btn btn-outline" id="cta-github-btn">
                <GitHubIcon /> View on GitHub
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={`container ${styles.footerContent}`}>
          <div className={styles.footerBrand}>
            <img src="/sims.png" alt="GradeSim" className={styles.footerLogo} />
            <span className={styles.footerName}>Elbi GradeSim</span>
          </div>

          <div className={styles.footerLinks}>
            <a href={CHROME_URL} target="_blank" rel="noopener noreferrer" className={styles.footerLink}>Chrome Web Store</a>
            <a href={FIREFOX_URL} target="_blank" rel="noopener noreferrer" className={styles.footerLink}>Firefox Add-ons</a>
            <a href={EDGE_URL} target="_blank" rel="noopener noreferrer" className={styles.footerLink}>Edge Add-ons</a>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={styles.footerLink}>GitHub</a>
            <a href={`${GITHUB_URL}/blob/main/PRIVACY_POLICY.md`} target="_blank" rel="noopener noreferrer" className={styles.footerLink}>Privacy Policy</a>
          </div>

          <span className={styles.footerCopy}>
            © {new Date().getFullYear()} Elbi GradeSim • v{pkg.version}
          </span>
        </div>
      </footer>
    </>
  );
}
