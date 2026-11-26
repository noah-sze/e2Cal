import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/db/db';
import type { WorkoutRoutine, Exercise } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { getInMemoryExercisesCache, setInMemoryExercisesCache } from './useExercises';
import { createInMemoryCache } from './createInMemoryCache';

const routinesCache = createInMemoryCache<WorkoutRoutine>(() => db.routines.toArray());

export const getInMemoryRoutinesCache = routinesCache.get;
export const setInMemoryRoutinesCache = routinesCache.set;
export const clearRoutinesCache = routinesCache.clear;
export const prewarmRoutinesCache = routinesCache.prewarm;

export function useRoutines(searchQuery = '') {
  const allRoutinesList = useLiveQuery(
    async () => {
      const result = await db.routines.toArray();
      routinesCache.set(result);
      return result;
    },
    []
  );

  const allExercisesList = useLiveQuery(
    async () => {
      const result = await db.exercises.toArray();
      setInMemoryExercisesCache(result);
      return result;
    },
    []
  );

  const allRoutines = allRoutinesList ?? routinesCache.get() ?? [];
  const allExercises = allExercisesList ?? getInMemoryExercisesCache() ?? [];

  const exerciseMap = new Map<string, Exercise>();
  allExercises.forEach((ex) => {
    exerciseMap.set(ex.id, ex);
  });

  const activeRoutines = allRoutines.filter((r) => !r.isArchived);
  const archivedRoutines = allRoutines.filter((r) => r.isArchived);

  const customRoutines = activeRoutines.filter((r) => r.isCustom);
  const presetRoutines = activeRoutines.filter((r) => !r.isCustom);

  const archivedCustomRoutines = archivedRoutines.filter((r) => r.isCustom);
  const archivedPresetRoutines = archivedRoutines.filter((r) => !r.isCustom);

  const filteredActiveRoutines = searchQuery.trim()
    ? activeRoutines.filter((r) => {
        const q = searchQuery.toLowerCase().trim();
        return (
          r.name.toLowerCase().includes(q) ||
          (r.notes && r.notes.toLowerCase().includes(q))
        );
      })
    : activeRoutines;

  const addRoutine = async (
    data: Omit<WorkoutRoutine, 'id' | 'createdAt' | 'updatedAt' | 'isArchived'> & {
      isCustom?: boolean;
    }
  ): Promise<WorkoutRoutine> => {
    const now = Date.now();
    const newRoutine: WorkoutRoutine = {
      ...data,
      id: uuidv4(),
      isCustom: data.isCustom ?? true,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.routines.add(newRoutine);
    return newRoutine;
  };

  const updateRoutine = async (
    id: string,
    updates: Partial<Omit<WorkoutRoutine, 'id' | 'createdAt'>>
  ) => {
    await db.routines.update(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  };

  const archiveRoutine = async (id: string) => {
    await db.routines.update(id, {
      isArchived: true,
      updatedAt: Date.now(),
    });
  };

  const unarchiveRoutine = async (id: string) => {
    await db.routines.update(id, {
      isArchived: false,
      updatedAt: Date.now(),
    });
  };

  const deleteRoutine = async (id: string): Promise<{ success: boolean }> => {
    await db.routines.delete(id);
    return { success: true };
  };

  return {
    allRoutines,
    activeRoutines,
    filteredActiveRoutines,
    archivedRoutines,
    customRoutines,
    presetRoutines,
    archivedCustomRoutines,
    archivedPresetRoutines,
    exerciseMap,
    isLoading: allRoutinesList === undefined && routinesCache.get() === null,
    addRoutine,
    updateRoutine,
    archiveRoutine,
    unarchiveRoutine,
    deleteRoutine,
  };
}
