-- Fix Supabase Security Advisor warnings:
-- 1. Function Search Path Mutable - Set explicit search_path on all functions
-- 2. RLS Policy Always True - Restrict exercise_catalog mutations to authenticated users

--------------------------------------------------------------------------------
-- 1. FIX FUNCTION SEARCH PATHS
--------------------------------------------------------------------------------
-- Setting search_path = '' prevents search path injection attacks by requiring
-- all object references to be fully qualified (schema.object).

-- 1.1 set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1.2 sync_profile_weight
CREATE OR REPLACE FUNCTION public.sync_profile_weight()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles
  SET weight_lb = NEW.weight_lb,
      updated_at = now()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

-- 1.3 derive_focus_from_muscle
CREATE OR REPLACE FUNCTION public.derive_focus_from_muscle(muscle_slug text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
begin
  return case
    when muscle_slug in ('chest', 'back', 'shoulders', 'arms', 'biceps', 'triceps', 'forearms') then 'upper'
    when muscle_slug in ('glutes', 'quads', 'hamstrings', 'calves', 'hip_flexors', 'adductors', 'abductors') then 'lower'
    when muscle_slug in ('core') then 'core'
    when muscle_slug in ('cardio') then 'cardio'
    when muscle_slug in ('mobility', 'yoga') then 'mobility'
    else 'full_body'
  end;
end;
$$;

-- 1.4 prevent_template_delete_with_active_sessions
CREATE OR REPLACE FUNCTION public.prevent_template_delete_with_active_sessions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
begin
  if exists (
    select 1
    from public.sessions
    where template_id = old.id
      and (
        status in ('initializing', 'in_progress')
        or (ended_at is null and status not in ('completed', 'cancelled'))
      )
  ) then
    raise exception 'Template has an active session and cannot be deleted until it is completed or cancelled.'
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

-- 1.5 set_user_id_from_session
CREATE OR REPLACE FUNCTION public.set_user_id_from_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- If user_id is not provided, derive it from the session
  IF NEW.user_id IS NULL THEN
    SELECT sess.user_id INTO NEW.user_id
    FROM public.session_exercises se
    JOIN public.sessions sess ON sess.id = se.session_id
    WHERE se.id = NEW.session_exercise_id;
  END IF;
  RETURN NEW;
END;
$$;

--------------------------------------------------------------------------------
-- 2. FIX OVERLY PERMISSIVE RLS POLICIES ON exercise_catalog
--------------------------------------------------------------------------------
-- The original policies used USING(true) for everyone. Now restrict mutations
-- to authenticated users only. SELECT remains public for read access.

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Public insert access" ON public.exercise_catalog;
DROP POLICY IF EXISTS "Public update access" ON public.exercise_catalog;
DROP POLICY IF EXISTS "Public delete access" ON public.exercise_catalog;

-- Create more restrictive policies for authenticated users only
CREATE POLICY "Authenticated users can insert exercises"
  ON public.exercise_catalog
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update exercises"
  ON public.exercise_catalog
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete exercises"
  ON public.exercise_catalog
  FOR DELETE
  TO authenticated
  USING (true);
