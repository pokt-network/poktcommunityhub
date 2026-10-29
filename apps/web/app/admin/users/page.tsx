import { adminUsers } from '@community/store';
import type { Metadata } from 'next';
import Link from 'next/link';

import { requireAdmin } from '@/lib/authz';
import { db } from '@/lib/db';
import { formatDate } from '@/lib/format';

import styles from '../../hub.module.css';
import { AdminFrame } from '../admin-frame';

export const metadata: Metadata = { title: 'Users' };

/** Flow 12: members, staff first, searchable by name or Discord id. */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; deleted?: string }>;
}) {
  await requireAdmin();
  const { q, deleted } = await searchParams;
  const search = typeof q === 'string' ? q.slice(0, 100) : '';
  const users = await adminUsers(db(), { search });

  return (
    <AdminFrame title="Users">
      {deleted === '1' && (
        <p className={styles.success} role="status">
          Account deleted.
        </p>
      )}
      <form className={styles.filters} method="get" role="search" aria-label="Find a member">
        <label className={styles.field}>
          Name or Discord id
          <input className={styles.input} name="q" defaultValue={search} />
        </label>
        <button className={styles.quiet} type="submit">
          Search
        </button>
      </form>

      {users.length === 0 ? (
        <p className={styles.empty}>No members match.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Member</th>
                <th scope="col">Role</th>
                <th className={styles.num} scope="col">
                  XP
                </th>
                <th className={styles.num} scope="col">
                  Pending / all
                </th>
                <th scope="col">Last sign-in</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <span className={styles.person}>
                      {u.avatarUrl !== null && (
                        <img src={u.avatarUrl} alt="" width={24} height={24} />
                      )}
                      <Link href={`/admin/users/${u.id}`}>{u.name}</Link>
                    </span>
                  </td>
                  <td>{u.role}</td>
                  <td className={styles.num}>{u.xp.toLocaleString('en-US')}</td>
                  <td className={styles.num}>
                    {u.pending} / {u.submissions}
                  </td>
                  <td className={styles.muted}>
                    {u.lastLoginAt === null ? 'Never' : formatDate(u.lastLoginAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminFrame>
  );
}
