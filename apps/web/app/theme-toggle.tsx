'use client';

import { Moon, Sun } from 'lucide-react';
import { useState } from 'react';

import { THEME_COOKIE, type Theme } from '@/lib/theme';

import styles from './hub.module.css';

/** Switches the page between dark and light, and remembers it for a year. */
export function ThemeToggle({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      className={styles.iconButton}
      aria-label={`Switch to ${next} mode`}
      onClick={() => {
        document.documentElement.dataset['theme'] = next;
        document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        setTheme(next);
      }}
    >
      {theme === 'dark' ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
    </button>
  );
}
