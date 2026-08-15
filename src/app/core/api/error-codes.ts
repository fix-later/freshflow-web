/**
 * Turns a backend error response into a **detailed, localized** message.
 *
 * Every failure the API can answer with carries a machine-readable `code`, and
 * validation failures add an exact per-field `message`. We map both to i18n
 * keys so the user sees the specific reason in their own language — never the
 * backend's English-only text, and never a vague catch-all when the response
 * actually says what went wrong.
 *
 * **Source of truth is the backend code, not `docs/04-api-design.md`** — the
 * doc predates the implementation and disagrees with it in places that matter
 * (it names `REFRESH_TOKEN_INVALID`, the handler emits `TOKEN_INVALID`; it
 * names `RATE_LIMITED`, the rate limiter emits `TOO_MANY_REQUESTS`). Codes were
 * swept out of every `Error.Validation/Conflict/Unauthorized/NotFound` call
 * site; the ones a `restaurant` session can reach are all mapped below.
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
    // `RefreshTokenCommandHandler` spells the malformed-token case
    // `TOKEN_INVALID`; `REFRESH_TOKEN_INVALID` is the doc's name and is never
    // sent. Both stay mapped — the doc's in case it is ever adopted.
    TOKEN_INVALID: 'errors.api.sessionExpired',
    REFRESH_TOKEN_INVALID: 'errors.api.sessionExpired',
    REFRESH_TOKEN_EXPIRED: 'errors.api.sessionExpired',
    REFRESH_TOKEN_REVOKED: 'errors.api.sessionExpired',
    REFRESH_TOKEN_REUSE: 'errors.api.sessionExpired',
    RESET_TOKEN_INVALID: 'errors.api.resetTokenInvalid',
    RESET_TOKEN_EXPIRED: 'errors.api.resetTokenInvalid',
    OTP_INVALID: 'errors.api.otpInvalid',
    CHANNEL_NOT_SUPPORTED: 'errors.api.channelNotSupported',
    // Delivery addresses (`Auth` module — the restaurant's own address book).
    DELIVERY_ADDRESS_NOT_FOUND: 'errors.api.deliveryAddressNotFound',

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
    // Session route planning. Every one of these reaches an operations manager
    // on the market-session screen — planning a day's routes, then approving
    // the proposal — and arrived as the backend's English until now.
    ROUTE_PLAN_NOT_FOUND: 'errors.api.routePlanNotFound',
    ROUTE_PLAN_CONFLICT: 'errors.api.routePlanConflict',
    ROUTE_PLAN_NOT_PROPOSED: 'errors.api.routePlanNotProposed',
    // The server marks the plan stale as it answers this, so the proposal on
    // screen is spent: it has to be planned again, not retried.
    PLAN_STALE: 'errors.api.routePlanStale',
    PLAN_HAS_UNASSIGNED_ORDERS: 'errors.api.routePlanHasUnassigned',
    ROUTE_PLAN_APPROVAL_CONFLICT: 'errors.api.routePlanApprovalConflict',
    STOP_LIMIT_EXCEEDED: 'errors.api.stopLimitExceeded',
    MISSING_COORDINATES: 'errors.api.missingCoordinates',
    HUB_RELAY_NOT_SUPPORTED: 'errors.api.hubRelayNotSupported',
    INVALID_STOP_ORDER: 'errors.api.invalidStopOrder',
    VEHICLE_NOT_FOUND: 'errors.api.vehicleNotFound',
    VEHICLE_NOT_AVAILABLE: 'errors.api.vehicleNotAvailable',
    VEHICLE_NOT_ELIGIBLE: 'errors.api.vehicleNotEligible',
    PENDING_HUB_DISCREPANCY: 'errors.api.pendingHubDiscrepancy',

    // Market sessions. A chợ trades in sessions now, and every one of these
    // reaches a buyer at checkout — as a `409` on confirm, or ahead of it as an
    // `issues[]` entry from confirm-preview. Unmapped, they arrived as the
    // backend's English.
    MARKET_SESSION_NOT_AVAILABLE: 'errors.api.marketSessionNotAvailable',
    MARKET_SESSION_NOT_OPEN: 'errors.api.marketSessionNotOpen',
    MARKET_SESSION_CLOSED: 'errors.api.marketSessionClosed',
    MARKET_SESSION_NOT_CLOSED: 'errors.api.marketSessionNotClosed',
    MARKET_SESSION_CUTOFF_PASSED: 'errors.api.marketSessionCutoffPassed',
    // The session's `plannedCapacityKg` ceiling — the order would tip the
    // session past what the chợ planned to move that day.
    MARKET_SESSION_CAPACITY_EXCEEDED:
        'errors.api.marketSessionCapacityExceeded',
    // Session-specific wording, not the generic concurrency line: what changed
    // underneath is the session, and that is what the admin must refresh.
    MARKET_SESSION_CONFLICT: 'errors.api.marketSessionConflict',
    // The administration side of the same lifecycle — reached from the market
    // session screens rather than checkout.
    MARKET_SESSION_NOT_FOUND: 'errors.api.marketSessionNotFound',
    MARKET_SESSION_NOT_READY: 'errors.api.marketSessionNotReady',
    INVALID_MARKET_SESSION: 'errors.api.invalidMarketSession',
    INVALID_MARKET_SESSION_CLOSE_TIME:
        'errors.api.invalidMarketSessionCloseTime',

    // Orders
    RESTAURANT_NOT_APPROVED: 'errors.api.restaurantNotApproved',
    // Confirming an order re-checks the restaurant's own status, so a account
    // suspended after the draft was built fails here rather than at sign-in.
    RESTAURANT_NOT_ACTIVE: 'errors.api.restaurantNotActive',
    // Backend emits `ORDER_EMPTY` (Order.CanConfirm), not `EMPTY_ORDER`.
    ORDER_EMPTY: 'errors.api.emptyOrder',
    INVALID_PRODUCT: 'errors.api.invalidProduct',
    INSUFFICIENT_STOCK: 'errors.api.insufficientStock',
    MINIMUM_ORDER_QUANTITY_NOT_MET: 'errors.api.minimumOrderQuantity',
    SCHEDULED_FOR_TOO_SOON: 'errors.api.scheduledTooSoon',
    ORDER_NOT_FOUND: 'errors.api.orderNotFound',
    ORDER_ITEM_NOT_FOUND: 'errors.api.orderItemNotFound',
    ORDER_NOT_CANCELLABLE: 'errors.field.orderNotCancellable',
    // Draft/cart lifecycle — reachable from the cart and checkout.
    ORDER_NOT_DRAFT: 'errors.api.orderNotDraft',
    ORDER_CANNOT_RESCHEDULE: 'errors.api.orderCannotReschedule',
    DELIVERY_DATE_OUT_OF_WINDOW: 'errors.api.deliveryDateOutOfWindow',
    DELIVERY_ADDRESS_ALREADY_CAPTURED: 'errors.api.deliveryAddressCaptured',
    DELIVERY_COORDINATES_REQUIRED: 'errors.api.deliveryCoordinatesRequired',
    VAT_RATE_MISSING: 'errors.api.vatRateMissing',
    INVALID_DELIVERY_FEE: 'errors.api.invalidDeliveryFee',
    // Receipt confirmation (UC-ORD-18) and issue reports (UC-ORD-19).
    ORDER_NOT_DELIVERED: 'errors.api.orderNotDelivered',
    ORDER_RECEIPT_ALREADY_CONFIRMED: 'errors.api.receiptAlreadyConfirmed',
    ORDER_ISSUE_NOT_ALLOWED: 'errors.api.orderIssueNotAllowed',
    ORDER_ISSUE_ALREADY_RESOLVED: 'errors.api.orderIssueAlreadyResolved',
    INVALID_ISSUE_QUANTITY: 'errors.api.invalidIssueQuantity',
    // Recurring schedules (UC-ORD-10/11).
    SCHEDULED_ORDER_NOT_FOUND: 'errors.api.scheduledOrderNotFound',
    SCHEDULED_ORDER_NOT_ACTIVE: 'errors.api.scheduledOrderNotActive',
    SCHEDULED_ORDER_ALREADY_CANCELLED: 'errors.api.scheduledOrderCancelled',
    SCHEDULED_ORDER_FIRST_RUN_IN_PAST: 'errors.api.scheduledFirstRunPast',
    // Credit (B2B debt, not prepaid checkout) — the restaurant sees these.
    CREDIT_LIMIT_EXCEEDED: 'errors.api.creditLimitExceeded',
    CREDITSTATEMENT_NOT_FOUND: 'errors.api.statementNotFound',
    INVALID_AMOUNT: 'errors.api.invalidAmount',
    // Concurrency the user can simply retry through.
    SERIALIZATION_CONFLICT: 'errors.api.concurrencyConflict',
    STOCK_RESERVATION_CONFLICT: 'errors.api.concurrencyConflict',
    STATEMENT_GENERATION_CONFLICT: 'errors.api.concurrencyConflict',

    // Invoices (read-only for a restaurant, but export can refuse)
    INVOICE_NOT_FOUND: 'errors.api.invoiceNotFound',
    INVOICE_NOT_ISSUED: 'errors.api.invoiceNotIssued',
    INVOICE_EXPORT_INCOMPLETE: 'errors.api.invoiceExportIncomplete',
    // `GET /invoices/{id}/pdf` renders sandbox drafts only. Once an invoice is
    // provider-issued, the legal PDF is that provider's file and this app must
    // not re-render it — a 422 the user reaches by pressing the button on an
    // issued invoice.
    INVOICE_PDF_PROVIDER_REQUIRED: 'errors.api.invoicePdfProviderRequired',
    BUYER_TAX_CODE_REQUIRED: 'errors.api.buyerTaxCodeRequired',
    BUYER_TAX_CODE_INVALID: 'errors.api.buyerTaxCodeInvalid',
    BUYER_LEGAL_NAME_REQUIRED: 'errors.api.buyerLegalNameRequired',
    BUYER_ADDRESS_REQUIRED: 'errors.api.buyerAddressRequired',
    INVOICE_LINE_UNIT_REQUIRED: 'errors.api.invoiceLineUnitRequired',

    // Notifications + push devices (settings screen)
    NOTIFICATION_NOT_FOUND: 'errors.api.notificationNotFound',
    NOTIFICATIONDEVICE_NOT_FOUND: 'errors.api.notificationDeviceNotFound',

    // AI assistant — its own envelope, thrown by the host controller
    SESSION_NOT_FOUND: 'errors.api.assistantSessionNotFound',
    ASSISTANT_PROVIDER_AUTH_FAILED: 'errors.api.assistantUnavailable',
    ASSISTANT_PROVIDER_UNAVAILABLE: 'errors.api.assistantUnavailable',
    ASSISTANT_PROVIDER_TIMEOUT: 'errors.api.assistantTimeout',
    ASSISTANT_PROVIDER_RATE_LIMITED: 'errors.api.assistantRateLimited',
    INVALID_REQUEST: 'errors.api.validation',

    // Catalog reads a restaurant can trip on a stale link
    CATEGORY_NOT_FOUND: 'errors.api.categoryNotFound',
    UNITOFMEASUREMENT_NOT_FOUND: 'errors.api.unitNotFound',
    PACKINGCODE_NOT_FOUND: 'errors.api.packingCodeNotFound',
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

    // ── Admin console ────────────────────────────────────────────────────
    // Catalog master data (categories / units / packing codes). Conflicts are
    // 409s the CRUD dialogs can hit on a duplicate name or code.
    CATEGORY_NAME_CONFLICT: 'errors.api.categoryNameConflict',
    CATEGORY_PARENT_NOT_FOUND: 'errors.api.categoryParentNotFound',
    CATEGORY_HAS_ACTIVE_CHILDREN: 'errors.api.categoryHasChildren',
    INVALID_CATEGORY: 'errors.api.invalidCategory',
    INVALID_CATEGORY_PARENT: 'errors.api.invalidCategoryParent',
    UNIT_NAME_CONFLICT: 'errors.api.unitNameConflict',
    INVALID_UNIT: 'errors.api.invalidUnit',
    PACKING_CODE_CONFLICT: 'errors.api.packingCodeConflict',
    INVALID_PACKING_CODE: 'errors.api.invalidPackingCode',

    // Users, market agents and sessions
    INVALID_ASSIGNMENT_TARGET: 'errors.api.invalidAssignmentTarget',
    MARKET_ASSIGNMENT_CONFLICT: 'errors.api.marketAssignmentConflict',
    AGENT_NOT_ELIGIBLE: 'errors.api.agentNotEligible',
    INVALID_AGENT: 'errors.api.invalidAgent',
    TOKEN_NOT_FOUND: 'errors.api.sessionExpired',

    // Restaurant credit administration
    INVALID_CREDIT_LIMIT: 'errors.api.invalidCreditLimit',
    CREDIT_LIMIT_BELOW_OUTSTANDING_BALANCE: 'errors.api.creditLimitBelowDebt',

    // Order operations (adjustments, grouping, procurement actuals)
    ORDER_NOT_BATCHED: 'errors.api.orderNotBatched',
    ORDER_ALREADY_IN_ACTIVE_GROUP: 'errors.api.orderAlreadyGrouped',
    INVALID_ACTUAL_UNIT_PRICE: 'errors.api.invalidActualUnitPrice',
    PROCUREMENT_ORDER_MISSING: 'errors.api.procurementOrderMissing',
    PROCUREMENT_ORDER_STATE_CONFLICT: 'errors.api.procurementOrderState',
    PURCHASE_ACTUALS_MISMATCH: 'errors.api.purchaseActualsMismatch',

    // Procurement batches — one code per illegal transition, so the console
    // can say which stage refused rather than "batch cannot be updated".
    PROCUREMENT_BATCH_NOT_FOUND: 'errors.api.batchNotFound',
    BATCH_ALREADY_IN_PROGRESS: 'errors.api.batchAlreadyInProgress',
    BATCH_ALREADY_HANDED_OFF: 'errors.api.batchAlreadyHandedOff',
    BATCH_CANCELLED: 'errors.api.batchCancelled',
    BATCH_NOT_CANCELLABLE: 'errors.api.batchNotCancellable',
    BATCH_NOT_MANIFESTABLE: 'errors.api.batchNotManifestable',
    BATCH_NOT_MANIFESTED: 'errors.api.batchNotManifested',
    BATCH_NOT_MERGEABLE: 'errors.api.batchNotMergeable',
    BATCH_NOT_PURCHASED: 'errors.api.batchNotPurchased',
    BATCH_NOT_REPORTABLE: 'errors.api.batchNotReportable',
    BATCH_RESET_NOT_ALLOWED: 'errors.api.batchResetNotAllowed',
    INVALID_BATCH_STATUS: 'errors.api.invalidBatchStatus',
    INVALID_PROCUREMENT_BATCH: 'errors.api.invalidProcurementBatch',
    INVALID_PURCHASE_LINE: 'errors.api.invalidPurchaseLine',
    PURCHASE_LINES_MISMATCH: 'errors.api.purchaseLinesMismatch',
    PRODUCT_NOT_IN_BATCH: 'errors.api.productNotInBatch',
    PROCUREMENT_HANDOVER_CONFLICT: 'errors.api.concurrencyConflict',
    REFERENCE_PRICE_MISSING: 'errors.api.referencePriceMissing',
    INVALID_EXCEPTION_TYPE: 'errors.api.invalidExceptionType',
    INVALID_EXCEPTION_QUANTITY: 'errors.api.invalidExceptionQuantity',

    // Hub operations
    HUB_ALREADY_CONFIGURED_FOR_MARKET: 'errors.api.hubAlreadyForMarket',
    HUB_NOT_CONFIGURED_FOR_MARKET: 'errors.api.hubNotForMarket',
    HUB_INACTIVE: 'errors.api.hubInactive',
    HUB_CAPACITY_EXCEEDED: 'errors.api.hubCapacityExceeded',
    HUB_CAPACITY_BELOW_OCCUPIED: 'errors.api.hubCapacityBelowOccupied',
    HUB_HAS_PENDING_DELIVERIES: 'errors.api.hubHasPendingDeliveries',
    HUB_HAS_ACTIVE_PROCUREMENT: 'errors.api.hubHasActiveProcurement',
    HUB_HANDOVER_NOT_FOUND: 'errors.api.hubHandoverNotFound',
    HUB_HANDOVER_ALREADY_CHECKED_OUT: 'errors.api.hubHandoverCheckedOut',
    HUB_INBOUND_EVENT_NOT_FOUND: 'errors.api.hubInboundNotFound',
    HUB_OUTBOUND_EVENT_NOT_FOUND: 'errors.api.hubOutboundNotFound',
    INBOUND_NOT_ARRIVED: 'errors.api.inboundNotArrived',
    INSUFFICIENT_HUB_STOCK: 'errors.api.insufficientHubStock',
    ORDER_ITEM_NOT_IN_INBOUND: 'errors.api.orderItemNotInInbound',
    ALREADY_RECEIVED: 'errors.api.inboundAlreadyRecorded',
    SCAN_NO_MATCH: 'errors.api.scanNoMatch',
    OUTBOUND_ROUTE_INVALID: 'errors.api.outboundRouteInvalid',

    // Logistics — fleet, routes, deliveries
    PLATE_NUMBER_DUPLICATE: 'errors.api.plateNumberDuplicate',
    FLEET_CAPACITY_EXCEEDED: 'errors.api.fleetCapacityExceeded',
    DELIVERY_NOT_FOUND: 'errors.api.deliveryNotFound',
    DELIVERY_ALREADY_EXISTS: 'errors.api.deliveryAlreadyExists',
    DELIVERY_STATUS_INVALID: 'errors.api.deliveryStatusInvalid',
    DELIVERY_ROUTE_NOT_IN_PROGRESS: 'errors.api.routeNotInProgress',
    DRIVER_REQUIRED: 'errors.api.driverRequired',
    DRIVER_ROUTE_MISMATCH: 'errors.api.driverRouteMismatch',
    ROUTE_NOT_ASSIGNED: 'errors.api.routeNotAssigned',
    ROUTE_NOT_STARTABLE: 'errors.api.routeNotStartable',
    ROUTE_NOT_REORDERABLE: 'errors.api.routeNotReorderable',
    ROUTE_LOCKED_FOR_SORTING: 'errors.api.routeLockedForSorting',
    ROUTE_HAS_NO_DRIVER: 'errors.api.routeHasNoDriver',
    ROUTE_HAS_NO_DELIVERIES: 'errors.api.routeHasNoDeliveries',
    ROUTE_HUB_MISMATCH: 'errors.api.routeHubMismatch',
    ORDER_NOT_ON_ROUTE: 'errors.api.orderNotOnRoute',
    PICKUP_ORDERS_INCOMPLETE: 'errors.api.pickupOrdersIncomplete',

    // Notifications delivery (admin sees these on a failed send)
    EMAIL_RECIPIENT_MISSING: 'errors.api.emailRecipientMissing',
    EMAIL_SEND_FAILED: 'errors.api.emailSendFailed',

    // Assistant session raced between two requests
    SESSION_CONFLICT: 'errors.api.concurrencyConflict',

    // Cross-cutting
    UNAUTHORIZED: 'errors.api.sessionExpired',
    TOKEN_EXPIRED: 'errors.api.sessionExpired',
    FORBIDDEN: 'errors.api.forbidden',
    // What the rate limiter's `OnRejected` actually writes (Program.cs). The
    // other two spellings are the doc's and are never sent.
    TOO_MANY_REQUESTS: 'errors.api.rateLimited',
    RATE_LIMIT_EXCEEDED: 'errors.api.rateLimited',
    RATE_LIMITED: 'errors.api.rateLimited',
};

/**
 * Exact backend message text → i18n key. These are the strings the field-level
 * `details` arrays send verbatim; mapping them lets us re-issue the *same*
 * detail in the user's language rather than showing the English original.
 * Anything not matched here or by {@link MESSAGE_PATTERNS} degrades to the
 * code- or caller-level message (see {@link describeApiError}).
 *
 * Only messages a validator sets with `.WithMessage(…)` are constant enough to
 * match exactly — FluentValidation's *defaults* embed the property name and the
 * length the user typed, so those are matched by pattern instead.
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

    // ── `.WithMessage(…)` overrides on the restaurant-facing validators ──
    // (Auth: profile / tax profile / delivery address; Orders: draft, issue,
    // recurring schedule.) Read off the validators themselves.
    // `ChangePasswordCommandValidator` ends this one with a full stop; the
    // entry above it is the doc's period-less wording, which is never sent.
    'New password must be different from current password.':
        'errors.field.passwordDifferent',
    'AvatarUrl must be a valid absolute HTTPS or HTTP URL.':
        'errors.field.absoluteUrlInvalid',
    'BusinessLicenseUrl must be a valid absolute HTTPS or HTTP URL.':
        'errors.field.absoluteUrlInvalid',
    'Pickup end time must be after pickup start time.':
        'errors.field.pickupWindow',
    'Latitude must be between -90 and 90.': 'errors.field.latitudeRange',
    'Longitude must be between -180 and 180.': 'errors.field.longitudeRange',
    'An order must have at least one item.': 'errors.field.orderItemsRequired',
    "RecurrenceType must be 'daily' or 'weekly'.":
        'errors.field.recurrenceTypeInvalid',
    'OrderItemId must be null or a non-empty id.': 'errors.field.uuidInvalid',
};

/**
 * FluentValidation's **default** messages, which no validator spells out and
 * which therefore cannot be matched exactly: each one interpolates the property
 * name and, for length rules, what the user actually typed. Without these, a
 * 400 from any `NotEmpty()` / `EmailAddress()` / `MaximumLength()` rule reached
 * the user as raw English — which is most of them, since the backend overrides
 * the message on only a handful of rules.
 *
 * Each entry maps to an i18n key plus the params that key interpolates.
 */
