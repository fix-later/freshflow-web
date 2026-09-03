import { inject, Injectable, signal } from '@angular/core';
import { parseJson, unwrapData } from 'app/core/api/envelope';
import { MarketSelectionService } from 'app/core/market/market-selection.service';
import { assistantApi } from 'contract';

/** `AssistantChatRequestValidator.MaxMessageLength` — 400 above it. */
export const ASSISTANT_MESSAGE_MAX_LENGTH = 4000;

/** Where a reload picks the conversation back up from. */
const STORAGE_KEY = 'freshflow.assistant.session';

/**
 * How long a stored conversation is worth restoring.
 *
 * Matched to the server's own conversation TTL (`DbConversationStore.Ttl`, 30
 * minutes, slid forward on every save). Past it the server has forgotten the
 * conversation, so restoring the transcript would put words on screen the
 * assistant can no longer remember saying — a history that lies about what the
 * next message will be answered against. Both sides forget together instead.
 */
const SESSION_TTL_MS = 30 * 60 * 1000;

/** One rendered turn, as the panel drew it. */
export interface AssistantStoredMessage {
    role: 'user' | 'assistant';
    text: string;
    failed?: boolean;
}

/** What survives a reload: the handle, what was said, and what it built. */
interface StoredSession {
    sessionId: string;
    messages: AssistantStoredMessage[];
    draftOrderId: string | null;
    /** When it was last written — compared against {@link SESSION_TTL_MS}. */
    at: number;
}

/**
 * An order the assistant has prepared but deliberately not confirmed.
 *
 * The backend never confirms on its own (the two-phase gate, T4): it hands back
 * this record and waits for the client to call again with `confirmOrderId` set
 * to exactly this `orderId`. Nothing the model says can set that field.
 */
export interface AssistantPendingConfirmation {
    orderId: string;
    deliveryAddressId: string;
    /** Raw JSON of the credit/cutoff preview, for rendering the summary. */
    previewJson?: string | null;
}

/** One turn's answer (`AssistantChatResponse`). */
export interface AssistantReply {
    reply: string;
    sessionId: string;
    pendingConfirmation: AssistantPendingConfirmation | null;
    draftOrderId: string | null;
}

/**
 * The restaurant's AI shopping assistant (`POST /api/v1/assistant/chat`).
 *
 * **Session identity.** `sessionId` is a client-generated handle, and the
 * server treats it as one: it is not a secret, and a session belonging to
 * another user answers 404 rather than resuming. It is minted once per
 * conversation here and kept in memory only — a reload starts a fresh
 * conversation, which is the honest behaviour given nothing is stored locally.
 */
@Injectable({ providedIn: 'root' })
export class AssistantService {
    private readonly _marketSelection = inject(MarketSelectionService);

    /**
     * Whether the chat box is up.
     *
     * Shared rather than owned by the panel, because two controls open the same
     * box — the header tool and the floating launcher — and they sit in
     * different corners of the layout tree.
     */
    readonly opened = signal(false);

    /**
     * Whether the greeting has already been offered and answered — opened,
     * started or dismissed.
     *
     * Kept here rather than in the bubble, for two reasons. The launcher that
     * hosts it unmounts and remounts as the layout re-renders, and the rule is
     * "once per session", not "once per mount". And the panel has to be able to
     * spend it too: opening the chat by any route means the greeting has done
     * its job.
     */
    private readonly _nudgeSpent = signal(false);
    readonly nudgeSpent = this._nudgeSpent.asReadonly();

    /**
     * A phrase a greeting starter picked, waiting for the panel to open and
     * send it. One-shot: {@link takeStarter} clears it.
     *
     * A starter is handed over as text rather than sent from here, so it goes
     * through the same path a typed message does — nothing can enter the
     * conversation by a private door.
     */
    private readonly _pendingStarter = signal<string | null>(null);
    readonly pendingStarter = this._pendingStarter.asReadonly();

    /**
     * The conversation restored from the last page, if there was one and the
     * server would still remember it. Read once at construction and handed to
     * the panel when it mounts.
     */
    private readonly _restored = restoreSession();

    private _sessionId = this._restored?.sessionId ?? newSessionId();

    /** The handle the current conversation is running under. */
    get sessionId(): string {
        return this._sessionId;
    }

    /**
     * The transcript a reload came back to, or `[]`.
     *
     * The server keeps the conversation itself — it is stored by session id and
     * resumed on the next turn — but exposes no way to read the turns back, so
     * what the buyer *sees* is restored from this browser's own copy. The two
     * are kept on the same clock (see {@link SESSION_TTL_MS}) so the screen and
     * the assistant's memory never disagree about what was said.
     */
    restoredMessages(): AssistantStoredMessage[] {
        return this._restored?.messages ?? [];
    }

    /** The draft the restored conversation had built, if any. */
    restoredDraftOrderId(): string | null {
        return this._restored?.draftOrderId ?? null;
    }

