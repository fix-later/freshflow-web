import { computed, inject, Injectable, Signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UserService } from 'app/core/user/user.service';
import { RestaurantProfileService } from '../restaurant-profile.service';
import {
    REQUIRED_SETUP_ITEMS,
    RequiredSetupItemId,
    SetupItemStates,
    SetupProgress,
} from './setup.types';

/** `sessionStorage` key prefix for the per-restaurant wizard dismissal. */
const DISMISSED_KEY_PREFIX = 'ffx.onboarding.dismissed.';

/**
 * Derives how far a restaurant is through the setup an admin needs before it
 * can approve the account, and remembers whether the wizard was dismissed this
 * session.
 *
 * Two rules shape this service:
 *
 * 1. **State is derived, never remembered** (FR-020). Every item's state is a
 *    `computed()` over {@link RestaurantProfileService}'s existing signals, so
 *    completing an item anywhere in the profile area updates the checklist with
 *    no reload (FR-018), and deleting the last address makes that item
 *    outstanding again for free.
 * 2. **The tax item has no state** (spec Decision 2). `PUT
 *    /restaurants/me/tax-profile` has no matching GET, so its completion cannot
 *    be confirmed. It is excluded from {@link states} and from both sides of
 *    {@link progress}, and is offered as a standing action instead.
 *
 * See `specs/003-restaurant-onboarding-wizard/data-model.md`.
 */
@Injectable({ providedIn: 'root' })
export class SetupCompletionService {
    private readonly _profileService = inject(RestaurantProfileService);
    private readonly _userService = inject(UserService);

    /** In-flight/settled first load, so `load()` is idempotent. */
    private _loaded: Promise<void> | null = null;

    /** Whose load this cache stands for. */
    private _loadedUserId: string | null = null;

    constructor() {
        // The states below are derived from the profile service, which now
        // empties itself when the account changes; this only has to forget that
        // a load already happened, or the new account's checklist would read as
        // "already loaded, nothing to fetch" and stay blank.
        this._userService.user$.pipe(takeUntilDestroyed()).subscribe((user) => {
            const id = user?.id ?? null;
            if (id === this._loadedUserId) {
                return;
            }
            this._loadedUserId = id;
            this.invalidate();
        });
    }

    /** State of each verifiable required item, derived from saved data. */
    readonly states: Signal<SetupItemStates> = computed(() => {
        const profile = this._profileService.profile();
        const addresses = this._profileService.deliveryAddresses();

        // A profile the platform accepts is not the same as one that is ready
        // for review: the backend marks every field optional and the edit form
        // only requires `name`. This stricter reading is UI-side and must not
        // leak into the form's validators (research R6).
        // `pickupStart`/`pickupEnd` dropped from this check: the receiving-window
        // feature is retired (every delivery now uses a fixed platform-wide
        // window), and the edit form no longer lets a restaurant fill them in —
        // requiring them would make this step permanently unreachable.
        const businessDone =
            isFilled(profile?.name) &&
            isFilled(profile?.address) &&
            isFilled(profile?.contactPerson);

        return {
            business: state(businessDone),
            license: state(isFilled(profile?.businessLicenseUrl)),
            // FR-022 asks only that an address exists — not that one is marked
            // default. `defaultDeliveryAddress()` already falls back to the
            // first, so a single unflagged address is usable.
            address: state(addresses.length > 0),
        };
    });

    /** Counts, outstanding list and the overall flag (data-model.md § 3). */
    readonly progress: Signal<SetupProgress> = computed(() => {
        const states = this.states();
        const outstanding = REQUIRED_SETUP_ITEMS.filter(
            (id) => states[id] === 'outstanding'
        );
        return {
            completed: REQUIRED_SETUP_ITEMS.length - outstanding.length,
            total: REQUIRED_SETUP_ITEMS.length,
            outstanding,
            isComplete: outstanding.length === 0,
        };
    });

    /**
     * Ensure the two underlying reads have happened at least once. Idempotent —
     * both the wizard and the dashboard card call it on open.
     *
     * Read failures are swallowed on purpose: an unreachable API leaves every
     * item `outstanding`, which is the safe reading, and the embedded forms
     * surface their own load errors.
     */
    load(): Promise<void> {
        this._loaded ??= Promise.all([
            this._profileService.loadProfile(),
            this._profileService.loadDeliveryAddresses(),
        ]).then(
            () => undefined,
            () => undefined
        );
        return this._loaded;
    }

    /** Drop the cached load so the next `load()` re-reads from the server. */
    invalidate(): void {
        this._loaded = null;
    }

    /** True when this restaurant dismissed the wizard in this browser session. */
    isDismissed(): boolean {
        const key = this._dismissKey();
        return key !== null && sessionStorage.getItem(key) === '1';
    }

    /**
     * Record a dismissal for the rest of this browser session.
     *
     * Session scope, not `localStorage`, and not the server: no endpoint
     * accepts a per-restaurant UI preference (research R4), and a permanent
     * local dismissal would let an incomplete restaurant silence the one prompt
     * that gets it approved. The profile-area checklist is the durable
     * reminder instead.
     */
    dismiss(): void {
        const key = this._dismissKey();
        if (key !== null) {
            sessionStorage.setItem(key, '1');
        }
    }

    /** Keyed by user id so a shared machine does not inherit a dismissal. */
    private _dismissKey(): string | null {
        const id = this._userService.current?.id;
        return id ? `${DISMISSED_KEY_PREFIX}${id}` : null;
    }
}

/** Present and not whitespace-only, matching the forms' `emptyToNull` rule. */
function isFilled(value: string | null | undefined): boolean {
    return typeof value === 'string' && value.trim() !== '';
}

function state(done: boolean): 'done' | 'outstanding' {
    return done ? 'done' : 'outstanding';
}

/** Re-exported so callers can narrow without a second import. */
export type { RequiredSetupItemId };
