/**
 * Production environment.
 *
 * Swapped in for `environment.ts` via `fileReplacements` in angular.json for
 * the `production` build configuration (the default target of `ng build`).
 * `apiBaseUrl` is the FreshFlow backend origin read by the generated API
 * client (see `src/contract/client.ts`).
 */
export const environment = {
    production: true,
    apiBaseUrl: 'https://api.freshflow.fishfix.vn',
    /**
     * Goong.io keys (client-side, embedded in the browser build). Left blank so
     * real keys are never committed — inject the production values at deploy
     * time (CI/secret) or via a local build override.
     */
    goongMapsKey: '',
    goongPlacesKey: '',
};
