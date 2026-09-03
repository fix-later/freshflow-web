import {
    ChangeDetectionStrategy,
    Component,
    inject,
    signal,
    ViewEncapsulation,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
    MAT_DIALOG_DATA,
    MatDialog,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { ApiLabelPipe } from 'app/core/i18n/api-label.pipe';
import { translateCreditNote } from 'app/core/i18n/credit-note';
import { RestaurantProfileService } from 'app/modules/restaurant/restaurant-profile.service';
import { RestaurantCreditService } from '../restaurant-credit.service';
import {
    CreditStatement,
    CreditStatementLine,
} from '../restaurant-credit.types';

export interface StatementSheetData {
    statementId: string;
    /** The list row, so the sheet has figures to show while the detail loads. */
    row?: CreditStatement | null;
}

/**
 * One month of credit, as a statement.
 *
 * Laid out after the modern printable invoice in the Fuse pages: who it is
 * from and who it is for at the top, the period and the closing balance
 * opposite them, then every movement of the month and the ladder that gets
 * from the opening balance to the closing one.
 *
 * A dialog: a statement is read, checked against the restaurant's own books,
 * and closed. The PDF is the copy that gets filed.
 */
@Component({
    selector: 'statement-sheet',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    templateUrl: './statement-sheet.component.html',
    styleUrl: './statement-sheet.component.scss',
    imports: [
        ApiLabelPipe,
        MatButtonModule,
        MatDialogModule,
        MatIconModule,
        MatProgressBarModule,
        TranslocoModule,
    ],
})
export class StatementSheetComponent {
    private readonly _service = inject(RestaurantCreditService);
    private readonly _profile = inject(RestaurantProfileService);
    private readonly _transloco = inject(TranslocoService);
    private readonly _data = inject<StatementSheetData>(MAT_DIALOG_DATA);
    readonly dialogRef = inject(MatDialogRef<StatementSheetComponent>);

    readonly statement = signal<CreditStatement | null>(this._data.row ?? null);
    readonly loading = signal(true);
    readonly loadError = signal<string | null>(null);
    readonly downloading = signal(false);
    readonly downloadError = signal<string | null>(null);

    /** Who the statement is for — the restaurant's own saved profile. */
    readonly restaurant = this._profile.profile;

    constructor() {
        this._service
            .getStatement(this._data.statementId)
            .then((statement) => {
                if (statement) {
                    this.statement.set(statement);
                }
            })
            .catch(async (err) =>
                this.loadError.set(
                    await describeApiError(
                        err,
                        (key) => this._transloco.translate(key),
                        'restaurantCredit.statements.loadError'
                    )
                )
            )
            .finally(() => this.loading.set(false));
    }

    /**
     * The month's movements, oldest first.
     *
     * The backend hands them back in no particular order, and a statement whose
     * rows jump between the 4th and the 20th cannot be checked against
     * anything — least of all its own running balance, which only makes sense
     * read downwards.
     */
    lines(statement: CreditStatement | null): CreditStatementLine[] {
        const lines = Array.isArray(statement?.lines) ? statement.lines : [];
        return [...lines].sort(
            (left, right) =>
                Date.parse(String(left.occurredAt ?? '')) -
                Date.parse(String(right.occurredAt ?? ''))
        );
    }

    money(value: number | null | undefined): string {
        return `${Number(value ?? 0).toLocaleString(
            this._transloco.getActiveLang()
        )} ₫`;
    }

    date(value: string | null | undefined, withTime = false): string {
        if (!value) {
            return '—';
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return String(value);
        }
        const lang = this._transloco.getActiveLang();
        return withTime
            ? date.toLocaleString(lang)
            : date.toLocaleDateString(lang);
    }

    /** "01/08/2026 — 31/08/2026", the range the statement actually closed. */
    period(statement: CreditStatement): string {
        const start = this.date(statement.periodStart);
        const end = this.date(statement.periodEnd);
        return start === end ? start : `${start} — ${end}`;
    }

    text(value: unknown): string {
        const text = String(value ?? '').trim();
        return text === '' ? '—' : text;
    }

    /**
     * What a movement was, in the reader's own language.
     *
     * The backend writes some of these itself — "Order confirmed", "Order
     * cancelled" — and they reached this column in English, in the middle of an
     * otherwise Vietnamese statement. The ledger on the credit page already
     * goes through this; the statement had been reading the raw note.
     */
    lineNote(line: CreditStatementLine): string {
        const note = translateCreditNote(
            String(line.note ?? line.reference ?? ''),
            (key, params) => this._transloco.translate(key, params)
        );
        return note.trim() === '' ? '—' : note;
    }

    downloadPdf(): void {
        const statement = this.statement();
        if (!statement || this.downloading()) {
            return;
        }
        this.downloading.set(true);
        this.downloadError.set(null);
        this._service
            .downloadStatementPdf(statement.id)
            .then((blob) => {
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = `statement-${statement.id}.pdf`;
                anchor.click();
                URL.revokeObjectURL(url);
            })
            .catch(async (err) =>
                this.downloadError.set(
                    await describeApiError(
                        err,
                        (key) => this._transloco.translate(key),
                        'restaurantCredit.statements.downloadError'
                    )
                )
            )
            .finally(() => this.downloading.set(false));
    }
}

/** Opens one statement over the credit page. */
export function openStatementSheet(
    dialog: MatDialog,
    statementId: string,
    row?: CreditStatement | null
): MatDialogRef<StatementSheetComponent> {
    return dialog.open<StatementSheetComponent, StatementSheetData>(
        StatementSheetComponent,
        {
            data: { statementId, row },
            panelClass: 'statement-sheet-dialog',
            width: '58rem',
            maxWidth: '96vw',
            autoFocus: false,
        }
    );
}
