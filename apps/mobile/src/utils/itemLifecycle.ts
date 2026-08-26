// Classifies each ItemType by how it's actually used in the product — a pure
// mapping, NOT a schema change. Exists so a generic, type-agnostic query
// (any status/count helper that doesn't filter by `type`) can be checked
// against intent before shipping. A real bug motivated this: useHomeData's
// old "Upcoming" count used getItemCountByStatus('active'), which silently
// summed every one of the 19 item types with status='active' — including
// Domains/Skills/Habits, not just Tasks — producing a number (273) with no
// relation to what a human means by "upcoming." See HANDOVER_SUMMARY 2026-08-13.
//
// 'structural' — created rarely, then referenced/edited over a long
// lifetime, rarely deleted: the durable "nouns" of the app (Domains,
// Missions, Skills, Pillars, Achievements, the singleton Focus, Plan
// Backwards workspaces, and every *definition* — Habit/Medication/Routine/
// Workout templates, a routine's steps, a workout's blocks, the exercise
// catalog). Their own `status` field (if any) changes rarely.
//
// 'transactional' — created and discarded frequently, carry a short-lived
// status lifecycle: Tasks, To Get objects, and one-off session rows
// (workout-session, routine-session — a single played-through instance of a
// structural template). These are the "to-dos and instances."
//
// This is orthogonal to the Actions model (utils/actions.ts): a Task is a
// transactional *item* (its own row, its own status); a logged Action
// (including a skill-practice session) is an *event* in activityLogs, never
// its own item row, and never structural or transactional in this sense —
// see the "Persistence model" note in CLAUDE.md.

import type { ItemType } from '../db/types';

export type ItemLifecycle = 'structural' | 'transactional';

export const ITEM_LIFECYCLE: Record<ItemType, ItemLifecycle> = {
  area: 'structural',
  project: 'structural',
  skill: 'structural',
  'potential-stat': 'structural',
  achievement: 'structural',
  focus: 'structural',
  medication: 'structural',
  supplement: 'structural',
  habit: 'structural',
  routine: 'structural',
  'routine-step': 'structural',
  'workout-template': 'structural',
  'workout-block': 'structural',
  exercise: 'structural',
  'backward-plan': 'structural',
  'potential-attribute': 'structural',
  task: 'transactional',
  object: 'transactional',
  'workout-session': 'transactional',
  'routine-session': 'transactional',
  meal: 'transactional',
  event: 'transactional',
};

export function isStructuralType(type: ItemType): boolean {
  return ITEM_LIFECYCLE[type] === 'structural';
}

export function isTransactionalType(type: ItemType): boolean {
  return ITEM_LIFECYCLE[type] === 'transactional';
}

export const STRUCTURAL_ITEM_TYPES: ItemType[] = (Object.keys(ITEM_LIFECYCLE) as ItemType[]).filter(isStructuralType);
export const TRANSACTIONAL_ITEM_TYPES: ItemType[] = (Object.keys(ITEM_LIFECYCLE) as ItemType[]).filter(isTransactionalType);
