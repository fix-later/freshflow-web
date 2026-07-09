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
    AuthApi,
    CategoriesApi,
    MarketsApi,
    OrdersApi,
    PricingApi,
    ProductsApi,
    ProfileApi,
    RestaurantCreditApi,
    RestaurantProfileApi,
    UnitsApi,
} from './generated';

// Re-export the generated models/runtime + client + auth helpers.
export * from './auth';
export * from './client';
export * from './generated';

// Ready-to-use, pre-configured API singletons.
export const adminApi = new AdminApi(apiConfiguration);
export const authApi = new AuthApi(apiConfiguration);
export const categoriesApi = new CategoriesApi(apiConfiguration);
export const marketsApi = new MarketsApi(apiConfiguration);
export const ordersApi = new OrdersApi(apiConfiguration);
export const pricingApi = new PricingApi(apiConfiguration);
export const productsApi = new ProductsApi(apiConfiguration);
export const profileApi = new ProfileApi(apiConfiguration);
export const restaurantCreditApi = new RestaurantCreditApi(apiConfiguration);
export const restaurantProfileApi = new RestaurantProfileApi(apiConfiguration);
export const unitsApi = new UnitsApi(apiConfiguration);
