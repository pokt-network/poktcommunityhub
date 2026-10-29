-- Up Migration

-- Quest icons are ids from the fixed set in core (section 13.2), not free text.
-- Membership of the set is core's to check; this keeps anything else out.
UPDATE quests SET icon = NULL WHERE icon !~ '^[a-z][a-z-]{0,31}$';
ALTER TABLE quests ADD CONSTRAINT quests_icon_id CHECK (icon ~ '^[a-z][a-z-]{0,31}$');

-- Down Migration

ALTER TABLE quests DROP CONSTRAINT quests_icon_id;
