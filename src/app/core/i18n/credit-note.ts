/**
 * Translates the notes the backend writes on credit ledger entries.
 *
 * A credit transaction's `description` is either something an operator typed
 * (a settlement note, a claim decision) or one of a handful of sentences the
 * backend writes itself — `"Order confirmed"` when confirming an order,
 * `"Order cancelled"` when refunding one. Those sentences reached the screen in
 * English, in the middle of an otherwise Vietnamese ledger.
 *
 * Only the system's own wording is translated, matched on the exact text it
 * sends; anything else is a person's own words and passes through untouched.
 * Same principle as {@link ApiLabelPipe}: an unrecognised value is shown as it
 * came, because a backend that adds a note ships it before the translation
 * catches up.
 *
 * Sources (freshflow-backend): `OrderConfirmationService`,
 * `CancelOrderCommandHandler`, `ProcurementBatchCancelledIntegrationEventHandler`,
 * `ApproveClaimCommandHandler`, `HubDiscrepancyRecordedIntegrationEventHandler`.
 */

/** Translate function, as `TranslocoService.translate` provides it. */
type Translate = (key: string, params?: Record<string, unknown>) => string;

/** Exact sentences the backend writes, keyed by their lowercased text. */
const SYSTEM_NOTES: Readonly<Record<string, string>> = {
    'order confirmed': 'creditNote.orderConfirmed',
    'order cancelled': 'creditNote.orderCancelled',
    'procurement batch cancelled': 'creditNote.procurementBatchCancelled',
    'claim approved': 'creditNote.claimApproved',
};

/** `Claim approved: <the reviewer's own words>` — prefix only is translated. */
const CLAIM_APPROVED = /^claim approved:\s*(.+)$/i;

/** `Hub discrepancy <id> refund for order item <id>.` — ids are kept. */
const HUB_DISCREPANCY =
    /^hub discrepancy (\S+) refund for order item (\S+?)\.?$/i;

export function translateCreditNote(
    note: string | null | undefined,
    translate: Translate
): string {
    const raw = String(note ?? '').trim();
    if (!raw) {
        return '';
    }

    const exact = SYSTEM_NOTES[raw.toLowerCase()];
    if (exact) {
        return translate(exact);
    }

    const claim = CLAIM_APPROVED.exec(raw);
    if (claim) {
        return `${translate('creditNote.claimApproved')}: ${claim[1]}`;
    }

    const hub = HUB_DISCREPANCY.exec(raw);
    if (hub) {
        return translate('creditNote.hubDiscrepancy', {
            discrepancy: hub[1],
            item: hub[2],
        });
    }

    return raw;
}
