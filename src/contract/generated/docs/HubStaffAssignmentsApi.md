# HubStaffAssignmentsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiV1HubsAssignedGet**](HubStaffAssignmentsApi.md#apiv1hubsassignedget) | **GET** /api/v1/hubs/assigned |  |
| [**apiV1HubsHubIdDriverAssignmentsGet**](HubStaffAssignmentsApi.md#apiv1hubshubiddriverassignmentsget) | **GET** /api/v1/hubs/{hubId}/driver-assignments |  |
| [**apiV1HubsHubIdDriverAssignmentsPut**](HubStaffAssignmentsApi.md#apiv1hubshubiddriverassignmentsput) | **PUT** /api/v1/hubs/{hubId}/driver-assignments |  |
| [**apiV1HubsHubIdStaffAssignmentsGet**](HubStaffAssignmentsApi.md#apiv1hubshubidstaffassignmentsget) | **GET** /api/v1/hubs/{hubId}/staff-assignments |  |
| [**apiV1HubsHubIdStaffAssignmentsPut**](HubStaffAssignmentsApi.md#apiv1hubshubidstaffassignmentsput) | **PUT** /api/v1/hubs/{hubId}/staff-assignments |  |



## apiV1HubsAssignedGet

> apiV1HubsAssignedGet()



### Example

```ts
import {
  Configuration,
  HubStaffAssignmentsApi,
} from '';
import type { ApiV1HubsAssignedGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new HubStaffAssignmentsApi(config);

  try {
    const data = await api.apiV1HubsAssignedGet();
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


## apiV1HubsHubIdDriverAssignmentsGet

> apiV1HubsHubIdDriverAssignmentsGet(hubId)



### Example

```ts
import {
  Configuration,
  HubStaffAssignmentsApi,
} from '';
import type { ApiV1HubsHubIdDriverAssignmentsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new HubStaffAssignmentsApi(config);

  const body = {
    // string
    hubId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1HubsHubIdDriverAssignmentsGetRequest;

  try {
    const data = await api.apiV1HubsHubIdDriverAssignmentsGet(body);
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


## apiV1HubsHubIdDriverAssignmentsPut

> apiV1HubsHubIdDriverAssignmentsPut(hubId, replaceHubDriverAssignmentsRequest)



### Example

```ts
import {
  Configuration,
  HubStaffAssignmentsApi,
} from '';
import type { ApiV1HubsHubIdDriverAssignmentsPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new HubStaffAssignmentsApi(config);

  const body = {
    // string
    hubId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // ReplaceHubDriverAssignmentsRequest (optional)
    replaceHubDriverAssignmentsRequest: ...,
  } satisfies ApiV1HubsHubIdDriverAssignmentsPutRequest;

  try {
    const data = await api.apiV1HubsHubIdDriverAssignmentsPut(body);
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
| **replaceHubDriverAssignmentsRequest** | [ReplaceHubDriverAssignmentsRequest](ReplaceHubDriverAssignmentsRequest.md) |  | [Optional] |

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


## apiV1HubsHubIdStaffAssignmentsGet

> apiV1HubsHubIdStaffAssignmentsGet(hubId)



### Example

```ts
import {
  Configuration,
  HubStaffAssignmentsApi,
} from '';
import type { ApiV1HubsHubIdStaffAssignmentsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new HubStaffAssignmentsApi(config);

  const body = {
    // string
    hubId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1HubsHubIdStaffAssignmentsGetRequest;

  try {
    const data = await api.apiV1HubsHubIdStaffAssignmentsGet(body);
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


## apiV1HubsHubIdStaffAssignmentsPut

> apiV1HubsHubIdStaffAssignmentsPut(hubId, replaceHubStaffAssignmentsRequest)



### Example

```ts
import {
  Configuration,
  HubStaffAssignmentsApi,
} from '';
import type { ApiV1HubsHubIdStaffAssignmentsPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new HubStaffAssignmentsApi(config);

  const body = {
    // string
    hubId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // ReplaceHubStaffAssignmentsRequest (optional)
    replaceHubStaffAssignmentsRequest: ...,
  } satisfies ApiV1HubsHubIdStaffAssignmentsPutRequest;

  try {
    const data = await api.apiV1HubsHubIdStaffAssignmentsPut(body);
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
| **replaceHubStaffAssignmentsRequest** | [ReplaceHubStaffAssignmentsRequest](ReplaceHubStaffAssignmentsRequest.md) |  | [Optional] |

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

