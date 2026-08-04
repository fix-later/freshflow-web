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
import { RouterLink, RouterLinkActive } from '@angular/router';
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

    @ViewChild('drawer') drawer!: MatDrawer;

    readonly titleKey = input.required<string>();
    readonly breadcrumbKey = input.required<string>();
    /** Breadcrumb root — the account area, not any one page inside it. */
    readonly breadcrumbRootKey = input('accountShell.group');

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
