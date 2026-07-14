import { Injectable } from '@angular/core';
import { extractList, parseJson } from 'app/core/api/envelope';
import { categoriesApi, marketsApi, productsApi, unitsApi } from 'contract';
import {
    CrudFormValue,
    CrudOption,
    CrudRow,
} from '../shared/resource-crud.types';

/** Coerce a form value to a required (non-empty) string. */
function str(value: unknown): string {
    return value == null ? '' : String(value);
}

/** Coerce a form value to an optional string (empty → null). */
function optStr(value: unknown): string | null {
    const trimmed = (value == null ? '' : String(value)).trim();
    return trimmed === '' ? null : trimmed;
}

/** Coerce a form value to an optional number (empty/NaN → null). */
function optNum(value: unknown): number | null {
    if (value == null || value === '') {
        return null;
    }
    const num = Number(value);
    return Number.isNaN(num) ? null : num;
}

/**
 * Admin catalog data access (categories, units, products, markets + market
 * pricing), backed by the generated OpenAPI client. Responses are untyped in
 * the spec, so list bodies are parsed via the shared envelope helpers.
 */
@Injectable({ providedIn: 'root' })
export class CatalogAdminService {
    // ---- Categories -------------------------------------------------------

    async listCategories(): Promise<CrudRow[]> {
        const res = await categoriesApi.apiV1CategoriesGetRaw({
            activeOnly: false,
        });
        return extractList<CrudRow>(await parseJson(res.raw));
    }

    async createCategory(value: CrudFormValue): Promise<void> {
        await categoriesApi.apiV1CategoriesPost({
            createCategoryRequest: { name: str(value['name']) },
        });
    }

    async updateCategory(id: string, value: CrudFormValue): Promise<void> {
        await categoriesApi.apiV1CategoriesIdPut({
            id,
            updateCategoryRequest: { name: str(value['name']) },
        });
    }

    async deactivateCategory(id: string): Promise<void> {
        await categoriesApi.apiV1CategoriesIdDeactivatePatch({ id });
    }

    // ---- Units ------------------------------------------------------------

    async listUnits(): Promise<CrudRow[]> {
        const res = await unitsApi.apiV1UnitsGetRaw({ activeOnly: false });
        return extractList<CrudRow>(await parseJson(res.raw));
    }

    async createUnit(value: CrudFormValue): Promise<void> {
        await unitsApi.apiV1UnitsPost({
            createUnitRequest: {
                name: str(value['name']),
                abbreviation: optStr(value['abbreviation']),
            },
        });
    }

    async updateUnit(id: string, value: CrudFormValue): Promise<void> {
        await unitsApi.apiV1UnitsIdPut({
            id,
            updateUnitRequest: {
                name: str(value['name']),
                abbreviation: optStr(value['abbreviation']),
            },
        });
    }

    async deactivateUnit(id: string): Promise<void> {
        await unitsApi.apiV1UnitsIdDeactivatePatch({ id });
    }

    // ---- Products ---------------------------------------------------------

    async listProducts(): Promise<CrudRow[]> {
        const res = await productsApi.apiV1ProductsGetRaw({
            includeInactive: true,
            pageSize: 100,
        });
        return extractList<CrudRow>(await parseJson(res.raw));
    }

    async createProduct(value: CrudFormValue): Promise<void> {
        await productsApi.apiV1ProductsPost({
            createProductRequest: {
                name: str(value['name']),
                unitId: str(value['unitId']),
                categoryId: optStr(value['categoryId']),
                description: optStr(value['description']),
            },
        });
    }

    async updateProduct(id: string, value: CrudFormValue): Promise<void> {
        await productsApi.apiV1ProductsIdPut({
            id,
            updateProductRequest: {
                name: str(value['name']),
                unitId: str(value['unitId']),
                categoryId: optStr(value['categoryId']),
                description: optStr(value['description']),
                imageUrl: optStr(value['imageUrl']),
            },
        });
    }

    async deactivateProduct(id: string): Promise<void> {
        await productsApi.apiV1ProductsIdDeactivatePatch({ id });
    }

    /** Category id/name options for the product form select. */
    async categoryOptions(): Promise<CrudOption[]> {
        return this._toOptions(await this.listCategories());
    }

    /** Unit id/name options for the product form select. */
    async unitOptions(): Promise<CrudOption[]> {
        return this._toOptions(await this.listUnits(), 'abbreviation');
    }

    // ---- Markets ----------------------------------------------------------

    async listMarkets(): Promise<CrudRow[]> {
        const res = await marketsApi.apiV1MarketsGetRaw({ activeOnly: false });
        return extractList<CrudRow>(await parseJson(res.raw));
    }

    async createMarket(value: CrudFormValue): Promise<void> {
        await marketsApi.apiV1MarketsPost({
            createMarketRequest: {
                name: str(value['name']),
                location: optStr(value['location']),
                address: optStr(value['address']),
                latitude: optNum(value['latitude']),
                longitude: optNum(value['longitude']),
            },
        });
    }

    async updateMarket(id: string, value: CrudFormValue): Promise<void> {
        await marketsApi.apiV1MarketsIdPut({
            id,
            updateMarketRequest: {
                name: str(value['name']),
                location: optStr(value['location']),
                address: optStr(value['address']),
                latitude: optNum(value['latitude']),
                longitude: optNum(value['longitude']),
            },
        });
    }

    async deactivateMarket(id: string): Promise<void> {
        await marketsApi.apiV1MarketsIdDeactivatePatch({ id });
    }

    // ---- Market products (pricing) ---------------------------------------

    async listMarketProducts(marketId: string): Promise<CrudRow[]> {
        const res = await marketsApi.apiV1MarketsMarketIdProductsGetRaw({
            marketId,
            pageSize: 200,
        });
        return extractList<CrudRow>(await parseJson(res.raw));
    }

    async addMarketProduct(
        marketId: string,
        productId: string,
        initialPrice: number | null,
        initialQuantity: number | null
    ): Promise<void> {
        await marketsApi.apiV1MarketsMarketIdProductsPost({
            marketId,
            createMarketProductRequest: {
                productId,
                initialPrice: initialPrice ?? undefined,
                initialQuantity: initialQuantity ?? undefined,
            },
        });
    }

    async updateMarketPrice(
        marketId: string,
        productId: string,
        price: number
    ): Promise<void> {
        await marketsApi.apiV1MarketsMarketIdProductsProductIdPricePatch({
            marketId,
            productId,
            updateProductPriceRequest: { price },
        });
    }

    async updateMarketQuantity(
        marketId: string,
        productId: string,
        quantity: number
    ): Promise<void> {
        await marketsApi.apiV1MarketsMarketIdProductsProductIdQuantityPatch({
            marketId,
            productId,
            updateAvailableQuantityRequest: { quantity },
        });
    }

    private _toOptions(rows: CrudRow[], suffixKey?: string): CrudOption[] {
        return rows
            .filter((row) => !!row.id)
            .map((row) => {
                const name = str(row['name']);
                const suffix = suffixKey ? str(row[suffixKey]) : '';
                return {
                    value: row.id,
                    label: suffix ? `${name} (${suffix})` : name,
                };
            });
    }
}