const MESSAGE_PATTERNS: {
    pattern: RegExp;
    key: string;
    params?: (match: RegExpMatchArray) => Record<string, string>;
}[] = [
    { pattern: /^'.+' must not be empty\.$/, key: 'errors.field.required' },
    {
        pattern: /^'.+' is not a valid email address\.$/,
        key: 'errors.field.emailInvalid',
    },
    {
        pattern: /^The length of '.+' must be (\d+) characters or fewer/,
        key: 'errors.field.maxLength',
        params: (m) => ({ max: m[1] }),
    },
    {
        pattern: /^The length of '.+' must be at least (\d+) characters/,
        key: 'errors.field.minLength',
        params: (m) => ({ min: m[1] }),
    },
    {
        pattern: /^'.+' must be greater than '(.+)'\.$/,
        key: 'errors.field.greaterThan',
        params: (m) => ({ min: m[1] }),
    },
    // `minValue`/`maxValue`, not the existing `min`/`max`: those two are also
    // the client-side `Validators.min/max` messages, rendered by templates that
    // pass no params — giving them a placeholder would print `{{min}}` there.
    {
        pattern: /^'.+' must be greater than or equal to '(.+)'\.$/,
        key: 'errors.field.minValue',
        params: (m) => ({ min: m[1] }),
    },
    {
        pattern: /^'.+' must be less than or equal to '(.+)'\.$/,
        key: 'errors.field.maxValue',
        params: (m) => ({ max: m[1] }),
    },
    {
        pattern: /^'.+' must be between (.+) and (.+)\.$/,
        key: 'errors.field.between',
        params: (m) => ({ min: m[1], max: m[2] }),
    },
    {
        pattern: /^'.+' is not in the correct format\.$/,
        key: 'errors.field.formatInvalid',
    },
    {
        pattern: /^'.+' must not be equal to '.+'\.$/,
        key: 'errors.field.notEqual',
    },
];

