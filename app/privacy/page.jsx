import Link from "next/link";
import styles from "../legal.module.css";

export const metadata = {
  title: "Privacy Policy: Elbi GradeSim",
  description:
    "How Elbi GradeSim handles your data. Grade data stays on your device in the browser extension.",
};

export default function PrivacyPage() {
  return (
    <main className={styles.legalPage}>
      <Link href="/" className={styles.backLink}>
        ← Back to Elbi GradeSim
      </Link>

      <header className={styles.legalHeader}>
        <p className={styles.legalEyebrow}>Legal</p>
        <h1 className={styles.legalTitle}>Privacy Policy</h1>
        <p className={styles.legalUpdated}>Last updated: July 4, 2026</p>
      </header>

      <article className={styles.legalBody}>
        <section>
          <h2>What Elbi GradeSim is</h2>
          <p>
            Elbi GradeSim is a free browser extension that reads your grades from
            AMIS (amis.uplb.edu.ph) and helps UPLB students calculate GWA and simulate
            Latin honor targets. This website (gradesim) promotes and documents the
            extension. The extension and this site are open-source projects maintained
            by volunteers: not an official UPLB product.
          </p>
        </section>

        <section>
          <h2>The extension: your data stays local</h2>
          <p>
            <strong>
              All grade data captured by the Elbi GradeSim extension remains on your
              device.
            </strong>{" "}
            The extension stores courses, grades, and simulation settings in your
            browser&apos;s local storage. It does not send your AMIS credentials, grades,
            or GWA to any external server operated by Elbi GradeSim.
          </p>
          <ul>
            <li>No account sign-up required.</li>
            <li>No analytics or telemetry in the extension.</li>
            <li>No cloud sync: uninstalling or clearing browser data removes stored grades.</li>
            <li>
              The extension only interacts with AMIS pages you open; it does not run in
              the background on unrelated sites.
            </li>
          </ul>
        </section>

        <section>
          <h2>This website</h2>
          <p>
            Visiting this marketing site is separate from using the extension. The site
            may be hosted on Vercel or similar infrastructure, which can log standard
            request metadata (IP address, user agent, timestamps) for security and
            delivery. This site does not collect your grades or AMIS login.
          </p>
        </section>

        <section>
          <h2>Browser store listings</h2>
          <p>
            When you install from the Chrome Web Store, Firefox Add-ons, or Edge
            Add-ons, those platforms may collect installation and usage statistics
            according to their own privacy policies. Elbi GradeSim does not receive
            your personal identity from those stores beyond aggregate install counts.
          </p>
        </section>

        <section>
          <h2>Open source</h2>
          <p>
            Source code is available on GitHub. You can inspect how data is handled
            before installing. Community curriculum contributions are public in the
            repository and do not include your personal grades.
          </p>
        </section>

        <section>
          <h2>Children</h2>
          <p>
            The extension is intended for UPLB students. It is not directed at children
            under 13.
          </p>
        </section>

        <section>
          <h2>Changes</h2>
          <p>
            We may update this policy if the extension or website changes materially.
            The date above reflects the latest revision.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            Questions? Email{" "}
            <a href="mailto:semariquit@gmail.com">semariquit@gmail.com</a> or open an
            issue on GitHub.
          </p>
        </section>
      </article>
    </main>
  );
}
