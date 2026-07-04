import Link from "next/link";
import styles from "../legal.module.css";

export const metadata = {
  title: "Terms of Service — Elbi GradeSim",
  description: "Terms for using the Elbi GradeSim browser extension and website.",
};

export default function TermsPage() {
  return (
    <main className={styles.legalPage}>
      <Link href="/" className={styles.backLink}>
        ← Back to Elbi GradeSim
      </Link>

      <header className={styles.legalHeader}>
        <p className={styles.legalEyebrow}>Legal</p>
        <h1 className={styles.legalTitle}>Terms of Service</h1>
        <p className={styles.legalUpdated}>Last updated: July 4, 2026</p>
      </header>

      <article className={styles.legalBody}>
        <section>
          <h2>Agreement</h2>
          <p>
            By installing Elbi GradeSim or using this website, you agree to these
            Terms. If you do not agree, do not use the extension or site.
          </p>
        </section>

        <section>
          <h2>What the extension does</h2>
          <p>
            Elbi GradeSim reads grade information displayed on AMIS pages you visit
            and performs local calculations (GWA, honor simulations, curriculum
            planning). It is a student tool — not an official UPLB or AMIS service.
            Calculations are estimates; verify important academic decisions with your
            college secretary or registrar.
          </p>
        </section>

        <section>
          <h2>Acceptable use</h2>
          <ul>
            <li>Use the extension only for your own academic planning.</li>
            <li>Do not tamper with AMIS or attempt to scrape data beyond normal browsing.</li>
            <li>Do not redistribute modified builds that misrepresent the project.</li>
            <li>Curriculum files you contribute to GitHub should not include personal grades.</li>
          </ul>
        </section>

        <section>
          <h2>No warranty</h2>
          <p>
            The extension and website are provided &quot;as is&quot; without warranties.
            GWA formulas, honor cutoffs, and curriculum data may be incomplete or
            outdated. Authors are not liable for academic decisions based on extension
            output.
          </p>
        </section>

        <section>
          <h2>AMIS and UPLB</h2>
          <p>
            AMIS is operated by UPLB. Elbi GradeSim is not affiliated with or endorsed
            by the university. Follow AMIS terms of use when accessing your account.
          </p>
        </section>

        <section>
          <h2>Open source license</h2>
          <p>
            The project is distributed under its repository license. Forking and
            contributions are welcome subject to that license and project guidelines.
          </p>
        </section>

        <section>
          <h2>Changes</h2>
          <p>
            These Terms may be updated. Continued use after changes means you accept
            the revised Terms.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            Questions? Email{" "}
            <a href="mailto:semariquit@gmail.com">semariquit@gmail.com</a>.
          </p>
        </section>
      </article>
    </main>
  );
}
