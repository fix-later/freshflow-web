/**
 * Turns a backend error response into a **detailed, localized** message.
 *
 * The API design doc (`docs/04-api-design.md`) enumerates every failure: each
 * has a machine-readable `code` (Auth §3, Domains §4, Admin §4.6) and, for
 * validation failures, an exact per-field `message` (Validation §6). We map
 * both to i18n keys so the user sees the specific reason in their own language
 * — never the backend's English-only text, and never a vague catch-all when the
 * doc actually specifies the detail.
 */
import { readApiError } from './envelope';

/**
 * Error `code` → i18n key. Used when the response carries no localizable
 * message/field detail (e.g. a bare 404/409 with just a code).
 */
export const API_ERROR_MESSAGE_KEYS: Record<string, string> = {
    // Account / credentials / auth tokens
    INVALID_CREDENTIALS: 'errors.api.invalidCredentials',
    INVALID_CURRENT_PASSWORD: 'errors.api.invalidCurrentPassword',
    ACCOUNT_INACTIVE: 'errors.api.accountInactive',
    ACCOUNT_LOCKED: 'errors.api.accountLocked',
    EMAIL_ALREADY_EXISTS: 'errors.api.emailAlreadyExists',
    PHONE_ALREADY_EXISTS: 'errors.api.phoneAlreadyExists',
    WEAK_PASSWORD: 'errors.api.weakPassword',
    ROLE_NOT_CONFIGURED: 'errors.api.serverError',
    REFRESH_TOKEN_INVALID: 'errors.api.sessionExpired',
    REFRESH_TOKEN_EXPIRED: 'errors.api.sessionExpired',
    REFRESH_TOKEN_REUSE: 'errors.api.sessionExpired',
    RESET_TOKEN_INVALID: 'errors.api.resetTokenInvalid',
    RESET_TOKEN_EXPIRED: 'errors.api.resetTokenInvalid',
    OTP_INVALID: 'errors.api.otpInvalid',
    CHANNEL_NOT_SUPPORTED: 'errors.api.channelNotSupported',

    // Admin — users / roles / markets
    USER_NOT_FOUND: 'errors.api.userNotFound',
    INVALID_ROLE: 'errors.api.invalidRole',
    INVALID_MARKET: 'errors.api.invalidMarket',
    // The backend spells this `CANNOT_DEACTIVATE_SELF` (ActivateUserCommandHandler).
    // It was mapped as `CANNOT_DISABLE_SELF` here, so the message never resolved and
    // the user fell through to the generic status text.
    CANNOT_DEACTIVATE_SELF: 'errors.api.cannotDisableSelf',

    // Admin — restaurants
    RESTAURANT_NOT_FOUND: 'errors.api.restaurantNotFound',
    ALREADY_APPROVED: 'errors.api.alreadyApproved',

    // Restaurant lifecycle rejections. These are **not** registered in the
    // backend's `ErrorExtensions`, so they arrive as HTTP 500 rather than 4xx.
    // `describeApiError` prefers the code over the status, so mapping them here
    // is what turns "server error" back into the actual business reason —
    // the UI still gates on `restaurantStatus` so they should never be hit.
    ALREADY_SUSPENDED: 'errors.api.alreadySuspended',
    NOT_ACTIVE: 'errors.api.restaurantNotActive',
    NOT_SUSPENDED: 'errors.api.restaurantNotSuspended',
    STATEMENT_PERIOD_NOT_CLOSED: 'errors.api.statementPeriodNotClosed',

    // Catalog / pricing
    MARKET_NOT_FOUND: 'errors.api.marketNotFound',
    PRODUCT_NOT_FOUND: 'errors.api.productNotFound',
    MARKET_ACCESS_DENIED: 'errors.api.marketAccessDenied',
    OPTIMISTIC_CONCURRENCY_CONFLICT: 'errors.api.concurrencyConflict',
    INVALID_PRICE: 'errors.api.invalidPrice',
    INVALID_QUANTITY: 'errors.api.invalidQuantity',
    MARKET_PRODUCT_ALREADY_EXISTS: 'errors.api.marketProductAlreadyExists',
    MARKET_PRODUCT_NOT_FOUND: 'errors.api.marketProductNotFound',
    MARKET_INACTIVE: 'errors.api.marketInactive',

    // Logistics — route planning / dispatch
    DELIVERY_ROUTE_NOT_FOUND: 'errors.api.routeNotFound',
    ROUTE_INVALID_TRANSITION: 'errors.api.routeInvalidTransition',
    STOP_LIMIT_EXCEEDED: 'errors.api.stopLimitExceeded',
    MISSING_COORDINATES: 'errors.api.missingCoordinates',
    HUB_RELAY_NOT_SUPPORTED: 'errors.api.hubRelayNotSupported',
    INVALID_STOP_ORDER: 'errors.api.invalidStopOrder',
    VEHICLE_NOT_FOUND: 'errors.api.vehicleNotFound',
    VEHICLE_NOT_AVAILABLE: 'errors.api.vehicleNotAvailable',
    VEHICLE_NOT_ELIGIBLE: 'errors.api.vehicleNotEligible',
    PENDING_HUB_DISCREPANCY: 'errors.api.pendingHubDiscrepancy',

    // Orders
    RESTAURANT_NOT_APPROVED: 'errors.api.restaurantNotApproved',
    // Backend emits `ORDER_EMPTY` (Order.CanConfirm), not `EMPTY_ORDER`.
    ORDER_EMPTY: 'errors.api.emptyOrder',
    INVALID_PRODUCT: 'errors.api.invalidProduct',
    INSUFFICIENT_STOCK: 'errors.api.insufficientStock',
    SCHEDULED_FOR_TOO_SOON: 'errors.api.scheduledTooSoon',
    ORDER_NOT_FOUND: 'errors.api.orderNotFound',
    ORDER_ITEM_NOT_FOUND: 'errors.api.orderItemNotFound',
    ORDER_NOT_CANCELLABLE: 'errors.field.orderNotCancellable',
    // Ops adjustments / status bridge (admin,operations_manager)
    ORDER_CANNOT_ADJUST: 'errors.api.orderCannotAdjust',
    INVALID_ACTUAL_QUANTITY: 'errors.api.invalidActualQuantity',
    ORDER_INVALID_TRANSITION: 'errors.api.orderInvalidTransition',
    ORDER_STATUS_NOT_ADVANCEABLE: 'errors.api.orderStatusNotAdvanceable',

    // Order claims (restaurant files, admin/ops reviews)
    CLAIM_NOT_FOUND: 'errors.api.claimNotFound',
    CLAIM_INVALID_TRANSITION: 'errors.api.claimInvalidTransition',
    INVALID_CLAIM_DECISION_NOTE: 'errors.api.claimDecisionNoteRequired',
    INVALID_CLAIM_AMOUNT: 'errors.api.claimAmountInvalid',
    CLAIM_ORDER_NOT_CLAIMABLE: 'errors.api.claimOrderNotClaimable',
    CREDIT_REFUND_EXCEEDS_ORDER_CHARGE: 'errors.api.refundExceedsOrderCharge',
    CREDIT_REFUND_EXCEEDS_BALANCE: 'errors.api.refundExceedsBalance',

    // Hub oversight
    HUB_DISCREPANCY_NOT_FOUND: 'errors.api.discrepancyNotFound',
    DISCREPANCY_ALREADY_ACKNOWLEDGED:
        'errors.api.discrepancyAlreadyAcknowledged',
    HUB_ACCESS_DENIED: 'errors.api.hubAccessDenied',
    HUB_NOT_FOUND: 'errors.api.hubNotFound',

    // Generic buckets — only reached when there is no specific message/detail
    VALIDATION_ERROR: 'errors.api.validation',
    BUSINESS_RULE_ERROR: 'errors.api.businessRule',
    AUTHORIZATION_ERROR: 'errors.api.forbidden',

    // Cross-cutting
    UNAUTHORIZED: 'errors.api.sessionExpired',
    TOKEN_EXPIRED: 'errors.api.sessionExpired',
    FORBIDDEN: 'errors.api.forbidden',
    RATE_LIMIT_EXCEEDED: 'errors.api.rateLimited',
    RATE_LIMITED: 'errors.api.rateLimited',
};