/**
 * Fills `{{param}}` placeholders in an already-translated string.
 *
 * Transloco does this itself when given params, but every caller here passes a
 * one-argument `translate` (98 of them across the app), and widening that
 * signature to thread params through would silently drop them at any call site
 * that was missed — leaving `{{max}}` on screen. Interpolating on this side
 * keeps the contract as it is and cannot half-apply.
 */
export function interpolate(
    text: string,
    params: Record<string, string>
): string {
    return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, name: string) =>
        name in params ? params[name] : whole
    );
}

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

/**
 * Localizes a backend message — first as an exact known string, then against
 * FluentValidation's default shapes. `undefined` when it is neither, so the
 * caller can fall through to the code- or status-level wording instead of
 * showing English.
 */
export function localizeApiMessage(
    text: string | undefined,
    translate: (key: string) => string
): string | undefined {
    const trimmed = text?.trim();
    if (!trimmed) {
        return undefined;
    }
    const exact = API_MESSAGE_TEXT_KEYS[trimmed];
    if (exact) {
        return translate(exact);
    }
    for (const { pattern, key, params } of MESSAGE_PATTERNS) {
        const match = trimmed.match(pattern);
        if (match) {
            const values = params?.(match);
            const template = translate(key);
            return values ? interpolate(template, values) : template;
        }
    }
    return undefined;
}

