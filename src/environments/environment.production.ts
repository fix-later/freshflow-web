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
    apiBaseUrl: 'http://api.freshflow.fishfix.vn',
};
