# PackingCodesApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiV1CatalogPackingCodesGet**](PackingCodesApi.md#apiv1catalogpackingcodesget) | **GET** /api/v1/catalog/packing-codes |  |
| [**apiV1CatalogPackingCodesIdDeactivatePatch**](PackingCodesApi.md#apiv1catalogpackingcodesiddeactivatepatch) | **PATCH** /api/v1/catalog/packing-codes/{id}/deactivate |  |
| [**apiV1CatalogPackingCodesIdGet**](PackingCodesApi.md#apiv1catalogpackingcodesidget) | **GET** /api/v1/catalog/packing-codes/{id} |  |
| [**apiV1CatalogPackingCodesIdPut**](PackingCodesApi.md#apiv1catalogpackingcodesidput) | **PUT** /api/v1/catalog/packing-codes/{id} |  |
| [**apiV1CatalogPackingCodesPost**](PackingCodesApi.md#apiv1catalogpackingcodespost) | **POST** /api/v1/catalog/packing-codes |  |



## apiV1CatalogPackingCodesGet

> apiV1CatalogPackingCodesGet(activeOnly, page, pageSize)



### Example

```ts
import {
  Configuration,
  PackingCodesApi,
} from '';
import type { ApiV1CatalogPackingCodesGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new PackingCodesApi(config);

  const body = {
    // boolean (optional)
    activeOnly: true,
    // number (optional)
    page: 56,
    // number (optional)
    pageSize: 56,
  } satisfies ApiV1CatalogPackingCodesGetRequest;

  try {
    const data = await api.apiV1CatalogPackingCodesGet(body);
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
| **activeOnly** | `boolean` |  | [Optional] [Defaults to `false`] |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **pageSize** | `number` |  | [Optional] [Defaults to `20`] |

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


## apiV1CatalogPackingCodesIdDeactivatePatch

> apiV1CatalogPackingCodesIdDeactivatePatch(id)



### Example

```ts
import {
  Configuration,
  PackingCodesApi,
} from '';
import type { ApiV1CatalogPackingCodesIdDeactivatePatchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new PackingCodesApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1CatalogPackingCodesIdDeactivatePatchRequest;

  try {
    const data = await api.apiV1CatalogPackingCodesIdDeactivatePatch(body);
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


## apiV1CatalogPackingCodesIdGet

> apiV1CatalogPackingCodesIdGet(id)



### Example

```ts
import {
  Configuration,
  PackingCodesApi,
} from '';
import type { ApiV1CatalogPackingCodesIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new PackingCodesApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1CatalogPackingCodesIdGetRequest;

  try {
    const data = await api.apiV1CatalogPackingCodesIdGet(body);
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


## apiV1CatalogPackingCodesIdPut

> apiV1CatalogPackingCodesIdPut(id, updatePackingCodeRequest)



### Example

```ts
import {
  Configuration,
  PackingCodesApi,
} from '';
import type { ApiV1CatalogPackingCodesIdPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new PackingCodesApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // UpdatePackingCodeRequest (optional)
    updatePackingCodeRequest: ...,
  } satisfies ApiV1CatalogPackingCodesIdPutRequest;

  try {
    const data = await api.apiV1CatalogPackingCodesIdPut(body);
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
| **updatePackingCodeRequest** | [UpdatePackingCodeRequest](UpdatePackingCodeRequest.md) |  | [Optional] |

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


## apiV1CatalogPackingCodesPost

> apiV1CatalogPackingCodesPost(createPackingCodeRequest)



### Example

```ts
import {
  Configuration,
  PackingCodesApi,
} from '';
import type { ApiV1CatalogPackingCodesPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new PackingCodesApi(config);

  const body = {
    // CreatePackingCodeRequest (optional)
    createPackingCodeRequest: ...,
  } satisfies ApiV1CatalogPackingCodesPostRequest;

  try {
    const data = await api.apiV1CatalogPackingCodesPost(body);
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
| **createPackingCodeRequest** | [CreatePackingCodeRequest](CreatePackingCodeRequest.md) |  | [Optional] |

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

