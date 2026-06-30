/**
 * Production environment.
 *
 * `apiBaseUrl` is the origin of the FreshFlow backend API and is read by the
 * generated API client (see `src/api/client.ts`). Override it per deployment.
 */
export const environment = {
    production: true,
    apiBaseUrl: 'http://localhost:8080',
};