/**
 * Localizes a `{ code, message }` pair that arrived in a **successful**
 * response body rather than as a rejection — the confirm-preview's `issues[]`
 * being the case that matters: a 200 whose payload lists, in the backend's
 * English, every reason the order would be refused.
 *
 * Same order of specificity as {@link describeApiError}: the code first (it is
 * stable and already mapped), then the message, then the caller's fallback.
 */
export function describeApiCode(
    code: string | null | undefined,
    message: string | null | undefined,
    translate: (key: string) => string,
    fallbackKey: string
): string {
    const codeKey = code ? API_ERROR_MESSAGE_KEYS[code] : undefined;
    if (codeKey) {
        return translate(codeKey);
    }
    return (
        localizeApiMessage(message ?? undefined, translate) ??
        translate(fallbackKey)
    );
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
    return (await resolveApiError(err, translate, fallbackKey)).message;
}

/** A failed call, resolved into everything a screen might want to show. */
export interface ApiErrorView {
    /**
     * The localized sentence to display. Never the backend's own prose — an
     * English sentence is not something to hand a Vietnamese user.
     */
    message: string;
    /** The backend's machine code, when it sent one. */
    code?: string;
    /** HTTP status, when the failure carried a response. */
    status?: number;
    /**
     * True when {@link message} came from a mapping for this specific failure,
     * false when it is only a category guess from the HTTP status (or the
     * caller's fallback). A screen can use it to decide whether to offer
     * "retry" or "report this".
     */
    recognized: boolean;
}

