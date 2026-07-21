import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { provideTransloco } from '@jsverse/transloco';
import { CrudRow } from '../shared/resource-crud.types';
import { CategoryMapComponent } from './category-map.component';

/** Minimal Transloco loader — the map's labels aren't under test. */
class StubTranslocoLoader {
    getTranslation(): Promise<Record<string, string>> {
        return Promise.resolve({});
    }
}

function createMap(rows: CrudRow[]): CategoryMapComponent {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
        imports: [CategoryMapComponent],
        providers: [
            { provide: MAT_DIALOG_DATA, useValue: { rows } },
            provideTransloco({
                config: { availableLangs: ['en'], defaultLang: 'en' },
                loader: StubTranslocoLoader,
            }),
        ],
    });
    return TestBed.createComponent(CategoryMapComponent).componentInstance;
}

/**
 * The map writes re-parents straight to the API, so the guard that decides
 * whether a drop is legal is the piece that must not be wrong: an accepted bad
 * drop would persist a cycle the tree can no longer render.
 */
describe('CategoryMapComponent — drag-to-reparent guard', () => {
    // root
    //  ├── child
    //  │    └── grandchild
    //  └── sibling
    const rows: CrudRow[] = [
        { id: 'root', name: 'Root' },
        { id: 'child', name: 'Child', parentId: 'root' },
        { id: 'grandchild', name: 'Grandchild', parentId: 'child' },
        { id: 'sibling', name: 'Sibling', parentId: 'root' },
    ];

    it('allows moving a node under an unrelated node', () => {
        expect(createMap(rows).canDropOn('grandchild', 'sibling')).toBe(true);
    });

    it('rejects dropping a node onto itself', () => {
        expect(createMap(rows).canDropOn('child', 'child')).toBe(false);
    });

    it('rejects dropping onto the current parent (no-op)', () => {
        expect(createMap(rows).canDropOn('child', 'root')).toBe(false);
    });

    it('rejects dropping onto a direct child, which would cycle', () => {
        expect(createMap(rows).canDropOn('root', 'child')).toBe(false);
    });

    it('rejects dropping onto a deeper descendant, which would cycle', () => {
        expect(createMap(rows).canDropOn('root', 'grandchild')).toBe(false);
    });

    it('places every category exactly once, at the right depth', () => {
        const nodes = createMap(rows).nodes();
        expect(nodes.length).toBe(4);
        const depthOf = new Map(nodes.map((n) => [n.id, n.depth]));
        expect(depthOf.get('root')).toBe(0);
        expect(depthOf.get('child')).toBe(1);
        expect(depthOf.get('grandchild')).toBe(2);
        expect(depthOf.get('sibling')).toBe(1);
    });

    it('treats a parentId that is not in the list as no parent', () => {
        const nodes = createMap([
            { id: 'orphan', name: 'Orphan', parentId: 'deactivated-parent' },
        ]).nodes();
        expect(nodes.length).toBe(1);
        expect(nodes[0].depth).toBe(0);
    });

    it('still renders every node when the data contains a cycle', () => {
        // A ↔ B: neither is reachable from a root, and a naive walk hangs.
        const nodes = createMap([
            { id: 'a', name: 'A', parentId: 'b' },
            { id: 'b', name: 'B', parentId: 'a' },
        ]).nodes();
        expect(nodes.map((n) => n.id).sort()).toEqual(['a', 'b']);
    });

    it('has no preview link when nothing is being dragged', () => {
        expect(createMap(rows).previewEdge()).toBeNull();
    });

    it('draws a preview link from the prospective parent while dragging', () => {
        const map = createMap(rows);
        map.dragId.set('grandchild');
        map.dropTargetId.set('sibling');
        const sibling = map.nodes().find((n) => n.id === 'sibling')!;

        const preview = map.previewEdge();
        expect(preview).toContain(`M ${sibling.x + map.nodeWidth}`);
    });

    it('draws no preview link over the root zone, which removes a link', () => {
        const map = createMap(rows);
        map.dragId.set('grandchild');
        map.dropTargetId.set(map.ROOT_ZONE);
        expect(map.previewEdge()).toBeNull();
    });

    it('marks the dragged node’s existing link as superseded', () => {
        const map = createMap(rows);
        map.dragId.set('grandchild');
        const edges = map.edges();
        const own = edges.find((e) => e.childId === 'grandchild')!;
        const other = edges.find((e) => e.childId === 'sibling')!;
        expect(map.isEdgeSuperseded(own)).toBe(true);
        expect(map.isEdgeSuperseded(other)).toBe(false);
    });

    it('reserves a root drop zone below the tree', () => {
        const map = createMap(rows);
        const lowestNode = Math.max(...map.nodes().map((n) => n.y));
        expect(map.rootZone().y).toBeGreaterThan(lowestNode);
        expect(map.rootZone().width).toBeGreaterThan(0);
    });

    it('terminates the ancestor walk on cyclic data', () => {
        const map = createMap([
            { id: 'a', name: 'A', parentId: 'b' },
            { id: 'b', name: 'B', parentId: 'a' },
            { id: 'c', name: 'C' },
        ]);
        expect(map.canDropOn('c', 'a')).toBe(true);
    });
});
