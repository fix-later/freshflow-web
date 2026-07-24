import { Injectable } from '@angular/core';
import {
    extractList,
    extractTotal,
    MAX_PAGE_SIZE,
    parseJson,
    unwrapData,
    withId,
} from 'app/core/api/envelope';
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

/**
 * Signed Cloudinary upload params returned by the backend
 * `POST /api/v1/products/image/upload-signature` (admin only). The signature is
 * computed over `folder` + `timestamp`, so those exact params must be forwarded
 * to Cloudinary alongside the file.
 */
interface ProductImageSignature {
    signature: string;
    timestamp: number;
    apiKey: string;
    cloudName: string;
    folder: string;
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

    /**
     * Categories, each annotated with a resolved `parentName`.
     *
     * The spec declares no response schema, and the list body carries only
     * `parentId` — so the parent's name is resolved by self-joining the same
     * list (no extra request). A server-sent `parentName` wins if present.
     */
    async listCategories(activeOnly = false): Promise<CrudRow[]> {
        const res = await categoriesApi.apiV1CategoriesGetRaw({ activeOnly });
        const rows = withId<CrudRow>(
            extractList(await parseJson(res.raw)),
            'categoryId'
        );
        const nameById = new Map(rows.map((row) => [row.id, str(row['name'])]));
        return rows.map((row) => ({
            ...row,
            parentName:
                optStr(row['parentName']) ??
                (row['parentId']
                    ? nameById.get(String(row['parentId'])) ?? ''
                    : ''),
        }));
    }

    async createCategory(value: CrudFormValue): Promise<void> {
        await categoriesApi.apiV1CategoriesPost({
            createCategoryRequest: {
                name: str(value['name']),
                parentId: optStr(value['parentId']),
            },
        });
    }

    async updateCategory(id: string, value: CrudFormValue): Promise<void> {
        await categoriesApi.apiV1CategoriesIdPut({
            id,
            updateCategoryRequest: {
                name: str(value['name']),
                parentId: optStr(value['parentId']),
            },
        });
    }

    async deactivateCategory(id: string): Promise<void> {
        await categoriesApi.apiV1CategoriesIdDeactivatePatch({ id });
    }

    /**
     * Reactivates a category through the dedicated
     * `PATCH /categories/{id}/activate` endpoint (added to the backend API).
     * Replaces the earlier `PUT` + `isActive: true` workaround, which the server
     * ignored (the update body has no `isActive`), leaving the row inactive.
     */
    async activateCategory(row: CrudRow): Promise<void> {
        await categoriesApi.apiV1CategoriesIdActivatePatch({ id: row.id });
    }

    // ---- Units ------------------------------------------------------------

    async listUnits(activeOnly = false): Promise<CrudRow[]> {
        const res = await unitsApi.apiV1UnitsGetRaw({ activeOnly });
        return withId<CrudRow>(extractList(await parseJson(res.raw)), 'unitId');
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

    /**
     * All products, following the offset pagination to completion — the API
     * caps `pageSize` at {@link MAX_PAGE_SIZE}, so a single request would miss
     * anything past the first 100. Loops until a short page (or the reported
     * total) is reached.
     */
    async listProducts(): Promise<CrudRow[]> {
        const pageSize = MAX_PAGE_SIZE;
        const all: CrudRow[] = [];
        for (let page = 1; ; page++) {
            const res = await productsApi.apiV1ProductsGetRaw({
                includeInactive: true,
                page,
                pageSize,
            });
            const body = await parseJson(res.raw);
            const rows = withId<CrudRow>(extractList(body), 'productId');
            all.push(...rows);
            const total = extractTotal(body);
            const done =
                rows.length < pageSize ||
                (total != null && all.length >= total) ||
                page >= 100; // safety cap: 100 pages × 100 = 10k products
            if (done) {
                break;
            }
        }
        return all;
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

    /**
     * Uploads a product image straight to Cloudinary using a short-lived signed
     * request minted by the backend, and returns the hosted `secure_url` to
     * store in the product's `imageUrl`.
     */
    async uploadProductImage(file: File): Promise<string> {
        const res =
            await productsApi.apiV1ProductsImageUploadSignaturePostRaw();
        const sig = unwrapData<ProductImageSignature>(await parseJson(res.raw));
        if (!sig?.signature) {
            throw new Error('Could not obtain an upload signature.');
        }

        const form = new FormData();
        form.append('file', file);
        form.append('api_key', sig.apiKey);
        form.append('timestamp', String(sig.timestamp));
        form.append('signature', sig.signature);
        form.append('folder', sig.folder);

        const upload = await fetch(
            `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
            { method: 'POST', body: form }
        );
        const body = (await upload.json()) as { secure_url?: string };
        if (!upload.ok || !body.secure_url) {
            throw new Error('Image upload failed.');
        }
        return body.secure_url;
    }

    /**
     * Category id/name options. Pass `activeOnly` for pickers/filters that must
     * not offer deactivated categories.
     */
    async categoryOptions(activeOnly = false): Promise<CrudOption[]> {
        return this._toOptions(await this.listCategories(activeOnly));
    }

    /** Active-only unit id/name options for the product form select. */
    async unitOptions(): Promise<CrudOption[]> {
        const units = (await this.listUnits(true)).filter(
            (u) => u['isActive'] !== false
        );
        return this._toOptions(units, 'abbreviation');
    }

    // ---- Markets ----------------------------------------------------------

    async listMarkets(): Promise<CrudRow[]> {
        const res = await marketsApi.apiV1MarketsGetRaw({ activeOnly: false });
        return withId<CrudRow>(
            extractList(await parseJson(res.raw)),
            'marketId'
        );
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
            pageSize: MAX_PAGE_SIZE,
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
