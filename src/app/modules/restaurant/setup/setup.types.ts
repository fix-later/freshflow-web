/**
 * Types for the restaurant setup-completion model
 * (`specs/003-restaurant-onboarding-wizard/data-model.md`).
 *
 * Nothing here is persisted. Every state below is derived from data the
 * platform already holds behind `/api/v1/restaurants/me/*`.
 */

/** The four things a restaurant supplies during setup. */
export type SetupItemId = 'business' | 'license' | 'address' | 'tax';

/**
 * The three items that gate review (spec Decision 1). `tax` is deliberately
 * absent: it is optional *and* unreadable, so it never carries a state.
 */
export type RequiredSetupItemId = 'business' | 'license' | 'address';

/**
 * A verifiable item's state.
 *
 * Two members, on purpose. An `'unknown'` member would push a third case into
 * every template and invite someone to render the tax item as a half-checked
 * box — the misleading affordance FR-021 forbids. Keeping the union at two
 * makes the honest behaviour the only expressible one.
 */
export type SetupItemState = 'done' | 'outstanding';

/** Per-item states for the three required items. */
export type SetupItemStates = Readonly<
    Record<RequiredSetupItemId, SetupItemState>
>;

/** Overall standing across the three required items. */
export interface SetupProgress {
    /** How many required items are done. 0–3. */
    readonly completed: number;
    /** Always {@link REQUIRED_SETUP_ITEMS}.length — the tax item never counts. */
    readonly total: number;
    /** Required items still outstanding, in wizard order. */
    readonly outstanding: readonly RequiredSetupItemId[];
    /** True when every required item is done. */
    readonly isComplete: boolean;
}

/**
 * The required items in wizard order. `business` and `license` share a step
 * (they share a single `PUT /restaurants/me/profile`), but stay separate items
 * so the checklist can name exactly what is missing.
 */
export const REQUIRED_SETUP_ITEMS: readonly RequiredSetupItemId[] = [
    'business',
    'license',
    'address',
] as const;
