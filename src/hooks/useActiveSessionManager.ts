'use client';

import { useMemo } from 'react';
import { equipmentPresets } from '@/lib/equipment';
import { useSessionData } from '@/hooks/useSessionData';
import { useSetOperations } from '@/hooks/useSetOperations';
import type { EquipmentInventory } from '@/types/domain';

/**
 * Manages active workout session state, persistence, and synchronization.
 * Composes useSessionData (fetching/derived state) and useSetOperations (CRUD).
 */
export function useActiveSessionManager(sessionId?: string | null, equipmentInventory?: EquipmentInventory | null) {
  const sessionData = useSessionData(sessionId);
  const {
    activeSession, errorMessage, setErrorMessage,
    profileWeightLb, exerciseHistory, exerciseTargets,
    sessionBodyWeight, setSessionBodyWeight, preferredUnit,
    exerciseLibrary, exerciseLibraryByName, supabase
  } = sessionData;

  const setOps = useSetOperations(
    activeSession, preferredUnit,
    sessionBodyWeight, setSessionBodyWeight,
    setErrorMessage, supabase
  );

  const resolvedInventory = useMemo(
    () => equipmentInventory ?? equipmentPresets.custom,
    [equipmentInventory]
  );

  return {
    // Session state
    activeSession,
    errorMessage,
    setErrorMessage,
    sessionBodyWeight,
    setSessionBodyWeight,
    preferredUnit,
    togglePreferredUnit: setOps.togglePreferredUnit,
    profileWeightLb,
    exerciseHistory,
    exerciseTargets,

    // Set operations
    handleSetUpdate: setOps.handleSetUpdate,
    handleBodyWeightUpdate: setOps.handleBodyWeightUpdate,
    handleRemoveSet: setOps.handleRemoveSet,
    addSet: setOps.addSet,
    removeSet: setOps.removeSet,
    updateSet: setOps.updateSet,

    // Exercise operations
    replaceSessionExercise: setOps.replaceSessionExercise,
    removeSessionExercise: setOps.removeSessionExercise,
    handleRemoveExercise: setOps.handleRemoveExercise,
    addSessionExercise: setOps.addSessionExercise,
    handleReorderExercises: setOps.handleReorderExercises,

    // Exercise library
    resolvedInventory,
    exerciseLibrary,
    exerciseLibraryByName,

    // Loading states
    isUpdating: setOps.isUpdating,

    // Supabase client
    supabase
  };
}
