import { Injectable } from '@angular/core';
import { uploadSignedImage } from 'app/core/api/cloudinary-upload';
import {
    extractList,
    extractPagination,
    extractTotal,
    fetchAllCursor,
    fetchAllOffset,
    parseJson,
    unwrapData,
    withId,
} from 'app/core/api/envelope';
import {
    categoriesApi,
    marketsApi,
    packingCodesApi,
    productsApi,
    tagsApi,
    unitsApi,
} from 'contract';
import {
    CrudFormValue,
    CrudOption,
    CrudRow,
} from '../shared/resource-crud.types';

/**
 * Field limits the catalog's own validators enforce. Named after the rule they
 * mirror so the pair can be re-checked when either side moves — the names are
 * not all the same size (`CreateUnitCommandValidator` caps at 100 where the
 * rest cap at 200), and a form that guesses one number for all of them rejects
 * valid input on one screen and lets a 400 through on another.
 */
export const PRODUCT_NAME_MAX_LENGTH = 200;
export const PRODUCT_DESCRIPTION_MAX_LENGTH = 1000;
export const CATEGORY_NAME_MAX_LENGTH = 200;
export const UNIT_NAME_MAX_LENGTH = 100;
export const UNIT_ABBREVIATION_MAX_LENGTH = 20;
export const MARKET_NAME_MAX_LENGTH = 200;

/**
 * `CrudFormValue` holds only strings/numbers, so the tag screen's pin flag
 * travels as a two-option select. These are its values — kept next to the
 * mapping that reads them so the pair cannot drift.
 */
export const PIN_YES = '1';
export const PIN_NO = '0';
export const MARKET_LOCATION_MAX_LENGTH = 200;
export const MARKET_ADDRESS_MAX_LENGTH = 500;
export const MARKET_DESCRIPTION_MAX_LENGTH = 2000;

/**
 * One recorded price/quantity change for a market listing
 * (`GET /markets/{marketId}/products/{productId}/price-history`, UC-PRI-10).
 *
 * `quantity` is nullable because the endpoint is untyped and an older snapshot
 * may not carry one; `price` is not — an entry without a price is dropped
 * before it gets here.
 */
export interface PriceHistoryEntry {
    /** ISO timestamp the change was recorded at. */
    recordedAt: string;
    price: number;
    quantity: number | null;
    /** User id of the agent who set it; empty when the record predates the field. */
    recordedBy: string;
}

/** Server-side page of products (one page loaded at a time). */
export interface ProductsPage {
    rows: CrudRow[];
    total: number;
    page?: number;
    pageSize?: number;
}

