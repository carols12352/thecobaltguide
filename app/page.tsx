import type { Metadata } from "next";
import Link from "next/link";
import styles from "./production.module.css";

export const metadata: Metadata = {
  title: "Cobalt Guide — Under Production",
  description:
    "Cobalt Guide is currently under production. A better way to discover where your Cobalt card earns more is on the way.",
};

export default function HomePage() {
  return (
    <main className={styles.page}>
      <div className={styles.grid} aria-hidden="true" />
      <div className={styles.scanline} aria-hidden="true" />

      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Cobalt Guide home">
          <span className={styles.brandMark} aria-hidden="true">
            CG
          </span>
          <span>Cobalt Guide</span>
        </Link>

        <div className={styles.buildLabel}>
          <span className={styles.statusDot} aria-hidden="true" />
          Build in progress
        </div>
      </header>

      <section className={styles.hero} aria-labelledby="production-title">
        <div className={styles.copy}>
          <p className={styles.eyebrow}>The next edition is taking shape</p>
          <h1 id="production-title" className={styles.title}>
            Under
            <span>production.</span>
          </h1>
          <p className={styles.description}>
            We’re building a clearer way to find where your Cobalt card earns
            more across Canada.
          </p>
        </div>

        <div className={styles.blueprint} aria-hidden="true">
          <svg viewBox="0 0 600 600" role="presentation">
            <circle cx="300" cy="300" r="232" />
            <circle cx="300" cy="300" r="172" />
            <circle cx="300" cy="300" r="42" />
            <path d="M300 18v564M18 300h564" />
            <path d="m136 136 328 328M464 136 136 464" />
            <path
              className={styles.route}
              d="M109 389c57-12 78-77 128-92 48-15 71 41 116 24 58-21 47-94 137-112"
            />
            <circle className={styles.routePoint} cx="109" cy="389" r="9" />
            <circle className={styles.routePoint} cx="490" cy="209" r="9" />
          </svg>
          <span className={styles.coordinateNorth}>43.65° N</span>
          <span className={styles.coordinateWest}>79.38° W</span>
          <span className={styles.blueprintNumber}>05×</span>
        </div>
      </section>

      <footer className={styles.footer}>
        <p>Designed for Cobalt cardholders in Canada</p>
        <p className={styles.footerMeta}>Preview / 2026</p>
      </footer>
    </main>
  );
}
