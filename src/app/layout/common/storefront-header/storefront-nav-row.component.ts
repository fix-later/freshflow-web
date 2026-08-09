import { NgTemplateOutlet } from '@angular/common';
import {
    booleanAttribute,
    ChangeDetectionStrategy,
    Component,
    inject,
    input,
    OnDestroy,
    OnInit,
    ViewEncapsulation,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { FuseNavigationItem } from '@fuse/components/navigation';
import { FuseMediaWatcherService } from '@fuse/services/media-watcher';
import { TranslocoModule } from '@jsverse/transloco';
import { NavigationService } from 'app/core/navigation/navigation.service';
import { Navigation } from 'app/core/navigation/navigation.types';
import { Subject, takeUntil } from 'rxjs';
import { HotDealsMenuComponent } from './hot-deals-menu.component';

/**
 * The storefront's primary navigation row: horizontal nav on the left, support
 * hotline on the right.
 *
 * Shared by the storefront enterprise layout. Resolves
 * its own navigation and breakpoint, so a layout only drops the tag in.
 *
 * `embedded` — render only the inner row (no full-bleed chrome) so a parent
 * grid can place it beside a logo that spans this row and the main bar.
 *
 * The Hot Deals entry is its own component ({@link HotDealsMenuComponent}) —
 * it opens a panel of the market's featured listings rather than being a plain
 * link.
 */
@Component({
    selector: 'storefront-nav-row',
    templateUrl: './storefront-nav-row.component.html',
    styles: [
        `
            storefront-nav-row {
                display: block;
                width: 100%;
            }
        `,
    ],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: true,
    imports: [
        NgTemplateOutlet,
        HotDealsMenuComponent,
        MatIconModule,
        MatMenuModule,
        RouterLink,
        RouterLinkActive,
        TranslocoModule,
    ],
})
export class StorefrontNavRowComponent implements OnInit, OnDestroy {
    private _navigationService = inject(NavigationService);
    private _fuseMediaWatcherService = inject(FuseMediaWatcherService);
    private _router = inject(Router);

    /** When true, skip the outer full-bleed wrapper (used under a spanning logo). */
    readonly embedded = input(false, { transform: booleanAttribute });

    navigation: Navigation;
    isScreenSmall = false;

    readonly hotline = {
        text: '+1 900 777525',
        href: 'tel:+1900777525',
    };

    private _unsubscribeAll = new Subject<void>();

    ngOnInit(): void {
        this._navigationService.navigation$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((navigation) => (this.navigation = navigation));

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

    /** True when any child link of a dropdown nav item is the active route. */
    isBranchActive(item: FuseNavigationItem): boolean {
        return !!item.children?.some(
            (child) =>
                !!child.link &&
                this._router.isActive(child.link, {
                    paths: 'subset',
                    queryParams: 'subset',
                    fragment: 'ignored',
                    matrixParams: 'ignored',
                })
        );
    }
}
