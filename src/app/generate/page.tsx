"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dumbbell,
  Calendar,
  RefreshCw,
  ChevronRight,
  Save,
  Clock,
  Activity,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Sidebar from "@/components/layout/Sidebar";
import { useUser } from "@/hooks/useUser";
import { calculateWorkoutImpact, generatePlan } from "@/lib/generator";
import { equipmentPresets } from "@/lib/equipment";
import { formatDayLabel, formatWeekStartDate } from "@/lib/schedule-utils";
import { createClient } from "@/lib/supabase/client";
import type { Exercise, FocusArea, GeneratedPlan, Goal, PlanDay, PlanInput } from "@/types/domain";

type ScheduleDay = {
  id: string;
  dayOfWeek: number;
  type: "workout" | "rest";
  focus?: FocusArea;
};

const STEP_ICON = [
  { id: 1, name: "Configure", icon: Activity },
  { id: 2, name: "Review Plan", icon: Calendar },
  { id: 3, name: "Finalize", icon: CheckCircle2 }
];

const daySequence = [1, 2, 3, 4, 5, 6, 0];

const dayPresets: Record<number, number[]> = {
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 3, 5, 6],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6]
};

const getDaysAvailable = (count: number) => dayPresets[count] ?? dayPresets[4];

const formatFocusLabel = (value?: string) =>
  value ? value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "";

const formatEquipmentLabel = (equipment: Exercise["equipment"]) => {
  if (!equipment || equipment.length === 0) return "";
  const labels = equipment.map((option) => {
    if (option.kind === "machine") {
      return option.machineType ? option.machineType.replace(/_/g, " ") : "machine";
    }
    return option.kind;
  });
  return labels.join(", ");
};

const buildWeeklySchedule = (plan: GeneratedPlan): ScheduleDay[] => {
  const planByDay = new Map(plan.schedule.map((day) => [day.dayOfWeek, day]));
  return daySequence.map((dayOfWeek) => {
    const scheduledDay = planByDay.get(dayOfWeek);
    return {
      id: `day-${dayOfWeek}`,
      dayOfWeek,
      type: scheduledDay ? "workout" : "rest",
      focus: scheduledDay?.focus
    };
  });
};

const buildSessionMap = (plan: GeneratedPlan) =>
  plan.schedule.reduce<Record<string, PlanDay>>((acc, day) => {
    acc[`day-${day.dayOfWeek}`] = day;
    return acc;
  }, {});

