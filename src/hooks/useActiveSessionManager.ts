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

    // Set operations (DB-aware wrappers)
    handleSetUpdate: setOps.handleSetUpdate,
    handleBodyWeightUpdate: setOps.handleBodyWeightUpdate,
    handleStartTimeUpdate: setOps.handleStartTimeUpdate,
    handleRemoveSet: setOps.handleRemoveSet,
    addSet: setOps.addSet,
    updateSet: setOps.updateSet,

    // Exercise operations (DB-aware wrappers)
    replaceSessionExercise: setOps.replaceSessionExercise,
    handleRemoveExercise: setOps.handleRemoveExercise,
    addSessionExercise: setOps.addSessionExercise,
    handleReorderExercises: setOps.handleReorderExercises,

    // Exercise library
    resolvedInventory,
    exerciseLibrary,
    exerciseLibraryByName,

    // Loading states
    syncStatus: setOps.syncStatus,
    isUpdating: setOps.isUpdating,

    // Supabase client
    supabase
  };
}
