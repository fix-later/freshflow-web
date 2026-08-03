# HubInboundApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiV1HubsHubIdCrossDockGet**](HubInboundApi.md#apiv1hubshubidcrossdockget) | **GET** /api/v1/hubs/{hubId}/cross-dock |  |
| [**apiV1HubsHubIdCrossDockPost**](HubInboundApi.md#apiv1hubshubidcrossdockpost) | **POST** /api/v1/hubs/{hubId}/cross-dock |  |
| [**apiV1HubsHubIdDiscrepanciesDiscrepancyIdAcknowledgePost**](HubInboundApi.md#apiv1hubshubiddiscrepanciesdiscrepancyidacknowledgepost) | **POST** /api/v1/hubs/{hubId}/discrepancies/{discrepancyId}/acknowledge |  |
| [**apiV1HubsHubIdDiscrepanciesGet**](HubInboundApi.md#apiv1hubshubiddiscrepanciesget) | **GET** /api/v1/hubs/{hubId}/discrepancies |  |
| [**apiV1HubsHubIdInboundGet**](HubInboundApi.md#apiv1hubshubidinboundget) | **GET** /api/v1/hubs/{hubId}/inbound |  |
| [**apiV1HubsHubIdInboundInboundIdDiscrepancyPost**](HubInboundApi.md#apiv1hubshubidinboundinboundiddiscrepancypost) | **POST** /api/v1/hubs/{hubId}/inbound/{inboundId}/discrepancy |  |
| [**apiV1HubsHubIdInboundPost**](HubInboundApi.md#apiv1hubshubidinboundpost) | **POST** /api/v1/hubs/{hubId}/inbound |  |
| [**apiV1HubsHubIdOrdersByRestaurantGet**](HubInboundApi.md#apiv1hubshubidordersbyrestaurantget) | **GET** /api/v1/hubs/{hubId}/orders-by-restaurant |  |
| [**apiV1HubsHubIdOutboundGet**](HubInboundApi.md#apiv1hubshubidoutboundget) | **GET** /api/v1/hubs/{hubId}/outbound |  |
| [**apiV1HubsHubIdOutboundPost**](HubInboundApi.md#apiv1hubshubidoutboundpost) | **POST** /api/v1/hubs/{hubId}/outbound |  |
| [**apiV1HubsHubIdPendingInboundGet**](HubInboundApi.md#apiv1hubshubidpendinginboundget) | **GET** /api/v1/hubs/{hubId}/pending-inbound |  |
| [**apiV1HubsHubIdProcurementPlanGet**](HubInboundApi.md#apiv1hubshubidprocurementplanget) | **GET** /api/v1/hubs/{hubId}/procurement-plan |  |
| [**apiV1HubsHubIdSortingPost**](HubInboundApi.md#apiv1hubshubidsortingpost) | **POST** /api/v1/hubs/{hubId}/sorting |  |
| [**apiV1HubsHubIdSortingProgressGet**](HubInboundApi.md#apiv1hubshubidsortingprogressget) | **GET** /api/v1/hubs/{hubId}/sorting-progress |  |
| [**apiV1HubsScanPost**](HubInboundApi.md#apiv1hubsscanpost) | **POST** /api/v1/hubs/scan |  |



## apiV1HubsHubIdCrossDockGet

> apiV1HubsHubIdCrossDockGet(hubId, status, cursor, pageSize)



### Example

```ts
import {
  Configuration,
  HubInboundApi,
} from '';
import type { ApiV1HubsHubIdCrossDockGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new HubInboundApi(config);

  const body = {
    // string
    hubId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string (optional)
    status: status_example,
    // string (optional)
    cursor: cursor_example,
    // number (optional)
    pageSize: 56,
  } satisfies ApiV1HubsHubIdCrossDockGetRequest;

  try {
    const data = await api.apiV1HubsHubIdCrossDockGet(body);
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
| **hubId** | `string` |  | [Defaults to `undefined`] |
| **status** | `string` |  | [Optional] [Defaults to `undefined`] |
| **cursor** | `string` |  | [Optional] [Defaults to `undefined`] |
| **pageSize** | `number` |  | [Optional] [Defaults to `50`] |

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


## apiV1HubsHubIdCrossDockPost

> apiV1HubsHubIdCrossDockPost(hubId, createCrossDockRequest)



### Example

```ts
import {
  Configuration,
  HubInboundApi,
} from '';
import type { ApiV1HubsHubIdCrossDockPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new HubInboundApi(config);

  const body = {
    // string
    hubId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // CreateCrossDockRequest (optional)
    createCrossDockRequest: ...,
  } satisfies ApiV1HubsHubIdCrossDockPostRequest;

  try {
    const data = await api.apiV1HubsHubIdCrossDockPost(body);
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
| **hubId** | `string` |  | [Defaults to `undefined`] |
| **createCrossDockRequest** | [CreateCrossDockRequest](CreateCrossDockRequest.md) |  | [Optional] |

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


## apiV1HubsHubIdDiscrepanciesDiscrepancyIdAcknowledgePost

> apiV1HubsHubIdDiscrepanciesDiscrepancyIdAcknowledgePost(hubId, discrepancyId)



### Example

```ts
import {
  Configuration,
  HubInboundApi,
} from '';
import type { ApiV1HubsHubIdDiscrepanciesDiscrepancyIdAcknowledgePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new HubInboundApi(config);

  const body = {
    // string
    hubId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    discrepancyId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1HubsHubIdDiscrepanciesDiscrepancyIdAcknowledgePostRequest;

  try {
    const data = await api.apiV1HubsHubIdDiscrepanciesDiscrepancyIdAcknowledgePost(body);
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
| **hubId** | `string` |  | [Defaults to `undefined`] |
| **discrepancyId** | `string` |  | [Defaults to `undefined`] |

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


## apiV1HubsHubIdDiscrepanciesGet

> apiV1HubsHubIdDiscrepanciesGet(hubId, status, cursor, pageSize)



### Example

```ts
import {
  Configuration,
  HubInboundApi,
} from '';
import type { ApiV1HubsHubIdDiscrepanciesGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new HubInboundApi(config);

  const body = {
    // string
    hubId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string (optional)
    status: status_example,
    // string (optional)
    cursor: cursor_example,
    // number (optional)
    pageSize: 56,
  } satisfies ApiV1HubsHubIdDiscrepanciesGetRequest;

  try {
    const data = await api.apiV1HubsHubIdDiscrepanciesGet(body);
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
| **hubId** | `string` |  | [Defaults to `undefined`] |
| **status** | `string` |  | [Optional] [Defaults to `undefined`] |
| **cursor** | `string` |  | [Optional] [Defaults to `undefined`] |
| **pageSize** | `number` |  | [Optional] [Defaults to `50`] |

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


## apiV1HubsHubIdInboundGet

> apiV1HubsHubIdInboundGet(hubId, date, cursor, pageSize)



### Example

```ts
import {
  Configuration,
  HubInboundApi,
} from '';
import type { ApiV1HubsHubIdInboundGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new HubInboundApi(config);

  const body = {
    // string
    hubId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // Date (optional)
    date: 2013-10-20,
    // string (optional)
    cursor: cursor_example,
    // number (optional)
    pageSize: 56,
  } satisfies ApiV1HubsHubIdInboundGetRequest;

  try {
    const data = await api.apiV1HubsHubIdInboundGet(body);
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
| **hubId** | `string` |  | [Defaults to `undefined`] |
| **date** | `Date` |  | [Optional] [Defaults to `undefined`] |
| **cursor** | `string` |  | [Optional] [Defaults to `undefined`] |
| **pageSize** | `number` |  | [Optional] [Defaults to `50`] |

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


## apiV1HubsHubIdInboundInboundIdDiscrepancyPost

> apiV1HubsHubIdInboundInboundIdDiscrepancyPost(hubId, inboundId, recordDiscrepancyRequest)



### Example

```ts
import {
  Configuration,
  HubInboundApi,
} from '';
import type { ApiV1HubsHubIdInboundInboundIdDiscrepancyPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new HubInboundApi(config);

  const body = {
    // string
    hubId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    inboundId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // RecordDiscrepancyRequest (optional)
    recordDiscrepancyRequest: ...,
  } satisfies ApiV1HubsHubIdInboundInboundIdDiscrepancyPostRequest;

  try {
    const data = await api.apiV1HubsHubIdInboundInboundIdDiscrepancyPost(body);
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
| **hubId** | `string` |  | [Defaults to `undefined`] |
| **inboundId** | `string` |  | [Defaults to `undefined`] |
| **recordDiscrepancyRequest** | [RecordDiscrepancyRequest](RecordDiscrepancyRequest.md) |  | [Optional] |

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


## apiV1HubsHubIdInboundPost

> apiV1HubsHubIdInboundPost(hubId, recordInboundRequest)



### Example

```ts
import {
  Configuration,
  HubInboundApi,
} from '';
import type { ApiV1HubsHubIdInboundPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new HubInboundApi(config);

  const body = {
    // string
    hubId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // RecordInboundRequest (optional)
    recordInboundRequest: ...,
  } satisfies ApiV1HubsHubIdInboundPostRequest;

  try {
    const data = await api.apiV1HubsHubIdInboundPost(body);
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
| **hubId** | `string` |  | [Defaults to `undefined`] |
| **recordInboundRequest** | [RecordInboundRequest](RecordInboundRequest.md) |  | [Optional] |

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


## apiV1HubsHubIdOrdersByRestaurantGet

> apiV1HubsHubIdOrdersByRestaurantGet(hubId, serviceDate, includeBatched)



### Example

```ts
import {
  Configuration,
  HubInboundApi,
} from '';
import type { ApiV1HubsHubIdOrdersByRestaurantGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new HubInboundApi(config);

  const body = {
    // string
    hubId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // Date (optional)
    serviceDate: 2013-10-20,
    // boolean (optional)
    includeBatched: true,
  } satisfies ApiV1HubsHubIdOrdersByRestaurantGetRequest;

  try {
    const data = await api.apiV1HubsHubIdOrdersByRestaurantGet(body);
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
| **hubId** | `string` |  | [Defaults to `undefined`] |
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


## apiV1HubsHubIdOutboundGet

> apiV1HubsHubIdOutboundGet(hubId, date, cursor, pageSize)



### Example

```ts
import {
  Configuration,
  HubInboundApi,
} from '';
import type { ApiV1HubsHubIdOutboundGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new HubInboundApi(config);

  const body = {
    // string
    hubId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // Date (optional)
    date: 2013-10-20,
    // string (optional)
    cursor: cursor_example,
    // number (optional)
    pageSize: 56,
  } satisfies ApiV1HubsHubIdOutboundGetRequest;

  try {
    const data = await api.apiV1HubsHubIdOutboundGet(body);
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
| **hubId** | `string` |  | [Defaults to `undefined`] |
| **date** | `Date` |  | [Optional] [Defaults to `undefined`] |
| **cursor** | `string` |  | [Optional] [Defaults to `undefined`] |
| **pageSize** | `number` |  | [Optional] [Defaults to `50`] |

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


## apiV1HubsHubIdOutboundPost

> apiV1HubsHubIdOutboundPost(hubId, recordOutboundRequest)



### Example

```ts
import {
  Configuration,
  HubInboundApi,
} from '';
import type { ApiV1HubsHubIdOutboundPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new HubInboundApi(config);

  const body = {
    // string
    hubId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // RecordOutboundRequest (optional)
    recordOutboundRequest: ...,
  } satisfies ApiV1HubsHubIdOutboundPostRequest;

  try {
    const data = await api.apiV1HubsHubIdOutboundPost(body);
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
| **hubId** | `string` |  | [Defaults to `undefined`] |
| **recordOutboundRequest** | [RecordOutboundRequest](RecordOutboundRequest.md) |  | [Optional] |

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


## apiV1HubsHubIdPendingInboundGet

> apiV1HubsHubIdPendingInboundGet(hubId, cursor, pageSize)



### Example

```ts
import {
  Configuration,
  HubInboundApi,
} from '';
import type { ApiV1HubsHubIdPendingInboundGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new HubInboundApi(config);

  const body = {
    // string
    hubId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string (optional)
    cursor: cursor_example,
    // number (optional)
    pageSize: 56,
  } satisfies ApiV1HubsHubIdPendingInboundGetRequest;

  try {
    const data = await api.apiV1HubsHubIdPendingInboundGet(body);
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
| **hubId** | `string` |  | [Defaults to `undefined`] |
| **cursor** | `string` |  | [Optional] [Defaults to `undefined`] |
| **pageSize** | `number` |  | [Optional] [Defaults to `50`] |

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


## apiV1HubsHubIdProcurementPlanGet

> apiV1HubsHubIdProcurementPlanGet(hubId, date)



### Example

```ts
import {
  Configuration,
  HubInboundApi,
} from '';
import type { ApiV1HubsHubIdProcurementPlanGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new HubInboundApi(config);

  const body = {
    // string
    hubId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // Date (optional)
    date: 2013-10-20,
  } satisfies ApiV1HubsHubIdProcurementPlanGetRequest;

  try {
    const data = await api.apiV1HubsHubIdProcurementPlanGet(body);
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
| **hubId** | `string` |  | [Defaults to `undefined`] |
| **date** | `Date` |  | [Optional] [Defaults to `undefined`] |

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


## apiV1HubsHubIdSortingPost

> apiV1HubsHubIdSortingPost(hubId, markLineSortedRequest)



### Example

```ts
import {
  Configuration,
  HubInboundApi,
} from '';
import type { ApiV1HubsHubIdSortingPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new HubInboundApi(config);

  const body = {
    // string
    hubId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // MarkLineSortedRequest (optional)
    markLineSortedRequest: ...,
  } satisfies ApiV1HubsHubIdSortingPostRequest;

  try {
    const data = await api.apiV1HubsHubIdSortingPost(body);
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
| **hubId** | `string` |  | [Defaults to `undefined`] |
| **markLineSortedRequest** | [MarkLineSortedRequest](MarkLineSortedRequest.md) |  | [Optional] |

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


## apiV1HubsHubIdSortingProgressGet

> apiV1HubsHubIdSortingProgressGet(hubId, serviceDate)



### Example

```ts
import {
  Configuration,
  HubInboundApi,
} from '';
import type { ApiV1HubsHubIdSortingProgressGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new HubInboundApi(config);

  const body = {
    // string
    hubId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // Date (optional)
    serviceDate: 2013-10-20,
  } satisfies ApiV1HubsHubIdSortingProgressGetRequest;

  try {
    const data = await api.apiV1HubsHubIdSortingProgressGet(body);
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
| **hubId** | `string` |  | [Defaults to `undefined`] |
| **serviceDate** | `Date` |  | [Optional] [Defaults to `undefined`] |

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


## apiV1HubsScanPost

> apiV1HubsScanPost(scanInboundRequest)



### Example

```ts
import {
  Configuration,
  HubInboundApi,
} from '';
import type { ApiV1HubsScanPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new HubInboundApi(config);

  const body = {
    // ScanInboundRequest (optional)
    scanInboundRequest: ...,
  } satisfies ApiV1HubsScanPostRequest;

  try {
    const data = await api.apiV1HubsScanPost(body);
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
| **scanInboundRequest** | [ScanInboundRequest](ScanInboundRequest.md) |  | [Optional] |

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

