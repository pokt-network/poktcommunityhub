import styles from './hub.module.css';

/**
 * A member's Discord avatar, or their initial on a brand-blue disc when there is
 * none (sign-in always stores one; older or seeded rows may not have it).
 */
export function Avatar({
  url,
  name,
  size = 32,
}: {
  url: string | null;
  name: string;
  size?: number;
}) {
  if (url !== null) {
    return <img className={styles.avatarImg} src={url} alt="" width={size} height={size} />;
  }
  return (
    <span className={styles.initial} style={{ width: size, height: size }} aria-hidden>
      {Array.from(name)[0]?.toUpperCase()}
    </span>
  );
}
