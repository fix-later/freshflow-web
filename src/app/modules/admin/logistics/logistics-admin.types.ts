/**
 * Shapes returned by the Logistics route-planning endpoints
 * (`/api/v1/logistics/routes/...`). The backend's OpenAPI spec declares no
 * response schemas, so these mirror the server DTOs (`RouteSuggestionsDto`,
 * `EligibilityResultDto`, `LoadingManifestDto`) and are parsed by hand — same
 * approach as `admin.types.ts`.
 */

/** Route lifecycle, in order — see `RouteStatus` (Logistics domain). */
export const ROUTE_STATUSES = [
    'planned',
    'selected',
    'reviewed',
    'assigned',
    'in_progress',
    'completed',
    'cancelled',
] as const;

export type RouteStatus = (typeof ROUTE_STATUSES)[number];

/** Optimization criteria accepted by calculate / optimize. */
export const OPTIMIZATION_CRITERIA = ['distance', 'time', 'cost'] as const;

export type OptimizationCriterion = (typeof OPTIMIZATION_CRITERIA)[number];

/** One market / restaurant proposed for a service date, with its order count. */
export interface RouteSuggestionItem {
    id: string;
    name: string;
    orderCount: number;
}

/**
 * A hub in the route-origin picker.
 *
 * `hasCoordinates` is the one thing the calculate call needs that the option
 * label cannot show: a hub with no latitude/longitude is refused
 * (`MISSING_COORDINATES`) because it is the route's first stop.
 *
 * The equivalent flag for restaurants is *not* available — `SuggestionItemDto`
 * carries only id, name and order count — so that half of the rule stays the
 * server's to enforce, and is answered by the message it sends back.
 */
export interface HubOption {
    value: string;
    label: string;
    hasCoordinates: boolean;
    /**
     * Orders waiting at this hub on the chosen service date, from
     * `/routes/suggestions`. Absent until the suggestions land; `0` means the
     * day suggests nothing for this hub, which is a reason to rank it lower —
     * not to hide it, since routing from a quiet hub stays Admin's call.
     */
    orderCount?: number;
}

/**
 * `GET /logistics/routes/suggestions` — what to route on a given day.
 *
 * Both halves matter and they are the point of the endpoint: `hubs` are the
 * hubs with goods waiting *that date* (each with its order count, resolved from
 * the routable markets), and `restaurants` the destinations waiting on them.
 * Reading only the restaurants and picking the origin from the general hub list
 * means routing from a hub that may have nothing to send.
 */
export interface RouteSuggestions {
    serviceDate: string;
    hubs: RouteSuggestionItem[];
    restaurants: RouteSuggestionItem[];
}

/**
 * Payload for `POST /logistics/routes/calculate`. A route now always starts at
 * one hub — the backend dropped market-origin (and multi-hub relay) routing.
 */
export interface CalculateRouteInput {
    serviceDate: string;
    hubId: string;
    destinationRestaurantIds: string[];
    optimizationCriteria: OptimizationCriterion;
}

/**
 * Payload for `POST /logistics/routes/plan` — asks the backend to build the
 * day's routes for a hub itself (splitting stops across vehicles as needed),
 * instead of Admin hand-picking restaurants per route.
 */
export interface PlanRoutesInput {
    hubId: string;
    serviceDate: string;
    optimizationCriteria: OptimizationCriterion;
}

/**
 * `GET /logistics/routes/{id}/eligibility` — whether a vehicle (+ driver) may
 * take a route. `reasons` are machine codes (`VEHICLE_DOUBLE_BOOKED`, …);
 * `isWeightComplete` is false when some order line has no packing weight, in
 * which case `routeLoadKg` is a lower bound.
 */
export interface RouteEligibility {
    isEligible: boolean;
    reasons: string[];
    routeLoadKg: number;
    vehicleCapacityKg: number;
    isWeightComplete: boolean;
}

export interface LoadingManifestLine {
    orderId: string;
    orderItemId: string;
    productName: string;
    quantity: number;
    capacityKg: number | null;
    marketProductId?: string | null;
}

export interface LoadingManifestStop {
    stopOrder: number;
    restaurantId: string;
    restaurantName: string;
    lines: LoadingManifestLine[];
}

/**
 * `GET /logistics/routes/{id}/loading-manifest` — what to load per restaurant
 * stop, already in loading order (furthest / last-delivered first).
 */
export interface LoadingManifest {
    routeId: string;
    status: string;
    serviceDate: string;
    stops: LoadingManifestStop[];
}

/**
 * Hub discrepancy lifecycle, exactly as the backend spells it
 * (`HubDiscrepancy.StatusOpen` / `StatusAcknowledged`). The list endpoint
 * compares the `status` query verbatim, so these are SCREAMING_CASE and
 * case-sensitive — anything else answers 400.
 */
export const DISCREPANCY_STATUSES = ['OPEN', 'ACKNOWLEDGED'] as const;

export type DiscrepancyStatus = (typeof DISCREPANCY_STATUSES)[number];

/** A stop on a route (`RouteStopDto`). */
export interface RouteStop {
    stopOrder: number;
    entityType: string;
    entityId: string;
    entityName: string;
    latitude?: number;
    longitude?: number;
    estimatedArrivalAt?: string | null;
    estimatedDepartureAt?: string | null;
}
