import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

/**
 * Roles the backend seeds (`RoleNames`), plus the `kiosk_staff` alias older API
 * versions still answer with. Anything outside this set is shown as-is rather
 * than as a missing-translation key.
 */
const KNOWN_ROLES = new Set([
    'admin',
    'operations_manager',
    'market_agent',
    'kiosk_staff',
    'hub_staff',
    'driver',
    'restaurant',
]);

/**
 * Renders a role as its translated name — `market_agent` → "Nhân viên chợ".
 *
 * The API speaks in snake_case identifiers, which leaked straight into every
 * screen that shows a role. Impure on purpose: transloco swaps the active
 * language without the input changing, and a pure pipe would keep the words it
 * was first rendered with.
 */
@Pipe({ name: 'roleLabel', standalone: true, pure: false })
export class RoleLabelPipe implements PipeTransform {
    private readonly _transloco = inject(TranslocoService);

    transform(role: string | null | undefined): string {
        const key = (role ?? '').trim();
        if (!key) {
            return '';
        }
        return KNOWN_ROLES.has(key)
            ? this._transloco.translate(`admin.roles.${key}`)
            : key;
    }
}
