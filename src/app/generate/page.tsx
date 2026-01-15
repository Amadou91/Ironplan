"use client";

import { useState, useEffect } from "react";
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
import { generateWeeklyPlan, generateWorkoutSession, regenerateSession } from "@/lib/generator";
import { WeeklySchedule, WorkoutSession } from "@/types/domain";
import { 
  saveGeneratedPlan, 
  SavedWeeklyPlan, 
  SavedWorkoutSession,
  saveSessionToDb
} from "@/lib/saved-sessions";

// Step indicators for the generation wizard
const STEPS = [
  { id: 1, name: "Configure", icon: Activity },
  { id: 2, name: "Review Plan", icon: Calendar },
  { id: 3, name: "Finalize", icon: CheckCircle2 }
];

export default function GeneratePage() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  
  // State for generation configuration
  const [goal, setGoal] = useState<string>("strength");
  const [level, setLevel] = useState<string>("intermediate");
  const [daysPerWeek, setDaysPerWeek] = useState<number>(4);
  const [equipment] = useState<string[]>(["gym"]); // Default to gym, selector to be added
  const [duration, setDuration] = useState<number>(60);
  
  // State for generation process
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  
  // State for the generated result
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule | null>(null);
  const [generatedSessions, setGeneratedSessions] = useState<Record<string, WorkoutSession>>({});
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/auth/login?redirect=/generate");
    }
  }, [user, userLoading, router]);

  // Handle generating the weekly schedule structure
  const handleGenerateSchedule = async () => {
    setIsGenerating(true);
    setGenerationError(null);
    
    try {
      // Simulate API delay for better UX
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const schedule = generateWeeklyPlan({
        goal,
        level,
        daysPerWeek,
        equipment,
        durationMinutes: duration
      });
      
      setWeeklySchedule(schedule);
      setCurrentStep(2);
      
      // Auto-expand the first workout day
      const firstWorkoutDay = schedule.find(d => d.type === 'workout');
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

  // Handle generating specific workout sessions for days
  useEffect(() => {
    if (currentStep === 2 && weeklySchedule) {
      const generateSessions = async () => {
        const sessions: Record<string, WorkoutSession> = {};
        
        // Find days that need workouts but don't have them yet
        const workoutDays = weeklySchedule.filter(
          day => day.type === 'workout' && !generatedSessions[day.id]
        );
        
        if (workoutDays.length > 0) {
          // Generate sessions for these days
          workoutDays.forEach(day => {
            if (day.focus) {
              const session = generateWorkoutSession({
                focus: day.focus,
                level,
                goal,
                durationMinutes: duration,
                equipment
              });
              sessions[day.id] = session;
            }
          });
          
          setGeneratedSessions(prev => ({ ...prev, ...sessions }));
        }
      };
      
      generateSessions();
    }
  }, [currentStep, weeklySchedule, level, goal, duration, equipment, generatedSessions]);

  // Regenerate a specific session
  const handleRegenerateSession = (dayId: string) => {
    const day = weeklySchedule?.find(d => d.id === dayId);
    if (!day || day.type !== 'workout' || !day.focus) return;
    
    setIsGenerating(true);
    
    // Small delay for UX
    setTimeout(() => {
      const newSession = regenerateSession(
        generatedSessions[dayId], 
        {
          focus: day.focus!,
          level,
          goal,
          durationMinutes: duration,
          equipment
        }
      );
      
      setGeneratedSessions(prev => ({
        ...prev,
        [dayId]: newSession
      }));
      setIsGenerating(false);
    }, 600);
  };

  // Save the plan to the database
  const handleSavePlan = async () => {
    if (!user || !weeklySchedule) return;
    
    setIsSaving(true);
    try {
      // 1. Prepare the plan data
      const planToSave: SavedWeeklyPlan = {
        userId: user.uid,
        name: `${goal.charAt(0).toUpperCase() + goal.slice(1)} Plan`,
        description: `${daysPerWeek} days/week ${level} program`,
        startDate: new Date().toISOString(),
        durationWeeks: 4, // Default to 4 weeks
        schedule: weeklySchedule.map(day => ({
          dayOfWeek: day.dayOfWeek,
          type: day.type,
          focus: day.focus,
          isRest: day.type === 'rest'
        })),
        metadata: {
          generatedAt: new Date().toISOString(),
          settings: {
            goal,
            level,
            daysPerWeek,
            equipment
          }
        }
      };

      // 2. Save the plan structure
      const savedPlanId = await saveGeneratedPlan(planToSave);
      
      // 3. Save individual workout sessions
      // We only save the "template" sessions for now
      const saveSessionPromises = weeklySchedule
        .filter(day => day.type === 'workout' && generatedSessions[day.id])
        .map(day => {
          const session = generatedSessions[day.id];
          const sessionToSave: SavedWorkoutSession = {
            userId: user.uid,
            planId: savedPlanId,
            name: session.name,
            focus: session.focus,
            exercises: session.exercises,
            difficulty: session.difficulty,
            estimatedDuration: session.estimatedDuration,
            scheduledDay: day.dayOfWeek
          };
          return saveSessionToDb(sessionToSave);
        });
        
      await Promise.all(saveSessionPromises);
      
      // 4. Navigate to dashboard or success page
      router.push('/dashboard?planCreated=true');
      
    } catch (error) {
      console.error("Error saving plan:", error);
      setGenerationError("Failed to save your plan. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Render Step 1: Configuration
  const renderConfigurationStep = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Goal Selection */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-blue-600" />
            Training Goal
          </h3>
          <div className="space-y-3">
            {[
              { id: "strength", label: "Strength & Power", desc: "Focus on increasing raw strength and lifting capacity" },
              { id: "hypertrophy", label: "Muscle Growth", desc: "Maximize muscle size and definition (Bodybuilding)" },
              { id: "endurance", label: "Endurance", desc: "Improve stamina and cardiovascular health" },
              { id: "weight-loss", label: "Weight Loss", desc: "High calorie burn with circuit-style training" }
            ].map((option) => (
              <div 
                key={option.id}
                onClick={() => setGoal(option.id)}
                className={`
                  p-4 rounded-xl border-2 cursor-pointer transition-all duration-200
                  ${goal === option.id 
                    ? "border-blue-600 bg-blue-50/50 dark:bg-blue-900/10" 
                    : "border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800"}
                `}
              >
                <div className="font-medium text-gray-900 dark:text-gray-100">{option.label}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{option.desc}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Level & Schedule */}
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Layers className="w-5 h-5 mr-2 text-blue-600" />
              Experience Level
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {['beginner', 'intermediate', 'advanced'].map((l) => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={`
                    py-2 px-4 rounded-lg text-sm font-medium capitalize transition-colors
                    ${level === l
                      ? "bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"}
                  `}
                >
                  {l}
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
                  onChange={(e) => setDaysPerWeek(parseInt(e.target.value))}
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
                    ${duration === mins
                      ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                      : "border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300"}
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

  // Render Step 2: Review Schedule
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
             <Button onClick={() => handleSavePlan()} disabled={isSaving}>
               {isSaving ? (
                 <span className="flex items-center"><RefreshCw className="w-4 h-4 mr-2 animate-spin"/> Saving...</span>
               ) : (
                 <span className="flex items-center"><Save className="w-4 h-4 mr-2"/> Save Plan</span>
               )}
             </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Weekly Overview Sidebar */}
          <div className="lg:col-span-1 space-y-3">
            {weeklySchedule.map((day) => (
              <div 
                key={day.id}
                onClick={() => day.type === 'workout' && setExpandedDay(day.id)}
                className={`
                  p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between
                  ${expandedDay === day.id 
                    ? "border-blue-600 bg-white dark:bg-gray-800 shadow-lg scale-[1.02]" 
                    : "border-transparent bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800"}
                  ${day.type === 'rest' ? "opacity-60 grayscale" : ""}
                `}
              >
                <div className="flex items-center">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center mr-3 font-bold text-sm
                    ${day.type === 'workout' ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}
                  `}>
                    {day.dayOfWeek.substring(0, 3)}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">{day.type === 'workout' ? day.focus : "Rest Day"}</div>
                    <div className="text-xs text-gray-500 capitalize">{day.type}</div>
                  </div>
                </div>
                {day.type === 'workout' && (
                  <ChevronRight className={`w-5 h-5 text-gray-400 ${expandedDay === day.id ? "rotate-90 text-blue-500" : ""}`} />
                )}
              </div>
            ))}
          </div>

          {/* Detailed Session View */}
          <div className="lg:col-span-2">
            {expandedDay ? (
              <Card className="h-full overflow-hidden flex flex-col">
                {generatedSessions[expandedDay] ? (
                  <>
                    <div className="p-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-start">
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                          {generatedSessions[expandedDay].name}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span className="flex items-center"><Clock className="w-4 h-4 mr-1"/> {generatedSessions[expandedDay].estimatedDuration} min</span>
                          <span className="flex items-center"><Dumbbell className="w-4 h-4 mr-1"/> {generatedSessions[expandedDay].exercises.length} Exercises</span>
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium uppercase">
                            {generatedSessions[expandedDay].difficulty}
                          </span>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleRegenerateSession(expandedDay)}
                        disabled={isGenerating}
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                        Regenerate
                      </Button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[600px]">
                      {generatedSessions[expandedDay].exercises.map((ex, idx) => (
                        <div key={ex.id} className="flex items-start p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-sm font-bold text-gray-500 mr-4 mt-1">
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between mb-1">
                              <h4 className="font-semibold text-gray-900 dark:text-white">{ex.name}</h4>
                              <span className="text-xs font-mono text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                {ex.sets} x {ex.reps}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 line-clamp-1">{ex.targetMuscle} • {ex.equipment}</p>
                            
                            {ex.notes && (
                              <div className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg">
                                Tip: {ex.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
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
          
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">
              Generate New Plan
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Create a scientifically optimized workout routine tailored to your goals.
            </p>
          </div>

          {/* Progress Steps */}
          <div className="mb-12">
            <div className="flex items-center justify-between relative">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-gray-200 dark:bg-gray-800 -z-10" />
              {STEPS.map((step) => {
                const Icon = step.icon;
                const isCompleted = step.id < currentStep;
                const isCurrent = step.id === currentStep;
                
                return (
                  <div key={step.id} className="flex flex-col items-center bg-white dark:bg-black px-4">
                    <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center border-2 mb-2 transition-colors duration-300
                      ${isCompleted 
                        ? "bg-green-500 border-green-500 text-white" 
                        : isCurrent 
                          ? "bg-blue-600 border-blue-600 text-white" 
                          : "bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-400"}
                    `}>
                      {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : <Icon className="w-5 h-5" />}
                    </div>
                    <span className={`text-sm font-medium ${isCurrent ? "text-gray-900 dark:text-white" : "text-gray-500"}`}>
                      {step.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Error Display */}
          {generationError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center text-red-700">
              <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
              {generationError}
            </div>
          )}

          {/* Step Content */}
          <div className="min-h-[400px]">
            {currentStep === 1 && renderConfigurationStep()}
            {currentStep === 2 && renderReviewStep()}
          </div>

        </div>
      </main>
    </div>
  );
}