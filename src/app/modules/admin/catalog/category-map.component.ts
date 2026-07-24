import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    ViewChild,
    ViewEncapsulation,
    computed,
    inject,
    signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { CrudRow } from '../shared/resource-crud.types';
import { CatalogAdminService } from './catalog-admin.service';

/** Horizontal spacing between depth levels, in SVG units. */
const COL_WIDTH = 240;
/** Vertical pitch between sibling leaves. */
const ROW_HEIGHT = 44;
const NODE_WIDTH = 200;
const NODE_HEIGHT = 32;
const PADDING = 24;
/** Longest label rendered before ellipsis (SVG text does not wrap or clip). */
const MAX_LABEL = 26;
/** Pointer travel before a press is treated as a drag rather than a click. */
const DRAG_THRESHOLD = 4;
/**
 * Slack around a node's box when hit-testing a drop. Must stay below half the
 * gap between rows (`ROW_HEIGHT - NODE_HEIGHT`) so two rows never both match.
 */
const HIT_PADDING = 5;
/** Height of the "drop here to clear the parent" band, and its gap above. */
const ROOT_ZONE_HEIGHT = 44;
const ROOT_ZONE_GAP = 16;

/**
 * Drop-target sentinel for the root zone. Not a valid uuid, so it can never
 * collide with a category id.
 */
export const ROOT_ZONE = '__root__';

/** A category placed on the canvas. */
export interface MapNode {
    id: string;
    label: string;
    /** Full, untruncated name — shown as a tooltip and sent on re-parent. */
    title: string;
    parentId: string | null;
    depth: number;
    x: number;
    y: number;
    childCount: number;
}

/** A parent→child connector, pre-rendered as an SVG cubic path. */
export interface MapEdge {
    id: string;
    /** The child end — used to dim the link a drag is about to replace. */
    childId: string;
    path: string;
}

interface TreeNode {
    id: string;
    name: string;
    parentId: string | null;
    children: TreeNode[];
}

export interface CategoryMapData {
    rows: CrudRow[];
}

/** Cubic connector from a parent's right edge to a child's left edge. */
function connector(x1: number, y1: number, x2: number, y2: number): string {
    const mid = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
}

function truncate(value: string): string {
    return value.length > MAX_LABEL
        ? `${value.slice(0, MAX_LABEL - 1)}…`
        : value;
}

/**
 * Builds the category forest from flat rows.
 *
 * The rows come from an untyped API, so this is defensive on two fronts: a
 * `parentId` pointing at a category that isn't in the list is treated as no
 * parent (the node becomes a root rather than disappearing), and nodes are
 * attached at most once so a cycle can't produce an infinite tree.
 */
function buildForest(rows: CrudRow[]): TreeNode[] {
    const nodes = new Map<string, TreeNode>();
    for (const row of rows) {
        if (row.id) {
            nodes.set(row.id, {
                id: row.id,
                name: String(row['name'] ?? row.id),
                parentId: row['parentId'] ? String(row['parentId']) : null,
                children: [],
            });
        }
    }

    /**
     * True when following `parentId` upwards from `id` never terminates.
     *
     * Attaching such a node would put a cycle into the child graph, and the
     * layout walk recurses over children — so it would never return. Nodes on a
     * cycle are detached and rendered as roots instead, which keeps every
     * category visible rather than hanging or dropping it.
     */
    const isCyclic = (id: string): boolean => {
        const seen = new Set<string>();
        let cursor: string | null | undefined = id;
        while (cursor) {
            if (seen.has(cursor)) {
                return true;
            }
            seen.add(cursor);
            cursor = nodes.get(cursor)?.parentId;
        }
        return false;
    };

    const roots: TreeNode[] = [];
    for (const node of nodes.values()) {
        const parent = node.parentId ? nodes.get(node.parentId) : undefined;
        if (parent && parent.id !== node.id && !isCyclic(node.id)) {
            parent.children.push(node);
        } else {
            roots.push(node);
        }
    }
    return roots;
}

