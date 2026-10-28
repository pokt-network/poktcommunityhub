import type { LeaderboardRow, Profile } from '@community/store';
import Link from 'next/link';

import { formatDate } from '@/lib/format';

import styles from './hub.module.css';

/**
 * Flow 7: what members see of each other. Shared by /users/[id] and the top of
 * /me, so a member's own view of their profile is exactly what others see.
 */
export function ProfileSummary({
  profile,
  rank,
}: {
  profile: Profile;
  rank: LeaderboardRow | null;
}) {
  return (
    <>
      <div className={styles.profileHead}>
        {profile.avatarUrl !== null && (
          <img className={styles.avatar} src={profile.avatarUrl} alt="" width={72} height={72} />
        )}
        <div className={styles.heading}>
          <h1 className={styles.title}>{profile.name}</h1>
          <p className={styles.muted}>Member since {formatDate(profile.joinedAt)}</p>
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{profile.xp.toLocaleString('en-US')}</span>
          <span className={styles.muted}>XP</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{rank === null ? '–' : `#${rank.rank}`}</span>
          <span className={styles.muted}>All-time rank</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{profile.completed.length}</span>
          <span className={styles.muted}>Quests completed</span>
        </div>
      </div>

      <section className={styles.heading} aria-labelledby="ranks-heading">
        <h2 id="ranks-heading" className={styles.subtitle}>
          Ranks
        </h2>
        {profile.roles.length === 0 ? (
          <p className={styles.muted}>No ranks yet.</p>
        ) : (
          <ul className={styles.roles}>
            {profile.roles.map((role) => (
              <li
                key={role.name}
                className={styles.role}
                style={
                  role.color === null ? undefined : { borderColor: role.color, color: role.color }
                }
              >
                {role.icon !== null && <span aria-hidden>{role.icon} </span>}
                {role.name}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.heading} aria-labelledby="completed-heading">
        <h2 id="completed-heading" className={styles.subtitle}>
          Completed quests
        </h2>
        {profile.completed.length === 0 ? (
          <p className={styles.muted}>None yet.</p>
        ) : (
          <ul className={styles.list}>
            {profile.completed.map((c) => (
              <li key={c.questId} className={styles.spread}>
                <Link href={`/quests/${c.questId}`}>{c.title}</Link>
                <span className={styles.meta}>
                  <span className={styles.xp}>{c.xp.toLocaleString('en-US')} XP</span>
                  <span>{formatDate(c.approvedAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
