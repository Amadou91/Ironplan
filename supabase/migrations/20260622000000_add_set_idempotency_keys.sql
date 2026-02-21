-- Add explicit idempotency keys for local-first set syncing.
-- Existing rows are backfilled so this is safe in production.

ALTER TABLE public.sets
  ADD COLUMN IF NOT EXISTS client_set_uuid uuid,
  ADD COLUMN IF NOT EXISTS last_op_id uuid;

UPDATE public.sets
SET client_set_uuid = id
WHERE client_set_uuid IS NULL;

ALTER TABLE public.sets
  ALTER COLUMN client_set_uuid SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sets_user_client_set_uuid_unique
  ON public.sets (user_id, client_set_uuid);

CREATE UNIQUE INDEX IF NOT EXISTS sets_user_last_op_id_unique
  ON public.sets (user_id, last_op_id)
  WHERE last_op_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ensure_set_idempotency_defaults()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.client_set_uuid IS NULL THEN
    NEW.client_set_uuid := NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_idempotency_defaults_on_insert ON public.sets;
CREATE TRIGGER set_idempotency_defaults_on_insert
  BEFORE INSERT ON public.sets
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_set_idempotency_defaults();
