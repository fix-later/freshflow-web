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

/** `GET /logistics/routes/suggestions` — what to route on a given day. */
export interface RouteSuggestions {
    serviceDate: string;
    markets: RouteSuggestionItem[];
    restaurants: RouteSuggestionItem[];
}

/** Payload for `POST /logistics/routes/calculate`. */
export interface CalculateRouteInput {
    serviceDate: string;
    sourceMarketIds: string[];
    destinationRestaurantIds: string[];
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
