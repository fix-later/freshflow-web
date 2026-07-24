import {
    ChangeDetectionStrategy,
    Component,
    OnDestroy,
    OnInit,
    ViewEncapsulation,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterOutlet } from '@angular/router';
import { FuseFullscreenComponent } from '@fuse/components/fullscreen';
import { FuseLoadingBarComponent } from '@fuse/components/loading-bar';
import {
    FuseNavigationService,
    FuseVerticalNavigationComponent,
} from '@fuse/components/navigation';
import { FuseConfig, FuseConfigService } from '@fuse/services/config';
import { FuseMediaWatcherService } from '@fuse/services/media-watcher';
import { TranslocoModule } from '@jsverse/transloco';
import { FuseRouteAnimationDirective } from 'app/core/animations/route-animation.directive';
import { NavigationService } from 'app/core/navigation/navigation.service';
import { Navigation } from 'app/core/navigation/navigation.types';
import { LanguagesComponent } from 'app/layout/common/languages/languages.component';
import { NotificationsComponent } from 'app/layout/common/notifications/notifications.component';
import { SearchComponent } from 'app/layout/common/search/search.component';
import { UserComponent } from 'app/layout/common/user/user.component';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'dense-layout',
    templateUrl: './dense.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
        FuseLoadingBarComponent,
        FuseVerticalNavigationComponent,
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,
        TranslocoModule,
        LanguagesComponent,
        FuseFullscreenComponent,
        SearchComponent,
        NotificationsComponent,
        UserComponent,
        RouterOutlet,
        FuseRouteAnimationDirective,
    ],
    styles: [
        `
            /*
              Dense nav stays appearance="dense" on hover — Fuse only adds
              .fuse-vertical-navigation-hover while expanding. Swap the mark
              for the primary wordmark to match the pinned-open state.
            */
            fuse-vertical-navigation.fuse-vertical-navigation-appearance-dense.fuse-vertical-navigation-hover {
                .admin-dense-logo-header {
                    justify-content: flex-start;
                    padding-left: 1.5rem;
                    padding-right: 1.5rem;
                }

                .admin-dense-logo-mark {
                    display: none !important;
                }

                .admin-dense-logo-primary {
                    display: block !important;
                }
            }
        `,
    ],
})
export class DenseLayoutComponent implements OnInit, OnDestroy {
    isScreenSmall = false;
    /** Sidebar open state — independent of theme/scheme toggles. */
    navigationOpened = true;
    navigation: Navigation;
    navigationAppearance: 'default' | 'dense' = 'dense';
    scheme: 'auto' | 'dark' | 'light';
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    /**
     * Constructor
     */
    constructor(
        private _navigationService: NavigationService,
        private _fuseConfigService: FuseConfigService,
        private _fuseMediaWatcherService: FuseMediaWatcherService,
        private _fuseNavigationService: FuseNavigationService
    ) {}

    /**
     * Getter for current year
     */
    get currentYear(): number {
        return new Date().getFullYear();
    }

    /**
     * On init
     */
    ngOnInit(): void {
        // Subscribe to config changes to track the active scheme
        this._fuseConfigService.config$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((config: FuseConfig) => {
                this.scheme = config.scheme;
            });

        // Subscribe to navigation data
        this._navigationService.navigation$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((navigation: Navigation) => {
                this.navigation = navigation;
            });

        // Sync sidebar / appearance only when the breakpoint actually changes —
        // not when light/dark scheme flips (that would reset a collapsed sidebar).
        this._fuseMediaWatcherService.onMediaChange$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(({ matchingAliases }) => {
                const isSmall = !matchingAliases.includes('md');
                if (isSmall === this.isScreenSmall) {
                    return;
                }
                this.isScreenSmall = isSmall;
                this.navigationOpened = !isSmall;
                this.navigationAppearance = isSmall ? 'default' : 'dense';
            });
    }

    /**
     * On destroy
     */
    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    /**
     * Toggle navigation
     */
    toggleNavigation(name: string): void {
        const navigation =
            this._fuseNavigationService.getComponent<FuseVerticalNavigationComponent>(
                name
            );

        if (navigation) {
            navigation.toggle();
        }
    }

    /**
     * Toggle the navigation appearance
     */
    toggleNavigationAppearance(): void {
        this.navigationAppearance =
            this.navigationAppearance === 'default' ? 'dense' : 'default';
    }

    /**
     * Toggle between the dark and light schemes
     */
    toggleScheme(): void {
        this._fuseConfigService.config = {
            scheme: this.scheme === 'dark' ? 'light' : 'dark',
        };
    }
}
