/**
 * Declarative description of an admin master-data screen, consumed by
 * {@link ResourceCrudComponent}. Each resource (categories, units, products,
 * hubs, …) supplies one `CrudResource` so a single component renders the
 * list, filter, create/edit dialog and row actions consistently.
 */

/** A table row — every managed entity has at least an id. */
export interface CrudRow {
    id: string;
    isActive?: boolean;
    [key: string]: unknown;
}

/** Form value emitted by the create/edit dialog (per field name). */
export type CrudFormValue = Record<string, string | number | null>;

export interface CrudColumn {
    /** i18n key for the header cell — also the column's sort key. */
    label: string;
    /** Text to render for a given row (an image URL when `image` is set). */
    cell: (row: CrudRow) => string;
    /** Render the cell as a thumbnail whose `src` is `cell(row)`. */
    image?: boolean;
    /** Makes the header a sort toggle. */
    sortable?: boolean;
    /**
     * Value to sort on, when the rendered `cell` text won't order correctly —
     * chiefly numeric columns, whose `cell` is formatted (`"500 kg"`) and would
     * otherwise sort lexically. Defaults to `cell(row)`.
     */
    sortValue?: (row: CrudRow) => string | number | null;
}

export type CrudFieldType =
    | 'text'
    | 'number'
    | 'textarea'
    | 'select'
    | 'location'
    | 'image';

export interface CrudOption {
    value: string;
    label: string;
}

export interface CrudField {
    /** Form-control name; also the key written into the request payload. */
    name: string;
    /** i18n key for the label. */
    label: string;
    type: CrudFieldType;
    required?: boolean;
    /** Max string length (`text`/`textarea`) — enforced client-side. */
    maxLength?: number;
    /** Minimum numeric value (`number`) — enforced client-side. */
    min?: number;
    /** Shown only when creating (e.g. an immutable code). */
    createOnly?: boolean;
    /** Shown only when editing (e.g. an image the create endpoint ignores). */
    editOnly?: boolean;
    /** Options for `type: 'select'`, loaded when the dialog opens. */
    options?: () => Promise<CrudOption[]>;
    /**
     * For `type: 'select'`: shows a filter box inside the dropdown so a long
     * option list (categories, products) can be narrowed by typing.
     */
    searchable?: boolean;
    /**
     * For `type: 'image'`: uploads the picked file and resolves to the hosted
     * URL, which is written into the control (and thus the request payload).
     */
    upload?: (file: File) => Promise<string>;
    /**
     * For `type: 'location'`: the control/payload keys the map picker reads and
     * writes. The location field itself holds no value.
     */
    latField?: string;
    lngField?: string;
}

/**
 * A page-level dropdown filter shown next to the search box. The selected
 * option value is matched against each row via {@link match}; an empty value
 * (the "all" option) disables the filter.
 */
export interface CrudFilter {
    /** Control key — unique per resource. */
    name: string;
    /** i18n key for the placeholder/label ("All categories", …). */
    label: string;
    /**
     * Dropdown options, rebuilt whenever the list loads.
     *
     * Receives the rows just fetched, so a filter derived from the list itself
     * (the category parent filter) can be computed from them instead of issuing
     * a second identical GET.
     */
    options: (rows: CrudRow[]) => Promise<CrudOption[]>;
    /** Keeps a row when it matches the selected (non-empty) value. */
    match: (row: CrudRow, value: string) => boolean;
}

export interface CrudRowAction {
    icon: string;
    /** i18n key for the tooltip. */
    tooltip: string;
    run: (row: CrudRow) => void;
}

/**
 * A page-level button rendered next to "Create". Receives the rows currently
 * loaded so an action can operate on the whole list (e.g. visualise it) without
 * re-fetching.
 */
export interface CrudHeaderAction {
    /** Heroicons id (rendered with the `heroicons_outline:` prefix). */
    icon: string;
    /** i18n key for the button label. */
    label: string;
    /**
     * @param rows   the rows currently loaded.
     * @param reload re-runs `resource.list()`; call it when the action changed
     *               data behind the table's back (e.g. the map's drag-to-reparent).
     */
    run: (rows: CrudRow[], reload: () => void) => void;
}

export interface CrudResource {
    /** i18n key for the page title. */
    title: string;
    /** i18n key for the page subtitle. */
    subtitle: string;
    /** i18n key for the create button + dialog heading. */
    createLabel: string;
    columns: CrudColumn[];
    fields: CrudField[];
    /** Row keys the client-side search box matches against. Omit to hide it. */
    searchKeys?: string[];
    /** i18n key for the search input placeholder (names what it matches on). */
    searchPlaceholder?: string;
    /** Page-level dropdown filters shown next to the search box. */
    filters?: CrudFilter[];
    list: () => Promise<CrudRow[]>;
    create: (value: CrudFormValue) => Promise<void>;
    update: (id: string, value: CrudFormValue) => Promise<void>;
    /** Deactivate or delete a row; omit if the resource can't be removed. */
    remove?: (row: CrudRow) => Promise<void>;
    /** i18n key for the remove tooltip/confirm (e.g. deactivate vs delete). */
    removeLabel?: string;
    /**
     * Set when `remove` deactivates the row rather than deleting it, so the
     * action can be disabled on rows that are already inactive (running it
     * again does nothing). Leave unset for hard deletes, which stay available
     * whatever the row's status.
     */
    removeIsDeactivate?: boolean;
    /**
     * Restores a deactivated row. When present, the row action on an inactive
     * row becomes "reactivate" instead of being disabled. Requires
     * {@link removeIsDeactivate}.
     */
    activate?: (row: CrudRow) => Promise<void>;
    /** Heroicons id for the remove action (default `trash`). */
    removeIcon?: string;
    /** Extra per-row actions (e.g. "manage pricing"). */
    rowActions?: CrudRowAction[];
    /** Extra page-level buttons shown beside "Create" (e.g. "view map"). */
    headerActions?: CrudHeaderAction[];
    /**
     * When `false`, rows use edit/remove action buttons + a dialog instead of
     * the expandable detail panel. Prefer for resources with only a couple of
     * fields (e.g. categories). Default `true` (markets inventory pattern).
     */
    inlineDetail?: boolean;
}
