'use client'

import React from 'react'
import { Target } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { GoalSelector } from '@/components/generate/GoalSelector'
import { MuscleGroupSelector } from '@/components/generate/MuscleGroupSelector'
import type { Goal, FocusArea } from '@/types/domain'

interface TrainingGoalsFormProps {
  goal: Goal
  focusAreas: FocusArea[]
  onGoalChange: (goal: Goal) => void
  onFocusAreasChange: (areas: FocusArea[]) => void
}

export function TrainingGoalsForm({
  goal,
  focusAreas,
  onGoalChange,
  onFocusAreasChange
}: TrainingGoalsFormProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Target className="h-5 w-5 text-accent" />
        <div>
          <h2 className="text-sm font-semibold text-strong">Training Goals</h2>
          <p className="text-xs text-subtle">Set your default training preferences.</p>
        </div>
      </div>

      <div className="space-y-6">
        <GoalSelector value={goal} onChange={onGoalChange} />
        
        <div>
          <label className="mb-2 block text-sm font-medium text-strong">Primary focus areas</label>
          <MuscleGroupSelector 
            selected={focusAreas} 
            onChange={onFocusAreasChange}
          />
        </div>
      </div>
    </Card>
  )
}
