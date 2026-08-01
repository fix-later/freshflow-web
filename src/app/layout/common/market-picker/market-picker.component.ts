import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    NgZone,
    OnDestroy,
    TemplateRef,
    ViewChild,
    ViewEncapsulation,
    computed,
    inject,
    signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
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
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
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

    readonly search = signal('');
    readonly markets = this._marketSelection.markets;
    readonly selected = this._marketSelection.selected;
    readonly loading = this._marketSelection.loading;

    readonly filtered = computed(() => {
        const query = this.search().trim().toLowerCase();
        const markets = this.markets();
        if (!query) {
            return markets;
        }
        return markets.filter(
            (market) =>
                market.name.toLowerCase().includes(query) ||
                (market.address ?? '').toLowerCase().includes(query)
        );
    });

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
            width: '36rem',
            maxWidth: 'calc(100vw - 2rem)',
            autoFocus: 'input',
        });
        this._dialogRef.afterClosed().subscribe(() => {
            this._dialogRef = null;
            this.search.set('');
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
