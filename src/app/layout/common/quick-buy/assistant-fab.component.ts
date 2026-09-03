import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    computed,
    inject,
    input,
} from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule } from '@jsverse/transloco';
import { PermissionsService } from 'app/core/auth/permissions/permissions.service';
import { AssistantNudgeComponent } from './assistant-nudge.component';
import { AssistantService } from './assistant.service';

/**
 * The floating launcher for the AI shopping assistant, pinned bottom-right on
 * the storefront.
 *
 * It stands where the contact FAB used to: a restaurant that wants something
 * reaches for the assistant, which can actually put the order together, rather
 * than for a hotline. Opening is all it does — the conversation lives in
 * `QuickBuyComponent`, and both share `AssistantService.opened`.
 *
 * Hidden while the box is up: the box carries its own close control, and a
 * launcher underneath it would only offer to close what is already open.
 */
@Component({
    selector: 'assistant-fab',
    templateUrl: './assistant-fab.component.html',
    styleUrl: './assistant-fab.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [AssistantNudgeComponent, MatTooltipModule, TranslocoModule],
})
export class AssistantFabComponent {
    private readonly _assistant = inject(AssistantService);
    private readonly _permissions = inject(PermissionsService);

    /** Lift the launcher when the scroll-to-top control shares the corner. */
    readonly raised = input(false);

    /** Same gate the header tool uses: an approved restaurant can order. */
    readonly available = computed(
        () =>
            this._permissions.hasRole('restaurant') &&
            this._permissions.isApproved()
    );

    readonly opened = this._assistant.opened;

    open(): void {
        // Through the service, so opening the chat also spends the greeting —
        // the offer has been answered whichever control answered it.
        this._assistant.openWith();
    }
}
