import { Injectable, computed, signal } from '@angular/core';
import { CatalogProduct } from 'app/modules/catalog/catalog.types';
import { DEMO_FAVORITES } from './favorites.demo-data';

/**
 * Saved products for fast reordering — the B2B equivalent of a consumer
 * wishlist (PRD RC-1: post-paid credit/debt, not a prepaid storefront).
 * Seeded with demo data until a per-restaurant "frequently ordered" API
 * exists; shared root singleton so both the catalog card toggle and the
 * header panel read/write the same state.
 */
@Injectable({ providedIn: 'root' })
export class FavoritesService {
    private readonly _items = signal<CatalogProduct[]>(DEMO_FAVORITES);

    readonly items = this._items.asReadonly();
    readonly count = computed(() => this._items().length);

    /**
     * Open-state of the header favorites drawer. Kept here (not in the
     * component) so the header trigger and the drawer panel — which render in
     * different parts of the layout, decoupled so the header's pin animation
     * can't affect the drawer — share one source of truth.
     */
    private readonly _drawerOpen = signal(false);
    readonly drawerOpen = this._drawerOpen.asReadonly();

    toggleDrawer(): void {
        this._drawerOpen.update((open) => !open);
    }

    setDrawerOpen(open: boolean): void {
        this._drawerOpen.set(open);
    }

    closeDrawer(): void {
        this._drawerOpen.set(false);
    }

    isFavorite(productId: string): boolean {
        return this._items().some((item) => item.id === productId);
    }

    toggle(product: CatalogProduct): void {
        if (this.isFavorite(product.id)) {
            this.remove(product.id);
            return;
        }
        this._items.update((items) => [...items, product]);
    }

    remove(productId: string): void {
        this._items.update((items) =>
            items.filter((item) => item.id !== productId)
        );
    }
}
