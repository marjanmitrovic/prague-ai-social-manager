-- Use only for retesting the most recent failed Instagram target.
WITH latest AS (
  SELECT pt.id AS target_id, pt.post_id
  FROM post_targets pt
  WHERE pt.platform = 'instagram'
  ORDER BY pt.created_at DESC NULLS LAST, pt.id DESC
  LIMIT 1
)
UPDATE post_targets pt
SET status = 'scheduled', error_message = NULL
FROM latest
WHERE pt.id = latest.target_id;

WITH latest AS (
  SELECT pt.post_id
  FROM post_targets pt
  WHERE pt.platform = 'instagram'
  ORDER BY pt.created_at DESC NULLS LAST, pt.id DESC
  LIMIT 1
)
UPDATE posts p
SET status = 'scheduled', scheduled_at = NOW() - INTERVAL '1 minute', updated_at = NOW()
FROM latest
WHERE p.id = latest.post_id;
