import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>ProcessPilot</h1>
        <p>The operating system for repeatable business work.</p>
        <p className={styles.status}>Cloud development foundation — Phase -1.</p>
      </main>
    </div>
  );
}
