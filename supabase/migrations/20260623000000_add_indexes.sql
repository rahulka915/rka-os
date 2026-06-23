-- Migration: Add performance indexes to all tables
-- Prevents query degradation as user data grows.
-- All queries are scoped to user_id, so composite indexes with user_id first are most effective.

-- items: queried by type and status on the client constantly
CREATE INDEX IF NOT EXISTS idx_items_user_id        ON public.items(user_id);
CREATE INDEX IF NOT EXISTS idx_items_user_type       ON public.items(user_id, type);
CREATE INDEX IF NOT EXISTS idx_items_user_status     ON public.items(user_id, status);
CREATE INDEX IF NOT EXISTS idx_items_scheduled_date  ON public.items(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_items_deleted_at      ON public.items(user_id, deleted_at);

-- item_instances: queried by item_id and scheduled_date heavily (daily medication logic)
CREATE INDEX IF NOT EXISTS idx_item_instances_user   ON public.item_instances(user_id);
CREATE INDEX IF NOT EXISTS idx_item_instances_item   ON public.item_instances(item_id);
CREATE INDEX IF NOT EXISTS idx_item_instances_date   ON public.item_instances(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_item_instances_status ON public.item_instances(user_id, status);

-- tags
CREATE INDEX IF NOT EXISTS idx_tags_user             ON public.tags(user_id);

-- item_tags: join table, queried by item_id and tag_id
CREATE INDEX IF NOT EXISTS idx_item_tags_user        ON public.item_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_item_tags_item        ON public.item_tags(item_id);
CREATE INDEX IF NOT EXISTS idx_item_tags_tag         ON public.item_tags(tag_id);

-- entity_links: compound lookups by source+type and target+type
CREATE INDEX IF NOT EXISTS idx_entity_links_user     ON public.entity_links(user_id);
CREATE INDEX IF NOT EXISTS idx_entity_links_source   ON public.entity_links(source_id, link_type);
CREATE INDEX IF NOT EXISTS idx_entity_links_target   ON public.entity_links(target_id, link_type);

-- activity_logs: queried by entity_id and action_type for history views
CREATE INDEX IF NOT EXISTS idx_activity_logs_user    ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity  ON public.activity_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_ts      ON public.activity_logs(user_id, timestamp DESC);

-- workout_sessions: queried by template_id for workout history
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user ON public.workout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_tmpl ON public.workout_sessions(template_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_date ON public.workout_sessions(user_id, date DESC);

-- exercise_sessions: queried by workout_session_id for active workout view
CREATE INDEX IF NOT EXISTS idx_exercise_sessions_user    ON public.exercise_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_exercise_sessions_workout ON public.exercise_sessions(workout_session_id);
CREATE INDEX IF NOT EXISTS idx_exercise_sessions_order   ON public.exercise_sessions(workout_session_id, "order");

-- set_entries: queried by exercise_session_id
CREATE INDEX IF NOT EXISTS idx_set_entries_user    ON public.set_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_set_entries_session ON public.set_entries(exercise_session_id);

-- exercise_media: queried by exercise_id
CREATE INDEX IF NOT EXISTS idx_exercise_media_user     ON public.exercise_media(user_id);
CREATE INDEX IF NOT EXISTS idx_exercise_media_exercise ON public.exercise_media(exercise_id);