export default function GeneratePage() {
  const router = useRouter();
  const supabase = createClient();
  const { user, loading: userLoading } = useUser();

  const [goal, setGoal] = useState<Goal>("strength");
  const [level, setLevel] = useState<PlanInput["experienceLevel"]>("intermediate");
  const [daysPerWeek, setDaysPerWeek] = useState<number>(4);
  const [equipmentPreset] = useState<keyof typeof equipmentPresets>("full_gym");
  const [duration, setDuration] = useState<number>(60);

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null);
  const [weeklySchedule, setWeeklySchedule] = useState<ScheduleDay[] | null>(null);
  const [generatedSessions, setGeneratedSessions] = useState<Record<string, PlanDay>>({});
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/auth/login?redirect=/generate");
    }
  }, [user, userLoading, router]);

  const buildPlanInput = (
    daysAvailable: number[],
    weeklyLayout?: PlanInput["schedule"]["weeklyLayout"]
  ): Partial<PlanInput> => ({
    intent: {
      mode: "style",
      style: goal
    },
    goals: {
      primary: goal,
      priority: "primary"
    },
    experienceLevel: level,
    intensity: "moderate",
    equipment: {
      preset: equipmentPreset,
      inventory: equipmentPresets[equipmentPreset]
    },
    time: {
      minutesPerSession: duration
    },
    schedule: {
      daysAvailable,
      timeWindows: ["evening"],
      minRestDays: 1,
      weeklyLayout
    },
    preferences: {
      focusAreas: [],
      dislikedActivities: [],
      accessibilityConstraints: [],
      restPreference: "balanced"
    }
  });

  const handleGenerateSchedule = async () => {
    setIsGenerating(true);
    setGenerationError(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 800));

      const { plan, errors } = generatePlan(buildPlanInput(getDaysAvailable(daysPerWeek)));
      if (!plan || errors.length > 0) {
        setGenerationError(errors[0] ?? "Failed to generate schedule. Please try again.");
        return;
      }

      const schedule = buildWeeklySchedule(plan);
      setGeneratedPlan(plan);
      setWeeklySchedule(schedule);
      setGeneratedSessions(buildSessionMap(plan));
      setCurrentStep(2);

      const firstWorkoutDay = schedule.find((day) => day.type === "workout");
      if (firstWorkoutDay) {
        setExpandedDay(firstWorkoutDay.id);
      }
    } catch (err) {
      console.error("Error generating schedule:", err);
      setGenerationError("Failed to generate schedule. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateSession = async (dayId: string) => {
    if (!generatedPlan || !weeklySchedule) return;
    const scheduleDay = weeklySchedule.find((day) => day.id === dayId);
    if (!scheduleDay || scheduleDay.type !== "workout") return;

    setIsGenerating(true);
    setGenerationError(null);

    try {
      const daysAvailable = generatedPlan.schedule.map((day) => day.dayOfWeek);
      const weeklyLayout = generatedPlan.schedule.map((day) => ({
        dayOfWeek: day.dayOfWeek,
        style: generatedPlan.goal,
        focus: day.focus
      }));

      const { plan, errors } = generatePlan(buildPlanInput(daysAvailable, weeklyLayout));
      if (!plan || errors.length > 0) {
        setGenerationError(errors[0] ?? "Unable to regenerate this session.");
        return;
      }

      const refreshedDay = plan.schedule.find((day) => day.dayOfWeek === scheduleDay.dayOfWeek);
      if (!refreshedDay) return;

      setGeneratedSessions((prev) => ({
        ...prev,
        [dayId]: refreshedDay
      }));

      setGeneratedPlan((prev) => {
        if (!prev) return prev;
        const updatedSchedule = prev.schedule.map((day) =>
          day.dayOfWeek === refreshedDay.dayOfWeek ? refreshedDay : day
        );
        const totalMinutes = updatedSchedule.reduce((sum, day) => sum + day.durationMinutes, 0);
        return {
          ...prev,
          schedule: updatedSchedule,
          summary: {
            ...prev.summary,
            totalMinutes,
            impact: calculateWorkoutImpact(updatedSchedule)
          }
        };
      });
    } catch (error) {
      console.error("Error regenerating session:", error);
      setGenerationError("Unable to regenerate this session. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSavePlan = async () => {
    if (!user || !generatedPlan || !weeklySchedule) return;

    setIsSaving(true);
    setGenerationError(null);

    try {
      const schedulePayload = weeklySchedule
        .filter((day) => day.type === "workout")
        .map((day) => generatedSessions[day.id])
        .filter((day): day is PlanDay => Boolean(day));

      const totalMinutes = schedulePayload.reduce((sum, day) => sum + day.durationMinutes, 0);
      const impact = calculateWorkoutImpact(schedulePayload);
      const summaryPayload = {
        ...generatedPlan.summary,
        totalMinutes,
        impact
      };

      const exercisesPayload = {
        schedule: schedulePayload,
        summary: summaryPayload,
        inputs: generatedPlan.inputs
      };

      const { data: workout, error: workoutError } = await supabase
        .from("workouts")
        .insert({
          user_id: user.id,
          title: generatedPlan.title,
          description: generatedPlan.description,
          goal: generatedPlan.goal,
          level: generatedPlan.level,
          exercises: exercisesPayload
        })
        .select("id")
        .single();

      if (workoutError || !workout) {
        throw workoutError ?? new Error("Unable to save workout.");
      }

      const weekStartDate = formatWeekStartDate(new Date());
      const scheduleRows = schedulePayload.map((day, index) => ({
        user_id: user.id,
        workout_id: workout.id,
        day_of_week: day.dayOfWeek,
        week_start_date: weekStartDate,
        order_index: index,
        is_active: true
      }));

      if (scheduleRows.length > 0) {
        const { error: scheduleError } = await supabase.from("scheduled_sessions").insert(scheduleRows);
        if (scheduleError) {
          throw scheduleError;
        }
      }

      router.push("/dashboard?planCreated=true");
    } catch (error) {
      console.error("Error saving plan:", error);
      setGenerationError("Failed to save your plan. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const renderConfigurationStep = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-blue-600" />
            Training Goal
          </h3>
          <div className="space-y-3">
            {[
              {
                id: "strength",
                label: "Strength & Power",
                desc: "Focus on increasing raw strength and lifting capacity"
              },
              {
                id: "hypertrophy",
                label: "Muscle Growth",
                desc: "Maximize muscle size and definition (Bodybuilding)"
              },
              {
                id: "endurance",
                label: "Endurance",
                desc: "Improve stamina and cardiovascular health"
              },
              {
                id: "general_fitness",
                label: "General Fitness",
                desc: "Build a balanced routine with strength and conditioning"
              }
            ].map((option) => (
              <div
                key={option.id}
                onClick={() => setGoal(option.id as Goal)}
                className={`
                  p-4 rounded-xl border-2 cursor-pointer transition-all duration-200
                  ${
                    goal === option.id
                      ? "border-blue-600 bg-blue-50/50 dark:bg-blue-900/10"
                      : "border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800"
                  }
                `}
              >
                <div className="font-medium text-gray-900 dark:text-gray-100">{option.label}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{option.desc}</div>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Layers className="w-5 h-5 mr-2 text-blue-600" />
              Experience Level
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {["beginner", "intermediate", "advanced"].map((value) => (
                <button
                  key={value}
                  onClick={() => setLevel(value as PlanInput["experienceLevel"])}
                  className={`
                    py-2 px-4 rounded-lg text-sm font-medium capitalize transition-colors
                    ${
                      level === value
                        ? "bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                    }
                  `}
                >
                  {value}
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-blue-600" />
              Weekly Schedule
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Days per week: <span className="text-blue-600 font-bold">{daysPerWeek}</span>
                </label>
                <input
                  type="range"
                  min="2"
                  max="6"
                  step="1"
                  value={daysPerWeek}
                  onChange={(e) => setDaysPerWeek(Number.parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-2">
                  <span>2 days</span>
                  <span>4 days</span>
                  <span>6 days</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Clock className="w-5 h-5 mr-2 text-blue-600" />
              Session Duration
            </h3>
            <div className="flex flex-wrap gap-3">
              {[30, 45, 60, 90].map((mins) => (
                <button
                  key={mins}
                  onClick={() => setDuration(mins)}
                  className={`
                    flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors border
                    ${
                      duration === mins
                        ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                        : "border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                    }
                  `}
                >
                  {mins} min
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button
          onClick={handleGenerateSchedule}
          disabled={isGenerating}
          className="w-full md:w-auto text-lg px-8 py-6"
        >
          {isGenerating ? (
            <span className="flex items-center">
              <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
              Generating Plan...
            </span>
          ) : (
            <span className="flex items-center">
              Create My Plan <ArrowRight className="w-5 h-5 ml-2" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );

  const renderReviewStep = () => {
    if (!weeklySchedule) return null;

    return (
      <div className="animate-in fade-in slide-in-from-right-8 duration-500 space-y-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Review Your Schedule</h2>
            <p className="text-gray-500 dark:text-gray-400">Here&apos;s your suggested {daysPerWeek}-day split.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setCurrentStep(1)}>
              Back
            </Button>
            <Button onClick={handleSavePlan} disabled={isSaving}>
              {isSaving ? (
                <span className="flex items-center">
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Saving...
                </span>
              ) : (
                <span className="flex items-center">
                  <Save className="w-4 h-4 mr-2" /> Save Plan
                </span>
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-3">
            {weeklySchedule.map((day) => (
              <div
                key={day.id}
                onClick={() => day.type === "workout" && setExpandedDay(day.id)}
                className={`
                  p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between
                  ${
                    expandedDay === day.id
                      ? "border-blue-600 bg-white dark:bg-gray-800 shadow-lg scale-[1.02]"
                      : "border-transparent bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }
                  ${day.type === "rest" ? "opacity-60 grayscale" : ""}
                `}
              >
                <div className="flex items-center">
                  <div
                    className={`
                    w-10 h-10 rounded-full flex items-center justify-center mr-3 font-bold text-sm
                    ${day.type === "workout" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}
                  `}
                  >
                    {formatDayLabel(day.dayOfWeek, "short")}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {day.type === "workout" ? formatFocusLabel(day.focus) : "Rest Day"}
                    </div>
                    <div className="text-xs text-gray-500 capitalize">{day.type}</div>
                  </div>
                </div>
                {day.type === "workout" && (
                  <ChevronRight
                    className={`w-5 h-5 text-gray-400 ${expandedDay === day.id ? "rotate-90 text-blue-500" : ""}`}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="lg:col-span-2">
            {expandedDay ? (
              <Card className="h-full overflow-hidden flex flex-col">
                {generatedSessions[expandedDay] ? (
                  <>
                    <div className="p-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-start">
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                          {formatDayLabel(generatedSessions[expandedDay].dayOfWeek)} · {formatFocusLabel(generatedSessions[expandedDay].focus)}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" /> {generatedSessions[expandedDay].durationMinutes} min
                          </span>
                          <span className="flex items-center">
                            <Dumbbell className="w-4 h-4 mr-1" /> {generatedSessions[expandedDay].exercises.length} Exercises
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium uppercase">
                            {level}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRegenerateSession(expandedDay)}
                        disabled={isGenerating}
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? "animate-spin" : ""}`} />
                        Regenerate
                      </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[600px]">
                      {generatedSessions[expandedDay].exercises.map((exercise, idx) => {
                        const muscleLabel =
                          exercise.primaryBodyParts?.[0] ??
                          exercise.primaryMuscle ??
                          exercise.focus ??
                          "";
                        const equipmentLabel = formatEquipmentLabel(exercise.equipment);
                        const details = [muscleLabel, equipmentLabel].filter(Boolean).join(" • ");
                        return (
                          <div
                            key={`${exercise.name}-${idx}`}
                            className="flex items-start p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800"
                          >
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-sm font-bold text-gray-500 mr-4 mt-1">
                              {idx + 1}
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between mb-1">
                                <h4 className="font-semibold text-gray-900 dark:text-white">{exercise.name}</h4>
                                <span className="text-xs font-mono text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                  {exercise.sets} x {exercise.reps}
                                </span>
                              </div>
                              {details && (
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 line-clamp-1">
                                  {details}
                                </p>
                              )}

                              {exercise.instructions?.[0] && (
                                <div className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg">
                                  Tip: {exercise.instructions[0]}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-12">
                    <RefreshCw className="w-12 h-12 mb-4 animate-spin text-blue-200" />
                    <p>Generating optimal workout...</p>
                  </div>
                )}
              </Card>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl p-12">
                <Dumbbell className="w-16 h-16 mb-4 text-gray-200 dark:text-gray-800" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Select a workout day</h3>
                <p>Click on any workout day from the sidebar to view and customize the session details.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-white dark:bg-black">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">
              Generate New Plan
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Create a scientifically optimized workout routine tailored to your goals.
            </p>
          </div>

          <div className="mb-12">
            <div className="flex items-center justify-between relative">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-gray-200 dark:bg-gray-800 -z-10" />
              {STEP_ICON.map((step) => {
                const Icon = step.icon;
                const isCompleted = step.id < currentStep;
                const isCurrent = step.id === currentStep;

                return (
                  <div key={step.id} className="flex flex-col items-center bg-white dark:bg-black px-4">
                    <div
                      className={`
                      w-10 h-10 rounded-full flex items-center justify-center border-2 mb-2 transition-colors duration-300
                      ${
                        isCompleted
                          ? "bg-green-500 border-green-500 text-white"
                          : isCurrent
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-400"
                      }
                    `}
                    >
                      {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : <Icon className="w-5 h-5" />}
                    </div>
                    <span
                      className={`text-sm font-medium ${isCurrent ? "text-gray-900 dark:text-white" : "text-gray-500"}`}
                    >
                      {step.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {generationError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center text-red-700">
              <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
              {generationError}
            </div>
          )}

          <div className="min-h-[400px]">
            {currentStep === 1 && renderConfigurationStep()}
            {currentStep === 2 && renderReviewStep()}
          </div>
        </div>
      </main>
    </div>
  );
}