/**
 * Resolves a failed call into a {@link ApiErrorView}.
 *
 * Same order of specificity as before — field detail, message, code, status —
 * with one rule added: **an unrecognized failure keeps its code in the
 * sentence**. Previously an unmapped code fell through to the HTTP category, so
 * a 403 with `SOME_NEW_CODE` read as a bare "you don't have permission" and the
 * one piece of information that identified the failure was dropped on the
 * floor. Nobody could report it, and nobody could tell two different failures
 * apart. Now it reads "… (SOME_NEW_CODE)".
 */
export async function resolveApiError(
    err: unknown,
    translate: (key: string) => string,
    fallbackKey: string
): Promise<ApiErrorView> {
    const info = await readApiError(err);

    if (!info) {
        // No response at all — a fetch network failure throws TypeError.
        return err instanceof TypeError
            ? { message: translate('errors.api.network'), recognized: true }
            : { message: translate(fallbackKey), recognized: false };
    }

    const base = { code: info.code, status: info.status };

    // 1) Field-level detail — the most specific reason(s).
    if (info.fieldErrors) {
        const messages = [...new Set(Object.values(info.fieldErrors))]
            .map((text) => localizeApiMessage(text, translate))
            .filter((text): text is string => !!text);
        if (messages.length) {
            return { ...base, message: messages.join(' '), recognized: true };
        }
    }

    // 2) A specific message the backend spells out (business rule, validator).
    const localizedMessage = localizeApiMessage(info.message, translate);
    if (localizedMessage) {
        return { ...base, message: localizedMessage, recognized: true };
    }

    // 3) The error code.
    const codeKey = info.code ? API_ERROR_MESSAGE_KEYS[info.code] : undefined;
    if (codeKey) {
        return { ...base, message: translate(codeKey), recognized: true };
    }

    // 4) Nothing recognized the failure. Say so by category *and* name the
    //    code, so the failure is still identifiable to whoever is asked about
    //    it — that is the whole reason a code is sent.
    const statusMessage = info.status
        ? API_STATUS_MESSAGE_KEYS[info.status]
        : undefined;
    const category = statusMessage
        ? translate(statusMessage)
        : translate(fallbackKey);

    return {
        ...base,
        message: info.code
            ? interpolate(translate('errors.api.unrecognized'), {
                  category,
                  code: info.code,
              })
            : category,
        recognized: false,
    };
}
