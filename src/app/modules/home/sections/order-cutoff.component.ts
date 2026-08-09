import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    inject,
    signal,
    ViewEncapsulation,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { OrdersService } from 'app/modules/orders/orders.service';
import { OrderCutoffView } from '../storefront-landing.types';

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

/**
 * Section 7: "Đơn hàng ngày mai".
 *
 * The daily order deadline, turned into a reason to order now. This is the only
 * urgency device on the page, and it is the one that happens to be true: the
 * cut-off is a real operational constraint the system already enforces.
 *
 * Everything the page could have faked here is absent by design. No invented
 * recent buyers, no invented viewer counts, no invented scarcity. And when the
 * ordering window cannot be read, the section shows **no time at all** rather
 * than falling back to a default. A wrong deadline is worse than no deadline on
 * the one section whose job is telling the buyer when to order.
 */
@Component({
    selector: 'order-cutoff',
    templateUrl: './order-cutoff.component.html',
    styleUrls: ['./order-cutoff.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [MatIconModule, RouterLink, TranslocoModule],
})
export class OrderCutoffComponent {
    private _orders = inject(OrdersService);
    private _destroyRef = inject(DestroyRef);

    readonly view = signal<OrderCutoffView>({
        known: false,
        isOpen: true,
        cutoffLabel: '',
        remainingMs: 0,
        deliveryWindowDays: 1,
    });

    readonly hours = computed(() =>
        pad(Math.floor(this.view().remainingMs / HOUR_MS))
    );
    readonly minutes = computed(() =>
        pad(Math.floor((this.view().remainingMs % HOUR_MS) / MINUTE_MS))
    );
    readonly seconds = computed(() =>
        pad(Math.floor((this.view().remainingMs % MINUTE_MS) / 1000))
    );

    /** True only when there is a real deadline still ahead of us. */
    readonly showCountdown = computed(
        () => this.view().known && this.view().isOpen
    );

    private _timer: ReturnType<typeof setInterval> | null = null;
    private _cutoffAt: Date | null = null;

    constructor() {
        void this._load();
        this._destroyRef.onDestroy(() => this._stopTimer());
    }

    private async _load(): Promise<void> {
        // Not named `window`: that would shadow the global inside this method,
        // which `matchMedia` below reads.
        let orderWindow;
        try {
            orderWindow = await this._orders.getOrderingWindow();
        } catch {
            // Leave `known: false`. The band still renders its message and CTA,
            // just without a time it cannot vouch for.
            return;
        }

        const cutoffAt = parseCutoff(orderWindow.cutoffTime);
        this.view.update((current) => ({
            ...current,
            known: !!cutoffAt,
            isOpen:
                orderWindow.isOpen &&
                !!cutoffAt &&
                cutoffAt.getTime() > Date.now(),
            cutoffLabel: formatCutoff(orderWindow.cutoffTime),
            deliveryWindowDays:
                orderWindow.deliveryWindowDays &&
                orderWindow.deliveryWindowDays > 0
                    ? orderWindow.deliveryWindowDays
                    : 1,
        }));

        if (!cutoffAt) {
            return;
        }
        this._cutoffAt = cutoffAt;
        this._tick();

        // Under reduced motion the remaining time is shown once, statically. A
        // digit changing every second is motion, and this is the page's most
        // insistent element.
        const reduced = globalThis.matchMedia?.(
            '(prefers-reduced-motion: reduce)'
        ).matches;
        if (!reduced) {
            this._timer = setInterval(() => this._tick(), 1000);
        }
    }

    private _tick(): void {
        if (!this._cutoffAt) {
            return;
        }
        const remaining = this._cutoffAt.getTime() - Date.now();
        if (remaining <= 0) {
            this._stopTimer();
            this.view.update((current) => ({
                ...current,
                isOpen: false,
                remainingMs: 0,
            }));
            return;
        }
        this.view.update((current) => ({ ...current, remainingMs: remaining }));
    }

    private _stopTimer(): void {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
    }
}

function pad(value: number): string {
    return value < 10 ? `0${value}` : `${value}`;
}

/**
 * `HH:mm[:ss]` from the server, resolved against today in the **browser's**
 * zone.
 *
 * The cut-off is a wall-clock time in `Asia/Ho_Chi_Minh`, which is where every
 * buyer of this product is, so this reads correctly for them. A buyer browsing
 * from another zone would see the countdown offset by that difference. Fixing
 * it properly needs the server to send a zoned instant rather than a bare time;
 * recorded in the plan's Gap Register rather than papered over with a
 * hardcoded +07:00.
 */
function parseCutoff(cutoffTime: string | null): Date | null {
    if (!cutoffTime) {
        return null;
    }
    const match = /^(\d{1,2}):(\d{2})/.exec(cutoffTime);
    if (!match) {
        return null;
    }
    const at = new Date();
    at.setHours(Number(match[1]), Number(match[2]), 0, 0);
    return at;
}

function formatCutoff(cutoffTime: string | null): string {
    if (!cutoffTime) {
        return '';
    }
    const match = /^(\d{1,2}):(\d{2})/.exec(cutoffTime);
    return match ? `${pad(Number(match[1]))}:${match[2]}` : '';
}
