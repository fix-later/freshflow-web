import { inject, Injectable } from '@angular/core';
import { parseJson, unwrapData } from 'app/core/api/envelope';
import { MarketSelectionService } from 'app/core/market/market-selection.service';
import { rawApi } from 'contract';

/** `AssistantChatRequestValidator.MaxMessageLength` — 400 above it. */
export const ASSISTANT_MESSAGE_MAX_LENGTH = 4000;

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
 * Sent through `rawApi` rather than the generated client: the checked-in
 * `AssistantChatRequest` model predates `deliveryAddressId`, so the typed call
 * cannot carry the field the confirmation gate needs. `rawApi` still applies
 * bearer auth, 401 refresh-and-retry and the typed error classes.
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

    private _sessionId = newSessionId();

    /** The handle the current conversation is running under. */
    get sessionId(): string {
        return this._sessionId;
    }

    /** Abandons the conversation; the next message starts a new one. */
    reset(): void {
        this._sessionId = newSessionId();
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
        const res = await rawApi.send('/api/v1/assistant/chat', 'POST', {
            sessionId: this._sessionId,
            message,
            // Product search is market-scoped, same as the catalogue the buyer
            // is looking at; omitted when no market is picked yet.
            marketId: this._marketSelection.selectedId() || null,
            deliveryAddressId: options?.deliveryAddressId ?? null,
            confirmOrderId: options?.confirmOrderId ?? null,
        });
        const data = unwrapData<Record<string, unknown>>(await parseJson(res));
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
