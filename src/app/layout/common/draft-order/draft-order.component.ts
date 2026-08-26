import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    ViewEncapsulation,
    effect,
    inject,
    signal,
    untracked,
} from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule } from '@jsverse/transloco';
import { DraftOrderService } from 'app/layout/common/draft-order/draft-order.service';

/** How long the icon holds its "added" state. Matches the CSS animation. */
const BUMP_MS = 520;

/**
 * Header trigger for the draft-order drawer. The drawer panel itself
 * (`<draft-order-drawer>`) renders at the layout root, decoupled from the
 * header so the header's pin/slide animation can't reposition it; both share
 * open-state through DraftOrderService.
 */
@Component({
    selector: 'draft-order',
    templateUrl: './draft-order.component.html',
    styleUrls: ['../header-icon-motion.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    exportAs: 'draftOrder',
    standalone: true,
    imports: [MatBadgeModule, MatIconModule, MatTooltipModule, TranslocoModule],
})
export class DraftOrderComponent {
    protected readonly draftOrderService = inject(DraftOrderService);
    private readonly _destroyRef = inject(DestroyRef);

    readonly count = this.draftOrderService.productCount;

    /**
     * Set for one beat whenever the cart gains a line, so the icon can answer
     * the press.
     *
     * Adding from a tile happens far from the header — the button is in the
     * grid, the cart is in the corner — and without a reply there is nothing to
     * say the press landed except a number quietly changing size. Only growth
     * counts: removing something needs no celebration.
     */
    readonly justAdded = signal(false);

    private _lastCount = this.count();
    private _bumpTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        effect(() => {
            const next = this.count();
            const grew = next > this._lastCount;
            this._lastCount = next;
            if (!grew) {
                return;
            }
            untracked(() => {
                this.justAdded.set(true);
                if (this._bumpTimer) {
                    clearTimeout(this._bumpTimer);
                }
                this._bumpTimer = setTimeout(
                    () => this.justAdded.set(false),
                    BUMP_MS
                );
            });
        });

        this._destroyRef.onDestroy(() => {
            if (this._bumpTimer) {
                clearTimeout(this._bumpTimer);
            }
        });
    }
}
