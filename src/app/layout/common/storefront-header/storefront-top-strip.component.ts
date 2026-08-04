import {
    ChangeDetectionStrategy,
    Component,
    OnDestroy,
    OnInit,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FuseMediaWatcherService } from '@fuse/services/media-watcher';
import { TranslocoModule } from '@jsverse/transloco';
import { LanguagesComponent } from 'app/layout/common/languages/languages.component';
import { MarketPickerComponent } from 'app/layout/common/market-picker/market-picker.component';
import { Subject, takeUntil } from 'rxjs';

/**
 * The storefront's dark utility strip: value props on the left, market /
 * language / currency on the right.
 *
 * Extracted from the enterprise layout so the storefront header rows can share the
 * same top strip without a copy that would drift. It owns its own breakpoint
 * check — the strip is desktop-only — so a layout just drops the tag in.
 */
@Component({
    selector: 'storefront-top-strip',
    templateUrl: './storefront-top-strip.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: {
        class: 'block w-full',
    },
    imports: [
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        MatTooltipModule,
        TranslocoModule,
        LanguagesComponent,
        MarketPickerComponent,
    ],
})
export class StorefrontTopStripComponent implements OnInit, OnDestroy {
    private _fuseMediaWatcherService = inject(FuseMediaWatcherService);

    isScreenSmall = false;

    /** Value props shown on the left of the top strip, as i18n keys. */
    readonly topBenefits = [
        {
            icon: 'heroicons_outline:truck',
            labelKey: 'header.strip.earlyDelivery',
        },
        {
            icon: 'heroicons_outline:receipt-percent',
            labelKey: 'header.strip.vat',
        },
        {
            icon: 'heroicons_outline:lifebuoy',
            labelKey: 'header.strip.support',
        },
    ];

    private _unsubscribeAll = new Subject<void>();

    ngOnInit(): void {
        this._fuseMediaWatcherService.onMediaChange$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(({ matchingAliases }) => {
                this.isScreenSmall = !matchingAliases.includes('md');
            });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }
}
