import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

/**
 * Translates a value the backend chose — a transaction type, a payment method,
 * a status — through `<prefix>.<value>`.
 *
 * The API answers with its own identifiers (`charge`, `bank_transfer`,
 * `pendingissuance`), which are not words a Vietnamese operator should be
 * reading off a screen. Rather than a lookup per call site, every enum-shaped
 * field goes through here with the i18n prefix its values live under.
 *
 * An unmapped value falls through to itself. That is deliberate: a backend that
 * adds a status ships it before the translation catches up, and the raw token
 * is more useful on screen than a blank cell or a raw key.
 *
 * Impure like {@link RoleLabelPipe}: switching language changes the output
 * without changing the input, which a pure pipe would never re-evaluate.
 */
@Pipe({ name: 'apiLabel', standalone: true, pure: false })
export class ApiLabelPipe implements PipeTransform {
    private readonly _transloco = inject(TranslocoService);

    transform(value: unknown, prefix: string): string {
        const raw = String(value ?? '').trim();
        if (!raw || !prefix) {
            return raw;
        }
        // Values arrive snake_cased (`bank_transfer`) or, from a few `ToString()`
        // paths, in the enum's own casing (`PendingIssuance`) — both resolve to
        // the same key.
        const key = `${prefix}.${raw.toLowerCase()}`;
        const label = this._transloco.translate(key);
        return label && label !== key ? label : raw;
    }
}
