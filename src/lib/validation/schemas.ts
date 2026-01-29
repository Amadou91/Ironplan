/**
 * Zod schemas for validating API responses from Supabase.
 * Provides runtime type safety and better error messages.
 */

import { z } from 'zod'

// Common field schemas
const uuidSchema = z.string().uuid()
const nullableString = z.string().nullable()
const nullableNumber = z.number().nullable()
const nullableBoolean = z.boolean().nullable()

// Weight unit enum
export const weightUnitSchema = z.enum(['lb', 'kg'])
export type WeightUnitValidated = z.infer<typeof weightUnitSchema>

// Load type enum
export const loadTypeSchema = z.enum(['total', 'per_implement'])
export type LoadTypeValidated = z.infer<typeof loadTypeSchema>

// Session status enum
export const sessionStatusSchema = z.enum(['in_progress', 'completed', 'cancelled', 'initializing'])
export type SessionStatusValidated = z.infer<typeof sessionStatusSchema>

// Metric profile enum
export const metricProfileSchema = z.enum([
  'timed_strength',
  'cardio_session',
  'mobility_session',
  'reps_weight',
  'reps_only',
  'duration'
])
export type MetricProfileValidated = z.infer<typeof metricProfileSchema>

// Set row schema
export const setRowSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema.optional(), // Denormalized from session for RLS
  set_number: nullableNumber,
  reps: nullableNumber,
  weight: nullableNumber,
  implement_count: nullableNumber,
  load_type: nullableString,
  rpe: nullableNumber,
  rir: nullableNumber,
  completed: nullableBoolean,
  performed_at: nullableString,
  weight_unit: nullableString,
  duration_seconds: nullableNumber.optional(),
  distance: nullableNumber.optional(),
  distance_unit: nullableString.optional(),
  rest_seconds_actual: nullableNumber.optional(),
  extras: z.record(z.string(), z.unknown()).optional(),
  extra_metrics: z.record(z.string(), z.unknown()).optional()
})
export type SetRowValidated = z.infer<typeof setRowSchema>

// Session exercise row schema
export const sessionExerciseRowSchema = z.object({
  id: uuidSchema,
  exercise_name: z.string(),
  primary_muscle: nullableString,
  secondary_muscles: z.array(z.string()).nullable(),
  metric_profile: nullableString,
  order_index: nullableNumber,
  sets: z.array(setRowSchema).default([])
})
export type SessionExerciseRowValidated = z.infer<typeof sessionExerciseRowSchema>

// Session row schema (for dashboard/progress queries)
export const sessionRowSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  template_id: nullableString,
  session_focus: nullableString.optional(),
  session_goal: nullableString.optional(),
  session_intensity: nullableString.optional(),
  started_at: z.string(),
  ended_at: nullableString,
  status: nullableString,
  minutes_available: nullableNumber.optional(),
  timezone: nullableString.optional(),
  body_weight_lb: nullableNumber.optional(),
  session_exercises: z.array(sessionExerciseRowSchema).default([])
})
export type SessionRowValidated = z.infer<typeof sessionRowSchema>

// Template row schema
export const templateRowSchema = z.object({
  id: uuidSchema,
  title: z.string(),
  focus: z.string(),
  style: z.string(),
  experience_level: z.string(),
  intensity: z.string(),
  created_at: z.string(),
  template_inputs: z.record(z.string(), z.unknown()).nullable()
})
export type TemplateRowValidated = z.infer<typeof templateRowSchema>

// Readiness row schema
export const readinessRowSchema = z.object({
  id: uuidSchema,
  session_id: uuidSchema,
  recorded_at: z.string(),
  sleep_quality: z.number(),
  muscle_soreness: z.number(),
  stress_level: z.number(),
  motivation: z.number(),
  readiness_score: nullableNumber,
  readiness_level: z.enum(['low', 'steady', 'high']).nullable()
})
export type ReadinessRowValidated = z.infer<typeof readinessRowSchema>

// Equipment kind enum
const equipmentKindSchema = z.enum([
  'bodyweight', 'dumbbell', 'kettlebell', 'band', 'barbell', 
  'bench_press', 'machine', 'block', 'bolster', 'strap'
])

// Machine type enum
const machineTypeSchema = z.enum([
  'cable', 'leg_press', 'treadmill', 'rower', 'indoor_bicycle', 'outdoor_bicycle'
])

