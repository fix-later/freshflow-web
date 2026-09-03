import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    computed,
    inject,
    input,
} from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { PermissionsService } from 'app/core/auth/permissions/permissions.service';
import { MarketSelectionService } from 'app/core/market/market-selection.service';
import { AssistantService } from './assistant.service';

/**
 * The phrases the greeting offers as one-tap openers.
 *
 * Fixed and translated, never generated: a starter is a promise about what the
 * assistant can do, and one invented per visit could promise something it
 * cannot. Fixed phrases can also be reviewed in both languages like any other
 * copy, and cost no round trip before the bubble can appear.
 */
const STARTER_KEYS = [
    'assistant.nudge.starter.restock',
    'assistant.nudge.starter.browse',
] as const;

/**
 * The assistant's greeting — a bubble beside the launcher, raised once per tab
 * when a restaurant that may order has told us which chợ it is shopping.
 *
 * It exists because the assistant never spoke first: a buyer had to notice the
 * launcher and decide, unprompted, that talking to it was worth a try. This
 * offers, in the corner, without taking the page: it is not modal, it covers
 * nothing, and one press either opens the conversation or ends the offer for
 * the session.
 *
 * Deliberately **not** an auto-opening panel. The buyer is mid-task on a
 * storefront, and a panel over the listings they came for has to be dismissed
 * before they can shop (see `research.md`, D1).
 */
@Component({
    selector: 'assistant-nudge',
    templateUrl: './assistant-nudge.component.html',
    styleUrl: './assistant-nudge.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [MatTooltipModule, TranslocoModule],
})
export class AssistantNudgeComponent {
    private readonly _assistant = inject(AssistantService);
    private readonly _permissions = inject(PermissionsService);
    private readonly _markets = inject(MarketSelectionService);
    private readonly _transloco = inject(TranslocoService);

    /** Lift with the launcher when the scroll-to-top control shares the corner. */
    readonly raised = input(false);

    readonly starterKeys = STARTER_KEYS;

    /** The chợ the greeting is about — it names the market it is offering. */
    readonly market = computed(() => this._markets.selected()?.name ?? '');

    /**
     * Every condition has to hold, and each says something different:
     * the viewer may use the assistant at all (the launcher's own rule), they
     * have chosen a chợ for it to shop, the conversation is not already open,
     * and the greeting has not been spent this session.
     */
    readonly visible = computed(
        () =>
            this._permissions.hasRole('restaurant') &&
            this._permissions.isApproved() &&
            !!this.market() &&
            !this._assistant.opened() &&
            !this._assistant.nudgeSpent()
    );

    /** Open the conversation with nothing asked yet. */
    open(): void {
        this._assistant.openWith();
    }

    /**
     * Open it with this starter already asked.
     *
     * Translated here, not in the panel: what travels is the sentence the buyer
     * read and pressed, so the conversation shows the words they chose rather
     * than a key they never saw.
     */
    start(key: string): void {
        this._assistant.openWith(this._transloco.translate(key));
    }

    dismiss(): void {
        this._assistant.dismissNudge();
    }
}
