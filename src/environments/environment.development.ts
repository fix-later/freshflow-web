/**
 * Development environment (used by `ng serve`).
 *
 * Swapped in for `environment.ts` via `fileReplacements` in angular.json.
 */
export const environment = {
    production: false,
    apiBaseUrl: 'https://api.freshflow.fishfix.vn',
    /**
     * Goong.io keys (client-side, embedded in the browser build). Left blank so
     * real keys are never committed — set them in the gitignored
     * `environment.local.ts` (run `npm run start:local`), or inject at deploy.
     */
    goongMapsKey: '',
    goongPlacesKey: '',
};
