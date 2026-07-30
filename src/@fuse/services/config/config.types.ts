// Types
export type Scheme = 'auto' | 'dark' | 'light';
export type Screens = { [key: string]: string };
export type Theme = 'theme-default' | string;

/**
 * AppConfig interface. Update this interface to strictly type your config
 * object.
 *
 * `themes` (the pickable-theme list) was dropped along with the theme-picker
 * drawer: the app ships one palette, and an area that needs its own declares it
 * via `data.theme` in `app.routes.ts`.
 */
export interface FuseConfig {
    layout: string;
    scheme: Scheme;
    screens: Screens;
    theme: Theme;
}
