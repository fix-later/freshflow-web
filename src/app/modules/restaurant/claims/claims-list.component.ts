import { DecimalPipe } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    inject,
    OnInit,
    signal,
    ViewEncapsulation,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import {
    ClaimRow,
    claimStatusPillClass,
    normalizeClaimStatus,
} from 'app/modules/orders/claims.types';
import { RestaurantClaimsService } from './restaurant-claims.service';

/**
 * "Khiếu nại" — every claim this restaurant has filed, and where each one got
 * to. Filing happens on the order it is about (see `order-detail`), so this
 * screen only reads: a claim is decided by admin/ops, and there is nothing the
 * filer can do to it afterwards.
 */
@Component({
    selector: 'restaurant-claims-list',
    templateUrl: './claims-list.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        DecimalPipe,
        MatButtonModule,
        MatIconModule,
        MatProgressBarModule,
        RouterLink,
        TranslocoModule,
    ],
})
export class ClaimsListComponent implements OnInit {
    private readonly _service = inject(RestaurantClaimsService);
    private readonly _transloco = inject(TranslocoService);

    readonly statusPillClass = claimStatusPillClass;

    readonly rows = signal<ClaimRow[]>([]);
    readonly loading = signal(false);
    /** Localized reason the read failed (403, 5xx, offline). */
    readonly loadError = signal<string | null>(null);
    /** Set while more pages remain; cursor paging, not page numbers. */
    readonly nextCursor = signal<string | null>(null);

    ngOnInit(): void {
        this.load();
    }

    /** First page. Also the retry action on the error state. */
    load(): void {
        this.rows.set([]);
        this.nextCursor.set(null);
        void this._fetch(null);
    }

    /** Appends the next cursor page to what is already listed. */
    loadMore(): void {
        const cursor = this.nextCursor();
        if (cursor) {
            void this._fetch(cursor);
        }
    }

    /** i18n key for a status pill, falling back to the raw value's slot. */
    statusKey(status: string | null | undefined): string {
        return `claims.status.${normalizeClaimStatus(status) ?? 'unknown'}`;
    }

    private async _fetch(cursor: string | null): Promise<void> {
        this.loading.set(true);
        this.loadError.set(null);
        try {
            const page = await this._service.listMyClaims(cursor);
            this.rows.update((rows) =>
                cursor ? [...rows, ...page.claims] : page.claims
            );
            this.nextCursor.set(page.nextCursor ?? null);
        } catch (err) {
            this.loadError.set(
                await describeApiError(
                    err,
                    (key) => this._transloco.translate(key),
                    'claims.loadError'
                )
            );
        } finally {
            this.loading.set(false);
        }
    }
}