/**
 * Exact backend message text → i18n key. These are the strings the doc §6
 * ("Validation Rules") and the field-level `details` arrays send verbatim;
 * mapping them lets us re-issue the *same* detail in the user's language rather
 * than showing the English original. Anything not listed here degrades to the
 * code- or caller-level message (see {@link describeApiError}).
 */
export const API_MESSAGE_TEXT_KEYS: Record<string, string> = {
    // Doc §6 wording
    'Must be a valid email address': 'errors.field.emailInvalid',
    'Must not exceed 255 characters': 'errors.field.max255',
    'Must be at least 8 characters': 'errors.field.passwordMinLength',
    'Must contain at least one uppercase letter':
        'errors.field.passwordUppercase',
    'Must contain at least one number': 'errors.field.passwordDigit',
    'Must contain at least one special character':
        'errors.field.passwordSpecial',
    'New password must be different from current password':
        'errors.field.passwordDifferent',
    'Identifier must be a valid email address or phone number':
        'errors.field.identifierInvalid',
    'Must be a valid phone number (7–15 digits, optional leading +)':
        'errors.field.phoneInvalid',
    'Must not exceed 200 characters': 'errors.field.max200',
    // FluentValidation messages actually emitted by RegisterRestaurantCommandValidator
    'Password must contain at least one uppercase letter.':
        'errors.field.passwordUppercase',
    'Password must contain at least one digit.': 'errors.field.passwordDigit',
    'Password must contain at least one special character.':
        'errors.field.passwordSpecial',
    'Phone must be a valid phone number (7–15 digits, optional leading +).':
        'errors.field.phoneInvalid',
    'One or more fields failed validation.': 'errors.api.validation',
    'Role must be one of the accepted values': 'errors.field.roleInvalid',
    'Must be greater than 0': 'errors.field.pricePositive',
    'Price must be greater than 0': 'errors.field.pricePositive',
    'Price must have at most 2 decimal places': 'errors.field.priceDecimals',
    'Quantity must be a whole number': 'errors.field.quantityInteger',
    'Quantity must be 0 or greater': 'errors.field.quantityNonNegative',
    'Quantity must be greater than 0': 'errors.field.quantityPositive',
    'Scheduled time must be at least 2 hours from now':
        'errors.api.scheduledTooSoon',
    'At least one order must be provided': 'errors.field.ordersRequired',
    'Cannot calculate a route for more than 20 orders at once':
        'errors.field.ordersMax20',
    'Order cannot be cancelled in its current status':
        'errors.field.orderNotCancellable',
    'You are not authorized to update prices at this market':
        'errors.api.marketAccessDenied',
    'Your restaurant account is pending Admin approval':
        'errors.api.restaurantNotApproved',
    'All orders must be confirmed before grouping':
        'errors.field.ordersMustBeConfirmed',
    'One or more orders are already in an active order group':
        'errors.field.ordersAlreadyGrouped',
    'Auto-batch is already running': 'errors.field.autoBatchRunning',
    'Requested quantity exceeds available hub stock':
        'errors.field.hubStockExceeded',
    'End date must be on or after start date':
        'errors.field.endDateBeforeStart',
    'Capacity must be greater than 0': 'errors.field.capacityPositive',
    'Authentication is required': 'errors.api.sessionExpired',
    'You do not have permission to perform this action': 'errors.api.forbidden',
};

