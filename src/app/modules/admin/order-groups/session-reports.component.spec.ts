import { TestBed } from '@angular/core/testing';
import { provideTransloco } from '@jsverse/transloco';
import { IncidentsService } from '../incidents/incidents.service';
import { AdminIncident } from '../incidents/incidents.types';
import { SessionReportsComponent } from './session-reports.component';

class StubTranslocoLoader {
    getTranslation(): Promise<Record<string, string>> {
        return Promise.resolve({});
    }
}

function incident(patch: Partial<AdminIncident>): AdminIncident {
    return {
        id: 'report-1',
        source: 'procurement',
        type: 'Shortfall',
        quantity: 3,
        note: null,
        proofImageUrl: null,
        reportedAt: '2026-08-17T01:00:00Z',
        reportedBy: null,
        reporterName: null,
        place: null,
        subject: null,
        context: null,
        status: null,
        hubId: null,
        acknowledgedBy: null,
        acknowledgedAt: null,
        updatedAt: null,
        link: null,
        ...patch,
    };
}

function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

interface Harness {
    component: SessionReportsComponent;
    fixture: ReturnType<
        typeof TestBed.createComponent<SessionReportsComponent>
    >;
    incidents: {
        listSessionProcurementIncidents: jasmine.Spy;
        listSessionHubIncidents: jasmine.Spy;
        listSessionDeliveryIncidents: jasmine.Spy;
        acknowledge: jasmine.Spy;
    };
}

function createHarness(rows: {
    procurement?: Promise<AdminIncident[]>;
    hub?: Promise<AdminIncident[]>;
    delivery?: Promise<AdminIncident[]>;
}): Harness {
    const incidents = {
        listSessionProcurementIncidents: jasmine
            .createSpy()
            .and.callFake(() => rows.procurement ?? Promise.resolve([])),
        listSessionHubIncidents: jasmine
            .createSpy()
            .and.callFake(() => rows.hub ?? Promise.resolve([])),
        listSessionDeliveryIncidents: jasmine
            .createSpy()
            .and.callFake(() => rows.delivery ?? Promise.resolve([])),
        acknowledge: jasmine.createSpy().and.resolveTo(undefined),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
        imports: [SessionReportsComponent],
        providers: [
            provideTransloco({
                config: { availableLangs: ['en'], defaultLang: 'en' },
                loader: StubTranslocoLoader,
            }),
            {
                provide: IncidentsService,
                useValue: incidents as unknown as IncidentsService,
            },
        ],
    });
    const fixture = TestBed.createComponent(SessionReportsComponent);
    return { component: fixture.componentInstance, fixture, incidents };
}

