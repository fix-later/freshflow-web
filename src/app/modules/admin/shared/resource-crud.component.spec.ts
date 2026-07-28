import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { ResourceCrudComponent } from './resource-crud.component';
import { CrudResource, CrudRow } from './resource-crud.types';

/**
 * Opening the real dialog needs the rendered `formDialog` template; these tests
 * only exercise which branch `save()` takes, so the dialog is a no-op.
 */
const dialogStub = {
    open: () => ({ afterClosed: () => of(undefined), close: () => undefined }),
};

class StubTranslocoLoader {
    getTranslation(): Promise<Record<string, string>> {
        return Promise.resolve({});
    }
}

/** Records which branch a save took. */
interface Calls {
    created: number;
    updated: string[];
}

function createComponent(rows: CrudRow[], calls: Calls): ResourceCrudComponent {
    const resource: CrudResource = {
        title: 't',
        subtitle: 's',
        createLabel: 'c',
        columns: [{ label: 'name', cell: (row) => String(row['name'] ?? '') }],
        fields: [{ name: 'name', label: 'name', type: 'text' }],
        list: () => Promise.resolve(rows),
        create: () => {
            calls.created++;
            return Promise.resolve();
        },
        update: (id) => {
            calls.updated.push(id);
            return Promise.resolve();
        },
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
        imports: [ResourceCrudComponent],
        providers: [
            provideTransloco({
                config: { availableLangs: ['en'], defaultLang: 'en' },
                loader: StubTranslocoLoader,
            }),
            {
                provide: Router,
                useValue: { navigate: () => Promise.resolve(true) },
            },
            { provide: ActivatedRoute, useValue: {} },
        ],
    });
    // The component imports MatDialogModule, which provides the real MatDialog;
    // overrideProvider replaces it regardless of that module's own provider.
    TestBed.overrideProvider(MatDialog, { useValue: dialogStub });
    const fixture = TestBed.createComponent(ResourceCrudComponent);
    fixture.componentInstance.resource = resource;
    return fixture.componentInstance;
}

/**
 * Saving an edit must never fall through to `create`. A row whose id the API
 * named unexpectedly arrives with a blank id, and the old code branched on the
 * id alone — so editing such a row silently added a duplicate record instead of
 * updating it.
 */
describe('ResourceCrudComponent — edit vs create', () => {
    it('updates the row it was opened on', () => {
        const calls: Calls = { created: 0, updated: [] };
        const component = createComponent([], calls);

        component.openEdit({ id: 'hub-1', name: 'Hub 1' });
        component.controlOf('name').setValue('Hub 1 renamed');
        component.save();

        expect(calls.updated).toEqual(['hub-1']);
        expect(calls.created).toBe(0);
    });

    it('refuses to save an edit of a row with no id', () => {
        const calls: Calls = { created: 0, updated: [] };
        const component = createComponent([], calls);

        // A row whose identifier the response did not expose as `id`.
        component.openEdit({ id: '', name: 'Hub 1' });
        component.controlOf('name').setValue('Hub 1 renamed');
        component.save();

        expect(calls.created).toBe(0);
        expect(calls.updated).toEqual([]);
    });

    it('creates on the dedicated create page', () => {
        const calls: Calls = { created: 0, updated: [] };
        const component = createComponent([], calls);
        component.pageMode = 'create';
        component.ngOnInit();
        component.controlOf('name').setValue('New hub');
        component.save();

        expect(calls.created).toBe(1);
        expect(calls.updated).toEqual([]);
    });

    it('creates after leaving edit mode on the create page', () => {
        const calls: Calls = { created: 0, updated: [] };
        const component = createComponent([], calls);
        component.pageMode = 'create';

        component.openEdit({ id: 'hub-1', name: 'Hub 1' });
        component.editing.set(false);
        component.editingId.set(null);
        component.ngOnInit();
        component.controlOf('name').setValue('New hub');
        component.save();

        expect(calls.created).toBe(1);
        expect(calls.updated).toEqual([]);
    });
});
