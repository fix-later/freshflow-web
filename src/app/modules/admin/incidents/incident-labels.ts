import { AdminIncident } from './incidents.types';

/**
 * How a report is worded and coloured, shared by the two screens that show
 * them: the console-wide board (Admin ▸ Báo cáo sự cố) and the per-session tab
 * inside a phiên chợ.
 *
 * Pure functions taking a `translate`, rather than a service: the mapping is a
 * lookup table over the raw backend tokens, and the two screens must not be
 * able to drift apart on what `Unavailable` or `PARTIAL` reads as.
 */

/**
 * The kind, in the reader's language.
 *
 * The sources spell their kinds in different vocabularies —
 * `ProcurementExceptionType` in PascalCase, `HubDiscrepancy.Condition*` in
 * SCREAMING_CASE, and a driver's stop has exactly one kind — so the source
 * decides which table is consulted. A token with no entry shows as itself: a
 * new backend kind reads as a raw word, never as a missing label.
 */
export function incidentTypeLabel(
    incident: AdminIncident,
    translate: (key: string) => string
): string {
    const token = incident.type.trim();
    if (!token) {
        return '—';
    }
    const key =
        incident.source === 'procurement'
            ? `admin.orderGroups.exceptionType.${token}`
            : incident.source === 'delivery'
              ? `admin.incidents.delivery.${token}`
              : `admin.incidents.condition.${token.toLowerCase()}`;
    const label = translate(key);
    return label === key ? token : label;
}

/** Translation key for the row's status — `reported` when it carries none. */
export function incidentStatusKey(incident: AdminIncident): string {
    return incident.status
        ? `admin.incidents.status.${incident.status}`
        : 'admin.incidents.status.reported';
}

export function incidentStatusPillClass(incident: AdminIncident): string {
    switch (incident.status) {
        case 'open':
            return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200';
        case 'acknowledged':
            return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200';
        default:
            return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200';
    }
}

/**
 * Who reported it. The hub DTO carries no reporter id at all, and a delivery
 * whose route the roster cannot name has none either, so both fall back to the
 * role rather than inventing a person.
 */
export function incidentReporterLabel(
    incident: AdminIncident,
    translate: (key: string) => string
): string {
    if (incident.reporterName) {
        return incident.reporterName;
    }
    switch (incident.source) {
        case 'hub':
            return translate('admin.incidents.reporter.hubStaff');
        case 'delivery':
            return translate('admin.incidents.reporter.driver');
        default:
            return '—';
    }
}

/**
 * Whether an admin can still sign this one off.
 *
 * Only hub discrepancies have a lifecycle — until one is acknowledged the hub
 * cannot dispatch (BR-HUB-2). A market agent's exception is a record of what
 * happened at the chợ and has nothing to close.
 */
export function canAcknowledgeIncident(incident: AdminIncident): boolean {
    return (
        incident.source === 'hub' &&
        incident.status === 'open' &&
        !!incident.hubId
    );
}

/** Newest first — what both screens list reports in. */
export function byReportedAtDesc(
    left: AdminIncident,
    right: AdminIncident
): number {
    return (right.reportedAt ?? '').localeCompare(left.reportedAt ?? '');
}
