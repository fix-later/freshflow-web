# DeliveryZonesApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiV1LogisticsDeliveryZonesGet**](DeliveryZonesApi.md#apiv1logisticsdeliveryzonesget) | **GET** /api/v1/logistics/delivery-zones |  |
| [**apiV1LogisticsDeliveryZonesIdDelete**](DeliveryZonesApi.md#apiv1logisticsdeliveryzonesiddelete) | **DELETE** /api/v1/logistics/delivery-zones/{id} |  |
| [**apiV1LogisticsDeliveryZonesIdGet**](DeliveryZonesApi.md#apiv1logisticsdeliveryzonesidget) | **GET** /api/v1/logistics/delivery-zones/{id} |  |
| [**apiV1LogisticsDeliveryZonesIdPut**](DeliveryZonesApi.md#apiv1logisticsdeliveryzonesidput) | **PUT** /api/v1/logistics/delivery-zones/{id} |  |
| [**apiV1LogisticsDeliveryZonesPost**](DeliveryZonesApi.md#apiv1logisticsdeliveryzonespost) | **POST** /api/v1/logistics/delivery-zones |  |



## apiV1LogisticsDeliveryZonesGet

> apiV1LogisticsDeliveryZonesGet(activeOnly)



### Example

```ts
import {
  Configuration,
  DeliveryZonesApi,
} from '';
import type { ApiV1LogisticsDeliveryZonesGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DeliveryZonesApi(config);

  const body = {
    // boolean (optional)
    activeOnly: true,
  } satisfies ApiV1LogisticsDeliveryZonesGetRequest;

  try {
    const data = await api.apiV1LogisticsDeliveryZonesGet(body);
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


## apiV1LogisticsDeliveryZonesIdDelete

> apiV1LogisticsDeliveryZonesIdDelete(id)



### Example

```ts
import {
  Configuration,
  DeliveryZonesApi,
} from '';
import type { ApiV1LogisticsDeliveryZonesIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DeliveryZonesApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1LogisticsDeliveryZonesIdDeleteRequest;

  try {
    const data = await api.apiV1LogisticsDeliveryZonesIdDelete(body);
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


## apiV1LogisticsDeliveryZonesIdGet

> apiV1LogisticsDeliveryZonesIdGet(id)



### Example

```ts
import {
  Configuration,
  DeliveryZonesApi,
} from '';
import type { ApiV1LogisticsDeliveryZonesIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DeliveryZonesApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1LogisticsDeliveryZonesIdGetRequest;

  try {
    const data = await api.apiV1LogisticsDeliveryZonesIdGet(body);
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


## apiV1LogisticsDeliveryZonesIdPut

> apiV1LogisticsDeliveryZonesIdPut(id, updateDeliveryZoneRequest)



### Example

```ts
import {
  Configuration,
  DeliveryZonesApi,
} from '';
import type { ApiV1LogisticsDeliveryZonesIdPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DeliveryZonesApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // UpdateDeliveryZoneRequest (optional)
    updateDeliveryZoneRequest: ...,
  } satisfies ApiV1LogisticsDeliveryZonesIdPutRequest;

  try {
    const data = await api.apiV1LogisticsDeliveryZonesIdPut(body);
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
| **updateDeliveryZoneRequest** | [UpdateDeliveryZoneRequest](UpdateDeliveryZoneRequest.md) |  | [Optional] |

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


## apiV1LogisticsDeliveryZonesPost

> apiV1LogisticsDeliveryZonesPost(createDeliveryZoneRequest)



### Example

```ts
import {
  Configuration,
  DeliveryZonesApi,
} from '';
import type { ApiV1LogisticsDeliveryZonesPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DeliveryZonesApi(config);

  const body = {
    // CreateDeliveryZoneRequest (optional)
    createDeliveryZoneRequest: ...,
  } satisfies ApiV1LogisticsDeliveryZonesPostRequest;

  try {
    const data = await api.apiV1LogisticsDeliveryZonesPost(body);
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
| **createDeliveryZoneRequest** | [CreateDeliveryZoneRequest](CreateDeliveryZoneRequest.md) |  | [Optional] |

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

