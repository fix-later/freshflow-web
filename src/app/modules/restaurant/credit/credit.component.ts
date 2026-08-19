import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
    inject,
    signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { ApiLabelPipe } from 'app/core/i18n/api-label.pipe';
import { translateCreditNote } from 'app/core/i18n/credit-note';
import { creditTypePillClass } from 'app/shared/status-pills';
import { RestaurantCreditService } from './restaurant-credit.service';
import {
    CreditStatement,
    CreditTransaction,
    RestaurantCreditBalance,
} from './restaurant-credit.types';

/**
 * "Công nợ" — the signed-in restaurant's own credit balance and ledger.
 *
 * The same ledger Admin ▸ Nhà hàng ▸ Công nợ shows, read through the
 * restaurant-scoped endpoints, and deliberately said the same way: a dated row
 * carrying a translated type pill, the amount, and the note behind it. What the
 * two screens must never do is describe one movement differently to the two
 * people arguing about it over the phone.
 */
@Component({
    selector: 'restaurant-credit',
    templateUrl: './credit.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        ApiLabelPipe,
        MatButtonModule,
        MatIconModule,
        MatProgressBarModule,
        MatSnackBarModule,
        MatTooltipModule,
        TranslocoModule,
    ],
})
export class CreditComponent implements OnInit {
    private readonly _service = inject(RestaurantCreditService);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);

    readonly balance = signal<RestaurantCreditBalance | null>(null);
    readonly transactions = signal<CreditTransaction[]>([]);
    readonly statements = signal<CreditStatement[]>([]);
    readonly loading = signal(false);
    /** Localized reason the read failed (403 not yours, 404, 5xx, offline). */
    readonly loadError = signal<string | null>(null);
    /** Localized reason the last paging/detail/download call failed. */
    readonly actionError = signal<string | null>(null);
    readonly downloadingId = signal<string | null>(null);

    private _transactionsCursor: string | undefined;
    private _statementsCursor: string | undefined;
    readonly hasMoreTransactions = signal(false);
    readonly hasMoreStatements = signal(false);

    /** Statement whose breakdown is expanded, and its fetched detail. */
    readonly expandedStatementId = signal<string | null>(null);
    readonly statementDetail = signal<CreditStatement | null>(null);
    readonly loadingStatement = signal(false);

    ngOnInit(): void {
        void this.reload();
    }

    /** (Re)loads balance + both ledgers; also the retry action on failure. */
    async reload(): Promise<void> {
        this.loading.set(true);
        this.loadError.set(null);
        this.actionError.set(null);
        this._transactionsCursor = undefined;
        this._statementsCursor = undefined;
        await Promise.all([
            this._service.getBalance(),
            this._service.listTransactions(),
            this._service.listStatements(),
        ])
            .then(([balance, tx, st]) => {
                this.balance.set(balance);
                this.transactions.set(tx.transactions);
                this._transactionsCursor = tx.nextCursor;
                this.hasMoreTransactions.set(!!tx.nextCursor);
                this.statements.set(st.statements);
                this._statementsCursor = st.nextCursor;
                this.hasMoreStatements.set(!!st.nextCursor);
            })
            .catch(async (err) => {
                this.balance.set(null);
                this.transactions.set([]);
                this.statements.set([]);
                this.loadError.set(
                    await this._describe(err, 'restaurantCredit.loadError')
                );
            })
            .finally(() => this.loading.set(false));
    }

    /**
     * Expands (or collapses) a statement's breakdown. The list rows carry only
     * summary figures, so the detail is fetched on first open and replaced on
     * each switch — one statement is expanded at a time.
     */
    toggleStatement(statement: CreditStatement): void {
        if (this.expandedStatementId() === statement.id) {
            this.expandedStatementId.set(null);
            this.statementDetail.set(null);
            return;
        }
        this.expandedStatementId.set(statement.id);
        this.statementDetail.set(null);
        this.loadingStatement.set(true);
        this._service
            .getStatement(statement.id)
            .then((detail) => {
                // Ignore a response for a statement the user already left.
                if (this.expandedStatementId() === statement.id) {
                    this.statementDetail.set(detail);
                }
            })
            .catch(async (err) => {
                this.statementDetail.set(null);
                this.actionError.set(
                    await this._describe(
                        err,
                        'restaurantCredit.statements.detailUnavailable'
                    )
                );
            })
            .finally(() => this.loadingStatement.set(false));
    }

    /**
     * The expanded statement, as the named figures a month is settled on.
     *
     * This used to print **every** scalar the endpoint returned, under labels
     * derived from the JSON field names — so a Vietnamese restaurant read
     * "Total charges", "Generated at" and its own `restaurantId` in English,
     * and any field the backend added appeared unannounced. The admin statement
     * says these six things; so does this.
     */
    statementEntries(): { label: string; value: string }[] {
        const detail = this.statementDetail();
        if (!detail) {
            return [];
        }
        const money = (value: unknown): string | null =>
            typeof value === 'number' ? this.formatAmount(value) : null;
        const rows: { label: string; value: string | null }[] = [
            {
                label: 'restaurantCredit.statements.openingBalance',
                value: money(detail.openingBalance),
            },
            {
                label: 'restaurantCredit.statements.charges',
                value: money(detail.totalCharges),
            },
            {
                label: 'restaurantCredit.statements.payments',
                value: money(detail.totalPayments),
            },
            {
                label: 'restaurantCredit.statements.refunds',
                value: money(detail['totalRefunds']),
            },
            {
                label: 'restaurantCredit.statements.closingBalance',
                value: money(detail.closingBalance),
            },
            {
                label: 'restaurantCredit.statements.dueDate',
                value:
                    typeof detail['dueDate'] === 'string'
                        ? this.formatDay(detail['dueDate'])
                        : null,
            },
        ];
        // A figure the statement does not carry is dropped rather than shown as
        // a dash: an absent refund line is not a refund of nothing.
        return rows
            .filter(
                (row): row is { label: string; value: string } =>
                    row.value !== null
            )
            .map((row) => ({
                label: this._transloco.translate(row.label),
                value: row.value,
            }));
    }

    readonly creditTypePillClass = creditTypePillClass;

    /**
     * What a ledger entry says beyond its type — the note, else the reference.
     * The backend writes some of these notes itself ("Order confirmed"), and a
     * restaurant should not be reading English out of its own ledger.
     */
    transactionNote(tx: CreditTransaction): string {
        return translateCreditNote(
            String(tx.description ?? tx['note'] ?? tx.reference ?? ''),
            (key, params) => this._transloco.translate(key, params)
        );
    }

    loadMoreTransactions(): void {
        if (!this._transactionsCursor) {
            return;
        }
        this._service
            .listTransactions(this._transactionsCursor)
            .then((res) => {
                this.transactions.update((items) => [
                    ...items,
                    ...res.transactions,
                ]);
                this._transactionsCursor = res.nextCursor;
                this.hasMoreTransactions.set(!!res.nextCursor);
            })
            .catch(async (err) => {
                // Stop offering "load more" on a page that cannot be fetched,
                // but say why rather than silently ending the list.
                this.hasMoreTransactions.set(false);
                this.actionError.set(
                    await this._describe(err, 'restaurantCredit.loadError')
                );
            });
    }

    loadMoreStatements(): void {
        if (!this._statementsCursor) {
            return;
        }
        this._service
            .listStatements(this._statementsCursor)
            .then((res) => {
                this.statements.update((items) => [
                    ...items,
                    ...res.statements,
                ]);
                this._statementsCursor = res.nextCursor;
                this.hasMoreStatements.set(!!res.nextCursor);
            })
            .catch(async (err) => {
                this.hasMoreStatements.set(false);
                this.actionError.set(
                    await this._describe(err, 'restaurantCredit.loadError')
                );
            });
    }

    downloadStatement(statement: CreditStatement): void {
        this.actionError.set(null);
        this.downloadingId.set(statement.id);
        this._service
            .downloadStatementPdf(statement.id)
            .then((blob) => {
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = `statement-${statement.year ?? ''}-${statement.month ?? ''}.pdf`;
                anchor.click();
                URL.revokeObjectURL(url);
            })
            .catch(async (err) => {
                const message = await this._describe(
                    err,
                    'restaurantCredit.downloadError'
                );
                this.actionError.set(message);
                this._snackBar.open(message, undefined, { duration: 6000 });
            })
            .finally(() => this.downloadingId.set(null));
    }

    /** Localizes any API rejection: field detail → code → status → network. */
    private _describe(err: unknown, fallbackKey: string): Promise<string> {
        return describeApiError(
            err,
            (key) => this._transloco.translate(key),
            fallbackKey
        );
    }

    formatAmount(value: number | null | undefined): string {
        if (value == null) {
            return '—';
        }
        return `${value.toLocaleString(this._transloco.getActiveLang())} ₫`;
    }

    formatDate(value: string | null | undefined): string {
        if (!value) {
            return '—';
        }
        const date = new Date(value);
        return Number.isNaN(date.getTime())
            ? '—'
            : date.toLocaleString(this._transloco.getActiveLang());
    }

    /**
     * The day alone, for a deadline. A payment due date is stored at midnight,
     * and printing it with a clock ("00:00:00 1/9/2026") reads as a time the
     * money is expected by rather than the day it is due.
     */
    formatDay(value: string | null | undefined): string {
        if (!value) {
            return '—';
        }
        const date = new Date(value);
        return Number.isNaN(date.getTime())
            ? '—'
            : date.toLocaleDateString(this._transloco.getActiveLang());
    }
}
