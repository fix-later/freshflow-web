# CategoriesApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiV1CategoriesGet**](CategoriesApi.md#apiv1categoriesget) | **GET** /api/v1/categories |  |
| [**apiV1CategoriesIdDeactivatePatch**](CategoriesApi.md#apiv1categoriesiddeactivatepatch) | **PATCH** /api/v1/categories/{id}/deactivate |  |
| [**apiV1CategoriesIdGet**](CategoriesApi.md#apiv1categoriesidget) | **GET** /api/v1/categories/{id} |  |
| [**apiV1CategoriesIdPut**](CategoriesApi.md#apiv1categoriesidput) | **PUT** /api/v1/categories/{id} |  |
| [**apiV1CategoriesPost**](CategoriesApi.md#apiv1categoriespost) | **POST** /api/v1/categories |  |



## apiV1CategoriesGet

> apiV1CategoriesGet(activeOnly)



### Example

```ts
import {
  Configuration,
  CategoriesApi,
} from '';
import type { ApiV1CategoriesGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CategoriesApi(config);

  const body = {
    // boolean (optional)
    activeOnly: true,
  } satisfies ApiV1CategoriesGetRequest;

  try {
    const data = await api.apiV1CategoriesGet(body);
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


## apiV1CategoriesIdDeactivatePatch

> apiV1CategoriesIdDeactivatePatch(id)



### Example

```ts
import {
  Configuration,
  CategoriesApi,
} from '';
import type { ApiV1CategoriesIdDeactivatePatchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CategoriesApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1CategoriesIdDeactivatePatchRequest;

  try {
    const data = await api.apiV1CategoriesIdDeactivatePatch(body);
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


## apiV1CategoriesIdGet

> apiV1CategoriesIdGet(id)



### Example

```ts
import {
  Configuration,
  CategoriesApi,
} from '';
import type { ApiV1CategoriesIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CategoriesApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1CategoriesIdGetRequest;

  try {
    const data = await api.apiV1CategoriesIdGet(body);
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


## apiV1CategoriesIdPut

> apiV1CategoriesIdPut(id, updateCategoryRequest)



### Example

```ts
import {
  Configuration,
  CategoriesApi,
} from '';
import type { ApiV1CategoriesIdPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CategoriesApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // UpdateCategoryRequest (optional)
    updateCategoryRequest: ...,
  } satisfies ApiV1CategoriesIdPutRequest;

  try {
    const data = await api.apiV1CategoriesIdPut(body);
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
| **updateCategoryRequest** | [UpdateCategoryRequest](UpdateCategoryRequest.md) |  | [Optional] |

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


## apiV1CategoriesPost

> apiV1CategoriesPost(createCategoryRequest)



### Example

```ts
import {
  Configuration,
  CategoriesApi,
} from '';
import type { ApiV1CategoriesPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CategoriesApi(config);

  const body = {
    // CreateCategoryRequest (optional)
    createCategoryRequest: ...,
  } satisfies ApiV1CategoriesPostRequest;

  try {
    const data = await api.apiV1CategoriesPost(body);
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
| **createCategoryRequest** | [CreateCategoryRequest](CreateCategoryRequest.md) |  | [Optional] |

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

