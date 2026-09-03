import { Clipboard } from '@angular/cdk/clipboard';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    ElementRef,
    TemplateRef,
    ViewContainerRef,
    ViewEncapsulation,
    computed,
    effect,
    inject,
    signal,
    viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { PermissionsService } from 'app/core/auth/permissions/permissions.service';
import { activeLang } from 'app/core/i18n/active-lang';
import { MarkdownToHtmlPipe } from 'app/core/pipes/markdown-to-html.pipe';
import { UserService } from 'app/core/user/user.service';
import { DraftOrderService } from 'app/layout/common/draft-order/draft-order.service';
import { OrdersService } from 'app/modules/orders/orders.service';
import {
    ASSISTANT_MESSAGE_MAX_LENGTH,
    AssistantCreditSummary,
    AssistantDeliveryAddress,
    AssistantPendingConfirmation,
    AssistantService,
} from './assistant.service';

interface QuickBuyMessage {
    role: 'user' | 'assistant';
    text: string;
    /** Set on the message that reported a failure, so it can offer a retry. */
    failed?: boolean;
}

/**
 * The draft order a conversation has assembled, read off the order itself.
 *
 * The assistant reports only an id (`draftOrderId`); the contents are read from
 * `GET /orders/{id}` so the card states what the platform holds rather than
 * what the model said it holds.
 */
interface AssistantDraft {
    id: string;
    itemCount: number;
    total: number | null;
    /** The order could not be read back — the card says so and offers nothing. */
    unreadable: boolean;
}

/** How close to the bottom still counts as "following along", in pixels. */
const FOLLOW_THRESHOLD_PX = 80;

/**
 * How long a turn may run before the typing indicator admits it is taking a
 * while. Tool-calling turns (search → model → reply) routinely run past this,
 * and three static dots for fifteen seconds reads as broken rather than busy.
 */
const STILL_WORKING_AFTER_MS = 6000;

/** One `key: value` the preview carried that this screen has no label for. */
interface PreviewExtra {
    key: string;
    value: string;
}

/** A blocking reason from `PreviewIssueDto`. */
interface PreviewIssue {
    code: string;
    message: string;
}

/**
 * `previewJson`, read into the shape the receipt renders.
 *
 * Every field is optional because the payload is the raw tool result, not a
 * contract this screen owns: it is `OrderConfirmationPreviewDto` today and the
 * tool's `{ error, message }` envelope when the preview itself failed.
 */
interface ConfirmationPreview {
    /** The tool failed rather than previewing — shown instead of a receipt. */
    error: PreviewIssue | null;
    /** `false` means confirming would be refused; the issues say why. */
    wouldSucceed: boolean | null;
    issues: PreviewIssue[];
    subtotal: number | null;
    vat: number | null;
    deliveryFee: number | null;
    total: number | null;
    /**
     * Stripped server-side before the payload leaves the tool
     * (`ToolResultJson.From(result, nameof(…RemainingCreditAfter))`), so it is
     * absent today. Read anyway: the field is the one credit figure the receipt
     * would highlight, and this lights up the row the day it is sent.
     */
    remainingCredit: number | null;
    scheduledFor: string | null;
    distanceKm: number | null;
    /** Anything else the payload carried — surfaced, never swallowed. */
    extras: PreviewExtra[];
}

/** Keys the receipt renders in named rows; everything else becomes an extra. */
const KNOWN_PREVIEW_KEYS = new Set([
    'wouldSucceed',
    'issues',
    'error',
    'message',
    'subtotalAmount',
    'vatAmount',
    'deliveryFee',
    'totalAmount',
    'remainingCreditAfter',
    'resolvedScheduledFor',
    'deliveryDistanceKm',
]);

/** Starter prompts for the empty state. Bodies live in the i18n bundles. */
const SUGGESTION_KEYS = [
    'assistant.suggestions.restock',
    'assistant.suggestions.tomorrow',
    'assistant.suggestions.price',
    'assistant.suggestions.reorder',
] as const;

