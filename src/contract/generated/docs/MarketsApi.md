# MarketsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiV1MarketsGet**](MarketsApi.md#apiv1marketsget) | **GET** /api/v1/markets |  |
| [**apiV1MarketsIdDeactivatePatch**](MarketsApi.md#apiv1marketsiddeactivatepatch) | **PATCH** /api/v1/markets/{id}/deactivate |  |
| [**apiV1MarketsIdDelete**](MarketsApi.md#apiv1marketsiddelete) | **DELETE** /api/v1/markets/{id} |  |
| [**apiV1MarketsIdGet**](MarketsApi.md#apiv1marketsidget) | **GET** /api/v1/markets/{id} |  |
| [**apiV1MarketsIdPut**](MarketsApi.md#apiv1marketsidput) | **PUT** /api/v1/markets/{id} |  |
| [**apiV1MarketsImageUploadSignaturePost**](MarketsApi.md#apiv1marketsimageuploadsignaturepost) | **POST** /api/v1/markets/image/upload-signature |  |
| [**apiV1MarketsMarketIdProductsGet**](MarketsApi.md#apiv1marketsmarketidproductsget) | **GET** /api/v1/markets/{marketId}/products |  |
| [**apiV1MarketsMarketIdProductsPost**](MarketsApi.md#apiv1marketsmarketidproductspost) | **POST** /api/v1/markets/{marketId}/products |  |
| [**apiV1MarketsMarketIdProductsProductIdDelete**](MarketsApi.md#apiv1marketsmarketidproductsproductiddelete) | **DELETE** /api/v1/markets/{marketId}/products/{productId} |  |
| [**apiV1MarketsMarketIdProductsProductIdPriceHistoryGet**](MarketsApi.md#apiv1marketsmarketidproductsproductidpricehistoryget) | **GET** /api/v1/markets/{marketId}/products/{productId}/price-history |  |
| [**apiV1MarketsMarketIdProductsProductIdPricePatch**](MarketsApi.md#apiv1marketsmarketidproductsproductidpricepatch) | **PATCH** /api/v1/markets/{marketId}/products/{productId}/price |  |
| [**apiV1MarketsMarketIdProductsProductIdQuantityPatch**](MarketsApi.md#apiv1marketsmarketidproductsproductidquantitypatch) | **PATCH** /api/v1/markets/{marketId}/products/{productId}/quantity |  |
| [**apiV1MarketsMarketIdProductsProductIdTagsPut**](MarketsApi.md#apiv1marketsmarketidproductsproductidtagsput) | **PUT** /api/v1/markets/{marketId}/products/{productId}/tags |  |
| [**apiV1MarketsPost**](MarketsApi.md#apiv1marketspost) | **POST** /api/v1/markets |  |



## apiV1MarketsGet

> apiV1MarketsGet(activeOnly)



### Example

```ts
import {
  Configuration,
  MarketsApi,
} from '';
import type { ApiV1MarketsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MarketsApi(config);

  const body = {
    // boolean (optional)
    activeOnly: true,
  } satisfies ApiV1MarketsGetRequest;

  try {
    const data = await api.apiV1MarketsGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **activeOnly** | `boolean` |  | [Optional] [Defaults to `true`] |

### Return type

`void` (Empty response body)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1MarketsIdDeactivatePatch

> apiV1MarketsIdDeactivatePatch(id)



### Example

```ts
import {
  Configuration,
  MarketsApi,
} from '';
import type { ApiV1MarketsIdDeactivatePatchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MarketsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1MarketsIdDeactivatePatchRequest;

  try {
    const data = await api.apiV1MarketsIdDeactivatePatch(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` |  | [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1MarketsIdDelete

> apiV1MarketsIdDelete(id)



### Example

```ts
import {
  Configuration,
  MarketsApi,
} from '';
import type { ApiV1MarketsIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MarketsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1MarketsIdDeleteRequest;

  try {
    const data = await api.apiV1MarketsIdDelete(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` |  | [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1MarketsIdGet

> apiV1MarketsIdGet(id)



### Example

```ts
import {
  Configuration,
  MarketsApi,
} from '';
import type { ApiV1MarketsIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MarketsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1MarketsIdGetRequest;

  try {
    const data = await api.apiV1MarketsIdGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` |  | [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1MarketsIdPut

> apiV1MarketsIdPut(id, updateMarketRequest)



### Example

```ts
import {
  Configuration,
  MarketsApi,
} from '';
import type { ApiV1MarketsIdPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MarketsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // UpdateMarketRequest (optional)
    updateMarketRequest: ...,
  } satisfies ApiV1MarketsIdPutRequest;

  try {
    const data = await api.apiV1MarketsIdPut(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` |  | [Defaults to `undefined`] |
| **updateMarketRequest** | [UpdateMarketRequest](UpdateMarketRequest.md) |  | [Optional] |

### Return type

`void` (Empty response body)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: `application/json`, `text/json`, `application/*+json`
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1MarketsImageUploadSignaturePost

> apiV1MarketsImageUploadSignaturePost()



### Example

```ts
import {
  Configuration,
  MarketsApi,
} from '';
import type { ApiV1MarketsImageUploadSignaturePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MarketsApi(config);

  try {
    const data = await api.apiV1MarketsImageUploadSignaturePost();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

`void` (Empty response body)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1MarketsMarketIdProductsGet

> apiV1MarketsMarketIdProductsGet(marketId, category, cursor, pageSize, tag)



### Example

```ts
import {
  Configuration,
  MarketsApi,
} from '';
import type { ApiV1MarketsMarketIdProductsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MarketsApi(config);

  const body = {
    // string
    marketId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string (optional)
    category: category_example,
    // string (optional)
    cursor: cursor_example,
    // number (optional)
    pageSize: 56,
    // string (optional)
    tag: tag_example,
  } satisfies ApiV1MarketsMarketIdProductsGetRequest;

  try {
    const data = await api.apiV1MarketsMarketIdProductsGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **marketId** | `string` |  | [Defaults to `undefined`] |
| **category** | `string` |  | [Optional] [Defaults to `undefined`] |
| **cursor** | `string` |  | [Optional] [Defaults to `undefined`] |
| **pageSize** | `number` |  | [Optional] [Defaults to `20`] |
| **tag** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `text/plain`, `application/json`, `text/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **404** | Not Found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1MarketsMarketIdProductsPost

> apiV1MarketsMarketIdProductsPost(marketId, createMarketProductRequest)



### Example

```ts
import {
  Configuration,
  MarketsApi,
} from '';
import type { ApiV1MarketsMarketIdProductsPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MarketsApi(config);

  const body = {
    // string
    marketId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // CreateMarketProductRequest (optional)
    createMarketProductRequest: ...,
  } satisfies ApiV1MarketsMarketIdProductsPostRequest;

  try {
    const data = await api.apiV1MarketsMarketIdProductsPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **marketId** | `string` |  | [Defaults to `undefined`] |
| **createMarketProductRequest** | [CreateMarketProductRequest](CreateMarketProductRequest.md) |  | [Optional] |

### Return type

`void` (Empty response body)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: `application/json`, `text/json`, `application/*+json`
- **Accept**: `text/plain`, `application/json`, `text/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | Created |  -  |
| **400** | Bad Request |  -  |
| **401** | Unauthorized |  -  |
| **403** | Forbidden |  -  |
| **404** | Not Found |  -  |
| **409** | Conflict |  -  |
| **422** | Unprocessable Content |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1MarketsMarketIdProductsProductIdDelete

> apiV1MarketsMarketIdProductsProductIdDelete(marketId, productId)



### Example

```ts
import {
  Configuration,
  MarketsApi,
} from '';
import type { ApiV1MarketsMarketIdProductsProductIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MarketsApi(config);

  const body = {
    // string
    marketId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    productId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1MarketsMarketIdProductsProductIdDeleteRequest;

  try {
    const data = await api.apiV1MarketsMarketIdProductsProductIdDelete(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **marketId** | `string` |  | [Defaults to `undefined`] |
| **productId** | `string` |  | [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `text/plain`, `application/json`, `text/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **204** | No Content |  -  |
| **401** | Unauthorized |  -  |
| **403** | Forbidden |  -  |
| **404** | Not Found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1MarketsMarketIdProductsProductIdPriceHistoryGet

> apiV1MarketsMarketIdProductsProductIdPriceHistoryGet(marketId, productId, cursor, pageSize, from, to)



### Example

```ts
import {
  Configuration,
  MarketsApi,
} from '';
import type { ApiV1MarketsMarketIdProductsProductIdPriceHistoryGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MarketsApi(config);

  const body = {
    // string
    marketId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    productId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string (optional)
    cursor: cursor_example,
    // number (optional)
    pageSize: 56,
    // string (optional)
    from: from_example,
    // string (optional)
    to: to_example,
  } satisfies ApiV1MarketsMarketIdProductsProductIdPriceHistoryGetRequest;

  try {
    const data = await api.apiV1MarketsMarketIdProductsProductIdPriceHistoryGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **marketId** | `string` |  | [Defaults to `undefined`] |
| **productId** | `string` |  | [Defaults to `undefined`] |
| **cursor** | `string` |  | [Optional] [Defaults to `undefined`] |
| **pageSize** | `number` |  | [Optional] [Defaults to `50`] |
| **from** | `string` |  | [Optional] [Defaults to `undefined`] |
| **to** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `text/plain`, `application/json`, `text/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **400** | Bad Request |  -  |
| **401** | Unauthorized |  -  |
| **404** | Not Found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1MarketsMarketIdProductsProductIdPricePatch

> apiV1MarketsMarketIdProductsProductIdPricePatch(marketId, productId, updateProductPriceRequest)



### Example

```ts
import {
  Configuration,
  MarketsApi,
} from '';
import type { ApiV1MarketsMarketIdProductsProductIdPricePatchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MarketsApi(config);

  const body = {
    // string
    marketId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    productId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // UpdateProductPriceRequest (optional)
    updateProductPriceRequest: ...,
  } satisfies ApiV1MarketsMarketIdProductsProductIdPricePatchRequest;

  try {
    const data = await api.apiV1MarketsMarketIdProductsProductIdPricePatch(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **marketId** | `string` |  | [Defaults to `undefined`] |
| **productId** | `string` |  | [Defaults to `undefined`] |
| **updateProductPriceRequest** | [UpdateProductPriceRequest](UpdateProductPriceRequest.md) |  | [Optional] |

### Return type

`void` (Empty response body)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: `application/json`, `text/json`, `application/*+json`
- **Accept**: `text/plain`, `application/json`, `text/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **400** | Bad Request |  -  |
| **401** | Unauthorized |  -  |
| **403** | Forbidden |  -  |
| **404** | Not Found |  -  |
| **409** | Conflict |  -  |
| **422** | Unprocessable Content |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1MarketsMarketIdProductsProductIdQuantityPatch

> apiV1MarketsMarketIdProductsProductIdQuantityPatch(marketId, productId, updateAvailableQuantityRequest)



### Example

```ts
import {
  Configuration,
  MarketsApi,
} from '';
import type { ApiV1MarketsMarketIdProductsProductIdQuantityPatchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MarketsApi(config);

  const body = {
    // string
    marketId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    productId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // UpdateAvailableQuantityRequest (optional)
    updateAvailableQuantityRequest: ...,
  } satisfies ApiV1MarketsMarketIdProductsProductIdQuantityPatchRequest;

  try {
    const data = await api.apiV1MarketsMarketIdProductsProductIdQuantityPatch(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **marketId** | `string` |  | [Defaults to `undefined`] |
| **productId** | `string` |  | [Defaults to `undefined`] |
| **updateAvailableQuantityRequest** | [UpdateAvailableQuantityRequest](UpdateAvailableQuantityRequest.md) |  | [Optional] |

### Return type

`void` (Empty response body)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: `application/json`, `text/json`, `application/*+json`
- **Accept**: `text/plain`, `application/json`, `text/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **400** | Bad Request |  -  |
| **401** | Unauthorized |  -  |
| **403** | Forbidden |  -  |
| **404** | Not Found |  -  |
| **409** | Conflict |  -  |
| **422** | Unprocessable Content |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1MarketsMarketIdProductsProductIdTagsPut

> apiV1MarketsMarketIdProductsProductIdTagsPut(marketId, productId, setMarketProductTagsRequest)



### Example

```ts
import {
  Configuration,
  MarketsApi,
} from '';
import type { ApiV1MarketsMarketIdProductsProductIdTagsPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MarketsApi(config);

  const body = {
    // string
    marketId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    productId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // SetMarketProductTagsRequest (optional)
    setMarketProductTagsRequest: ...,
  } satisfies ApiV1MarketsMarketIdProductsProductIdTagsPutRequest;

  try {
    const data = await api.apiV1MarketsMarketIdProductsProductIdTagsPut(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **marketId** | `string` |  | [Defaults to `undefined`] |
| **productId** | `string` |  | [Defaults to `undefined`] |
| **setMarketProductTagsRequest** | [SetMarketProductTagsRequest](SetMarketProductTagsRequest.md) |  | [Optional] |

### Return type

`void` (Empty response body)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: `application/json`, `text/json`, `application/*+json`
- **Accept**: `text/plain`, `application/json`, `text/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **204** | No Content |  -  |
| **400** | Bad Request |  -  |
| **401** | Unauthorized |  -  |
| **403** | Forbidden |  -  |
| **404** | Not Found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1MarketsPost

> apiV1MarketsPost(createMarketRequest)



### Example

```ts
import {
  Configuration,
  MarketsApi,
} from '';
import type { ApiV1MarketsPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MarketsApi(config);

  const body = {
    // CreateMarketRequest (optional)
    createMarketRequest: ...,
  } satisfies ApiV1MarketsPostRequest;

  try {
    const data = await api.apiV1MarketsPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **createMarketRequest** | [CreateMarketRequest](CreateMarketRequest.md) |  | [Optional] |

### Return type

`void` (Empty response body)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: `application/json`, `text/json`, `application/*+json`
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

