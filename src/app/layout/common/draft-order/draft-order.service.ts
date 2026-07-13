import { Injectable, computed, signal } from '@angular/core';
import { CatalogProduct } from 'app/modules/catalog/catalog.types';
import { DEMO_DRAFT_ORDER_LINES } from './draft-order.demo-data';
import { DraftOrderLine } from './draft-order.types';

/**
 * The restaurant's in-progress order (PRD M5 · FR-ORD: draft → add/update/
 * remove items → confirm before the 22:00 cutoff → price snapshot). This is
 * *not* a consumer prepaid cart — no price/subtotal is computed here since
 * price is locked only at confirmation (PRD §5, M4). Seeded with demo data
 * until backed by the real order-draft API; shared root singleton so both
 * the catalog and the header panel read/write the same state.
 */
@Injectable({ providedIn: 'root' })
export class DraftOrderService {
    private readonly _lines = signal<DraftOrderLine[]>(DEMO_DRAFT_ORDER_LINES);

    readonly lines = this._lines.asReadonly();
    readonly totalQuantity = computed(() =>
        this._lines().reduce((sum, line) => sum + line.quantity, 0)
    );
    /** Demo UI subtotal only — final price locks at confirmation (PRD §5). */
    readonly subtotal = computed(() =>
        this._lines().reduce(
            (sum, line) => sum + line.unitPrice * line.quantity,
            0
        )
    );

    /**
     * Open-state of the header draft-order drawer. Kept here (not in the
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

    add(product: CatalogProduct, quantity = 1, unitPrice = 0): void {
        const existing = this._lines().find(
            (line) => line.product.id === product.id
        );
        if (existing) {
            this.setQuantity(product.id, existing.quantity + quantity);
            return;
        }
        this._lines.update((lines) => [
            ...lines,
            { product, quantity, unitPrice },
        ]);
    }

    setQuantity(productId: string, quantity: number): void {
        if (quantity <= 0) {
            this.remove(productId);
            return;
        }
        this._lines.update((lines) =>
            lines.map((line) =>
                line.product.id === productId ? { ...line, quantity } : line
            )
        );
    }

    remove(productId: string): void {
        this._lines.update((lines) =>
            lines.filter((line) => line.product.id !== productId)
        );
    }

    clear(): void {
        this._lines.set([]);
    }
}
