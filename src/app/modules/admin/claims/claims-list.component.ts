import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    TemplateRef,
    ViewEncapsulation,
    computed,
    inject,
    input,
    signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
    MatDialog,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { claimStatusPillClass } from 'app/modules/orders/claims.types';
import { normalizeOrderStatus } from 'app/modules/orders/orders.types';
import type { AdminOrderItem } from '../admin.types';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';
import { newestActiveFirst } from '../shared/row-order';
import { ClaimsService } from './claims.service';
import {
    AdminClaimParty,
    AdminClaimRow,
    CLAIM_DECIDABLE_STATUS,
    CLAIM_DECISION_NOTE_MAX_LENGTH,
    CLAIM_STATUSES,
    ClaimStatus,
} from './claims.types';

/** Which way a review dialog is about to go. */
type ClaimDecision = 'approve' | 'reject';

/**
 * Re-exported so this file's existing importers keep working; the colours are
 * the shared ones, since the restaurant reads its claim's status from the same
 * lifecycle and a claim that is amber here must not be grey there.
 */
export { claimStatusPillClass };

/**
 * Admin ▸ Dashboard ▸ Khiếu nại — the review queue for restaurants' shortage /
 * damage claims (`/api/v1/claims`, decisions are `admin,operations_manager`).
 *
 * A queue, not a dashboard: how many are waiting and what they are worth is
 * reported on the Báo cáo sự cố tab, beside the shortages the claims are filed
 * over. What is left here is the work — filter, inspect, decide.
 *
 * Approving refunds the claimed amount against the restaurant's B2B credit, so
 * a decision is final and is treated as one: the note is mandatory on a
 * rejection (the restaurant is told why), and both buttons only appear while
 * the claim is still `submitted` — the one state the backend accepts a
 * decision from.
 */