/**
 * "Mua hàng nhanh" — the AI shopping assistant's launcher and panel, wired to
 * `POST /api/v1/assistant/chat`.
 *
 * **Restaurant only.** The endpoint is `[Authorize(Roles = "restaurant")]`, so
 * for anyone else the launcher is not rendered at all rather than opening a
 * panel whose every message would 403 — and an unapproved restaurant cannot
 * order yet, so the assistant that exists to build orders stays hidden too.
 *
 * **The box is detached into a CDK overlay, not left inline.** The trigger
 * sits in the header on desktop and inside the mobile bottom bar — and that bar
 * is `position: fixed; z-index: 50`, which opens a stacking context. Rendered
 * in place, the box's own `z-index: 96` is scoped inside that 50, so the
 * floating launcher (root, `z-index: 90`) painted over it and swallowed taps on
 * the send button. Attaching to the overlay container puts the box at the
 * document root, out of every ancestor's stacking context.
 *
 * **Two controls open it,** the header tool and `assistant-fab` in the corner,
 * so the open flag lives on {@link AssistantService} rather than here.
 *
 * **Confirmation is two-phase and stays that way.** A turn that comes back with
 * a `pendingConfirmation` renders a receipt and a button; {@link confirmOrder}
 * is the *only* method that passes `confirmOrderId`, and nothing derived from
 * the reply text can reach it. {@link retry} deliberately re-sends plain text
 * only — a failed confirmation restores the card so the button stays the single
 * path, rather than letting a retry replay an order confirmation.
 */
