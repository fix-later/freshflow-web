import { Injectable, computed, signal } from '@angular/core';
import { CatalogProduct } from 'app/modules/catalog/catalog.types';
import { DraftOrderLine } from './draft-order.types';

/**
 * The restaurant's in-progress order (PRD M5 · FR-ORD: draft → add/update/
 * remove items → confirm before the 22:00 cutoff → price snapshot). This is
 * *not* a consumer prepaid cart — the displayed unit price is indicative;
 * final price locks at confirmation (PRD §5, M4). Shared root singleton so
 * both the catalog and the header panel read/write the same state. Client-side
 * until backed by the real order-draft API.
 */
@Injectable({ providedIn: 'root' })
export class DraftOrderService {
    private readonly _lines = signal<DraftOrderLine[]>([]);

    readonly lines = this._lines.asReadonly();
    readonly totalQuantity = computed(() =>
        this._lines().reduce((sum, line) => sum + line.quantity, 0)
    );
    /** Display subtotal only — final price locks at confirmation (PRD §5). */
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

    /**
     * Adds a product line (or bumps quantity). Unit price defaults to the
     * catalog listing price so callers don't have to pass it every time.
     */
    add(product: CatalogProduct, quantity = 1, unitPrice?: number): void {
        const price = unitPrice ?? product.price ?? 0;
        const existing = this._lines().find(
            (line) => line.product.id === product.id
        );
        if (existing) {
            this._lines.update((lines) =>
                lines.map((line) =>
                    line.product.id === product.id
                        ? {
                              ...line,
                              quantity: line.quantity + quantity,
                              // Heal lines that were stored with the old 0 default.
                              unitPrice: line.unitPrice || price,
                          }
                        : line
                )
            );
            return;
        }
        this._lines.update((lines) => [
            ...lines,
            { product, quantity, unitPrice: price },
        ]);
    }

    setQuantity(productId: string, quantity: number): void {
        if (quantity <= 0) {
            this.remove(productId);
            return;
        }
        this._lines.update((lines) =>
            lines.map((line) =>
                line.product.id === productId
                    ? {
                          ...line,
                          quantity,
                          // Heal lines stored with the old 0-price default.
                          unitPrice: line.unitPrice || line.product.price || 0,
                      }
                    : line
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
