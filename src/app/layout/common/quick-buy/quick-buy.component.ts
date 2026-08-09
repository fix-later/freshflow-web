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
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { PermissionsService } from 'app/core/auth/permissions/permissions.service';
import { activeLang } from 'app/core/i18n/active-lang';
import {
    ASSISTANT_MESSAGE_MAX_LENGTH,
    AssistantPendingConfirmation,
    AssistantService,
} from './assistant.service';

interface QuickBuyMessage {
    role: 'user' | 'assistant';
    text: string;
    /** Set on the message that reported a failure, so it can offer a retry. */
    failed?: boolean;
}

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
 * **The panel is detached into a CDK overlay, not left inline.** The trigger
 * sits in the header on desktop and inside the mobile bottom bar — and that bar
 * is `position: fixed; z-index: 50`, which opens a stacking context. Rendered
 * in place, the panel's own `z-index: 96` is scoped inside that 50, so
 * `contact-fab` (root, `z-index: 90`) painted over the sheet and swallowed
 * taps on the send button. Attaching to the overlay container puts the panel at
 * the document root, out of every ancestor's stacking context.
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
    imports: [FormsModule, MatIconModule, MatTooltipModule, TranslocoModule],
})
export class QuickBuyComponent {
    private readonly _assistant = inject(AssistantService);
    private readonly _permissions = inject(PermissionsService);
    private readonly _transloco = inject(TranslocoService);
    private readonly _overlay = inject(Overlay);
    private readonly _viewContainer = inject(ViewContainerRef);
    private readonly _destroyRef = inject(DestroyRef);

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

    readonly opened = signal(false);
    readonly sending = signal(false);
    readonly query = signal('');
    readonly messages = signal<QuickBuyMessage[]>([]);

    /** The order awaiting an explicit press of the confirm button. */
    readonly pending = signal<AssistantPendingConfirmation | null>(null);

    /** Last thing the user typed — what {@link retry} re-sends. */
    private _lastUserMessage = '';

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

    constructor() {
        // Anything that lengthens the transcript — a message, the typing
        // indicator, the receipt — pins the view to the newest content. Without
        // this the panel stayed where it was and the reply arrived off-screen.
        effect(() => {
            this.messages();
            this.sending();
            this.pending();
            if (this.opened()) {
                this._scrollToLatest();
            }
        });

        this._destroyRef.onDestroy(() => this._detach());
    }

    // ── Panel ────────────────────────────────────────────────────────────

    toggle(): void {
        if (this.opened()) {
            this.close();
        } else {
            this.open();
        }
    }

    open(): void {
        if (this.opened() || !this.available()) {
            return;
        }
        this.opened.set(true);
        this._attach();
        setTimeout(() => this._composer()?.nativeElement.focus());
    }

    close(): void {
        if (!this.opened()) {
            return;
        }
        this.query.set('');
        this.opened.set(false);
        this._detach();
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
        this.messages.set([]);
        this.query.set('');
        this._lastUserMessage = '';
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
    confirmOrder(): void {
        const pending = this.pending();
        if (!pending || this.sending()) {
            return;
        }
        const text = this._transloco.translate('assistant.confirm.sent');
        this.pending.set(null);
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

    // ── Formatting ───────────────────────────────────────────────────────

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
                deliveryAddressId: options?.deliveryAddressId,
            });
            this._push({ role: 'assistant', text: answer.reply });
            this.pending.set(answer.pendingConfirmation);
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
        });
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
