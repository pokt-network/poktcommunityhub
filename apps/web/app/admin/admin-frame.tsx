import Link from 'next/link';
import type { ReactNode } from 'react';

import styles from '../hub.module.css';

/**
 * The console's frame. Each page renders it AFTER its own requireAdmin(): a
 * layout would draw the navigation around the 404 an ambassador gets, which
 * would tell them what the console holds.
 */
export function AdminFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className={styles.page}>
      <nav className={styles.adminNav} aria-label="Admin">
        <Link href="/admin">Overview</Link>
        <Link href="/admin/review">Review</Link>
        <Link href="/admin/quests">Quests</Link>
        <Link href="/admin/categories">Categories</Link>
        <Link href="/admin/ranks">Ranks</Link>
        <Link href="/admin/users">Users</Link>
        <Link href="/admin/discord">Discord</Link>
      </nav>
      <h1 className={styles.title}>{title}</h1>
      {children}
    </main>
  );
}
