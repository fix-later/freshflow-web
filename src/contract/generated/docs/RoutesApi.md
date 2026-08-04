# RoutesApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiV1LogisticsRoutesCalculatePost**](RoutesApi.md#apiv1logisticsroutescalculatepost) | **POST** /api/v1/logistics/routes/calculate |  |
| [**apiV1LogisticsRoutesGet**](RoutesApi.md#apiv1logisticsroutesget) | **GET** /api/v1/logistics/routes |  |
| [**apiV1LogisticsRoutesIdAssignVehiclePost**](RoutesApi.md#apiv1logisticsroutesidassignvehiclepost) | **POST** /api/v1/logistics/routes/{id}/assign-vehicle |  |
| [**apiV1LogisticsRoutesIdGet**](RoutesApi.md#apiv1logisticsroutesidget) | **GET** /api/v1/logistics/routes/{id} |  |
| [**apiV1LogisticsRoutesIdLoadingManifestGet**](RoutesApi.md#apiv1logisticsroutesidloadingmanifestget) | **GET** /api/v1/logistics/routes/{id}/loading-manifest |  |
| [**apiV1LogisticsRoutesIdOptimizePost**](RoutesApi.md#apiv1logisticsroutesidoptimizepost) | **POST** /api/v1/logistics/routes/{id}/optimize |  |
| [**apiV1LogisticsRoutesIdReviewPost**](RoutesApi.md#apiv1logisticsroutesidreviewpost) | **POST** /api/v1/logistics/routes/{id}/review |  |
| [**apiV1LogisticsRoutesIdSelectPost**](RoutesApi.md#apiv1logisticsroutesidselectpost) | **POST** /api/v1/logistics/routes/{id}/select |  |
| [**apiV1LogisticsRoutesPlanPost**](RoutesApi.md#apiv1logisticsroutesplanpost) | **POST** /api/v1/logistics/routes/plan |  |
| [**apiV1LogisticsRoutesRouteIdEligibilityGet**](RoutesApi.md#apiv1logisticsroutesrouteideligibilityget) | **GET** /api/v1/logistics/routes/{routeId}/eligibility |  |
| [**apiV1LogisticsRoutesSuggestionsGet**](RoutesApi.md#apiv1logisticsroutessuggestionsget) | **GET** /api/v1/logistics/routes/suggestions |  |



## apiV1LogisticsRoutesCalculatePost

> apiV1LogisticsRoutesCalculatePost(calculateRouteRequest)



### Example

```ts
import {
  Configuration,
  RoutesApi,
} from '';
import type { ApiV1LogisticsRoutesCalculatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new RoutesApi(config);

  const body = {
    // CalculateRouteRequest (optional)
    calculateRouteRequest: ...,
  } satisfies ApiV1LogisticsRoutesCalculatePostRequest;

  try {
    const data = await api.apiV1LogisticsRoutesCalculatePost(body);
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
| **calculateRouteRequest** | [CalculateRouteRequest](CalculateRouteRequest.md) |  | [Optional] |

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


## apiV1LogisticsRoutesGet

> apiV1LogisticsRoutesGet(cursor, pageSize, serviceDate, status, hubId)



### Example

```ts
import {
  Configuration,
  RoutesApi,
} from '';
import type { ApiV1LogisticsRoutesGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new RoutesApi(config);

  const body = {
    // string (optional)
    cursor: cursor_example,
    // number (optional)
    pageSize: 56,
    // Date (optional)
    serviceDate: 2013-10-20,
    // string (optional)
    status: status_example,
    // string (optional)
    hubId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1LogisticsRoutesGetRequest;

  try {
    const data = await api.apiV1LogisticsRoutesGet(body);
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
| **cursor** | `string` |  | [Optional] [Defaults to `undefined`] |
| **pageSize** | `number` |  | [Optional] [Defaults to `50`] |
| **serviceDate** | `Date` |  | [Optional] [Defaults to `undefined`] |
| **status** | `string` |  | [Optional] [Defaults to `undefined`] |
| **hubId** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## apiV1LogisticsRoutesIdAssignVehiclePost

> apiV1LogisticsRoutesIdAssignVehiclePost(id, assignVehicleRequest)



### Example

```ts
import {
  Configuration,
  RoutesApi,
} from '';
import type { ApiV1LogisticsRoutesIdAssignVehiclePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new RoutesApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // AssignVehicleRequest (optional)
    assignVehicleRequest: ...,
  } satisfies ApiV1LogisticsRoutesIdAssignVehiclePostRequest;

  try {
    const data = await api.apiV1LogisticsRoutesIdAssignVehiclePost(body);
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
| **assignVehicleRequest** | [AssignVehicleRequest](AssignVehicleRequest.md) |  | [Optional] |

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


## apiV1LogisticsRoutesIdGet

> apiV1LogisticsRoutesIdGet(id)



### Example

```ts
import {
  Configuration,
  RoutesApi,
} from '';
import type { ApiV1LogisticsRoutesIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new RoutesApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1LogisticsRoutesIdGetRequest;

  try {
    const data = await api.apiV1LogisticsRoutesIdGet(body);
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


## apiV1LogisticsRoutesIdLoadingManifestGet

> apiV1LogisticsRoutesIdLoadingManifestGet(id)



### Example

```ts
import {
  Configuration,
  RoutesApi,
} from '';
import type { ApiV1LogisticsRoutesIdLoadingManifestGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new RoutesApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1LogisticsRoutesIdLoadingManifestGetRequest;

  try {
    const data = await api.apiV1LogisticsRoutesIdLoadingManifestGet(body);
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


## apiV1LogisticsRoutesIdOptimizePost

> apiV1LogisticsRoutesIdOptimizePost(id, optimizeRouteRequest)



### Example

```ts
import {
  Configuration,
  RoutesApi,
} from '';
import type { ApiV1LogisticsRoutesIdOptimizePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new RoutesApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // OptimizeRouteRequest (optional)
    optimizeRouteRequest: ...,
  } satisfies ApiV1LogisticsRoutesIdOptimizePostRequest;

  try {
    const data = await api.apiV1LogisticsRoutesIdOptimizePost(body);
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
| **optimizeRouteRequest** | [OptimizeRouteRequest](OptimizeRouteRequest.md) |  | [Optional] |

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


## apiV1LogisticsRoutesIdReviewPost

> apiV1LogisticsRoutesIdReviewPost(id, reviewRouteRequest)



### Example

```ts
import {
  Configuration,
  RoutesApi,
} from '';
import type { ApiV1LogisticsRoutesIdReviewPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new RoutesApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // ReviewRouteRequest (optional)
    reviewRouteRequest: ...,
  } satisfies ApiV1LogisticsRoutesIdReviewPostRequest;

  try {
    const data = await api.apiV1LogisticsRoutesIdReviewPost(body);
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
| **reviewRouteRequest** | [ReviewRouteRequest](ReviewRouteRequest.md) |  | [Optional] |

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


## apiV1LogisticsRoutesIdSelectPost

> apiV1LogisticsRoutesIdSelectPost(id)



### Example

```ts
import {
  Configuration,
  RoutesApi,
} from '';
import type { ApiV1LogisticsRoutesIdSelectPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new RoutesApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1LogisticsRoutesIdSelectPostRequest;

  try {
    const data = await api.apiV1LogisticsRoutesIdSelectPost(body);
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


## apiV1LogisticsRoutesPlanPost

> apiV1LogisticsRoutesPlanPost(planRoutesRequest)



### Example

```ts
import {
  Configuration,
  RoutesApi,
} from '';
import type { ApiV1LogisticsRoutesPlanPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new RoutesApi(config);

  const body = {
    // PlanRoutesRequest (optional)
    planRoutesRequest: ...,
  } satisfies ApiV1LogisticsRoutesPlanPostRequest;

  try {
    const data = await api.apiV1LogisticsRoutesPlanPost(body);
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
| **planRoutesRequest** | [PlanRoutesRequest](PlanRoutesRequest.md) |  | [Optional] |

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


## apiV1LogisticsRoutesRouteIdEligibilityGet

> apiV1LogisticsRoutesRouteIdEligibilityGet(routeId, vehicleId, driverUserId)



### Example

```ts
import {
  Configuration,
  RoutesApi,
} from '';
import type { ApiV1LogisticsRoutesRouteIdEligibilityGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new RoutesApi(config);

  const body = {
    // string
    routeId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string (optional)
    vehicleId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string (optional)
    driverUserId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1LogisticsRoutesRouteIdEligibilityGetRequest;

  try {
    const data = await api.apiV1LogisticsRoutesRouteIdEligibilityGet(body);
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
| **routeId** | `string` |  | [Defaults to `undefined`] |
| **vehicleId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **driverUserId** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## apiV1LogisticsRoutesSuggestionsGet

> apiV1LogisticsRoutesSuggestionsGet(serviceDate, includeBatched)



### Example

```ts
import {
  Configuration,
  RoutesApi,
} from '';
import type { ApiV1LogisticsRoutesSuggestionsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new RoutesApi(config);

  const body = {
    // Date (optional)
    serviceDate: 2013-10-20,
    // boolean (optional)
    includeBatched: true,
  } satisfies ApiV1LogisticsRoutesSuggestionsGetRequest;

  try {
    const data = await api.apiV1LogisticsRoutesSuggestionsGet(body);
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
| **serviceDate** | `Date` |  | [Optional] [Defaults to `undefined`] |
| **includeBatched** | `boolean` |  | [Optional] [Defaults to `false`] |

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

