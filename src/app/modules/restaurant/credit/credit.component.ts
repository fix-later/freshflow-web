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
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { apiErrorMessage } from 'app/core/api/envelope';
import { RestaurantCreditService } from './restaurant-credit.service';
import {
    CreditStatement,
    CreditTransaction,
    RestaurantCreditBalance,
} from './restaurant-credit.types';

/** "Công nợ" — the signed-in restaurant's own credit balance and history. */
@Component({
    selector: 'restaurant-credit',
    templateUrl: './credit.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatButtonModule,
        MatIconModule,
        MatProgressBarModule,
        MatSnackBarModule,
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
    readonly loadError = signal(false);
    readonly downloadingId = signal<string | null>(null);

    private _transactionsCursor: string | undefined;
    private _statementsCursor: string | undefined;
    readonly hasMoreTransactions = signal(false);
    readonly hasMoreStatements = signal(false);

    ngOnInit(): void {
        this.loading.set(true);
        this.loadError.set(false);
        Promise.all([
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
            .catch(() => this.loadError.set(true))
            .finally(() => this.loading.set(false));
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
            .catch(() => this.hasMoreTransactions.set(false));
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
            .catch(() => this.hasMoreStatements.set(false));
    }

    downloadStatement(statement: CreditStatement): void {
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
                const message =
                    (await apiErrorMessage(err)) ??
                    this._transloco.translate('restaurantCredit.downloadError');
                this._snackBar.open(message, undefined, { duration: 6000 });
            })
            .finally(() => this.downloadingId.set(null));
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
}
