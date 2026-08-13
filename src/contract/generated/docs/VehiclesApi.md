# VehiclesApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiV1LogisticsVehiclesGet**](VehiclesApi.md#apiv1logisticsvehiclesget) | **GET** /api/v1/logistics/vehicles |  |
| [**apiV1LogisticsVehiclesIdDelete**](VehiclesApi.md#apiv1logisticsvehiclesiddelete) | **DELETE** /api/v1/logistics/vehicles/{id} |  |
| [**apiV1LogisticsVehiclesIdGet**](VehiclesApi.md#apiv1logisticsvehiclesidget) | **GET** /api/v1/logistics/vehicles/{id} |  |
| [**apiV1LogisticsVehiclesIdHubPut**](VehiclesApi.md#apiv1logisticsvehiclesidhubput) | **PUT** /api/v1/logistics/vehicles/{id}/hub |  |
| [**apiV1LogisticsVehiclesIdPut**](VehiclesApi.md#apiv1logisticsvehiclesidput) | **PUT** /api/v1/logistics/vehicles/{id} |  |
| [**apiV1LogisticsVehiclesPost**](VehiclesApi.md#apiv1logisticsvehiclespost) | **POST** /api/v1/logistics/vehicles |  |



## apiV1LogisticsVehiclesGet

> apiV1LogisticsVehiclesGet(cursor, pageSize, isActive, hubId)



### Example

```ts
import {
  Configuration,
  VehiclesApi,
} from '';
import type { ApiV1LogisticsVehiclesGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new VehiclesApi(config);

  const body = {
    // string (optional)
    cursor: cursor_example,
    // number (optional)
    pageSize: 56,
    // boolean (optional)
    isActive: true,
    // string (optional)
    hubId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1LogisticsVehiclesGetRequest;

  try {
    const data = await api.apiV1LogisticsVehiclesGet(body);
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
| **isActive** | `boolean` |  | [Optional] [Defaults to `undefined`] |
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


## apiV1LogisticsVehiclesIdDelete

> apiV1LogisticsVehiclesIdDelete(id)



### Example

```ts
import {
  Configuration,
  VehiclesApi,
} from '';
import type { ApiV1LogisticsVehiclesIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new VehiclesApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1LogisticsVehiclesIdDeleteRequest;

  try {
    const data = await api.apiV1LogisticsVehiclesIdDelete(body);
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


## apiV1LogisticsVehiclesIdGet

> apiV1LogisticsVehiclesIdGet(id)



### Example

```ts
import {
  Configuration,
  VehiclesApi,
} from '';
import type { ApiV1LogisticsVehiclesIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new VehiclesApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1LogisticsVehiclesIdGetRequest;

  try {
    const data = await api.apiV1LogisticsVehiclesIdGet(body);
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


## apiV1LogisticsVehiclesIdHubPut

> apiV1LogisticsVehiclesIdHubPut(id, assignVehicleToHubRequest)



### Example

```ts
import {
  Configuration,
  VehiclesApi,
} from '';
import type { ApiV1LogisticsVehiclesIdHubPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new VehiclesApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // AssignVehicleToHubRequest (optional)
    assignVehicleToHubRequest: ...,
  } satisfies ApiV1LogisticsVehiclesIdHubPutRequest;

  try {
    const data = await api.apiV1LogisticsVehiclesIdHubPut(body);
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
| **assignVehicleToHubRequest** | [AssignVehicleToHubRequest](AssignVehicleToHubRequest.md) |  | [Optional] |

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


## apiV1LogisticsVehiclesIdPut

> apiV1LogisticsVehiclesIdPut(id, updateVehicleRequest)



### Example

```ts
import {
  Configuration,
  VehiclesApi,
} from '';
import type { ApiV1LogisticsVehiclesIdPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new VehiclesApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // UpdateVehicleRequest (optional)
    updateVehicleRequest: ...,
  } satisfies ApiV1LogisticsVehiclesIdPutRequest;

  try {
    const data = await api.apiV1LogisticsVehiclesIdPut(body);
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
| **updateVehicleRequest** | [UpdateVehicleRequest](UpdateVehicleRequest.md) |  | [Optional] |

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


## apiV1LogisticsVehiclesPost

> apiV1LogisticsVehiclesPost(registerVehicleRequest)



### Example

```ts
import {
  Configuration,
  VehiclesApi,
} from '';
import type { ApiV1LogisticsVehiclesPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new VehiclesApi(config);

  const body = {
    // RegisterVehicleRequest (optional)
    registerVehicleRequest: ...,
  } satisfies ApiV1LogisticsVehiclesPostRequest;

  try {
    const data = await api.apiV1LogisticsVehiclesPost(body);
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
| **registerVehicleRequest** | [RegisterVehicleRequest](RegisterVehicleRequest.md) |  | [Optional] |

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

