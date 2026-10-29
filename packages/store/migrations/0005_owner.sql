-- Up Migration

-- The owner role (brief section 13.1): one user above admin, the only one who
-- promotes, demotes or deletes admins. At most one, enforced here rather than
-- trusted to the app.
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('ambassador', 'admin', 'owner'));
CREATE UNIQUE INDEX users_one_owner ON users ((true)) WHERE role = 'owner';

-- A hub with exactly one admin makes that admin the owner (on Cherry AS, the
-- bootstrap admin). With several admins nobody is guessed at: the runbook's
-- ownership step names one.
UPDATE users SET role = 'owner'
 WHERE role = 'admin' AND (SELECT count(*) FROM users WHERE role = 'admin') = 1;

-- Down Migration

UPDATE users SET role = 'admin' WHERE role = 'owner';
DROP INDEX users_one_owner;
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('ambassador', 'admin'));
