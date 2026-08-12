import { Location } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
    signal,
    ViewChild,
    ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { FuseMediaWatcherService } from '@fuse/services/media-watcher';
import { TranslocoModule } from '@jsverse/transloco';
import { UserService } from 'app/core/user/user.service';
import { accountNavGroups } from 'app/modules/restaurant/account-area-nav';
import { map } from 'rxjs';

/**
 * Shared right-sidebar shell for the account area.
 *
 * The rail lists **every** account destination on every page in the area, so
 * no screen is reachable from one page and invisible from the next. Pages
 * supply only their heading — the nav is not theirs to vary.
 */
@Component({
    selector: 'account-shell',
    templateUrl: './account-shell.component.html',
    styleUrl: './account-shell.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: { class: 'flex w-full min-w-0 flex-auto flex-col' },
    imports: [
        MatSidenavModule,
        MatButtonModule,
        MatIconModule,
        RouterLink,
        RouterLinkActive,
        TranslocoModule,
    ],
})
export class AccountShellComponent {
    private readonly _fuseMediaWatcher = inject(FuseMediaWatcherService);
    private readonly _userService = inject(UserService);
    private readonly _router = inject(Router);
    private readonly _location = inject(Location);

    @ViewChild('drawer') drawer!: MatDrawer;

    readonly titleKey = input.required<string>();
    readonly breadcrumbKey = input.required<string>();
    /** Breadcrumb root — the account area, not any one page inside it. */
    readonly breadcrumbRootKey = input('accountShell.group');

    /**
     * Set by a **detail** page to swap the breadcrumb for a back control.
     *
     * A detail page is reached from exactly one place at a time, and the thing
     * its reader wants is the way back to that place — not a trail restating
     * where they already know they are. The value is the *fallback* route: the
     * button prefers real history (see {@link goBack}), so arriving at an order
     * from the claims list returns to the claims list, not to the order list.
     */
    readonly backLink = input<string | null>(null);
    readonly backLabelKey = input('accountShell.back');

    /** True when this page renders a back control instead of a breadcrumb. */
    readonly isDetail = computed(() => !!this.backLink());

    private readonly _user = toSignal(this._userService.user$, {
        initialValue: this._userService.current,
    });

    /** Every account destination the signed-in role can reach, grouped. */
    readonly navGroups = computed(() =>
        accountNavGroups(this._user()?.role === 'restaurant')
    );

    /** Short label for “Tài khoản của {{name}}”. */
    readonly displayName = computed(() => {
        const user = this._user();
        if (!user) {
            return '';
        }
        const full = user.fullName?.trim();
        if (full) {
            return full;
        }
        if (user.name?.trim() && user.name !== user.email) {
            return user.name.trim();
        }
        const local = user.email?.split('@')[0] ?? '';
        if (!local) {
            return user.email ?? '';
        }
        return local.charAt(0).toUpperCase() + local.slice(1);
    });

    readonly avatarUrl = computed(
        () => this._user()?.avatarUrl || this._user()?.avatar || null
    );

    /** BR-AUTH-1 — show the verified tick when the account is approved. */
    readonly isApproved = computed(
        () => this._user()?.approvalStatus === 'approved'
    );

    /** Two-letter initials for the square avatar fallback. */
    readonly initials = computed(() => {
        const label = this.displayName() || this._user()?.email || '';
        const parts = label
            .trim()
            .split(/[\s._-]+/)
            .filter(Boolean);
        if (parts.length >= 2) {
            return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
        }
        return label.slice(0, 2).toUpperCase() || '??';
    });

    private readonly _isScreenSmall = toSignal(
        this._fuseMediaWatcher.onMediaChange$.pipe(
            map(({ matchingAliases }) => !matchingAliases.includes('md'))
        ),
        { initialValue: false }
    );

    readonly drawerMode = computed<'over' | 'side'>(() =>
        this._isScreenSmall() ? 'over' : 'side'
    );

    /** Desktop: open by default. Mobile: closed until the hamburger is tapped. */
    readonly drawerOpened = signal(true);

    constructor() {
        this._fuseMediaWatcher.onMediaChange$
            .pipe(
                map(({ matchingAliases }) => matchingAliases.includes('md')),
                takeUntilDestroyed()
            )
            .subscribe((isMdUp) => {
                this.drawerOpened.set(isMdUp);
            });
    }

    /**
     * Back to wherever the reader came from.
     *
     * `location.back()` only when this page was reached by an in-app
     * navigation. Angular numbers navigations from 1, so an id of 1 means the
     * detail page *is* the entry point — a deep link, a refresh, a pasted URL —
     * and there is nothing behind it to go back to; stepping back there would
     * leave the site entirely. Those fall through to the declared route.
     */
    goBack(): void {
        const link = this.backLink();
        // A signal in Angular 22, not a plain property.
        const arrivedInApp =
            (this._router.lastSuccessfulNavigation()?.id ?? 1) > 1;
        if (arrivedInApp) {
            this._location.back();
            return;
        }
        if (link) {
            void this._router.navigateByUrl(link);
        }
    }

    toggleDrawer(): void {
        // Drive close/open through MatDrawer so its transform transition runs;
        // `openedChange` keeps the signal (and content padding) in sync.
        void this.drawer.toggle();
    }

    onOpenedChange(opened: boolean): void {
        this.drawerOpened.set(opened);
    }

    onNavClick(): void {
        if (this.drawerMode() === 'over') {
            void this.drawer.close();
        }
    }
}
