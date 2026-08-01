import type { MuscleGroup, Equipment } from './exerciseLibrary';

export interface StarterExercise {
  title: string;
  muscleGroup: MuscleGroup;
  equipment?: Equipment;
}

export const STARTER_EXERCISES: StarterExercise[] = [
  { title: 'Barbell Bench Press', muscleGroup: 'chest', equipment: 'barbell' },
  { title: 'Push-Up', muscleGroup: 'chest', equipment: 'bodyweight' },
  { title: 'Incline Dumbbell Press', muscleGroup: 'chest', equipment: 'dumbbell' },
  { title: 'Pull-Up', muscleGroup: 'back', equipment: 'bodyweight' },
  { title: 'Barbell Row', muscleGroup: 'back', equipment: 'barbell' },
  { title: 'Lat Pulldown', muscleGroup: 'back', equipment: 'cable' },
  { title: 'Overhead Press', muscleGroup: 'shoulders', equipment: 'barbell' },
  { title: 'Lateral Raise', muscleGroup: 'shoulders', equipment: 'dumbbell' },
  { title: 'Bicep Curl', muscleGroup: 'arms', equipment: 'dumbbell' },
  { title: 'Tricep Pushdown', muscleGroup: 'arms', equipment: 'cable' },
  { title: 'Barbell Squat', muscleGroup: 'legs', equipment: 'barbell' },
  { title: 'Romanian Deadlift', muscleGroup: 'legs', equipment: 'barbell' },
  { title: 'Walking Lunge', muscleGroup: 'legs', equipment: 'dumbbell' },
  { title: 'Leg Press', muscleGroup: 'legs', equipment: 'machine' },
  { title: 'Plank', muscleGroup: 'core', equipment: 'bodyweight' },
  { title: 'Hanging Leg Raise', muscleGroup: 'core', equipment: 'bodyweight' },
  { title: 'Kettlebell Swing', muscleGroup: 'full-body', equipment: 'kettlebell' },
  { title: 'Burpee', muscleGroup: 'full-body', equipment: 'bodyweight' },
  { title: 'Running', muscleGroup: 'cardio', equipment: 'other' },
  { title: 'Rowing Machine', muscleGroup: 'cardio', equipment: 'machine' },
];