@Component({
    selector: 'quick-buy',
    templateUrl: './quick-buy.component.html',
    styleUrls: ['./quick-buy.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: true,
    imports: [
        FormsModule,
        MatIconModule,
        MatTooltipModule,
        TranslocoModule,
        MarkdownToHtmlPipe,
    ],
})
export class QuickBuyComponent {
    private readonly _assistant = inject(AssistantService);
    private readonly _permissions = inject(PermissionsService);
    private readonly _transloco = inject(TranslocoService);
    private readonly _overlay = inject(Overlay);
    private readonly _viewContainer = inject(ViewContainerRef);
    private readonly _destroyRef = inject(DestroyRef);
    private readonly _clipboard = inject(Clipboard);
    private readonly _orders = inject(OrdersService);
    private readonly _draftOrder = inject(DraftOrderService);
    private readonly _router = inject(Router);
    private readonly _userService = inject(UserService);

    private readonly _lang = activeLang();

    private readonly _panelTemplate =
        viewChild<TemplateRef<unknown>>('panelTemplate');
    private readonly _composer =
        viewChild<ElementRef<HTMLTextAreaElement>>('chatInput');
    private readonly _scroller =
        viewChild<ElementRef<HTMLElement>>('messageScroller');

    private _overlayRef: OverlayRef | null = null;

    /** The assistant acts on the account, so it is offered to no one else. */
    readonly available = computed(
        () =>
            this._permissions.hasRole('restaurant') &&
            this._permissions.isApproved()
    );

    readonly maxLength = ASSISTANT_MESSAGE_MAX_LENGTH;
    readonly suggestionKeys = SUGGESTION_KEYS;

    /** Shared with the floating launcher — see `AssistantService.opened`. */
    readonly opened = this._assistant.opened;
    readonly sending = signal(false);
    readonly query = signal('');
    /**
     * The conversation, seeded from whatever survived the last page load.
     *
     * The server keeps the conversation itself for half an hour; this is the
     * transcript the buyer was looking at, so a reload comes back to the same
     * screen rather than an empty one.
     */
    readonly messages = signal<QuickBuyMessage[]>(
        this._assistant.restoredMessages().map((message) => ({ ...message }))
    );

    /** Index of the reply whose copy button just fired, for the "Copied" tick. */
    readonly copiedIndex = signal<number | null>(null);

    /** True once a turn has run long enough to be worth reassuring about. */
    readonly stillWorking = signal(false);

    /**
     * A reply landed while the user was reading further up. The thread is not
     * yanked to the bottom in that case (see {@link _scrollToLatest}); this
     * raises the pill that offers to take them there.
     */
    readonly unreadBelow = signal(false);

    /**
     * The restaurant's credit standing, when a turn looked it up.
     *
     * The backend hands these figures to the client and deliberately withholds
     * them from the model, so the assistant answers "the figures are on screen"
     * — and until now nothing put them there. Kept until a later turn replaces
     * them: a balance stated once stays true for the rest of the conversation.
     */
    readonly credit = signal<AssistantCreditSummary | null>(null);

    /** The restaurant's delivery addresses, when a turn listed them. */
    readonly addresses = signal<AssistantDeliveryAddress[]>([]);

    /**
     * Where the buyer says this order should go.
     *
     * Sent as `deliveryAddressId` on every later turn, which is what the
     * server injects into a confirmation — the model never chooses the address
     * (`AssistantChatRequest`: "never accepted from the LLM"), so picking one
     * here is the only way the buyer can say it in a conversation.
     */
    readonly selectedAddressId = signal<string | null>(null);

    /** The order awaiting an explicit press of the confirm button. */
    readonly pending = signal<AssistantPendingConfirmation | null>(null);

    /**
     * The draft the conversation has built so far, as the *order* reports it.
     *
     * Every figure here comes from reading the order back, never from the
     * reply: the reply is model prose, and a card that quoted it could tell the
     * buyer a total the order does not hold.
     */
    readonly draft = signal<AssistantDraft | null>(null);

    /** True while the draft is being adopted and checkout is being opened. */
    readonly openingCheckout = signal(false);

    /** Last thing the user typed — what {@link retry} re-sends. */
    private _lastUserMessage = '';

    /**
     * Overrides the "only follow if already at the bottom" rule for the next
     * transcript change. Set by the actions the user drove themselves — sending,
     * retrying, confirming — where landing on the newest content is the point.
     */
    private _pinNext = true;

    /**
     * A draft the restored conversation had built, waiting to be read back the
     * first time the panel is opened.
     */
    private _restoredDraftId: string | null =
        this._assistant.restoredDraftOrderId();

    /** Transcript length at the last scroll decision, to spot a new arrival. */
    private _lastCount = 0;

    private _workingTimer: ReturnType<typeof setTimeout> | undefined;
    private _copiedTimer: ReturnType<typeof setTimeout> | undefined;

    /** Nothing said yet: the panel shows the greeting and starter prompts. */
    readonly isEmpty = computed(() => this.messages().length === 0);

    /** Remaining characters, surfaced only as the cap comes into view. */
    readonly remaining = computed(
        () => ASSISTANT_MESSAGE_MAX_LENGTH - this.query().trim().length
    );
    readonly nearLimit = computed(() => this.remaining() <= 200);

    readonly canSend = computed(() => {
        const length = this.query().trim().length;
        return !this.sending() && length > 0 && length <= this.maxLength;
    });

    /** The pending order's preview, parsed into the receipt's shape. */
    readonly preview = computed<ConfirmationPreview | null>(() => {
        const pending = this.pending();
        return pending ? readPreview(pending.previewJson) : null;
    });

    /**
     * True once the box is docked in the corner rather than covering the screen
     * — the same 640px the stylesheet switches at.
     *
     * It decides `aria-modal`, which has to be honest: a docked box leaves the
     * page behind it reachable, and claiming otherwise tells a screen-reader
     * user there is nothing back there to return to.
     */
    readonly docked = signal(false);

    /**
     * Whether the box has been grown to fill the screen.
     *
     * Panel-local and deliberately not remembered: the assistant opens as a box
     * beside the produce every time, and full screen is something asked for
     * when a conversation gets long enough to want the room.
     */
    readonly expanded = signal(false);

    constructor() {
        // The transcript is written down as it grows, so a reload comes back to
        // it. Only what was said and what it built — the composer's half-typed
        // line is not a message and is not kept.
        effect(() => {
            const messages = this.messages();
            const draft = this.draft();
            this._assistant.persist(
                messages.map(({ role, text, failed }) => ({
                    role,
                    text,
                    failed,
                })),
                draft && !draft.unreadable ? draft.id : null
            );
        });

        // A conversation belongs to the account that had it. Signing out is not
        // a reload: the next person at this browser must not find it waiting.
        this._userService.user$
            .pipe(takeUntilDestroyed(this._destroyRef))
            .subscribe((user) => {
                if (user?.role !== 'restaurant') {
                    this._assistant.forget();
                }
            });

        const dockQuery = window.matchMedia?.('(min-width: 640px)');
        if (dockQuery) {
            this.docked.set(dockQuery.matches);
            const onChange = (event: MediaQueryListEvent): void =>
                this.docked.set(event.matches);
            dockQuery.addEventListener('change', onChange);
            this._destroyRef.onDestroy(() =>
                dockQuery.removeEventListener('change', onChange)
            );
        }

        // The box follows the shared flag rather than the control that set it:
        // `assistant-fab` lives in another corner of the layout and only flips
        // `AssistantService.opened`, so mounting the overlay — and the focus
        // that belongs to opening — has to happen here or not at all.
        effect(() => {
            // Availability is re-read here, not just at the launcher: signing
            // out with the box up must take it down, rather than leave a
            // composer whose every message would 403.
            if (this.opened() && this.available()) {
                // Reopening lands on the newest message, not where it was left.
                this._pinNext = true;
                this._attach();
                setTimeout(() => this._composer()?.nativeElement.focus());
                // A greeting starter arrives as a phrase the buyer already
                // pressed. It is asked here, through `_ask`, so it travels the
                // same path a typed message does — nothing enters the
                // conversation by a private door.
                // A conversation restored from the last page may have left a
                // draft behind. Read it back on open, not on load: a buyer who
                // never opens the panel should not pay for the request, and the
                // card is only ever seen in here.
                const restoredDraft = this._restoredDraftId;
                if (restoredDraft) {
                    this._restoredDraftId = null;
                    void this._trackDraft(restoredDraft);
                }
                const starter = this._assistant.takeStarter();
                if (starter) {
                    this._ask(starter);
                }
            } else {
                this._detach();
            }
        });

        // Anything that lengthens the transcript — a message, the typing
        // indicator, the receipt — pulls the view down to it, but only while the
        // user is actually following along. Yanking someone who scrolled up to
        // re-read an earlier reply is the worse failure of the two, so that case
        // raises the "new reply" pill and leaves their position alone.
        effect(() => {
            const count = this.messages().length;
            this.sending();
            this.pending();
            if (!this.opened()) {
                this._lastCount = count;
                return;
            }
            const grew = count > this._lastCount;
            this._lastCount = count;
            // Measured here rather than inside the deferred scroll: by the time
            // the new content has rendered, the scroller has already grown and
            // nobody is "near the bottom" any more.
            const follow = this._pinNext || this._isNearBottom();
            this._pinNext = false;
            if (follow) {
                this._scrollToLatest();
            } else if (grew) {
                this.unreadBelow.set(true);
            }
        });

        // Three static dots for fifteen seconds reads as broken. A turn that
        // calls tools routinely runs that long, so past a threshold the
        // indicator says so rather than pretending nothing is happening.
        effect(() => {
            clearTimeout(this._workingTimer);
            if (!this.sending()) {
                this.stillWorking.set(false);
                return;
            }
            this._workingTimer = setTimeout(
                () => this.stillWorking.set(true),
                STILL_WORKING_AFTER_MS
            );
        });

        this._destroyRef.onDestroy(() => {
            clearTimeout(this._workingTimer);
            clearTimeout(this._copiedTimer);
            this._detach();
        });
    }

    // ── Panel ────────────────────────────────────────────────────────────

    open(): void {
        if (this.opened() || !this.available()) {
            return;
        }
        this.opened.set(true);
    }

    close(): void {
        if (!this.opened()) {
            return;
        }
        this.query.set('');
        this.opened.set(false);
        // Reopening starts as a box again, so the launcher always does the same
        // thing however the last conversation was left.
        this.expanded.set(false);
    }

    /**
     * Grows the box to fill the screen, and back.
     *
     * The transcript is re-pinned because the surface changes height under it:
     * the message that was at the bottom of a 24rem box is somewhere mid-screen
     * once the panel is three times taller.
     */
    toggleExpanded(): void {
        this.expanded.update((value) => !value);
        this._pinNext = true;
        this._scrollToLatest();
    }

    /**
     * Hoists the panel to the overlay container at the document root.
     *
     * A global position strategy with no backdrop: the surface positions itself
     * (rail on desktop, sheet on a phone) and draws its own scrim, which is
     * mobile-only — a CDK backdrop would dim the page on desktop too, where the
     * panel deliberately leaves it usable.
     */
    private _attach(): void {
        const template = this._panelTemplate();
        if (this._overlayRef || !template) {
            return;
        }
        this._overlayRef = this._overlay.create({
            positionStrategy: this._overlay.position().global(),
            scrollStrategy: this._overlay.scrollStrategies.noop(),
            hasBackdrop: false,
            panelClass: 'ff-qb-overlay',
        });
        this._overlayRef.attach(
            new TemplatePortal(template, this._viewContainer)
        );
    }

    private _detach(): void {
        this._overlayRef?.dispose();
        this._overlayRef = null;
    }

    /** Drops the conversation — the next message opens a new session. */
    startOver(): void {
        this._assistant.reset();
        this.pending.set(null);
        this.draft.set(null);
        this.messages.set([]);
        this.query.set('');
        this._lastUserMessage = '';
        this.unreadBelow.set(false);
        this.copiedIndex.set(null);
        setTimeout(() => this._composer()?.nativeElement.focus());
    }

    onKeydown(event: KeyboardEvent): void {
        if (event.code === 'Escape') {
            this.close();
            return;
        }
        // Shift+Enter is a newline — which is why the composer is a textarea.
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.send();
        }
    }

    /**
     * Grows the composer with its content up to a five-line ceiling, after
     * which it scrolls. Height is cleared first so the box can also shrink —
     * `scrollHeight` never reports less than the current height.
     */
    onComposerInput(event: Event): void {
        const el = event.target as HTMLTextAreaElement;
        this.query.set(el.value);
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, composerMaxHeight(el))}px`;
    }

    // ── Sending ──────────────────────────────────────────────────────────

    send(): void {
        if (!this.canSend()) {
            return;
        }
        this._ask(this.query().trim());
    }

    /** Sends a starter prompt as though the user had typed it. */
    sendSuggestion(key: string): void {
        if (this.sending()) {
            return;
        }
        this._ask(this._transloco.translate(key));
    }

    /**
     * Re-sends the last thing the user typed after a failure.
     *
     * Plain text only, never a confirmation: a retry that could carry
     * `confirmOrderId` would be a second path to placing an order, which is
     * exactly what the two-phase gate exists to prevent. A confirmation that
     * failed restores its card instead (see {@link _turn}), so the button
     * remains the only way through.
     */
    retry(): void {
        if (this.sending() || !this._lastUserMessage) {
            return;
        }
        const text = this._lastUserMessage;
        this._pinNext = true;
        // Drop the failure notice being retried, so the thread does not
        // accumulate one error bubble per attempt.
        this.messages.update((list) =>
            list.filter((message, index) =>
                index === list.length - 1 ? !message.failed : true
            )
        );
        void this._turn(text);
    }

    /**
     * The confirm button — the only path that sets `confirmOrderId`.
     *
     * The address is echoed from the pending record rather than re-picked here:
     * the server injects that exact address, and sending a different one would
     * either be refused or quietly deliver somewhere the receipt never showed.
     */
    /**
     * Takes the draft the assistant built to checkout.
     *
     * Adopts it as the cart first, because checkout renders the cart: the draft
     * is an ordinary draft order for this restaurant, so the shortest honest
     * path is to point the cart at it — the same `adopt` checkout itself calls
     * when a date change forces a new draft — rather than teach checkout a
     * second source.
     *
     * `adopt` reports nothing back, so the read is verified the way the cart
     * itself records it: `_reload` drops the order id when the order cannot be
     * read, so an id that did not stick means the draft is gone. Better to say
     * so here than to open a checkout for an order that is not there.
     *
     * This navigates. It never confirms: the two-phase gate is untouched, and
     * `confirmOrderId` is still set by exactly one button.
     */
    async openDraftCheckout(): Promise<void> {
        const draft = this.draft();
        if (!draft || draft.unreadable || this.openingCheckout()) {
            return;
        }
        this.openingCheckout.set(true);
        try {
            this._draftOrder.adopt(draft.id);
            await this._draftOrder.settled();
            if (this._draftOrder.orderId() !== draft.id) {
                this.draft.set({ ...draft, unreadable: true });
                return;
            }
            this.close();
            await this._router.navigate(['/checkout']);
        } finally {
            this.openingCheckout.set(false);
        }
    }

    confirmOrder(): void {
        const pending = this.pending();
        if (!pending || this.sending()) {
            return;
        }
        const text = this._transloco.translate('assistant.confirm.sent');
        this.pending.set(null);
        this._pinNext = true;
        this._push({ role: 'user', text });
        void this._turn(text, {
            confirmOrderId: pending.orderId,
            deliveryAddressId: pending.deliveryAddressId,
            restoreOnFailure: pending,
        });
    }

    /** Walks away from the prepared order without confirming it. */
    dismissConfirmation(): void {
        this.pending.set(null);
    }

    // ── Reading the reply ────────────────────────────────────────────────

    /**
     * Copies a reply as the markdown the model actually sent, not the rendered
     * HTML — that is what pastes usefully into a note or an order sheet.
     */
    copyReply(index: number, text: string): void {
        if (!this._clipboard.copy(text)) {
            return;
        }
        this.copiedIndex.set(index);
        clearTimeout(this._copiedTimer);
        this._copiedTimer = setTimeout(() => this.copiedIndex.set(null), 2000);
    }

    /** The "new reply" pill — takes the reader down to what arrived. */
    jumpToLatest(): void {
        this._scrollToLatest();
    }

    /** Scrolling back down by hand retires the pill, same as pressing it. */
    onThreadScroll(): void {
        if (this.unreadBelow() && this._isNearBottom()) {
            this.unreadBelow.set(false);
        }
    }

    // ── Formatting ───────────────────────────────────────────────────────

    /** Picks the address this order should go to, or un-picks it. */
    selectAddress(address: AssistantDeliveryAddress): void {
        this.selectedAddressId.update((current) =>
            current === address.id ? null : address.id
        );
    }

    money(value: number | null): string {
        if (value === null) {
            return '—';
        }
        return `${value.toLocaleString(this._lang())} ₫`;
    }

    dateTime(value: string | null): string {
        if (!value) {
            return '—';
        }
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime())
            ? value
            : parsed.toLocaleString(this._lang());
    }

    distance(value: number | null): string {
        return value === null
            ? '—'
            : `${value.toLocaleString(this._lang())} km`;
    }

    // ── Internals ────────────────────────────────────────────────────────

    private _ask(text: string): void {
        this.query.set('');
        this._resetComposerHeight();
        // The user drove this, so follow it down wherever they were reading.
        this._pinNext = true;
        this._push({ role: 'user', text });
        void this._turn(text);
    }

    private async _turn(
        text: string,
        options?: {
            confirmOrderId?: string;
            deliveryAddressId?: string;
            restoreOnFailure?: AssistantPendingConfirmation;
        }
    ): Promise<void> {
        this._lastUserMessage = text;
        this.sending.set(true);
        try {
            const answer = await this._assistant.chat(text, {
                confirmOrderId: options?.confirmOrderId,
                // A confirmation echoes its own address; every other turn
                // carries whichever one the buyer picked from the list.
                deliveryAddressId:
                    options?.deliveryAddressId ??
                    this.selectedAddressId() ??
                    undefined,
            });
            // An empty reply renders as an empty bubble, which reads as a bug in
            // this panel rather than a turn that produced nothing. Name it, and
            // treat it as failed so the retry button is there — retrying is the
            // one useful thing to do with it.
            const reply = answer.reply.trim();
            this._push(
                reply
                    ? { role: 'assistant', text: reply }
                    : {
                          role: 'assistant',
                          failed: true,
                          text: this._transloco.translate(
                              'assistant.emptyReply'
                          ),
                      }
            );
            this.pending.set(answer.pendingConfirmation);
            if (answer.creditSummary) {
                this.credit.set(answer.creditSummary);
            }
            if (answer.deliveryAddresses) {
                this.addresses.set(answer.deliveryAddresses);
                // A list of one, or one marked default, answers the question
                // the list was asked — pre-selecting it saves a tap without
                // deciding anything the buyer did not.
                this.selectedAddressId.update(
                    (current) =>
                        current ??
                        answer.deliveryAddresses!.find((a) => a.isDefault)
                            ?.id ??
                        (answer.deliveryAddresses!.length === 1
                            ? answer.deliveryAddresses![0].id
                            : null)
                );
            }
            await this._trackDraft(answer.draftOrderId);
        } catch (err) {
            // A confirmation that failed puts its card back, so the user can
            // press confirm again — the button stays the only path to
            // `confirmOrderId`, and `retry()` never carries one.
            if (options?.restoreOnFailure) {
                this.pending.set(options.restoreOnFailure);
            }
            this._push({
                role: 'assistant',
                failed: true,
                text: await describeApiError(
                    err,
                    (key) => this._transloco.translate(key),
                    'assistant.error'
                ),
            });
        } finally {
            this.sending.set(false);
        }
    }

    /**
     * Follows the draft the conversation is building.
     *
     * Re-read on every turn that names one, because a later turn adds lines to
     * the same order — the card has to move with it rather than freeze at what
     * the first turn happened to contain (FR-011). A turn that names no draft
     * leaves the card alone: the assistant simply had nothing to say about it,
     * which is not the same as the draft having gone away.
     */
    private async _trackDraft(draftOrderId: string | null): Promise<void> {
        if (!draftOrderId) {
            return;
        }
        try {
            const order = await this._orders.getOrder(draftOrderId);
            const itemCount = order?.itemCount ?? order?.items?.length ?? 0;
            if (!order || itemCount <= 0) {
                // An order with no lines is not something to pay for; an order
                // that will not load is not something to send anyone to.
                this.draft.set(
                    order
                        ? null
                        : {
                              id: draftOrderId,
                              itemCount: 0,
                              total: null,
                              unreadable: true,
                          }
                );
                return;
            }
            this.draft.set({
                id: draftOrderId,
                itemCount,
                total: order.totalAmount ?? null,
                unreadable: false,
            });
        } catch {
            // The turn itself succeeded — only the read of its draft failed, so
            // the conversation stands and the card says what it cannot do.
            this.draft.set({
                id: draftOrderId,
                itemCount: 0,
                total: null,
                unreadable: true,
            });
        }
    }

    private _push(message: QuickBuyMessage): void {
        this.messages.update((list) => [...list, message]);
    }

    private _resetComposerHeight(): void {
        const el = this._composer()?.nativeElement;
        if (el) {
            el.style.height = 'auto';
        }
    }

    /**
     * Deferred a frame: the effect runs before the new message is in the DOM,
     * so scrolling immediately would land on the previous height.
     */
    private _scrollToLatest(): void {
        setTimeout(() => {
            const el = this._scroller()?.nativeElement;
            if (!el) {
                return;
            }
            const reduced = window.matchMedia?.(
                '(prefers-reduced-motion: reduce)'
            ).matches;
            el.scrollTo({
                top: el.scrollHeight,
                behavior: reduced ? 'auto' : 'smooth',
            });
            this.unreadBelow.set(false);
        });
    }

    /** Whether the reader is close enough to the newest message to follow it. */
    private _isNearBottom(): boolean {
        const el = this._scroller()?.nativeElement;
        if (!el) {
            // Nothing rendered yet, so there is no position to preserve.
            return true;
        }
        return (
            el.scrollHeight - el.scrollTop - el.clientHeight <=
            FOLLOW_THRESHOLD_PX
        );
    }
}

/** Five lines, derived from the box's own line-height rather than assumed. */
function composerMaxHeight(el: HTMLTextAreaElement): number {
    const lineHeight = Number.parseFloat(
        getComputedStyle(el).lineHeight || '20'
    );
    const usable = Number.isFinite(lineHeight) ? lineHeight : 20;
    return usable * 5;
}

/**
 * Reads the confirmation preview into the receipt's shape.
 *
 * Two payloads arrive here and both must render: `OrderConfirmationPreviewDto`
 * on success, and the tool's `{ error, message }` envelope when the preview
 * itself failed. Anything else the payload carries is kept as an extra rather
 * than dropped — the previous version filtered out every non-scalar, which
 * silently discarded `issues[]`, i.e. the reasons a confirmation would be
 * refused, leaving a confirm button with no explanation beside it.
 */
function readPreview(json: string | null | undefined): ConfirmationPreview {
    const empty: ConfirmationPreview = {
        error: null,
        wouldSucceed: null,
        issues: [],
        subtotal: null,
        vat: null,
        deliveryFee: null,
        total: null,
        remainingCredit: null,
        scheduledFor: null,
        distanceKm: null,
        extras: [],
    };
    if (!json) {
        return empty;
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        // Not JSON at all — show it rather than pretend there was no preview.
        return { ...empty, extras: [{ key: 'preview', value: json }] };
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return empty;
    }

    const record = parsed as Record<string, unknown>;
    const errorCode = asString(record['error']);

    return {
        error: errorCode
            ? { code: errorCode, message: asString(record['message']) ?? '' }
            : null,
        wouldSucceed:
            typeof record['wouldSucceed'] === 'boolean'
                ? record['wouldSucceed']
                : null,
        issues: readIssues(record['issues']),
        subtotal: asNumber(record['subtotalAmount']),
        vat: asNumber(record['vatAmount']),
        deliveryFee: asNumber(record['deliveryFee']),
        total: asNumber(record['totalAmount']),
        remainingCredit: asNumber(record['remainingCreditAfter']),
        scheduledFor: asString(record['resolvedScheduledFor']),
        distanceKm: asNumber(record['deliveryDistanceKm']),
        extras: Object.entries(record)
            .filter(([key]) => !KNOWN_PREVIEW_KEYS.has(key))
            .map(([key, value]) => ({
                key,
                // Objects and arrays are stringified rather than skipped: an
                // unreadable row still tells the operator something is there.
                value:
                    value !== null && typeof value === 'object'
                        ? JSON.stringify(value)
                        : String(value ?? ''),
            }))
            .filter((extra) => extra.value !== ''),
    };
}

function readIssues(value: unknown): PreviewIssue[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map((entry) => {
            if (typeof entry === 'string') {
                return { code: '', message: entry };
            }
            if (entry && typeof entry === 'object') {
                const issue = entry as Record<string, unknown>;
                return {
                    code: asString(issue['code']) ?? '',
                    message: asString(issue['message']) ?? '',
                };
            }
            return { code: '', message: '' };
        })
        .filter((issue) => !!(issue.message || issue.code));
}

function asNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function asString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() !== '' ? value : null;
}