    /**
     * Writes the conversation down so a reload can pick it up.
     *
     * `sessionStorage`, not `localStorage`: this is a tab's conversation, it can
     * name what a restaurant is buying, and on a shared machine it has no
     * business outliving the tab it was typed in. Storage failures are ignored —
     * a private-mode browser still gets a working assistant, just one that
     * forgets on reload.
     */
    persist(
        messages: readonly AssistantStoredMessage[],
        draftOrderId: string | null
    ): void {
        try {
            if (!messages.length) {
                sessionStorage.removeItem(STORAGE_KEY);
                return;
            }
            const stored: StoredSession = {
                sessionId: this._sessionId,
                messages: [...messages],
                draftOrderId,
                at: Date.now(),
            };
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
        } catch {
            // Persistence is a convenience; the conversation still works.
        }
    }

    /** Abandons the conversation; the next message starts a new one. */
    reset(): void {
        this._sessionId = newSessionId();
        this.forget();
    }

    /**
     * Drops the stored conversation.
     *
     * Called when it stops being this browser's to hold — signing out — and by
     * {@link reset}. The in-memory copy is the panel's; this only clears what
     * would otherwise be waiting for the next person to open the tab.
     */
    forget(): void {
        try {
            sessionStorage.removeItem(STORAGE_KEY);
        } catch {
            // Nothing to do: there is no copy we can be sure of either way.
        }
    }

    /**
     * Opens the chat, optionally with a first question already chosen.
     *
     * Either way the greeting is spent: it has been answered, and offering it
     * again over an open conversation would be inviting someone into a room
     * they are standing in.
     */
    openWith(starter?: string): void {
        const phrase = starter?.trim();
        if (phrase) {
            this._pendingStarter.set(phrase);
        }
        this._nudgeSpent.set(true);
        this.opened.set(true);
    }

    /** Turns the greeting down without opening the chat. */
    dismissNudge(): void {
        this._nudgeSpent.set(true);
    }

    /**
     * The starter a greeting picked, if any — returned once and then forgotten,
     * so re-opening the panel does not re-ask the same question.
     */
    takeStarter(): string | null {
        const phrase = this._pendingStarter();
        if (phrase) {
            this._pendingStarter.set(null);
        }
        return phrase;
    }

    /**
     * One conversational turn.
     *
     * `confirmOrderId` is set **only** by the confirm button, never by anything
     * derived from the reply — that is the whole point of the gate. When it is
     * set, `deliveryAddressId` must echo the pending confirmation's, because
     * the server injects that address into the order rather than trusting the
     * model to have chosen one.
     */
    async chat(
        message: string,
        options?: { confirmOrderId?: string; deliveryAddressId?: string }
    ): Promise<AssistantReply> {
        const res = await assistantApi.apiV1AssistantChatPostRaw({
            assistantChatRequest: {
                sessionId: this._sessionId,
                message,
                // Product search is market-scoped, same as the catalogue the
                // buyer is looking at; omitted when no market is picked yet.
                marketId: this._marketSelection.selectedId() || null,
                deliveryAddressId: options?.deliveryAddressId ?? null,
                confirmOrderId: options?.confirmOrderId ?? null,
            },
        });
        const data = unwrapData<Record<string, unknown>>(
            await parseJson(res.raw)
        );
        const pending = data?.['pendingConfirmation'] as
            | Record<string, unknown>
            | null
            | undefined;

        return {
            reply: String(data?.['reply'] ?? ''),
            // The server echoes the handle; trust its copy so a session it
            // rotated is followed rather than overwritten on the next turn.
            sessionId: String(data?.['sessionId'] ?? this._sessionId),
            pendingConfirmation: pending
                ? {
                      orderId: String(pending['orderId'] ?? ''),
                      deliveryAddressId: String(
                          pending['deliveryAddressId'] ?? ''
                      ),
                      previewJson:
                          (pending['previewJson'] as string | null) ?? null,
                  }
                : null,
            draftOrderId: (data?.['draftOrderId'] as string | null) ?? null,
        };
    }
}

/**
 * The stored conversation, if there is one this browser wrote and the server
 * would still recognise.
 *
 * Anything unreadable, malformed or past the TTL reads as "no conversation":
 * a half-parsed transcript on screen would be worse than the fresh start the
 * buyer already expects.
 */
function restoreSession(): StoredSession | null {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw) as Partial<StoredSession>;
        const fresh =
            typeof parsed.at === 'number' &&
            Date.now() - parsed.at < SESSION_TTL_MS;
        if (
            !fresh ||
            typeof parsed.sessionId !== 'string' ||
            !parsed.sessionId ||
            !Array.isArray(parsed.messages)
        ) {
            sessionStorage.removeItem(STORAGE_KEY);
            return null;
        }
        return {
            sessionId: parsed.sessionId,
            messages: parsed.messages.filter(
                (message): message is AssistantStoredMessage =>
                    !!message &&
                    typeof message.text === 'string' &&
                    (message.role === 'user' || message.role === 'assistant')
            ),
            draftOrderId:
                typeof parsed.draftOrderId === 'string'
                    ? parsed.draftOrderId
                    : null,
            at: parsed.at,
        };
    } catch {
        return null;
    }
}

/**
 * A fresh conversation handle. `crypto.randomUUID` where available, with a
 * random fallback for insecure origins (it is a handle, not a credential — the
 * server authorises on the JWT and 404s a session owned by anyone else).
 */
function newSessionId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
