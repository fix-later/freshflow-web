import { RouteSuggestionItem, RouteSuggestions } from './logistics-admin.types';

/**
 * Parses `GET /logistics/routes/suggestions`.
 *
 * The live body is `RouteSuggestionsDto`:
 *
 * ```json
 * { "serviceDate": "2026-08-06",
 *   "hubs": [{ "id": "…", "name": "Hub Thủ Đức", "orderCount": 7 }],
 *   "restaurants": [{ "id": "…", "name": "Quán A", "orderCount": 2 }] }
 * ```
 *
 * Both lists are the point of the endpoint: it answers *what should be routed
 * today* — which hubs have goods waiting, and which restaurants are waiting on
 * them. The hubs were read from a `markets` key instead, which the response has
 * never carried (it is a leftover from when a route could start at a market),
 * so that half always came back empty and the origin was taken from the plain
 * hub list — a list that says nothing about whether a hub has anything to send.
 *
 * `markets` is still accepted as a fallback so an older API in front of this
 * build keeps working.
 */
export function parseRouteSuggestions(
    body: Record<string, unknown> | null | undefined,
    fallbackServiceDate: string
): RouteSuggestions {
    const data = body ?? {};
    return {
        serviceDate: text(data['serviceDate']) || fallbackServiceDate,
        hubs: suggestionItems(data['hubs'] ?? data['markets']),
        restaurants: suggestionItems(data['restaurants']),
    };
}

/** Rows with an id; anything unusable is dropped rather than half-rendered. */
function suggestionItems(value: unknown): RouteSuggestionItem[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .filter(
            (entry): entry is Record<string, unknown> =>
                !!entry && typeof entry === 'object'
        )
        .map((entry) => ({
            id: text(entry['id']),
            name: text(entry['name']),
            orderCount: count(entry['orderCount']),
        }))
        .filter((item) => !!item.id);
}

function text(value: unknown): string {
    return value == null ? '' : String(value);
}

function count(value: unknown): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
}
