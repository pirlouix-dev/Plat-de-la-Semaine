/**
 * Dish-related types for "Plat de la Semaine"
 *
 * Matches the data model from the original Python application and aligns
 * with the .NET backend API contract.
 */

// ── Enums (const-object pattern for erasableSyntaxOnly compat) ────────────────

/** Course (type) of a dish: 0 = Starter, 1 = Main, 2 = Dessert */
export const Course = {
  Starter: 0,
  Main: 1,
  Dessert: 2,
} as const;
export type Course = (typeof Course)[keyof typeof Course];

/** Season tag: 0 = Spring, 1 = Summer, 2 = Autumn, 3 = Winter */
export const Season = {
  Spring: 0,
  Summer: 1,
  Autumn: 2,
  Winter: 3,
} as const;
export type Season = (typeof Season)[keyof typeof Season];

// ── Constants ────────────────────────────────────────────────────────────────

/** French labels for course types, indexed by Course value */
export const COURSE_LABELS: Record<(typeof Course)[keyof typeof Course], string> = {
  [Course.Starter]: "Entrée",
  [Course.Main]: "Plat",
  [Course.Dessert]: "Dessert",
};

/** French labels for seasons, indexed by Season value */
export const SEASON_LABELS: Record<(typeof Season)[keyof typeof Season], string> = {
  [Season.Spring]: "Printemps",
  [Season.Summer]: "Été",
  [Season.Autumn]: "Automne",
  [Season.Winter]: "Hiver",
};

/** Convenience list of all season values */
export const ALL_SEASONS: Season[] = [
  Season.Spring,
  Season.Summer,
  Season.Autumn,
  Season.Winter,
];

// ── Core Types ───────────────────────────────────────────────────────────────

/**
 * A dish entity as stored in the database and returned by the backend API.
 */
export interface Dish {
  /** Unique identifier (from backend / Firebase) */
  id: string;
  /** Owner user identifier */
  userId: string;
  /** Dish name (unique per user, kept in alphabetical order) */
  name: string;
  /** Free-text description (can be empty) */
  description: string;
  /** Course type (0 = Starter, 1 = Main, 2 = Dessert) */
  course: Course;
  /** Array of season values (0-3); all four indicates year-round */
  seasons: Season[];
  /** ISO-8601 datetime of last update */
  updatedAt: string;
  /** Soft-delete flag */
  isDeleted: boolean;
}

/**
 * Payload for creating a new dish (POST /api/dishes).
 * Backend assigns `id`, `userId`, `updatedAt`, and `isDeleted`.
 */
export interface CreateDishPayload {
  name: string;
  description?: string;
  course: Course;
  seasons: Season[];
}

/**
 * Payload for updating an existing dish (PUT /api/dishes/:id).
 * Only provided fields will be updated.
 */
export interface UpdateDishPayload {
  name?: string;
  description?: string;
  course?: Course;
  seasons?: Season[];
}

// ── Validation helpers ───────────────────────────────────────────────────────

/** Check whether a numeric value is a valid Course member */
export function isValidCourse(value: number): value is Course {
  return Object.values(Course).includes(value as Course);
}

/** Check whether a numeric value is a valid Season member */
export function isValidSeason(value: number): value is Season {
  return Object.values(Season).includes(value as Season);
}