@Component({
    selector: 'admin-claims-list',
    templateUrl: './claims-list.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        AdminLoadingStateComponent,
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        MatSelectModule,
        MatSnackBarModule,
        MatTooltipModule,
        ReactiveFormsModule,
        TranslocoModule,
    ],
    styles: [
        `
            .claims-grid {
                grid-template-columns:
                    minmax(0, 1fr) minmax(0, 0.9fr) minmax(0, 0.7fr)
                    minmax(0, 1.2fr) minmax(0, 0.9fr) 13.5rem;
            }
        `,
    ],
})
export class ClaimsListComponent implements OnInit {
    private readonly _claims = inject(ClaimsService);
    private readonly _dialog = inject(MatDialog);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);

    private _dialogRef: MatDialogRef<unknown> | null = null;
    /** Kept apart from `_dialogRef`: the detail can open the review on top. */
    private _detailRef: MatDialogRef<unknown> | null = null;

    /**
     * True when the dashboard's tab bar already names this section — the queue
     * then drops its own page title and its full-viewport positioning, and
     * scrolls with the dashboard instead of inside itself.
     */
    readonly embedded = input(false);

    readonly statusPillClass = claimStatusPillClass;
    readonly statusOptions = CLAIM_STATUSES;
    readonly noteMaxLength = CLAIM_DECISION_NOTE_MAX_LENGTH;

    readonly claims = signal<AdminClaimRow[]>([]);
    readonly loading = signal(false);
    readonly loadingMore = signal(false);
    readonly nextCursor = signal<string | undefined>(undefined);
    readonly loadError = signal<string | null>(null);
    readonly restaurantOptions = signal<AdminClaimParty[]>([]);

    readonly restaurantId = new FormControl('', { nonNullable: true });
    readonly status = new FormControl<ClaimStatus | ''>('', {
        nonNullable: true,
    });

    /** The claim being inspected, re-read from the server. */
    readonly viewing = signal<AdminClaimRow | null>(null);
    readonly viewingId = signal<string | null>(null);
    readonly viewLoading = signal(false);
    readonly viewError = signal<string | null>(null);

    /** The claim under review, and which way. */
    readonly reviewing = signal<AdminClaimRow | null>(null);
    readonly decision = signal<ClaimDecision>('approve');
    readonly deciding = signal(false);
    readonly decisionNote = new FormControl('', { nonNullable: true });

    /**
     * Localized reason the last decision was refused, shown inside the dialog
     * so it sits next to the note the operator may need to change — a toast
     * over a modal is easy to miss entirely.
     */
    readonly decisionError = signal<string | null>(null);

    /** `NotEmpty` on reject only; approve tolerates a blank note. */
    readonly noteRequired = computed(() => this.decision() === 'reject');

    /**
     * The client-side verdict on the note, as an i18n key — mirroring
     * `RejectClaimCommandValidator` (`NotEmpty` + `MaximumLength(1000)`) and
     * `ApproveClaimCommandValidator` (`MaximumLength(1000)`).
     *
     * A method, not a `computed`: it reads the form control's value, which is
     * not a signal, so a computed would never recompute as the note is typed.
     */
    noteErrorKey(): string | null {
        const note = this.decisionNote.value.trim();
        if (this.noteRequired() && !note) {
            return 'admin.claims.review.noteRequired';
        }
        if (note.length > CLAIM_DECISION_NOTE_MAX_LENGTH) {
            return 'admin.claims.review.noteTooLong';
        }
        return null;
    }

    canSubmitDecision(): boolean {
        return !this.deciding() && this.noteErrorKey() === null;
    }

    ngOnInit(): void {
        this._claims
            .listRestaurants()
            .then((restaurants) => this.restaurantOptions.set(restaurants))
            .catch(() => this.restaurantOptions.set([]));
        this._load();
        this.restaurantId.valueChanges.subscribe(() => this._load());
        this.status.valueChanges.subscribe(() => this._load());
    }

    /** Only a `submitted` claim can still be decided (BE: 409 otherwise). */
    canDecide(row: AdminClaimRow): boolean {
        return (
            String(row.status ?? '').toLowerCase() === CLAIM_DECIDABLE_STATUS
        );
    }

    /**
     * Opens the detail for a claim and re-reads it by id.
     *
     * The row is shown immediately (so the panel is never blank) and replaced by
     * the server's copy when it arrives — a claim another operator decided in
     * the meantime therefore loses its decision buttons here rather than
     * failing with `CLAIM_INVALID_TRANSITION` after the operator commits.
     */
    openDetail(
        row: AdminClaimRow | null,
        claimId: string,
        template: TemplateRef<unknown>
    ): void {
        const id = claimId.trim();
        if (!id || this._detailRef) {
            return;
        }
        this.viewing.set(row);
        this.viewingId.set(id);
        this.viewError.set(null);
        this._detailRef = this._dialog.open(template, {
            autoFocus: 'first-tabbable',
            maxWidth: '95vw',
        });
        this._detailRef.afterClosed().subscribe(() => {
            this._detailRef = null;
            this.viewing.set(null);
            this.viewingId.set(null);
        });
        this._refreshDetail(id);
    }

    closeDetail(): void {
        this._detailRef?.close();
    }

    /** Re-reads the open claim; also the retry for a failed detail read. */
    reloadDetail(): void {
        const id = this.viewingId();
        if (id) {
            this._refreshDetail(id);
        }
    }

    private _refreshDetail(claimId: string): void {
        this.viewLoading.set(true);
        this.viewError.set(null);
        this._claims
            .getClaim(claimId)
            .then((claim) => {
                if (this.viewingId() !== claimId) {
                    return; // The dialog moved on (or closed) while in flight.
                }
                this.viewing.set(claim);
                if (!claim) {
                    this.viewError.set(
                        this._transloco.translate('admin.claims.detail.missing')
                    );
                    return;
                }
                // The queue row is a snapshot; the fresh copy wins where both
                // exist, so a decision made elsewhere shows up in the list too.
                this.claims.update((rows) =>
                    rows.map((row) => (row.id === claim.id ? claim : row))
                );
            })
            .catch(async (err) => {
                if (this.viewingId() !== claimId) {
                    return;
                }
                this.viewError.set(
                    await describeApiError(
                        err,
                        (key) => this._transloco.translate(key),
                        'admin.claims.detail.loadError'
                    )
                );
            })
            .finally(() => this.viewLoading.set(false));
    }

    openReview(
        row: AdminClaimRow,
        decision: ClaimDecision,
        template: TemplateRef<unknown>
    ): void {
        if (!this.canDecide(row) || this._dialogRef) {
            return;
        }
        this.reviewing.set(row);
        this.decision.set(decision);
        this.decisionError.set(null);
        this.decisionNote.reset('');
        this._dialogRef = this._dialog.open(template, {
            autoFocus: 'first-tabbable',
            maxWidth: '95vw',
        });
        this._dialogRef.afterClosed().subscribe(() => {
            this._dialogRef = null;
            this.reviewing.set(null);
        });
    }

    closeReview(): void {
        this._dialogRef?.close();
    }

    submitDecision(): void {
        const row = this.reviewing();
        if (!row || !this.canSubmitDecision()) {
            this.decisionNote.markAsTouched();
            return;
        }
        const note = this.decisionNote.value.trim();
        const isApprove = this.decision() === 'approve';
        this.decisionError.set(null);
        this.deciding.set(true);

        const call = isApprove
            ? this._claims.approveClaim(row.id, note || undefined)
            : this._claims.rejectClaim(row.id, note);

        call.then((updated) => {
            this._notify(
                isApprove
                    ? 'admin.claims.review.approveSuccess'
                    : 'admin.claims.review.rejectSuccess'
            );
            this.closeReview();
            // A decision is terminal, so the detail behind the review dialog is
            // now stale in the one way that matters (its buttons).
            this.closeDetail();
            // Patch the decided row in place from the response when the server
            // sent one, so the queue reflects the decision without a refetch;
            // otherwise reload rather than guess the new state.
            if (updated) {
                this.claims.update((rows) =>
                    rows.map((r) => (r.id === updated.id ? updated : r))
                );
            } else {
                this._load();
            }
        })
            .catch(async (err) => {
                this.decisionError.set(
                    await describeApiError(
                        err,
                        (key) => this._transloco.translate(key),
                        isApprove
                            ? 'admin.claims.review.approveError'
                            : 'admin.claims.review.rejectError'
                    )
                );
            })
            .finally(() => this.deciding.set(false));
    }

    loadMore(): void {
        const cursor = this.nextCursor();
        if (!cursor || this.loadingMore()) {
            return;
        }
        this.loadingMore.set(true);
        this._claims
            .listClaims({
                restaurantId: this.restaurantId.value.trim() || undefined,
                status: this.status.value || undefined,
                cursor,
            })
            .then((page) => {
                this.claims.update((rows) => [...rows, ...page.claims]);
                this.nextCursor.set(page.nextCursor);
            })
            .catch(() => this.nextCursor.set(undefined))
            .finally(() => this.loadingMore.set(false));
    }

    reload(): void {
        this._load();
    }

    trackById(index: number, row: AdminClaimRow): string {
        return row.id || String(index);
    }

    statusLabel(status: string | null | undefined): string {
        const token = String(status ?? '')
            .trim()
            .toLowerCase();
        if (!token) {
            return '—';
        }
        const key = `admin.claims.status.${token}`;
        const translated = this._transloco.translate(key);
        return translated === key ? token : translated;
    }

    money(value: unknown): string {
        if (value === null || value === undefined || value === '') {
            return '—';
        }
        const amount = Number(value);
        return Number.isNaN(amount)
            ? String(value)
            : `${amount.toLocaleString(this._transloco.getActiveLang())} ₫`;
    }

    restaurantName(row: AdminClaimRow): string {
        return (
            row.restaurant?.name ||
            row.orderDetail?.restaurantName ||
            this._transloco.translate('admin.claims.restaurant.unavailable')
        );
    }

    restaurantContact(row: AdminClaimRow): string {
        return [row.restaurant?.email, row.restaurant?.phone]
            .filter((value): value is string => !!value)
            .join(' · ');
    }

    partyLabel(party: AdminClaimParty | null | undefined): string {
        if (!party) {
            return '—';
        }
        return party.email && party.email !== party.name
            ? `${party.name} · ${party.email}`
            : party.name;
    }

    orderItems(row: AdminClaimRow): AdminOrderItem[] {
        return Array.isArray(row.orderDetail?.items)
            ? row.orderDetail.items
            : [];
    }

    orderSummary(row: AdminClaimRow): string {
        const items = this.orderItems(row);
        if (!items.length) {
            return this._transloco.translate('admin.claims.order.unavailable');
        }
        const visible = items.slice(0, 2).map((item) => {
            const quantity = item.actualQuantity ?? item.quantity;
            return `${item.productNameSnapshot || '—'}${
                quantity != null ? ` × ${quantity}` : ''
            }`;
        });
        const remaining = items.length - visible.length;
        return `${visible.join(', ')}${remaining > 0 ? ` (+${remaining})` : ''}`;
    }

    orderStatusLabel(status: string | null | undefined): string {
        const normalized = normalizeOrderStatus(status);
        if (!normalized) {
            return '—';
        }
        const key = `admin.orders.status.${normalized}`;
        const translated = this._transloco.translate(key);
        return translated === key ? normalized : translated;
    }

    formatDate(value: unknown): string {
        if (value === null || value === undefined || value === '') {
            return '—';
        }
        const date = new Date(String(value));
        return Number.isNaN(date.getTime())
            ? '—'
            : date.toLocaleString(this._transloco.getActiveLang());
    }

    private _load(): void {
        this.loading.set(true);
        this.loadError.set(null);
        this._claims
            .listClaims({
                restaurantId: this.restaurantId.value.trim() || undefined,
                status: this.status.value || undefined,
            })
            .then((page) => {
                this.claims.set(newestActiveFirst(page.claims));
                this.nextCursor.set(page.nextCursor);
            })
            .catch(async (err) => {
                this.claims.set([]);
                this.nextCursor.set(undefined);
                // An empty queue and a failed read look identical otherwise,
                // and "no claims" is the more dangerous of the two to believe.
                this.loadError.set(
                    await describeApiError(
                        err,
                        (key) => this._transloco.translate(key),
                        'admin.claims.loadError'
                    )
                );
            })
            .finally(() => this.loading.set(false));
    }

    private _notify(key: string): void {
        this._snackBar.open(this._transloco.translate(key), undefined, {
            duration: 3000,
        });
    }
}