/**
 * HTTP status → i18n key. The safety net so that even a rejection with no
 * recognised code or message still explains *why* by category (permission,
 * not found, conflict, server error…) rather than a bare "action failed".
 */
export const API_STATUS_MESSAGE_KEYS: Record<number, string> = {
    400: 'errors.api.validation',
    401: 'errors.api.sessionExpired',
    403: 'errors.api.forbidden',
    404: 'errors.api.notFound',
    409: 'errors.api.conflict',
    422: 'errors.api.businessRule',
    429: 'errors.api.rateLimited',
    500: 'errors.api.serverError',
    502: 'errors.api.serverError',
    503: 'errors.api.serverError',
    504: 'errors.api.serverError',
};

/** Localizes an exact backend string, or `undefined` if it isn't a known one. */
function localizeKnownText(
    text: string | undefined,
    translate: (key: string) => string
): string | undefined {
    if (!text) {
        return undefined;
    }
    const key = API_MESSAGE_TEXT_KEYS[text.trim()];
    return key ? translate(key) : undefined;
}

/**
 * Resolves a failed API call to a **detailed, localized** user-facing message,
 * in order of specificity:
 *  1. the per-field validation detail (`details[]`), each re-issued in the
 *     user's language — this is the "detailed" case the doc §6 specifies;
 *  2. a specific documented top-level message, localized;
 *  3. a message for the backend `code`;
 *  4. a message for the HTTP status category (permission / not found / …);
 *  5. a network message for a request that never reached the server;
 *  6. the caller's own localized `fallbackKey` (last resort).
 *
 * The backend's raw (English) text is never shown as-is: an unmapped string
 * falls through to the next, localized, level. Because of steps 4–5, a plain
 * "the action failed" is effectively never shown — the user always gets a
 * reason. `translate` is the caller's Transloco `translate` fn, passed in to
 * keep this helper DI-free.
 */
export async function describeApiError(
    err: unknown,
    translate: (key: string) => string,
    fallbackKey: string
): Promise<string> {
    const info = await readApiError(err);

    if (info) {
        // 1) Field-level detail — the most specific reason(s).
        if (info.fieldErrors) {
            const messages = [...new Set(Object.values(info.fieldErrors))]
                .map((text) => localizeKnownText(text, translate))
                .filter((text): text is string => !!text);
            if (messages.length) {
                return messages.join(' ');
            }
        }

        // 2) A specific documented message (e.g. a business-rule violation).
        const localizedMessage = localizeKnownText(info.message, translate);
        if (localizedMessage) {
            return localizedMessage;
        }

        // 3) The error code.
        const codeKey = info.code
            ? API_ERROR_MESSAGE_KEYS[info.code]
            : undefined;
        if (codeKey) {
            return translate(codeKey);
        }

        // 4) The HTTP status category — always says *why* at some level.
        const statusKey = info.status
            ? API_STATUS_MESSAGE_KEYS[info.status]
            : undefined;
        if (statusKey) {
            return translate(statusKey);
        }
    } else if (err instanceof TypeError) {
        // 5) No response at all — a fetch network failure throws TypeError.
        return translate('errors.api.network');
    }

    // 6) The caller's localized fallback.
    return translate(fallbackKey);
}
