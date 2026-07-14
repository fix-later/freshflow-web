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
    /** i18n key for the header cell. */
    label: string;
    /** Text to render for a given row. */
    cell: (row: CrudRow) => string;
}

export type CrudFieldType = 'text' | 'number' | 'textarea' | 'select';

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
    /** Shown only when creating (e.g. an immutable code). */
    createOnly?: boolean;
    /** Options for `type: 'select'`, loaded when the dialog opens. */
    options?: () => Promise<CrudOption[]>;
}

export interface CrudRowAction {
    icon: string;
    /** i18n key for the tooltip. */
    tooltip: string;
    run: (row: CrudRow) => void;
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
    list: () => Promise<CrudRow[]>;
    create: (value: CrudFormValue) => Promise<void>;
    update: (id: string, value: CrudFormValue) => Promise<void>;
    /** Deactivate or delete a row; omit if the resource can't be removed. */
    remove?: (row: CrudRow) => Promise<void>;
    /** i18n key for the remove tooltip/confirm (e.g. deactivate vs delete). */
    removeLabel?: string;
    /** Heroicons id for the remove action (default `trash`). */
    removeIcon?: string;
    /** Extra per-row actions (e.g. "manage pricing"). */
    rowActions?: CrudRowAction[];
}
