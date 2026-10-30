import { Code, GraduationCap, Megaphone, MessageCircle, User, type LucideIcon } from 'lucide-react';
import type { CSSProperties } from 'react';

import styles from './hero-art.module.css';

/**
 * The board's hero picture: an ambassador (centre) reaching out to community
 * members one by one. Each connection draws a line, sends XP back along it, and
 * fills the level bar until the ambassador levels up. Pure CSS; with reduced
 * motion it shows the finished state (everyone connected, level 4).
 */
const PEOPLE: {
  initial: string;
  color: string;
  icon: LucideIcon;
  x: number;
  y: number;
  xp: string;
}[] = [
  { initial: 'K', color: 'var(--brand-mint)', icon: MessageCircle, x: 14, y: 20, xp: '+25' },
  { initial: 'M', color: 'var(--brand-lavender)', icon: Megaphone, x: 86, y: 16, xp: '+50' },
  { initial: 'S', color: 'var(--brand-coral)', icon: GraduationCap, x: 90, y: 66, xp: '+75' },
  { initial: 'J', color: 'var(--brand-gold)', icon: Code, x: 10, y: 68, xp: '+40' },
];

/** The ambassador's spot, in the same 0–100 space as PEOPLE. */
const HUB = { x: 50, y: 44 };

const vars = (v: Record<string, string | number>) => v as CSSProperties;

export function HeroArt() {
  return (
    <div className={styles.art} aria-hidden>
      <svg className={styles.lines} viewBox="0 0 100 100" preserveAspectRatio="none">
        {PEOPLE.map((p, i) => (
          <g key={p.initial} style={vars({ '--i': i, '--c': p.color })}>
            <line className={styles.link} x1={HUB.x} y1={HUB.y} x2={p.x} y2={p.y} pathLength={1} />
            {/* XP travelling home: a short dash running from the member to the ambassador. */}
            <line className={styles.pulse} x1={p.x} y1={p.y} x2={HUB.x} y2={HUB.y} pathLength={1} />
          </g>
        ))}
      </svg>

      {PEOPLE.map(({ initial, color, icon: Icon, x, y, xp }, i) => (
        <div
          key={initial}
          className={styles.person}
          style={vars({ '--i': i, '--c': color, left: `${x}%`, top: `${y}%` })}
        >
          <span className={styles.face}>{initial}</span>
          <span className={styles.badge}>
            <Icon size={12} strokeWidth={2.5} />
          </span>
          <span className={styles.xp}>{xp} XP</span>
        </div>
      ))}

      <div className={styles.hub} style={{ left: `${HUB.x}%`, top: `${HUB.y}%` }}>
        <span className={styles.ring} />
        <span className={styles.you}>
          <User size={30} strokeWidth={2} />
        </span>
        <span className={styles.levelBefore}>Lv 3</span>
        <span className={styles.level}>Lv 4</span>
      </div>

      <div className={styles.progress}>
        <span className={styles.bar}>
          <span />
        </span>
        <span className={styles.levelUp}>Level up!</span>
      </div>
    </div>
  );
}
