import { LIMITS } from '@community/core';
import { adminCategories } from '@community/store';
import type { Metadata } from 'next';

import {
  createCategoryAction,
  deleteCategoryAction,
  moveCategoryAction,
  renameCategoryAction,
} from '@/lib/admin-actions';
import { requireAdmin } from '@/lib/authz';
import { db } from '@/lib/db';

import { ActionForm } from '../../action-form';
import styles from '../../hub.module.css';
import { AdminFrame } from '../admin-frame';

export const metadata: Metadata = { title: 'Categories' };

/** Flow 10: create, rename, reorder and delete. Deleting leaves its quests uncategorised. */
export default async function CategoriesPage() {
  await requireAdmin();
  const categories = await adminCategories(db());

  return (
    <AdminFrame title="Categories">
      <ActionForm
        action={createCategoryAction}
        submit="Add category"
        className={styles.inline}
        resetOnSuccess
      >
        <label className={styles.field}>
          New category
          <input className={styles.input} name="name" required maxLength={LIMITS.categoryName} />
        </label>
      </ActionForm>

      {categories.length === 0 ? (
        <p className={styles.empty}>No categories yet.</p>
      ) : (
        <ul className={styles.list}>
          {categories.map((c, i) => (
            <li key={c.id} className={styles.item}>
              <div className={styles.spread}>
                <ActionForm
                  action={renameCategoryAction}
                  submit="Rename"
                  tone="quiet"
                  className={styles.inline}
                >
                  <input type="hidden" name="id" value={c.id} />
                  <label className={styles.field}>
                    <span className="sr-only">Name</span>
                    <input
                      className={styles.input}
                      name="name"
                      required
                      maxLength={LIMITS.categoryName}
                      defaultValue={c.name}
                    />
                  </label>
                </ActionForm>
                <span className={styles.muted}>
                  {c.quests} {c.quests === 1 ? 'quest' : 'quests'}
                </span>
              </div>
              <div className={styles.row}>
                {i > 0 && (
                  <ActionForm
                    action={moveCategoryAction}
                    submit="Move up"
                    tone="quiet"
                    className={styles.inline}
                  >
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="direction" value="up" />
                  </ActionForm>
                )}
                {i < categories.length - 1 && (
                  <ActionForm
                    action={moveCategoryAction}
                    submit="Move down"
                    tone="quiet"
                    className={styles.inline}
                  >
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="direction" value="down" />
                  </ActionForm>
                )}
                <ActionForm
                  action={deleteCategoryAction}
                  submit="Delete"
                  tone="danger"
                  className={styles.inline}
                >
                  <input type="hidden" name="id" value={c.id} />
                </ActionForm>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminFrame>
  );
}
