


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;




ALTER SCHEMA "public" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."group_type_enum" AS ENUM (
    'superset',
    'circuit',
    'giant_set',
    'dropset'
);


ALTER TYPE "public"."group_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."set_type_enum" AS ENUM (
    'working',
    'warmup',
    'backoff',
    'drop',
    'amrap'
);


ALTER TYPE "public"."set_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."weight_unit_enum" AS ENUM (
    'lb',
    'kg'
);


ALTER TYPE "public"."weight_unit_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        avatar_url = excluded.avatar_url;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."exercise_catalog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "primary_muscle" "text",
    "secondary_muscles" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "equipment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."exercise_catalog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."muscle_groups" (
    "slug" "text" NOT NULL,
    "label" "text" NOT NULL
);


ALTER TABLE "public"."muscle_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "workout_id" "uuid",
    "day_of_week" integer NOT NULL,
    "session_name" "text" NOT NULL,
    "workouts" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "saved_sessions_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."saved_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scheduled_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "workout_id" "uuid" NOT NULL,
    "schedule_batch_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "week_start_date" "date" NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "scheduled_sessions_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6))),
    CONSTRAINT "scheduled_sessions_status_check" CHECK (("status" = ANY (ARRAY['DRAFT'::"text", 'ACTIVE'::"text", 'ARCHIVED'::"text", 'COMPLETED'::"text"])))
);


