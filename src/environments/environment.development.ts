import { env } from './env.generated';

/**
 * Development environment (used by `ng serve`).
 *
 * Swapped in for `environment.ts` via `fileReplacements` in angular.json.
 * Values come from `.env` — see `environment.ts` for how that is wired.
 */
export const environment = {
    production: false,
    apiBaseUrl: env.API_BASE_URL || 'https://api.freshflow.fishfix.vn',
    goongMapsKey: env.GOONG_MAPS_KEY,
    goongPlacesKey: env.GOONG_PLACES_KEY,
};
