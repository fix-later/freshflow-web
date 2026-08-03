import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
    computed,
    inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { UserService } from 'app/core/user/user.service';
import { SetupCompletionService } from './setup-completion.service';
import { REQUIRED_SETUP_ITEMS, RequiredSetupItemId } from './setup.types';

/** Where each item is completed, using the profile area's `section` query param. */
const ITEM_SECTION: Readonly<Record<RequiredSetupItemId, string>> = {
    // The licence is a field of the business-profile form, so it shares a
    // destination with the business item (research R2).
    business: 'business',
    license: 'business',
    address: 'addresses',
};

/**
 * Getting-started card on the restaurant profile overview: which setup items
 * remain before an administrator can review the account, and a direct way into
 * each one.
 *
 * It reads {@link SetupCompletionService}, whose state is computed from the
 * same signals the profile-area forms write through — so completing an item
 * elsewhere updates this card with no reload, and removing the data makes the
 * item outstanding again (FR-018).
 *
 * The tax item is rendered separately as a standing action: it can never be
 * confirmed from saved data, so it is never ticked and never counted
 * (FR-021, spec Decision 2).
 */
@Component({
    selector: 'setup-checklist',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    templateUrl: './setup-checklist.component.html',
    imports: [
        MatButtonModule,
        MatIconModule,
        MatProgressBarModule,
        RouterLink,
        TranslocoModule,
    ],
})
export class SetupChecklistComponent implements OnInit {
    private readonly _completion = inject(SetupCompletionService);
    private readonly _userService = inject(UserService);

    private readonly _user = toSignal(this._userService.user$, {
        initialValue: this._userService.current,
    });

    readonly items = REQUIRED_SETUP_ITEMS;
    readonly states = this._completion.states;
    readonly progress = this._completion.progress;

    /**
     * Show only while there is outstanding work on an account that is not yet
     * approved — an active customer should not be nagged (FR-019).
     */
    readonly visible = computed(() => {
        const user = this._user();
        if (user?.role !== 'restaurant' || user.approvalStatus === 'approved') {
            return false;
        }
        return !this.progress().isComplete;
    });

    readonly percent = computed(() => {
        const { completed, total } = this.progress();
        return total === 0 ? 0 : Math.round((completed / total) * 100);
    });

    ngOnInit(): void {
        void this._completion.load();
    }

    labelKey(item: RequiredSetupItemId): string {
        return `restaurantOnboarding.items.${item}`;
    }

    /** Deep link into the profile section where `item` is completed (FR-017). */
    sectionFor(item: RequiredSetupItemId): Record<string, string> {
        return { section: ITEM_SECTION[item] };
    }

    isDone(item: RequiredSetupItemId): boolean {
        return this.states()[item] === 'done';
    }
}
