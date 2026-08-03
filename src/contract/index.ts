/**
 * Public entry point for the typed API layer.
 *
 * Import everything from here (the `contract` path maps to `src/contract` via
 * the tsconfig `baseUrl`) rather than reaching into `./generated` directly:
 *
 *   import { productsApi, categoriesApi, PermissionError } from 'contract';
 *
 * Each exported API instance is bound to the shared {@link apiConfiguration}
 * (base URL + bearer token + JSON headers + 401/403/5xx handling).
 */
import { apiConfiguration } from './client';
import {
    AdminApi,
    AnalyticsApi,
    AssistantApi,
    AuthApi,
    CategoriesApi,
    DriverApi,
    HubHandoverApi,
    HubInboundApi,
    HubStaffAssignmentsApi,
    HubsApi,
    InvoicesApi,
    MarketsApi,
    NotificationApi,
    NotificationDeviceApi,
    OrdersApi,
    PackingCodesApi,
    PricingApi,
    ProcurementApi,
    ProductsApi,
    ProfileApi,
    RestaurantCreditApi,
    RestaurantFavoritesApi,
    RestaurantProfileApi,
    RoutesApi,
    ShippingApi,
    UnitsApi,
    VehiclesApi,
} from './generated';

// Re-export the generated models/runtime + client + auth helpers.
export * from './auth';
export * from './client';
export * from './generated';
export * from './raw';

// Ready-to-use, pre-configured API singletons.
export const adminApi = new AdminApi(apiConfiguration);
export const analyticsApi = new AnalyticsApi(apiConfiguration);
export const assistantApi = new AssistantApi(apiConfiguration);
export const authApi = new AuthApi(apiConfiguration);
export const categoriesApi = new CategoriesApi(apiConfiguration);
export const driverApi = new DriverApi(apiConfiguration);
export const hubHandoverApi = new HubHandoverApi(apiConfiguration);
export const hubInboundApi = new HubInboundApi(apiConfiguration);
export const hubStaffAssignmentsApi = new HubStaffAssignmentsApi(
    apiConfiguration
);
export const hubsApi = new HubsApi(apiConfiguration);
export const invoicesApi = new InvoicesApi(apiConfiguration);
export const marketsApi = new MarketsApi(apiConfiguration);
export const notificationApi = new NotificationApi(apiConfiguration);
export const notificationDeviceApi = new NotificationDeviceApi(
    apiConfiguration
);
export const ordersApi = new OrdersApi(apiConfiguration);
export const packingCodesApi = new PackingCodesApi(apiConfiguration);
export const pricingApi = new PricingApi(apiConfiguration);
export const procurementApi = new ProcurementApi(apiConfiguration);
export const productsApi = new ProductsApi(apiConfiguration);
export const profileApi = new ProfileApi(apiConfiguration);
export const restaurantCreditApi = new RestaurantCreditApi(apiConfiguration);
export const restaurantFavoritesApi = new RestaurantFavoritesApi(
    apiConfiguration
);
export const restaurantProfileApi = new RestaurantProfileApi(apiConfiguration);
export const routesApi = new RoutesApi(apiConfiguration);
export const shippingApi = new ShippingApi(apiConfiguration);
export const unitsApi = new UnitsApi(apiConfiguration);
export const vehiclesApi = new VehiclesApi(apiConfiguration);
