import { inject, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';

/**
 * The active language as a signal, for components that pick a field by locale
 * (`name` vs `nameEn`) rather than going through a translation key.
 *
 * Exists because `computed(() => transloco.getActiveLang() === 'vi')` looks
 * correct and is not: `getActiveLang()` is a plain getter, so the computed has
 * no signal dependency, memoizes the first language it saw, and never
 * recomputes. Every label derived from it then stays stuck in that language for
 * the rest of the session. Reading `langChanges$` gives the computed something
 * real to depend on.
 *
 * Call from an injection context (a field initializer or a constructor).
 */
export function activeLang(): Signal<string> {
    const transloco = inject(TranslocoService);
    return toSignal(transloco.langChanges$, {
        initialValue: transloco.getActiveLang(),
    });
}

/**
 * A price as the storefront writes it, grouped for the active locale.
 *
 * `null` renders as a plain hyphen rather than as zero: a listing without a
 * price has not been priced, which is not the same as being free. The hyphen is
 * deliberately the ASCII one, not an em-dash, per the storefront's typography
 * rule that no em-dash or en-dash appears in rendered text.
 */
export function formatVnd(price: number | null, lang: string): string {
    return price === null ? '-' : `${price.toLocaleString(lang)} ₫`;
}
