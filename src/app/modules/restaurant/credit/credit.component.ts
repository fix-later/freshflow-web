import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
    inject,
    signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
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
import { openStatementSheet } from './statement-sheet/statement-sheet.component';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/** A statement closes a month that has ended, so the default is the last one. */
const PREVIOUS_MONTH = ((): { year: number; month: number } => {
    const now = new Date();
    const month = now.getMonth(); // 0-based: last month's 1-based number.
    return month === 0
        ? { year: now.getFullYear() - 1, month: 12 }
        : { year: now.getFullYear(), month };
})();

const YEARS = [
    PREVIOUS_MONTH.year,
    PREVIOUS_MONTH.year - 1,
    PREVIOUS_MONTH.year - 2,
];

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
        MatFormFieldModule,
        MatSelectModule,
        ReactiveFormsModule,
        MatIconModule,
        MatProgressBarModule,
        MatSnackBarModule,
        MatTooltipModule,
        TranslocoModule,
    ],
})
export class CreditComponent implements OnInit {
    private readonly _service = inject(RestaurantCreditService);
    private readonly _dialog = inject(MatDialog);
    private readonly _fb = inject(FormBuilder);
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

    private _transactionsCursor: string | undefined;
    private _statementsCursor: string | undefined;
    readonly hasMoreTransactions = signal(false);
    readonly hasMoreStatements = signal(false);

    /** The month a new statement would be asked for; last month by default. */
    readonly generateForm = this._fb.nonNullable.group({
        month: [PREVIOUS_MONTH.month],
        year: [PREVIOUS_MONTH.year],
    });
    readonly generating = signal(false);
    readonly generateError = signal<string | null>(null);

    readonly monthOptions = MONTHS;
    /** This year and the two before it — nothing older is billed here. */
    readonly yearOptions = YEARS;

    ngOnInit(): void {
        void this.reload();
    }

    /**
     * Closes one billing month into a statement and opens it.
     *
     * The endpoint has always been open to the restaurant that owns the
     * account ("Admin or the owning restaurant"), but the page only ever listed
     * what somebody else had generated — so a restaurant that needed last
     * month's statement had to ask for it. Idempotent on the server: pressing
     * this twice for the same month opens the statement that already exists
     * rather than making a second one.
     */
    async generateStatement(): Promise<void> {
        if (this.generating()) {
            return;
        }
        const { month, year } = this.generateForm.getRawValue();
        this.generating.set(true);
        this.generateError.set(null);
        try {
            const statement = await this._service.generateStatement(
                year,
                month
            );
            await this.reload();
            if (statement) {
                openStatementSheet(this._dialog, statement.id, statement);
            }
        } catch (err) {
            this.generateError.set(
                await this._describe(
                    err,
                    'restaurantCredit.statements.generateError'
                )
            );
        } finally {
            this.generating.set(false);
        }
    }

    /** Opens one statement as the document it is. */
    openStatement(statement: CreditStatement): void {
        openStatementSheet(this._dialog, statement.id, statement);
    }

    /**
     * The period the statement closed, e.g. "01/08/2026 — 31/08/2026".
     *
     * Read from `periodStart`/`periodEnd`, which is what the backend sends.
     * This row used to print `month`/`year` — fields no statement has ever
     * carried — so every row read as a bare "/".
     */
    statementPeriod(statement: CreditStatement): string {
        const start = this.formatDay(statement.periodStart);
        const end = this.formatDay(statement.periodEnd);
        if (start === '—' && end === '—') {
            return this.formatDay(statement.generatedAt);
        }
        return start === end ? start : `${start} — ${end}`;
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
