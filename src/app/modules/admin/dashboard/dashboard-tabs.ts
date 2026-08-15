/**
 * The four sections of the admin dashboard.
 *
 * These used to be four nav entries (three of them under a "Dashboard" branch,
 * plus an audit-log screen with no nav entry at all and therefore no way in).
 * They are one page now: all four answer "how is the platform doing right
 * now", they are read one after another rather than navigated between, and
 * three of them share the same date range.
 *
 * Order follows how the question is usually asked — what happened (analytics),
 * what it is worth (finance), what went wrong (claims), who did what
 * (activity).
 */
export const DASHBOARD_TABS = [
    {
        index: 0,
        slug: 'analytics',
        label: 'admin.dashboard.tabs.analytics',
        icon: 'heroicons_outline:chart-bar',
    },
    {
        index: 1,
        slug: 'finance',
        label: 'admin.dashboard.tabs.finance',
        icon: 'heroicons_outline:banknotes',
    },
    {
        index: 2,
        slug: 'claims',
        label: 'admin.dashboard.tabs.claims',
        icon: 'heroicons_outline:exclamation-triangle',
    },
    {
        index: 3,
        slug: 'activity',
        label: 'admin.dashboard.tabs.activity',
        icon: 'heroicons_outline:clipboard-document-list',
    },
] as const;

/** The `?tab=` value a tab travels under. */
export type DashboardTabSlug = (typeof DASHBOARD_TABS)[number]['slug'];

/**
 * The tab a `?tab=` value names, or 0 for anything unrecognised — a stale
 * bookmark lands on analytics rather than on a blank panel.
 */
export function dashboardTabIndexOf(slug: string | null | undefined): number {
    return DASHBOARD_TABS.find((tab) => tab.slug === slug)?.index ?? 0;
}

/** The slug for a tab index, for writing the URL back. */
export function dashboardTabSlugOf(index: number): DashboardTabSlug {
    return (
        DASHBOARD_TABS.find((tab) => tab.index === index) ?? DASHBOARD_TABS[0]
    ).slug;
}
