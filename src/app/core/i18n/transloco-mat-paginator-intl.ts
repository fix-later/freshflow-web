import { Injectable, inject } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslocoService } from '@jsverse/transloco';

/**
 * `MatPaginatorIntl` ships English-only labels with no i18n hook, so every
 * paginator in the app ("Items per page:", "1 – 8 of 8" …) stayed English
 * even though the rest of the UI is Transloco-driven. This mirrors that
 * content through Transloco and re-renders on language change.
 */
@Injectable({ providedIn: 'root' })
export class TranslocoMatPaginatorIntl extends MatPaginatorIntl {
    private readonly _transloco = inject(TranslocoService);

    constructor() {
        super();
        this._translateLabels();
        this._transloco.langChanges$.subscribe(() => this._translateLabels());
    }

    override getRangeLabel = (
        page: number,
        pageSize: number,
        length: number
    ): string => {
        if (length === 0 || pageSize === 0) {
            return this._transloco.translate('paginator.rangeEmpty', {
                length,
            });
        }
        const start = page * pageSize + 1;
        const end = Math.min(start + pageSize - 1, length);
        return this._transloco.translate('paginator.range', {
            start,
            end,
            length,
        });
    };

    private _translateLabels(): void {
        this.itemsPerPageLabel = this._transloco.translate(
            'paginator.itemsPerPage'
        );
        this.nextPageLabel = this._transloco.translate('paginator.nextPage');
        this.previousPageLabel = this._transloco.translate(
            'paginator.previousPage'
        );
        this.firstPageLabel = this._transloco.translate('paginator.firstPage');
        this.lastPageLabel = this._transloco.translate('paginator.lastPage');
        this.changes.next();
    }
}
