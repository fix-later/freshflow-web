# RestaurantCreditApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiV1RestaurantsRestaurantIdCreditGet**](RestaurantCreditApi.md#apiv1restaurantsrestaurantidcreditget) | **GET** /api/v1/restaurants/{restaurantId}/credit |  |
| [**apiV1RestaurantsRestaurantIdCreditStatementsGeneratePost**](RestaurantCreditApi.md#apiv1restaurantsrestaurantidcreditstatementsgeneratepost) | **POST** /api/v1/restaurants/{restaurantId}/credit/statements/generate |  |
| [**apiV1RestaurantsRestaurantIdCreditStatementsGet**](RestaurantCreditApi.md#apiv1restaurantsrestaurantidcreditstatementsget) | **GET** /api/v1/restaurants/{restaurantId}/credit/statements |  |
| [**apiV1RestaurantsRestaurantIdCreditStatementsStatementIdGet**](RestaurantCreditApi.md#apiv1restaurantsrestaurantidcreditstatementsstatementidget) | **GET** /api/v1/restaurants/{restaurantId}/credit/statements/{statementId} |  |
| [**apiV1RestaurantsRestaurantIdCreditStatementsStatementIdPdfGet**](RestaurantCreditApi.md#apiv1restaurantsrestaurantidcreditstatementsstatementidpdfget) | **GET** /api/v1/restaurants/{restaurantId}/credit/statements/{statementId}/pdf |  |
| [**apiV1RestaurantsRestaurantIdCreditTransactionsGet**](RestaurantCreditApi.md#apiv1restaurantsrestaurantidcredittransactionsget) | **GET** /api/v1/restaurants/{restaurantId}/credit/transactions |  |



## apiV1RestaurantsRestaurantIdCreditGet

> apiV1RestaurantsRestaurantIdCreditGet(restaurantId)



### Example

```ts
import {
  Configuration,
  RestaurantCreditApi,
} from '';
import type { ApiV1RestaurantsRestaurantIdCreditGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new RestaurantCreditApi(config);

  const body = {
    // string
    restaurantId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1RestaurantsRestaurantIdCreditGetRequest;

  try {
    const data = await api.apiV1RestaurantsRestaurantIdCreditGet(body);
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
| **restaurantId** | `string` |  | [Defaults to `undefined`] |

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
| **403** | Forbidden |  -  |
| **404** | Not Found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1RestaurantsRestaurantIdCreditStatementsGeneratePost

> apiV1RestaurantsRestaurantIdCreditStatementsGeneratePost(restaurantId, generateStatementRequest)



### Example

```ts
import {
  Configuration,
  RestaurantCreditApi,
} from '';
import type { ApiV1RestaurantsRestaurantIdCreditStatementsGeneratePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new RestaurantCreditApi(config);

  const body = {
    // string
    restaurantId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // GenerateStatementRequest (optional)
    generateStatementRequest: ...,
  } satisfies ApiV1RestaurantsRestaurantIdCreditStatementsGeneratePostRequest;

  try {
    const data = await api.apiV1RestaurantsRestaurantIdCreditStatementsGeneratePost(body);
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
| **restaurantId** | `string` |  | [Defaults to `undefined`] |
| **generateStatementRequest** | [GenerateStatementRequest](GenerateStatementRequest.md) |  | [Optional] |

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
| **403** | Forbidden |  -  |
| **404** | Not Found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1RestaurantsRestaurantIdCreditStatementsGet

> apiV1RestaurantsRestaurantIdCreditStatementsGet(restaurantId, cursor, pageSize)



### Example

```ts
import {
  Configuration,
  RestaurantCreditApi,
} from '';
import type { ApiV1RestaurantsRestaurantIdCreditStatementsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new RestaurantCreditApi(config);

  const body = {
    // string
    restaurantId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string (optional)
    cursor: cursor_example,
    // number (optional)
    pageSize: 56,
  } satisfies ApiV1RestaurantsRestaurantIdCreditStatementsGetRequest;

  try {
    const data = await api.apiV1RestaurantsRestaurantIdCreditStatementsGet(body);
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
| **restaurantId** | `string` |  | [Defaults to `undefined`] |
| **cursor** | `string` |  | [Optional] [Defaults to `undefined`] |
| **pageSize** | `number` |  | [Optional] [Defaults to `50`] |

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
| **403** | Forbidden |  -  |
| **404** | Not Found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1RestaurantsRestaurantIdCreditStatementsStatementIdGet

> apiV1RestaurantsRestaurantIdCreditStatementsStatementIdGet(restaurantId, statementId)



### Example

```ts
import {
  Configuration,
  RestaurantCreditApi,
} from '';
import type { ApiV1RestaurantsRestaurantIdCreditStatementsStatementIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new RestaurantCreditApi(config);

  const body = {
    // string
    restaurantId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    statementId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1RestaurantsRestaurantIdCreditStatementsStatementIdGetRequest;

  try {
    const data = await api.apiV1RestaurantsRestaurantIdCreditStatementsStatementIdGet(body);
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
| **restaurantId** | `string` |  | [Defaults to `undefined`] |
| **statementId** | `string` |  | [Defaults to `undefined`] |

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
| **403** | Forbidden |  -  |
| **404** | Not Found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1RestaurantsRestaurantIdCreditStatementsStatementIdPdfGet

> apiV1RestaurantsRestaurantIdCreditStatementsStatementIdPdfGet(restaurantId, statementId)



### Example

```ts
import {
  Configuration,
  RestaurantCreditApi,
} from '';
import type { ApiV1RestaurantsRestaurantIdCreditStatementsStatementIdPdfGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new RestaurantCreditApi(config);

  const body = {
    // string
    restaurantId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    statementId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1RestaurantsRestaurantIdCreditStatementsStatementIdPdfGetRequest;

  try {
    const data = await api.apiV1RestaurantsRestaurantIdCreditStatementsStatementIdPdfGet(body);
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
| **restaurantId** | `string` |  | [Defaults to `undefined`] |
| **statementId** | `string` |  | [Defaults to `undefined`] |

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
| **403** | Forbidden |  -  |
| **404** | Not Found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1RestaurantsRestaurantIdCreditTransactionsGet

> apiV1RestaurantsRestaurantIdCreditTransactionsGet(restaurantId, cursor, pageSize, from, to)



### Example

```ts
import {
  Configuration,
  RestaurantCreditApi,
} from '';
import type { ApiV1RestaurantsRestaurantIdCreditTransactionsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new RestaurantCreditApi(config);

  const body = {
    // string
    restaurantId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string (optional)
    cursor: cursor_example,
    // number (optional)
    pageSize: 56,
    // string (optional)
    from: from_example,
    // string (optional)
    to: to_example,
  } satisfies ApiV1RestaurantsRestaurantIdCreditTransactionsGetRequest;

  try {
    const data = await api.apiV1RestaurantsRestaurantIdCreditTransactionsGet(body);
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
| **restaurantId** | `string` |  | [Defaults to `undefined`] |
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
| **403** | Forbidden |  -  |
| **404** | Not Found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

