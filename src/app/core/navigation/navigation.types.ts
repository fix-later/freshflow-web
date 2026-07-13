import { FuseNavigationItem } from '@fuse/components/navigation';

/**
 * A UI area: a group of routes sharing the same chrome (layout + nav).
 * Declared per route block via `data: { area, layout }` in `app.routes.ts`.
 */
export type Area = 'storefront' | 'admin';

export interface Navigation {
    compact: FuseNavigationItem[];
    default: FuseNavigationItem[];
    futuristic: FuseNavigationItem[];
    horizontal: FuseNavigationItem[];
}