/**
 * Admin ▸ Catalog ▸ Categories ▸ Mind map.
 *
 * Renders the category hierarchy as a left-to-right tidy tree: leaves are laid
 * out on a fixed vertical pitch and every parent is centred on the span of its
 * children, so sibling groups read as blocks and no two nodes overlap.
 *
 * Nodes can be dragged onto another node to re-parent them, which writes
 * straight through to `PUT /categories/{id}`. Dropping anywhere that is not a
 * valid target cancels — in particular, the map cannot clear a parent (there is
 * no "no parent" drop zone); use the edit form for that.
 */
@Component({
    selector: 'admin-category-map',
    templateUrl: './category-map.component.html',
    styleUrls: ['./category-map.component.scss'],
    // ViewEncapsulation.None matches the rest of the admin console; the marks
    // are namespaced with a `category-map-` prefix so they can't leak.
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatButtonModule,
        MatDialogModule,
        MatIconModule,
        MatProgressBarModule,
        MatSnackBarModule,
        MatTooltipModule,
        TranslocoModule,
    ],
})
export class CategoryMapComponent {
    private readonly _data = inject<CategoryMapData>(MAT_DIALOG_DATA);
    private readonly _catalog = inject(CatalogAdminService);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);

    @ViewChild('canvas') private _canvas?: ElementRef<SVGSVGElement>;

    readonly nodeWidth = NODE_WIDTH;
    readonly nodeHeight = NODE_HEIGHT;

    readonly zoom = signal(1);
    readonly saving = signal(false);
    /** True once a re-parent succeeded, so the table behind reloads on close. */
    readonly changed = signal(false);

    /** Live rows — replaced from the API after every successful re-parent. */
    private readonly _rows = signal<CrudRow[]>(this._data.rows);

    // ---- Drag state -------------------------------------------------------

    readonly dragId = signal<string | null>(null);
    /** Pointer offset from the drag origin, in SVG units. */
    readonly dragDelta = signal<{ x: number; y: number }>({ x: 0, y: 0 });
    readonly dropTargetId = signal<string | null>(null);
    private _pointerStart: { x: number; y: number } | null = null;
    private _pressedId: string | null = null;

    private readonly _layout = computed(() => {
        const roots = buildForest(this._rows());
        const nodes: MapNode[] = [];
        const placed = new Map<string, MapNode>();
        const edges: MapEdge[] = [];
        let nextLeafRow = 0;
        let maxDepth = 0;

        /** Post-order placement: leaves consume a row, parents centre on kids. */
        const place = (node: TreeNode, depth: number): number => {
            maxDepth = Math.max(maxDepth, depth);
            const x = PADDING + depth * COL_WIDTH;
            let y: number;

            if (!node.children.length) {
                y = PADDING + nextLeafRow * ROW_HEIGHT;
                nextLeafRow += 1;
            } else {
                const childYs = node.children.map((child) =>
                    place(child, depth + 1)
                );
                y = (Math.min(...childYs) + Math.max(...childYs)) / 2;
            }

            const placedNode: MapNode = {
                id: node.id,
                label: truncate(node.name),
                title: node.name,
                parentId: node.parentId,
                depth,
                x,
                y,
                childCount: node.children.length,
            };
            nodes.push(placedNode);
            placed.set(node.id, placedNode);

            for (const child of node.children) {
                const childNode = placed.get(child.id);
                if (!childNode) {
                    continue;
                }
                edges.push({
                    id: `${node.id}-${child.id}`,
                    childId: child.id,
                    path: connector(
                        x + NODE_WIDTH,
                        y + NODE_HEIGHT / 2,
                        childNode.x,
                        childNode.y + NODE_HEIGHT / 2
                    ),
                });
            }
            return y;
        };

        roots.forEach((root) => place(root, 0));

        const contentHeight =
            PADDING * 2 + Math.max(nextLeafRow, 1) * ROW_HEIGHT;
        return {
            nodes,
            edges,
            width: PADDING * 2 + (maxDepth + 1) * COL_WIDTH,
            // The root zone is reserved below the tree, so it is always visible
            // rather than appearing mid-drag and shifting the layout.
            zoneY: contentHeight + ROOT_ZONE_GAP,
            height: contentHeight + ROOT_ZONE_GAP + ROOT_ZONE_HEIGHT + PADDING,
        };
    });

    readonly nodes = computed(() => this._layout().nodes);
    readonly edges = computed(() => this._layout().edges);
    readonly rootZone = computed(() => ({
        x: PADDING,
        y: this._layout().zoneY,
        width: this._layout().width - PADDING * 2,
        height: ROOT_ZONE_HEIGHT,
    }));
    readonly ROOT_ZONE = ROOT_ZONE;

    /**
     * The link a drop would create, drawn live while dragging.
     *
     * Runs from the prospective parent's right edge to the dragged node's
     * current position, so the parent–child relationship is visible before the
     * write happens. Null when there is no valid target (including over the
     * root zone, which removes a link rather than creating one).
     */
    readonly previewEdge = computed(() => {
        const dragId = this.dragId();
        const targetId = this.dropTargetId();
        if (!dragId || !targetId || targetId === ROOT_ZONE) {
            return null;
        }
        const parent = this.nodes().find((n) => n.id === targetId);
        const child = this.nodes().find((n) => n.id === dragId);
        if (!parent || !child) {
            return null;
        }
        const { x: dx, y: dy } = this.dragDelta();
        return connector(
            parent.x + NODE_WIDTH,
            parent.y + NODE_HEIGHT / 2,
            child.x + dx,
            child.y + dy + NODE_HEIGHT / 2
        );
    });

    /** True for the link the current drag would replace, so it can fade out. */
    isEdgeSuperseded(edge: MapEdge): boolean {
        return !!this.dragId() && edge.childId === this.dragId();
    }
    readonly viewBox = computed(
        () => `0 0 ${this._layout().width} ${this._layout().height}`
    );
    readonly canvasWidth = computed(() => this._layout().width * this.zoom());
    readonly canvasHeight = computed(() => this._layout().height * this.zoom());

    /** Parent lookup used by the cycle guard. */
    private readonly _parentOf = computed(
        () => new Map(this.nodes().map((n) => [n.id, n.parentId]))
    );

    zoomIn(): void {
        this.zoom.update((z) => Math.min(2, z + 0.2));
    }

    zoomOut(): void {
        this.zoom.update((z) => Math.max(0.4, z - 0.2));
    }

    zoomReset(): void {
        this.zoom.set(1);
    }

    // ---- Dragging ---------------------------------------------------------

    onPointerDown(node: MapNode, event: PointerEvent): void {
        if (this.saving() || event.button !== 0) {
            return;
        }
        event.preventDefault();
        this._pressedId = node.id;
        this._pointerStart = this._toSvg(event);
        (event.target as Element).setPointerCapture?.(event.pointerId);
    }

    onPointerMove(event: PointerEvent): void {
        if (!this._pressedId || !this._pointerStart) {
            return;
        }
        const point = this._toSvg(event);
        const dx = point.x - this._pointerStart.x;
        const dy = point.y - this._pointerStart.y;

        // Only promote to a drag past the threshold, so a plain click on a node
        // (or a click-and-release wobble) never re-parents anything.
        if (
            !this.dragId() &&
            Math.hypot(dx, dy) * this.zoom() < DRAG_THRESHOLD
        ) {
            return;
        }
        this.dragId.set(this._pressedId);
        this.dragDelta.set({ x: dx, y: dy });
        this.dropTargetId.set(this._targetAt(point));
    }

    onPointerUp(): void {
        const dragId = this.dragId();
        const targetId = this.dropTargetId();
        this._pressedId = null;
        this._pointerStart = null;
        this.dragId.set(null);
        this.dragDelta.set({ x: 0, y: 0 });
        this.dropTargetId.set(null);

        if (dragId && targetId) {
            void this._reparent(
                dragId,
                targetId === ROOT_ZONE ? null : targetId
            );
        }
    }

    /** Whether a node may be dropped onto `target`. */
    canDropOn(dragId: string, targetId: string): boolean {
        if (dragId === targetId) {
            return false;
        }
        const parentOf = this._parentOf();
        // Already its parent — nothing to change.
        if (parentOf.get(dragId) === targetId) {
            return false;
        }
        // Target must not be a descendant of the dragged node, or the two would
        // form a cycle that no longer renders as a tree.
        let cursor: string | null | undefined = targetId;
        const seen = new Set<string>();
        while (cursor && !seen.has(cursor)) {
            if (cursor === dragId) {
                return false;
            }
            seen.add(cursor);
            cursor = parentOf.get(cursor);
        }
        return true;
    }

    /** Translation applied to the node being dragged. */
    dragTransform(node: MapNode): string {
        if (this.dragId() !== node.id) {
            return '';
        }
        const { x, y } = this.dragDelta();
        return `translate(${x} ${y})`;
    }

    /** Converts a pointer position to SVG user units. */
    private _toSvg(event: PointerEvent): { x: number; y: number } {
        const svg = this._canvas?.nativeElement;
        if (!svg) {
            return { x: 0, y: 0 };
        }
        const rect = svg.getBoundingClientRect();
        // width/height are exactly viewBox × zoom, so there is no letterboxing
        // and the scale factor is the zoom itself.
        const scale = this.zoom();
        return {
            x: (event.clientX - rect.left) / scale,
            y: (event.clientY - rect.top) / scale,
        };
    }

    /** The drop target under a point — a node id, {@link ROOT_ZONE}, or none. */
    private _targetAt(point: { x: number; y: number }): string | null {
        const dragId = this._pressedId;
        if (!dragId) {
            return null;
        }

        const zone = this.rootZone();
        if (
            point.x >= zone.x &&
            point.x <= zone.x + zone.width &&
            point.y >= zone.y &&
            point.y <= zone.y + zone.height
        ) {
            // Only meaningful for a node that currently has a parent.
            const dragged = this.nodes().find((n) => n.id === dragId);
            return dragged?.parentId ? ROOT_ZONE : null;
        }

        // The hit box is padded so bringing a node alongside a target latches
        // on, rather than demanding an exact overlap. Padding stays under half
        // the row pitch so neighbouring rows can't both match.
        const hit = this.nodes().find(
            (n) =>
                point.x >= n.x - HIT_PADDING &&
                point.x <= n.x + NODE_WIDTH + HIT_PADDING &&
                point.y >= n.y - HIT_PADDING &&
                point.y <= n.y + NODE_HEIGHT + HIT_PADDING
        );
        return hit && this.canDropOn(dragId, hit.id) ? hit.id : null;
    }

    /**
     * Writes the new parent through to the API. `null` promotes the category to
     * the top level.
     *
     * `PUT /categories/{id}` replaces the whole record, so the current name is
     * resent alongside the new `parentId`. On success the list is re-fetched
     * rather than patched locally, so the map reflects whatever the server
     * actually stored.
     */
    private async _reparent(
        childId: string,
        parentId: string | null
    ): Promise<void> {
        const child = this.nodes().find((n) => n.id === childId);
        if (!child) {
            return;
        }
        this.saving.set(true);
        try {
            await this._catalog.updateCategory(childId, {
                name: child.title,
                parentId,
            });
            const rows = await this._catalog.listCategories();
            this._rows.set(rows.filter((row) => row.isActive !== false));
            this.changed.set(true);
            this._notify(
                this._transloco.translate(
                    parentId
                        ? 'admin.categories.map.moveSuccess'
                        : 'admin.categories.map.promoteSuccess'
                )
            );
        } catch (err) {
            this._notify(
                await describeApiError(
                    err,
                    (key) => this._transloco.translate(key),
                    'admin.categories.map.moveError'
                )
            );
        } finally {
            this.saving.set(false);
        }
    }

    private _notify(message: string): void {
        this._snackBar.open(message, undefined, { duration: 3000 });
    }
}