/** Query for a single products page. */
export interface ProductsQuery {
    page: number;
    pageSize: number;
    search?: string;
    categoryId?: string;
}

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

    /**
     * All categories in one request (BE has no offset pagination), each
     * annotated with a resolved `parentName`. The admin table paginates
     * client-side from this list.
     */
    async listCategories(activeOnly = false): Promise<CrudRow[]> {
        const res = await categoriesApi.apiV1CategoriesGetRaw({ activeOnly });
        const body = await parseJson(res.raw);
        return this._withCategoryParentNames(
            withId<CrudRow>(extractList(body), 'categoryId')
        );
    }

    private _withCategoryParentNames(rows: CrudRow[]): CrudRow[] {
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
                imageUrl: optStr(value['imageUrl']),
            },
        });
    }

    async updateCategory(id: string, value: CrudFormValue): Promise<void> {
        await categoriesApi.apiV1CategoriesIdPut({
            id,
            updateCategoryRequest: {
                name: str(value['name']),
                parentId: optStr(value['parentId']),
                imageUrl: optStr(value['imageUrl']),
            },
        });
    }

    async deactivateCategory(id: string): Promise<void> {
        await categoriesApi.apiV1CategoriesIdDeactivatePatch({ id });
    }

    /** Single category by id (edit page). Resolves parentName when missing. */
    async getCategory(id: string): Promise<CrudRow | null> {
        const res = await categoriesApi.apiV1CategoriesIdGetRaw({ id });
        const data = unwrapData<Record<string, unknown>>(
            await parseJson(res.raw)
        );
        if (!data) {
            return null;
        }
        const [row] = withId([data as CrudRow], 'categoryId');
        if (!row?.id) {
            return null;
        }
        if (row['parentId'] && !row['parentName']) {
            try {
                const parent = await categoriesApi.apiV1CategoriesIdGetRaw({
                    id: String(row['parentId']),
                });
                const parentData = unwrapData<Record<string, unknown>>(
                    await parseJson(parent.raw)
                );
                if (parentData?.['name']) {
                    return { ...row, parentName: String(parentData['name']) };
                }
            } catch {
                // Fall through — parent name stays empty.
            }
        }
        return row;
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

    /**
     * All units in one request (BE has no offset pagination). The admin table
     * paginates client-side from this list.
     */
    async listUnits(activeOnly = false): Promise<CrudRow[]> {
        const res = await unitsApi.apiV1UnitsGetRaw({ activeOnly });
        const body = await parseJson(res.raw);
        return withId<CrudRow>(extractList(body), 'unitId');
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

    // ---- Packing codes ------------------------------------------------------

    /**
     * All packing codes in one request (mirrors {@link listUnits} — the admin
     * table paginates client-side).
     */
    async listPackingCodes(activeOnly = false): Promise<CrudRow[]> {
        const res = await packingCodesApi.apiV1CatalogPackingCodesGetRaw({
            activeOnly,
            pageSize: 100,
        });
        const body = await parseJson(res.raw);
        return withId<CrudRow>(extractList(body), 'packingCodeId');
    }

    /**
     * `capacityKg` is sent even when blank.
     *
     * It is a non-nullable `decimal` on the request record, so omitting it does
     * not mean "leave it out" — model binding fills in `0`, which the validator
     * then rejects with a 400. Sending `0` explicitly produces the same refusal
     * from the server but keeps the payload honest about what was submitted;
     * the form's own `required` rule is what stops it getting this far.
     */
    async createPackingCode(value: CrudFormValue): Promise<void> {
        await packingCodesApi.apiV1CatalogPackingCodesPost({
            createPackingCodeRequest: {
                code: str(value['code']),
                description: optStr(value['description']),
                capacityKg: optNum(value['capacityKg']) ?? 0,
            },
        });
    }

    async updatePackingCode(id: string, value: CrudFormValue): Promise<void> {
        await packingCodesApi.apiV1CatalogPackingCodesIdPut({
            id,
            updatePackingCodeRequest: {
                code: str(value['code']),
                description: optStr(value['description']),
                capacityKg: optNum(value['capacityKg']) ?? 0,
            },
        });
    }

    async deactivatePackingCode(id: string): Promise<void> {
        await packingCodesApi.apiV1CatalogPackingCodesIdDeactivatePatch({
            id,
        });
    }

    // ---- Products ---------------------------------------------------------

    /**
     * One server-side page of products. Search and category filtering are sent
     * to the backend (`search`/`category`) so only the current page is loaded,
     * keeping the frontend light. Only active products are returned
     * (`includeInactive: false`).
     */
    async listProducts(query: ProductsQuery): Promise<ProductsPage> {
        const res = await productsApi.apiV1ProductsGetRaw({
            includeInactive: false,
            page: query.page,
            pageSize: query.pageSize,
            search: query.search || undefined,
            category: query.categoryId || undefined,
        });
        const body = await parseJson(res.raw);
        const rows = withId<CrudRow>(extractList(body), 'productId');
        const info = extractPagination(body);
        return {
            rows,
            total: info?.total ?? extractTotal(body) ?? rows.length,
            page: info?.page,
            pageSize: info?.pageSize,
        };
    }

    /**
     * All active products as id/name options for pickers (e.g. adding a product
     * to a market). Pickers need the whole set, so this pages to completion —
     * unlike {@link listProducts}, which loads one page for the table.
     */
    async productOptions(): Promise<CrudOption[]> {
        const rows = await fetchAllOffset<CrudRow>((page, pageSize) =>
            productsApi
                .apiV1ProductsGetRaw({ includeInactive: false, page, pageSize })
                .then((res) => res.raw)
        );
        return withId<CrudRow>(rows, 'productId')
            .filter((row) => !!row.id)
            .map((row) => ({
                value: row.id,
                label: String(row['name'] ?? ''),
            }));
    }

    /** All active products with full row data for selection tables. */
    async listAllProductsForSelection(): Promise<CrudRow[]> {
        const rows = await fetchAllOffset<CrudRow>((page, pageSize) =>
            productsApi
                .apiV1ProductsGetRaw({ includeInactive: false, page, pageSize })
                .then((res) => res.raw)
        );
        return withId<CrudRow>(rows, 'productId').filter((row) => !!row.id);
    }

    /** Single product by id, for pages reached by deep link (no passed state). */
    async getProduct(id: string): Promise<CrudRow | null> {
        const res = await productsApi.apiV1ProductsIdGetRaw({ id });
        const data = unwrapData<Record<string, unknown>>(
            await parseJson(res.raw)
        );
        if (!data) {
            return null;
        }
        const [row] = withId([data as CrudRow], 'productId');
        return row?.id ? row : null;
    }

    async createProduct(value: CrudFormValue): Promise<void> {
        await productsApi.apiV1ProductsPost({
            createProductRequest: {
                name: str(value['name']),
                unitId: str(value['unitId']),
                categoryId: optStr(value['categoryId']),
                description: optStr(value['description']),
                packingCodeId: optStr(value['packingCodeId']),
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
                packingCodeId: optStr(value['packingCodeId']),
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
        return uploadSignedImage(file, () =>
            productsApi.apiV1ProductsImageUploadSignaturePostRaw()
        );
    }

    /** Same flow as {@link uploadProductImage}, for a category's `imageUrl`. */
    async uploadCategoryImage(file: File): Promise<string> {
        return uploadSignedImage(file, () =>
            categoriesApi.apiV1CategoriesImageUploadSignaturePostRaw()
        );
    }

    /** Same flow as {@link uploadProductImage}, for a market's `imageUrl`. */
    async uploadMarketImage(file: File): Promise<string> {
        return uploadSignedImage(file, () =>
            marketsApi.apiV1MarketsImageUploadSignaturePostRaw()
        );
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

    /** Active-only packing-code id/code options for the product form select. */
    async packingCodeOptions(): Promise<CrudOption[]> {
        const codes = (await this.listPackingCodes(true)).filter(
            (c) => c['isActive'] !== false
        );
        return codes
            .filter((row) => !!row.id)
            .map((row) => ({ value: row.id, label: str(row['code']) }));
    }

    // ---- Markets ----------------------------------------------------------

    /**
     * All markets in one request (BE has no offset pagination). The admin
     * table paginates client-side from this list.
     */
    async listMarkets(activeOnly = false): Promise<CrudRow[]> {
        const res = await marketsApi.apiV1MarketsGetRaw({ activeOnly });
        const body = await parseJson(res.raw);
        return withId<CrudRow>(extractList(body), 'marketId');
    }

    async createMarket(value: CrudFormValue): Promise<CrudRow | null> {
        const res = await marketsApi.apiV1MarketsPostRaw({
            createMarketRequest: {
                name: str(value['name']),
                location: optStr(value['location']),
                address: optStr(value['address']),
                latitude: optNum(value['latitude']),
                longitude: optNum(value['longitude']),
                imageUrl: optStr(value['imageUrl']),
                description: optStr(value['description']),
            },
        });
        const data = unwrapData<Record<string, unknown>>(
            await parseJson(res.raw)
        );
        if (!data) {
            return null;
        }
        const [row] = withId([data as CrudRow], 'marketId');
        return row?.id ? row : null;
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
                imageUrl: optStr(value['imageUrl']),
                description: optStr(value['description']),
            },
        });
    }

    async deactivateMarket(id: string): Promise<void> {
        await marketsApi.apiV1MarketsIdDeactivatePatch({ id });
    }

    /**
     * Permanently removes a market (`DELETE /markets/{id}`).
     *
     * Distinct from {@link deactivateMarket}, which retires a market while
     * keeping its price history. Whether a given market may actually be
     * deleted — no listings, no orders referencing it — is the server's call:
     * it answers 409/400 and the caller shows that reason. Nothing is assumed
     * here about which markets qualify.
     */
    async deleteMarket(id: string): Promise<void> {
        await marketsApi.apiV1MarketsIdDelete({ id });
    }

    /** Single market by id (edit page). */
    async getMarket(id: string): Promise<CrudRow | null> {
        const res = await marketsApi.apiV1MarketsIdGetRaw({ id });
        const data = unwrapData<Record<string, unknown>>(
            await parseJson(res.raw)
        );
        if (!data) {
            return null;
        }
        const [row] = withId([data as CrudRow], 'marketId');
        return row?.id ? row : null;
    }

    // ---- Market products (pricing) ---------------------------------------

    async listMarketProducts(marketId: string): Promise<CrudRow[]> {
        return fetchAllCursor<CrudRow>((cursor, pageSize) =>
            marketsApi
                .apiV1MarketsMarketIdProductsGetRaw({
                    marketId,
                    cursor,
                    pageSize,
                })
                .then((res) => res.raw)
        );
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

    /**
     * Replaces a listing's tag assignments
     * (`PUT .../products/{productId}/tags`).
     *
     * A **replace**, not a merge: the endpoint takes the complete set, so the
     * caller must send every tag the listing should keep. Sending a tag whose
     * `pinsToTop` is set is what pins the listing to the top of the market's
     * board — that is what the old `PATCH .../featured` did.
     *
     * Takes **catalog tag ids**, not names. `SetMarketProductTagsRequest` binds
     * `TagIds` (guids) and the validator rejects a null set, so the earlier
     * `{ tags: ["name"] }` body did not merely lose the names — it failed the
     * request outright. Ids that are not in the live catalog come back as
     * `VALIDATION_ERROR` (400) from the handler's lookup.
     *
     */
    async setMarketProductTags(
        marketId: string,
        productId: string,
        tagIds: readonly string[]
    ): Promise<void> {
        await marketsApi.apiV1MarketsMarketIdProductsProductIdTagsPut({
            marketId,
            productId,
            setMarketProductTagsRequest: {
                tagIds: [...new Set(tagIds.filter(Boolean))],
            },
        });
    }

    // -------------------------------------------------------------------
    // Tag catalog (SCRUM-386) — global, not per market
    // -------------------------------------------------------------------

    /**
     * The whole tag catalog (`GET /api/v1/tags`).
     *
     * Readable by any authenticated user, because the storefront needs the
     * names too; only the writes below are admin-only.
     */
    async listTags(): Promise<CrudRow[]> {
        const res = await tagsApi.apiV1TagsGetRaw();
        return withId<CrudRow>(extractList(await parseJson(res.raw)), 'tagId');
    }

    /** Tag catalog as picker options, label = the tag's (normalized) name. */
    async listTagOptions(): Promise<CrudOption[]> {
        const rows = await this.listTags();
        return rows
            .filter((row) => !!row.id)
            .map((row) => ({
                value: row.id,
                label: String(row['name'] ?? row.id),
            }));
    }

    /**
     * Creates a tag. The name is normalized server-side (trim + lower-case) and
     * must be unique — a collision answers 409 `TAG_NAME_CONFLICT`, which the
     * CRUD shell surfaces through `describeApiError`.
     */
    async createTag(value: CrudFormValue): Promise<void> {
        await tagsApi.apiV1TagsPost({
            createTagRequest: {
                name: String(value['name'] ?? '').trim(),
                pinsToTop: value['pinsToTop'] === PIN_YES,
            },
        });
    }

    /** Renames a tag and/or toggles its pin flag (both fields are required). */
    async updateTag(id: string, value: CrudFormValue): Promise<void> {
        await tagsApi.apiV1TagsIdPut({
            id,
            updateTagRequest: {
                name: String(value['name'] ?? '').trim(),
                pinsToTop: value['pinsToTop'] === PIN_YES,
            },
        });
    }

    /**
     * Soft-deletes a tag **and clears it from every listing that carried it**
     * — the backend does both in one command. A pinning tag therefore unpins
     * every listing it was on, which is why the screen asks before running it.
     */
    async deleteTag(id: string): Promise<void> {
        await tagsApi.apiV1TagsIdDelete({ id });
    }

    /** Delists a product from a market (does not deactivate the base product). */
    async removeMarketProduct(
        marketId: string,
        productId: string
    ): Promise<void> {
        await marketsApi.apiV1MarketsMarketIdProductsProductIdDelete({
            marketId,
            productId,
        });
    }

    // ---- Market products (price history) ----------------------------------

    /**
     * Every recorded price/quantity change for one market listing, within
     * `days`, oldest first.
     *
     * Reads the whole window rather than one page: this drives a chart and a
     * change log, both of which need the complete series to mean anything — a
     * "lowest price" over a partial window is a wrong number, not a partial one.
     * `fetchAllCursor` bounds the walk.
     *
     * Rows are read tolerantly (`GET` responses have no declared schema) and a
     * row missing a timestamp or a price is dropped: it cannot be placed on a
     * time axis, and plotting it at 0 would invent a price collapse.
     *
     * Throws on a failed request — unlike the storefront reads, this is the
     * screen's whole subject, so the caller shows the error rather than an
     * empty chart that looks like "no changes yet".
     */
    async getPriceHistory(
        marketId: string,
        productId: string,
        days = 30
    ): Promise<PriceHistoryEntry[]> {
        const from = new Date();
        from.setDate(from.getDate() - days);
        const rows = await fetchAllCursor<CrudRow>((cursor, pageSize) =>
            marketsApi
                .apiV1MarketsMarketIdProductsProductIdPriceHistoryGetRaw({
                    marketId,
                    productId,
                    from: from.toISOString(),
                    cursor,
                    pageSize,
                })
                .then((res) => res.raw)
        );
        return rows
            .map((row) => ({
                recordedAt: str(row['recordedAt'] ?? row['createdAt']),
                price: optNum(row['price'] ?? row['unitPrice']),
                quantity: optNum(row['quantity']),
                recordedBy: str(row['recordedBy'] ?? row['updatedBy']),
            }))
            .filter(
                (entry): entry is PriceHistoryEntry =>
                    !!entry.recordedAt && entry.price !== null
            )
            .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
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