ALTER TABLE "public"."scheduled_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_exercises" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "exercise_id" "uuid",
    "exercise_name" "text" NOT NULL,
    "primary_muscle" "text",
    "secondary_muscles" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "variation" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."session_exercises" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "template_id" "uuid",
    "name" "text" NOT NULL,
    "status" "text" DEFAULT 'in_progress'::"text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "minutes_available" integer,
    "generated_exercises" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "impact" "jsonb",
    "timezone" "text",
    "session_notes" "text",
    CONSTRAINT "sessions_status_check" CHECK (("status" = ANY (ARRAY['in_progress'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_exercise_id" "uuid" NOT NULL,
    "set_number" integer NOT NULL,
    "reps" integer,
    "weight" numeric(10,2),
    "rpe" numeric(3,1),
    "rir" numeric(3,1),
    "notes" "text",
    "completed" boolean DEFAULT false NOT NULL,
    "performed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "set_type" "public"."set_type_enum" DEFAULT 'working'::"public"."set_type_enum" NOT NULL,
    "weight_unit" "public"."weight_unit_enum" DEFAULT 'lb'::"public"."weight_unit_enum" NOT NULL,
    "rest_seconds_actual" integer,
    "failure" boolean DEFAULT false,
    "tempo" "text",
    "rom_cue" "text",
    "pain_score" integer,
    "pain_area" "text",
    "group_id" "text",
    "group_type" "public"."group_type_enum",
    "extras" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "sets_pain_score_range" CHECK ((("pain_score" IS NULL) OR (("pain_score" >= 0) AND ("pain_score" <= 10)))),
    CONSTRAINT "sets_rpe_rir_exclusive" CHECK ((NOT (("rpe" IS NOT NULL) AND ("rir" IS NOT NULL))))
);


ALTER TABLE "public"."sets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workout_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "focus" "text" NOT NULL,
    "style" "text" NOT NULL,
    "experience_level" "text" NOT NULL,
    "intensity" "text" NOT NULL,
    "equipment" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "preferences" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "template_inputs" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."workout_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "goal" "text",
    "level" "text",
    "tags" "text"[],
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "exercises" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "workouts_status_check" CHECK (("status" = ANY (ARRAY['DRAFT'::"text", 'ACTIVE'::"text", 'ARCHIVED'::"text", 'COMPLETED'::"text"])))
);


ALTER TABLE "public"."workouts" OWNER TO "postgres";


ALTER TABLE ONLY "public"."exercise_catalog"
    ADD CONSTRAINT "exercise_catalog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."muscle_groups"
    ADD CONSTRAINT "muscle_groups_pkey" PRIMARY KEY ("slug");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_sessions"
    ADD CONSTRAINT "saved_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scheduled_sessions"
    ADD CONSTRAINT "scheduled_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_exercises"
    ADD CONSTRAINT "session_exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sets"
    ADD CONSTRAINT "sets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workout_templates"
    ADD CONSTRAINT "workout_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workouts"
    ADD CONSTRAINT "workouts_pkey" PRIMARY KEY ("id");



CREATE INDEX "exercise_catalog_primary_muscle_idx" ON "public"."exercise_catalog" USING "btree" ("primary_muscle");



CREATE UNIQUE INDEX "saved_sessions_user_day_idx" ON "public"."saved_sessions" USING "btree" ("user_id", "day_of_week");



CREATE INDEX "session_exercises_session_id_order_idx" ON "public"."session_exercises" USING "btree" ("session_id", "order_index");



CREATE INDEX "session_exercises_session_idx" ON "public"."session_exercises" USING "btree" ("session_id", "order_index");



CREATE INDEX "sessions_user_id_started_at_idx" ON "public"."sessions" USING "btree" ("user_id", "started_at" DESC);



CREATE INDEX "sessions_user_started_idx" ON "public"."sessions" USING "btree" ("user_id", "started_at" DESC);



CREATE INDEX "sets_exercise_idx" ON "public"."sets" USING "btree" ("session_exercise_id", "set_number");



CREATE INDEX "sets_performed_at_idx" ON "public"."sets" USING "btree" ("performed_at");



CREATE INDEX "sets_session_exercise_id_set_number_idx" ON "public"."sets" USING "btree" ("session_exercise_id", "set_number");



CREATE INDEX "workout_templates_user_created_idx" ON "public"."workout_templates" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "workouts_user_created_idx" ON "public"."workouts" USING "btree" ("user_id", "created_at" DESC);



CREATE OR REPLACE TRIGGER "profiles_set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."exercise_catalog"
    ADD CONSTRAINT "exercise_catalog_primary_muscle_fkey" FOREIGN KEY ("primary_muscle") REFERENCES "public"."muscle_groups"("slug");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_sessions"
    ADD CONSTRAINT "saved_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_sessions"
    ADD CONSTRAINT "saved_sessions_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scheduled_sessions"
    ADD CONSTRAINT "scheduled_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scheduled_sessions"
    ADD CONSTRAINT "scheduled_sessions_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_exercises"
    ADD CONSTRAINT "session_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise_catalog"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."session_exercises"
    ADD CONSTRAINT "session_exercises_primary_muscle_fkey" FOREIGN KEY ("primary_muscle") REFERENCES "public"."muscle_groups"("slug");



ALTER TABLE ONLY "public"."session_exercises"
    ADD CONSTRAINT "session_exercises_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."workout_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sets"
    ADD CONSTRAINT "sets_session_exercise_id_fkey" FOREIGN KEY ("session_exercise_id") REFERENCES "public"."session_exercises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workout_templates"
    ADD CONSTRAINT "workout_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workouts"
    ADD CONSTRAINT "workouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Exercise catalog is viewable by everyone" ON "public"."exercise_catalog" FOR SELECT USING (true);



CREATE POLICY "Muscle groups are viewable by everyone" ON "public"."muscle_groups" FOR SELECT USING (true);



CREATE POLICY "Profiles are updatable by owner" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Profiles are viewable by owner" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can manage their saved sessions" ON "public"."saved_sessions" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their scheduled sessions" ON "public"."scheduled_sessions" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their session exercises" ON "public"."session_exercises" USING ((EXISTS ( SELECT 1
   FROM "public"."sessions"
  WHERE (("sessions"."id" = "session_exercises"."session_id") AND ("sessions"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."sessions"
  WHERE (("sessions"."id" = "session_exercises"."session_id") AND ("sessions"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage their sessions" ON "public"."sessions" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their sets" ON "public"."sets" USING ((EXISTS ( SELECT 1
   FROM ("public"."session_exercises"
     JOIN "public"."sessions" ON (("sessions"."id" = "session_exercises"."session_id")))
  WHERE (("session_exercises"."id" = "sets"."session_exercise_id") AND ("sessions"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."session_exercises"
     JOIN "public"."sessions" ON (("sessions"."id" = "session_exercises"."session_id")))
  WHERE (("session_exercises"."id" = "sets"."session_exercise_id") AND ("sessions"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage their workout templates" ON "public"."workout_templates" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their workouts" ON "public"."workouts" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."exercise_catalog" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."muscle_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saved_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scheduled_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_exercises" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workout_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workouts" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT ALL ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."exercise_catalog" TO "service_role";
GRANT SELECT ON TABLE "public"."exercise_catalog" TO "anon";
GRANT SELECT ON TABLE "public"."exercise_catalog" TO "authenticated";



GRANT ALL ON TABLE "public"."muscle_groups" TO "service_role";
GRANT SELECT ON TABLE "public"."muscle_groups" TO "anon";
GRANT SELECT ON TABLE "public"."muscle_groups" TO "authenticated";



GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."saved_sessions" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."saved_sessions" TO "authenticated";



GRANT ALL ON TABLE "public"."scheduled_sessions" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."scheduled_sessions" TO "authenticated";



GRANT ALL ON TABLE "public"."session_exercises" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."session_exercises" TO "authenticated";



GRANT ALL ON TABLE "public"."sessions" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."sessions" TO "authenticated";



GRANT ALL ON TABLE "public"."sets" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."sets" TO "authenticated";



GRANT ALL ON TABLE "public"."workout_templates" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."workout_templates" TO "authenticated";



GRANT ALL ON TABLE "public"."workouts" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."workouts" TO "authenticated";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";




























drop extension if exists "pg_net";

revoke delete on table "public"."exercise_catalog" from "anon";

revoke insert on table "public"."exercise_catalog" from "anon";

revoke references on table "public"."exercise_catalog" from "anon";

revoke trigger on table "public"."exercise_catalog" from "anon";

revoke truncate on table "public"."exercise_catalog" from "anon";

revoke update on table "public"."exercise_catalog" from "anon";

revoke delete on table "public"."exercise_catalog" from "authenticated";

revoke insert on table "public"."exercise_catalog" from "authenticated";

revoke references on table "public"."exercise_catalog" from "authenticated";

revoke trigger on table "public"."exercise_catalog" from "authenticated";

revoke truncate on table "public"."exercise_catalog" from "authenticated";

revoke update on table "public"."exercise_catalog" from "authenticated";

revoke delete on table "public"."muscle_groups" from "anon";

revoke insert on table "public"."muscle_groups" from "anon";

revoke references on table "public"."muscle_groups" from "anon";

revoke trigger on table "public"."muscle_groups" from "anon";

revoke truncate on table "public"."muscle_groups" from "anon";

revoke update on table "public"."muscle_groups" from "anon";

revoke delete on table "public"."muscle_groups" from "authenticated";

revoke insert on table "public"."muscle_groups" from "authenticated";

revoke references on table "public"."muscle_groups" from "authenticated";

revoke trigger on table "public"."muscle_groups" from "authenticated";

revoke truncate on table "public"."muscle_groups" from "authenticated";

revoke update on table "public"."muscle_groups" from "authenticated";

revoke delete on table "public"."profiles" from "anon";

revoke insert on table "public"."profiles" from "anon";

revoke references on table "public"."profiles" from "anon";

revoke select on table "public"."profiles" from "anon";

revoke trigger on table "public"."profiles" from "anon";

revoke truncate on table "public"."profiles" from "anon";

revoke update on table "public"."profiles" from "anon";

revoke delete on table "public"."profiles" from "authenticated";

revoke insert on table "public"."profiles" from "authenticated";

revoke references on table "public"."profiles" from "authenticated";

revoke select on table "public"."profiles" from "authenticated";

revoke trigger on table "public"."profiles" from "authenticated";

revoke truncate on table "public"."profiles" from "authenticated";

revoke update on table "public"."profiles" from "authenticated";

revoke delete on table "public"."saved_sessions" from "anon";

revoke insert on table "public"."saved_sessions" from "anon";

revoke references on table "public"."saved_sessions" from "anon";

revoke select on table "public"."saved_sessions" from "anon";

revoke trigger on table "public"."saved_sessions" from "anon";

revoke truncate on table "public"."saved_sessions" from "anon";

revoke update on table "public"."saved_sessions" from "anon";

revoke references on table "public"."saved_sessions" from "authenticated";

revoke trigger on table "public"."saved_sessions" from "authenticated";

revoke truncate on table "public"."saved_sessions" from "authenticated";

revoke delete on table "public"."scheduled_sessions" from "anon";

revoke insert on table "public"."scheduled_sessions" from "anon";

revoke references on table "public"."scheduled_sessions" from "anon";

revoke select on table "public"."scheduled_sessions" from "anon";

revoke trigger on table "public"."scheduled_sessions" from "anon";

revoke truncate on table "public"."scheduled_sessions" from "anon";

revoke update on table "public"."scheduled_sessions" from "anon";

revoke references on table "public"."scheduled_sessions" from "authenticated";

revoke trigger on table "public"."scheduled_sessions" from "authenticated";

revoke truncate on table "public"."scheduled_sessions" from "authenticated";

revoke delete on table "public"."session_exercises" from "anon";

revoke insert on table "public"."session_exercises" from "anon";

revoke references on table "public"."session_exercises" from "anon";

revoke select on table "public"."session_exercises" from "anon";

revoke trigger on table "public"."session_exercises" from "anon";

revoke truncate on table "public"."session_exercises" from "anon";

revoke update on table "public"."session_exercises" from "anon";

revoke references on table "public"."session_exercises" from "authenticated";

revoke trigger on table "public"."session_exercises" from "authenticated";

revoke truncate on table "public"."session_exercises" from "authenticated";

revoke delete on table "public"."sessions" from "anon";

revoke insert on table "public"."sessions" from "anon";

revoke references on table "public"."sessions" from "anon";

revoke select on table "public"."sessions" from "anon";

revoke trigger on table "public"."sessions" from "anon";

revoke truncate on table "public"."sessions" from "anon";

revoke update on table "public"."sessions" from "anon";

revoke references on table "public"."sessions" from "authenticated";

revoke trigger on table "public"."sessions" from "authenticated";

revoke truncate on table "public"."sessions" from "authenticated";

revoke delete on table "public"."sets" from "anon";

revoke insert on table "public"."sets" from "anon";

revoke references on table "public"."sets" from "anon";

revoke select on table "public"."sets" from "anon";

revoke trigger on table "public"."sets" from "anon";

revoke truncate on table "public"."sets" from "anon";

revoke update on table "public"."sets" from "anon";

revoke references on table "public"."sets" from "authenticated";

revoke trigger on table "public"."sets" from "authenticated";

revoke truncate on table "public"."sets" from "authenticated";

revoke delete on table "public"."workout_templates" from "anon";

revoke insert on table "public"."workout_templates" from "anon";

revoke references on table "public"."workout_templates" from "anon";

revoke select on table "public"."workout_templates" from "anon";

revoke trigger on table "public"."workout_templates" from "anon";

revoke truncate on table "public"."workout_templates" from "anon";

revoke update on table "public"."workout_templates" from "anon";

revoke references on table "public"."workout_templates" from "authenticated";

revoke trigger on table "public"."workout_templates" from "authenticated";

revoke truncate on table "public"."workout_templates" from "authenticated";

revoke delete on table "public"."workouts" from "anon";

revoke insert on table "public"."workouts" from "anon";

revoke references on table "public"."workouts" from "anon";

revoke select on table "public"."workouts" from "anon";

revoke trigger on table "public"."workouts" from "anon";

revoke truncate on table "public"."workouts" from "anon";

revoke update on table "public"."workouts" from "anon";

revoke references on table "public"."workouts" from "authenticated";

revoke trigger on table "public"."workouts" from "authenticated";

revoke truncate on table "public"."workouts" from "authenticated";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


