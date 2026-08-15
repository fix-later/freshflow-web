import { env } from './env.generated';

/**
 * Base/default environment — swapped out per build configuration via
 * `fileReplacements` in angular.json:
 *   production  → environment.production.ts   (default target of `ng build`)
 *   development → environment.development.ts  (default target of `ng serve`)
 *   local       → environment.local.ts        (gitignored; each dev's backend)
 *
 * Every value comes from `.env` via `env.generated.ts` (written by
 * `scripts/generate-env.mjs`, which runs before start/build/test) — no origin
 * or key is written here, so nothing has to be edited in two places and none of
 * it can be committed by accident. A missing `API_BASE_URL` fails the build.
 *
 * `apiBaseUrl` is the backend origin read by the generated API client (see
 * `src/contract/client.ts`); the Goong keys are the map SDK (`goongMapsKey`,
 * Maptiles) and the Places REST key (`goongPlacesKey`).
 */
export const environment = {
    production: false,
    apiBaseUrl: env.API_BASE_URL,
    goongMapsKey: env.GOONG_MAPS_KEY,
    goongPlacesKey: env.GOONG_PLACES_KEY,
    /** Delivery-side Cloudinary cloud; no key or secret ships to the browser. */
    cloudinaryCloudName: env.CLOUDINARY_CLOUD_NAME,
};
