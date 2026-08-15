import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    NgZone,
    OnDestroy,
    TemplateRef,
    ViewChild,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule } from '@jsverse/transloco';
import {
    Market,
    MarketSelectionService,
} from 'app/core/market/market-selection.service';
import { whenSplashHidden } from 'app/core/splash/wait-for-splash';

/**
 * Header market picker — the storefront's entry decision.
 *
 * Shopping is scoped to one market (see `MarketSelectionService`), so this is
 * the first thing a buyer chooses: the dialog opens by itself on first visit and
 * the catalog stays empty until a market is picked. Afterwards the button shows
 * the active market and reopens the dialog for switching.
 *
 * It replaces the delivery-address ("Địa chỉ nhà hàng") picker that used to sit
 * here — the address belongs to checkout, not to browsing.
 */
@Component({
    selector: 'market-picker',
    templateUrl: './market-picker.component.html',
    styleUrl: './market-picker.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: {
        class: 'inline-flex items-center',
    },
    imports: [
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        TranslocoModule,
    ],
})
export class MarketPickerComponent implements AfterViewInit, OnDestroy {
    @ViewChild('marketPickerPanel') private _panel: TemplateRef<unknown>;

    private _dialog = inject(MatDialog);
    private _ngZone = inject(NgZone);
    private _marketSelection = inject(MarketSelectionService);
    private _dialogRef: MatDialogRef<unknown> | null = null;

    readonly markets = this._marketSelection.markets;
    readonly selected = this._marketSelection.selected;
    readonly loading = this._marketSelection.loading;

    ngAfterViewInit(): void {
        void this._marketSelection.ensureLoaded().then(() => {
            if (this._marketSelection.hasSelection()) {
                return;
            }
            // Wait for the splash to clear so the dialog never opens underneath
            // it. `whenSplashHidden` resolves from a MutationObserver outside
            // Angular, hence the explicit zone re-entry.
            void whenSplashHidden().then(() =>
                this._ngZone.run(() => this.openPanel())
            );
        });
    }

    ngOnDestroy(): void {
        this._dialogRef?.close();
    }

    /** Two-letter monogram from the first and last word of the name. */
    initials(name: string): string {
        const parts = name.split(/[_\s]+/).filter(Boolean);
        const first = parts[0]?.charAt(0) ?? '';
        const last = parts.length > 1 ? parts.at(-1)?.charAt(0) ?? '' : '';
        return (first + last).toUpperCase();
    }

    openPanel(): void {
        if (!this._panel || this._dialogRef) {
            return;
        }
        void this._marketSelection.ensureLoaded();
        this._dialogRef = this._dialog.open(this._panel, {
            // Three cards across at `lg`, so the dialog has to be wide enough
            // to hold them without squeezing each below readable width.
            width: '64rem',
            maxWidth: 'calc(100vw - 2rem)',
            // There is no input to land on any more; the first card is what a
            // keyboard user wants under the cursor.
            autoFocus: 'first-tabbable',
        });
        this._dialogRef.afterClosed().subscribe(() => {
            this._dialogRef = null;
        });
    }

    closePanel(): void {
        this._dialogRef?.close();
    }

    select(market: Market): void {
        this._marketSelection.select(market);
        this.closePanel();
    }

    /** Retry after a failed market load. */
    reload(): void {
        void this._marketSelection.reload();
    }
}