describe('SessionReportsComponent', () => {
    it('reads nothing until the tab is opened', async () => {
        const { fixture, incidents } = createHarness({});
        fixture.componentRef.setInput('batch', { id: 'batch-1' });
        fixture.componentRef.setInput('hubId', 'hub-1');
        fixture.detectChanges();
        await flush();

        expect(
            incidents.listSessionProcurementIncidents
        ).not.toHaveBeenCalled();
        expect(incidents.listSessionHubIncidents).not.toHaveBeenCalled();

        fixture.componentRef.setInput('active', true);
        fixture.detectChanges();
        await flush();

        expect(incidents.listSessionProcurementIncidents).toHaveBeenCalledTimes(
            1
        );
        expect(incidents.listSessionHubIncidents).toHaveBeenCalledOnceWith(
            { id: 'batch-1' },
            'hub-1'
        );
    });

    it('merges both streams newest first and counts what blocks the hub', async () => {
        const { component, fixture } = createHarness({
            procurement: Promise.resolve([
                incident({
                    id: 'exception-1',
                    reportedAt: '2026-08-17T01:00:00Z',
                }),
            ]),
            hub: Promise.resolve([
                incident({
                    id: 'discrepancy-1',
                    source: 'hub',
                    type: 'PARTIAL',
                    status: 'open',
                    hubId: 'hub-1',
                    reportedAt: '2026-08-17T02:00:00Z',
                }),
            ]),
        });
        fixture.componentRef.setInput('batch', { id: 'batch-1' });
        fixture.componentRef.setInput('hubId', 'hub-1');
        fixture.componentRef.setInput('active', true);
        fixture.detectChanges();
        await flush();

        expect(component.reports().map((row) => row.id)).toEqual([
            'discrepancy-1',
            'exception-1',
        ]);
        expect(component.summary()).toEqual({
            total: 2,
            procurement: 1,
            hub: 1,
            delivery: 0,
            open: 1,
        });
        expect(component.loadError()).toBeNull();
    });

    it('keeps the stream that answered when the other one fails', async () => {
        const { component, fixture } = createHarness({
            procurement: Promise.resolve([incident({ id: 'exception-1' })]),
            hub: Promise.reject(new Error('hub down')),
        });
        fixture.componentRef.setInput('batch', { id: 'batch-1' });
        fixture.componentRef.setInput('hubId', 'hub-1');
        fixture.componentRef.setInput('active', true);
        fixture.detectChanges();
        await flush();

        expect(component.reports()).toHaveSize(1);
        expect(component.partial()).toBe(true);
        expect(component.loadError()).toBeNull();
    });

    it('filters by source and by status', async () => {
        const { component, fixture } = createHarness({
            procurement: Promise.resolve([incident({ id: 'exception-1' })]),
            hub: Promise.resolve([
                incident({
                    id: 'discrepancy-1',
                    source: 'hub',
                    status: 'open',
                    hubId: 'hub-1',
                }),
                incident({
                    id: 'discrepancy-2',
                    source: 'hub',
                    status: 'acknowledged',
                    hubId: 'hub-1',
                }),
            ]),
        });
        fixture.componentRef.setInput('batch', { id: 'batch-1' });
        fixture.componentRef.setInput('hubId', 'hub-1');
        fixture.componentRef.setInput('active', true);
        fixture.detectChanges();
        await flush();

        component.setSource('hub');
        expect(component.filtered()).toHaveSize(2);

        component.setStatus('open');
        expect(component.filtered().map((row) => row.id)).toEqual([
            'discrepancy-1',
        ]);

        // An agent's exception has no lifecycle, so it is what "đã ghi nhận"
        // means — and it must survive the status filter that names it.
        component.setSource('');
        component.setStatus('reported');
        expect(component.filtered().map((row) => row.id)).toEqual([
            'exception-1',
        ]);
    });

    it('marks a hub discrepancy acknowledged in place', async () => {
        const { component, fixture, incidents } = createHarness({
            hub: Promise.resolve([
                incident({
                    id: 'discrepancy-1',
                    source: 'hub',
                    status: 'open',
                    hubId: 'hub-1',
                }),
            ]),
        });
        fixture.componentRef.setInput('batch', { id: 'batch-1' });
        fixture.componentRef.setInput('hubId', 'hub-1');
        fixture.componentRef.setInput('active', true);
        fixture.detectChanges();
        await flush();

        const row = component.reports()[0];
        expect(component.canAcknowledge(row)).toBe(true);

        component.acknowledge(row);
        await flush();

        expect(incidents.acknowledge).toHaveBeenCalledOnceWith(
            'hub-1',
            'discrepancy-1'
        );
        expect(component.reports()[0].status).toBe('acknowledged');
        expect(component.canAcknowledge(component.reports()[0])).toBe(false);
        expect(component.summary().open).toBe(0);
    });

    it('says why an unbatched session has nothing to show', async () => {
        const { component, fixture, incidents } = createHarness({});
        fixture.componentRef.setInput('batch', null);
        fixture.componentRef.setInput('active', true);
        fixture.detectChanges();
        await flush();

        expect(component.hasBatch()).toBe(false);
        // The panel still asks — the service is the one place that decides an
        // unbatched session has no reports.
        expect(incidents.listSessionProcurementIncidents).toHaveBeenCalledWith(
            null
        );
        expect(component.reports()).toEqual([]);
    });

    it(`lists a driver's failed stop beside the chợ and hub reports`, async () => {
        const { component, fixture, incidents } = createHarness({
            procurement: Promise.resolve([
                incident({
                    id: 'exception-1',
                    reportedAt: '2026-08-17T01:00:00Z',
                }),
            ]),
            delivery: Promise.resolve([
                incident({
                    id: 'delivery:stop-1',
                    source: 'delivery',
                    type: 'DeliveryFailed',
                    quantity: null,
                    note: 'Nhà hàng đóng cửa',
                    reporterName: 'Trần Văn E',
                    reportedAt: '2026-08-17T03:00:00Z',
                }),
            ]),
        });
        const failed = [
            {
                deliveryId: 'stop-1',
                orderId: 'order-1',
                routeLabel: 'Tuyến 1',
                driverName: 'Trần Văn E',
                at: '2026-08-17T03:00:00Z',
                proofUrl: null,
            },
        ];
        fixture.componentRef.setInput('batch', { id: 'batch-1' });
        fixture.componentRef.setInput('hubId', 'hub-1');
        fixture.componentRef.setInput('failedDeliveries', failed);
        fixture.componentRef.setInput('active', true);
        fixture.detectChanges();
        await flush();

        expect(incidents.listSessionDeliveryIncidents).toHaveBeenCalledWith(
            failed
        );
        // Newest first, so the stop leads the chợ exception before it.
        expect(component.reports().map((row) => row.id)).toEqual([
            'delivery:stop-1',
            'exception-1',
        ]);
        expect(component.summary().delivery).toBe(1);

        component.setSource('delivery');
        expect(component.filtered().map((row) => row.id)).toEqual([
            'delivery:stop-1',
        ]);
    });
});
