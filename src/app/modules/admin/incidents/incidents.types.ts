/**
 * The incident board's row shape.
 *
 * Two streams reach it, and they are the only two an admin can read. The
 * platform takes issue reports from four places:
 *
 *  - market agents at the chợ (`POST /procurement/tasks/{batchId}/exceptions`)
 *  - hub staff receiving a shipment (`POST /hubs/{hubId}/inbound/{id}/discrepancy`)
 *  - restaurants on a delivered order (`POST /orders/{orderId}/issues`)
 *  - drivers on a delivery (`POST /driver/deliveries/{deliveryId}/issues`)
 *
 * The first two have a read endpoint of their own. The driver's `issues` do
 * not — `IDeliveryIssueRepository` is add-only, as `IOrderIssueRepository` is —
 * but a driver's *failed delivery* is readable by another road: reporting one
 * (`PATCH /driver/deliveries/{id}/status` with `failureReason`) marks the stop
 * `failed` and cancels the order with that same reason as its
 * `cancellationReason` (`DeliveryFailedIntegrationEventHandler`). The stop says
 * which order failed and when; the order says why. Restaurants' order issues
 * remain unreadable until the backend grows a query for them.
 */
export type IncidentSource = 'procurement' | 'hub' | 'delivery';

/**
 * One failed stop on a session's routes, as the session dialog already has it.
 *
 * Passed in rather than fetched: the dialog walks the day's routes and their
 * deliveries when it opens, so the reports tab adds one order read per failed
 * stop — and nothing at all when every stop landed.
 */
export interface SessionFailedDelivery {
    deliveryId: string;
    orderId: string;
    /** "Tuyến 2" — where the stop sat, for the "nơi xảy ra" column. */
    routeLabel: string | null;
    /** Who was driving it, from the hub's roster; the DTO carries only an id. */
    driverName: string | null;
    /** When the driver marked it failed — the stop's actual arrival. */
    at: string | null;
    proofUrl: string | null;
}

/**
 * Hub discrepancies carry a lifecycle — open until an admin signs them off,
 * and until then the hub cannot dispatch (BR-HUB-2). Procurement exceptions
 * have none: an agent reports one and it stands as a record of what happened,
 * which is why {@link AdminIncident.status} is nullable rather than defaulted.
 */
export type IncidentStatus = 'open' | 'acknowledged';

export interface AdminIncident {
    id: string;
    source: IncidentSource;
    /**
     * The kind, as the backend spells it — `Unavailable`/`Shortfall`/
     * `PriceDiscrepancy`/`Damaged` from `ProcurementExceptionType`, or
     * `MISSING`/`DAMAGED`/`PARTIAL` from `HubDiscrepancy.Condition*`. Kept as
     * the raw token so the label lookup, not the parse, decides the wording.
     */
    type: string;
    /** How much was affected. Units differ by source, so it is shown as given. */
    quantity: number | null;
    note: string | null;
    proofImageUrl: string | null;
    reportedAt: string | null;
    /** The reporter's user id — neither endpoint resolves it to a name. */
    reportedBy: string | null;
    /** Resolved from Admin Users for procurement; hub DTO has no reporter id. */
    reporterName: string | null;
    /** Where it happened: the phiên chợ, or the hub. */
    place: string | null;
    /** What it is about: the product bought, or the order line received. */
    subject: string | null;
    /** Restaurant/order context resolved from GET /orders/{orderId}. */
    context: string | null;
    status: IncidentStatus | null;
    /** Hub rows only — acknowledging needs the hub id as well as the row id. */
    hubId: string | null;
    acknowledgedBy: string | null;
    acknowledgedAt: string | null;
    updatedAt: string | null;
    /** The record this came from, for the "open" link. */
    link: string | null;
}
