import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { ResourceCrudComponent } from './resource-crud.component';
import { CrudResource } from './resource-crud.types';

class StubTranslocoLoader {
    getTranslation(): Promise<Record<string, string>> {
        return Promise.resolve({});
    }
}

const resource: CrudResource = {
    title: 'admin.packingCodes.title',
    subtitle: 'admin.packingCodes.subtitle',
    createLabel: 'admin.packingCodes.create',
    columns: [],
    fields: [
        { name: 'code', label: 'code', type: 'text', required: true },
        {
            name: 'capacityKg',
            label: 'capacityKg',
            type: 'number',
            required: true,
            min: 0.1,
            max: 25,
        },
    ],
    list: () => Promise.resolve([]),
    create: () => Promise.resolve(),
    update: () => Promise.resolve(),
};

function build(): { component: ResourceCrudComponent; opened: number } {
    const state = { opened: 0 };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
        providers: [
            provideTransloco({
                config: { availableLangs: ['vi'], defaultLang: 'vi' },
                loader: StubTranslocoLoader,
            }),
            {
                provide: MatDialog,
                useValue: {
                    open: () => {
                        state.opened++;
                        return {
                            afterClosed: () => ({ subscribe: () => ({}) }),
                        };
                    },
                },
            },
            { provide: ActivatedRoute, useValue: { snapshot: {} } },
            ResourceCrudComponent,
        ],
    });
    const component = TestBed.inject(ResourceCrudComponent);
    component.resource = resource;
    return { component, opened: state.opened };
}

describe('ResourceCrudComponent — field bindings', () => {
    /**
     * The fields live in one `ng-template` rendered through `ngTemplateOutlet`
     * from three places, each wrapping it in its own `<form [formGroup]>`. That
     * wrapper does not reach the controls: the outlet builds the view against
     * the template's *declaration* context, so the group has to be bound inside
     * the template. When it was not, Angular threw `NG01050`, the inputs
     * rendered unbound, and the fields after the first were left half-built —
     * a dialog with a stray unlabelled box and no third field.
     */
    it('binds every field to its control, not just the first', async () => {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            providers: [
                provideTransloco({
                    config: { availableLangs: ['vi'], defaultLang: 'vi' },
                    loader: StubTranslocoLoader,
                }),
                { provide: ActivatedRoute, useValue: { snapshot: {} } },
            ],
        });
        const fixture = TestBed.createComponent(ResourceCrudComponent);
        fixture.componentInstance.resource = resource;
        // `create` page mode renders the same outlet without a dialog.
        fixture.componentInstance.pageMode = 'create';
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const inputs: HTMLInputElement[] = Array.from(
            fixture.nativeElement.querySelectorAll('input')
        );
        expect(inputs.length).toBe(resource.fields.length);

        // Model → view proves each control is actually wired to its input.
        fixture.componentInstance.form!.patchValue({
            code: 'THUNG-10',
            capacityKg: 10,
        });
        fixture.detectChanges();
        expect(inputs.map((i) => i.value)).toEqual(['THUNG-10', '10']);
    });
});

describe('ResourceCrudComponent — create dialog', () => {
    it('builds the form before opening, so the dialog is not an empty header', () => {
        const { component } = build();

        component.openCreate();

        // The dialog body is `@if (form)`: without this the whole form,
        // including the save button, renders as nothing.
        expect(component.form).not.toBeNull();
        expect(Object.keys(component.form!.controls).sort()).toEqual([
            'capacityKg',
            'code',
        ]);
    });

    it('starts empty and invalid, so a blank submit cannot be sent', () => {
        const { component } = build();

        component.openCreate();

        expect(component.form!.invalid).toBeTrue();
        expect(component.form!.get('capacityKg')!.value).toBeNull();
    });

    it('enforces the numeric bounds the backend validates', () => {
        const { component } = build();
        component.openCreate();
        const capacity = component.form!.get('capacityKg')!;

        // `GreaterThan(0)` server-side — zero is refused there, so it is here.
        capacity.setValue(0);
        expect(capacity.hasError('min')).toBeTrue();

        // `LessThanOrEqualTo(Logistics:Box:MaxLoadKg)`, 25 in appsettings.
        capacity.setValue(30);
        expect(capacity.hasError('max')).toBeTrue();

        capacity.setValue(5);
        expect(capacity.valid).toBeTrue();
    });
});