// Equipment option schema (for exercise catalog)
const equipmentOptionSchema = z.object({
  kind: equipmentKindSchema,
  machineType: machineTypeSchema.optional(),
  requires: z.array(equipmentKindSchema).optional()
})

// Exercise catalog row schema
export const exerciseCatalogRowSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  category: z.string().default('Strength'),
  focus: nullableString,
  movement_pattern: nullableString,
  metric_profile: nullableString,
  sets: nullableNumber,
  reps: nullableString,
  rpe: nullableNumber,
  duration_minutes: nullableNumber,
  rest_seconds: nullableNumber,
  load_target: nullableNumber,
  primary_muscle: nullableString,
  secondary_muscles: z.array(z.string()).default([]),
  instructions: z.array(z.string()).default([]),
  video_url: nullableString,
  equipment: z.array(equipmentOptionSchema).default([]),
  e1rm_eligible: nullableBoolean.default(false),
  is_interval: z.boolean().default(false),
  interval_duration: nullableNumber,
  interval_rest: nullableNumber,
  or_group: nullableString
})
export type ExerciseCatalogRowValidated = z.infer<typeof exerciseCatalogRowSchema>

// Body measurement row schema
export const bodyMeasurementRowSchema = z.object({
  recorded_at: z.string(),
  weight_lb: nullableNumber,
  source: z.string()
})
export type BodyMeasurementRowValidated = z.infer<typeof bodyMeasurementRowSchema>

// Exercise history row schema (for set history queries)
export const exerciseHistoryRowSchema = z.object({
  weight: nullableNumber,
  weight_unit: z.string(),
  reps: nullableNumber,
  performed_at: z.string(),
  session_exercise: z.object({
    exercise_name: z.string()
  })
})
export type ExerciseHistoryRowValidated = z.infer<typeof exerciseHistoryRowSchema>

// Profile row schema
export const profileRowSchema = z.object({
  id: uuidSchema,
  email: nullableString,
  full_name: nullableString,
  weight_lb: nullableNumber,
  height_in: nullableNumber,
  preferences: z.record(z.string(), z.unknown()).default({})
})
export type ProfileRowValidated = z.infer<typeof profileRowSchema>

// Session query result (full session with readiness)
export const sessionQueryResultSchema = z.object({
  id: uuidSchema,
  user_id: nullableString,
  template_id: nullableString,
  name: z.string(),
  started_at: z.string(),
  ended_at: nullableString,
  status: nullableString,
  timezone: nullableString,
  body_weight_lb: nullableNumber,
  session_notes: nullableString.optional(),
  session_readiness: z.array(z.object({
    sleep_quality: z.number(),
    muscle_soreness: z.number(),
    stress_level: z.number(),
    motivation: z.number()
  })).default([]),
  session_exercises: z.array(sessionExerciseRowSchema).default([])
})
export type SessionQueryResultValidated = z.infer<typeof sessionQueryResultSchema>

/**
 * Safely parse API response with Zod schema.
 * Returns validated data or null with console error.
 */
export function safeParseArray<T>(
  schema: z.ZodType<T>,
  data: unknown,
  context?: string
): T[] {
  const arraySchema = z.array(schema)
  const result = arraySchema.safeParse(data)
  
  if (result.success) {
    return result.data
  }
  
  console.error(`Validation failed${context ? ` for ${context}` : ''}:`, result.error.format())
  return []
}

/**
 * Safely parse single item with Zod schema.
 * Returns validated data or null with console error.
 */
export function safeParseSingle<T>(
  schema: z.ZodType<T>,
  data: unknown,
  context?: string
): T | null {
  const result = schema.safeParse(data)
  
  if (result.success) {
    return result.data
  }
  
  console.error(`Validation failed${context ? ` for ${context}` : ''}:`, result.error.format())
  return null
}

/**
 * Parse with fallback - returns data as-is if parsing fails, with warning.
 * Use when you need graceful degradation rather than failure.
 */
export function parseWithFallback<T>(
  schema: z.ZodType<T>,
  data: unknown,
  context?: string
): T | typeof data {
  const result = schema.safeParse(data)
  
  if (result.success) {
    return result.data
  }
  
  console.warn(`Schema mismatch${context ? ` for ${context}` : ''}, using raw data:`, result.error.format())
  return data
}
