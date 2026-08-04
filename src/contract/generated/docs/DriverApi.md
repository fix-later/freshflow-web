# DriverApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiV1DriverDeliveriesDeliveryIdIssuesPost**](DriverApi.md#apiv1driverdeliveriesdeliveryidissuespost) | **POST** /api/v1/driver/deliveries/{deliveryId}/issues |  |
| [**apiV1DriverDeliveriesDeliveryIdProofOfDeliveryPut**](DriverApi.md#apiv1driverdeliveriesdeliveryidproofofdeliveryput) | **PUT** /api/v1/driver/deliveries/{deliveryId}/proof-of-delivery |  |
| [**apiV1DriverDeliveriesDeliveryIdProofOfDeliveryUploadSignaturePost**](DriverApi.md#apiv1driverdeliveriesdeliveryidproofofdeliveryuploadsignaturepost) | **POST** /api/v1/driver/deliveries/{deliveryId}/proof-of-delivery/upload-signature |  |
| [**apiV1DriverDeliveriesDeliveryIdStatusPatch**](DriverApi.md#apiv1driverdeliveriesdeliveryidstatuspatch) | **PATCH** /api/v1/driver/deliveries/{deliveryId}/status |  |
| [**apiV1DriverRoutesRouteIdConfirmPickupPost**](DriverApi.md#apiv1driverroutesrouteidconfirmpickuppost) | **POST** /api/v1/driver/routes/{routeId}/confirm-pickup |  |
| [**apiV1DriverRoutesRouteIdReorderPost**](DriverApi.md#apiv1driverroutesrouteidreorderpost) | **POST** /api/v1/driver/routes/{routeId}/reorder |  |
| [**apiV1DriverRoutesRouteIdStartPost**](DriverApi.md#apiv1driverroutesrouteidstartpost) | **POST** /api/v1/driver/routes/{routeId}/start |  |
| [**apiV1DriverRoutesTodayGet**](DriverApi.md#apiv1driverroutestodayget) | **GET** /api/v1/driver/routes/today |  |



## apiV1DriverDeliveriesDeliveryIdIssuesPost

> apiV1DriverDeliveriesDeliveryIdIssuesPost(deliveryId, reportDeliveryIssueRequest)



### Example

```ts
import {
  Configuration,
  DriverApi,
} from '';
import type { ApiV1DriverDeliveriesDeliveryIdIssuesPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DriverApi(config);

  const body = {
    // string
    deliveryId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // ReportDeliveryIssueRequest (optional)
    reportDeliveryIssueRequest: ...,
  } satisfies ApiV1DriverDeliveriesDeliveryIdIssuesPostRequest;

  try {
    const data = await api.apiV1DriverDeliveriesDeliveryIdIssuesPost(body);
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
| **deliveryId** | `string` |  | [Defaults to `undefined`] |
| **reportDeliveryIssueRequest** | [ReportDeliveryIssueRequest](ReportDeliveryIssueRequest.md) |  | [Optional] |

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


## apiV1DriverDeliveriesDeliveryIdProofOfDeliveryPut

> apiV1DriverDeliveriesDeliveryIdProofOfDeliveryPut(deliveryId, attachProofOfDeliveryRequest)



### Example

```ts
import {
  Configuration,
  DriverApi,
} from '';
import type { ApiV1DriverDeliveriesDeliveryIdProofOfDeliveryPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DriverApi(config);

  const body = {
    // string
    deliveryId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // AttachProofOfDeliveryRequest (optional)
    attachProofOfDeliveryRequest: ...,
  } satisfies ApiV1DriverDeliveriesDeliveryIdProofOfDeliveryPutRequest;

  try {
    const data = await api.apiV1DriverDeliveriesDeliveryIdProofOfDeliveryPut(body);
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
| **deliveryId** | `string` |  | [Defaults to `undefined`] |
| **attachProofOfDeliveryRequest** | [AttachProofOfDeliveryRequest](AttachProofOfDeliveryRequest.md) |  | [Optional] |

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


## apiV1DriverDeliveriesDeliveryIdProofOfDeliveryUploadSignaturePost

> apiV1DriverDeliveriesDeliveryIdProofOfDeliveryUploadSignaturePost(deliveryId)



### Example

```ts
import {
  Configuration,
  DriverApi,
} from '';
import type { ApiV1DriverDeliveriesDeliveryIdProofOfDeliveryUploadSignaturePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DriverApi(config);

  const body = {
    // string
    deliveryId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1DriverDeliveriesDeliveryIdProofOfDeliveryUploadSignaturePostRequest;

  try {
    const data = await api.apiV1DriverDeliveriesDeliveryIdProofOfDeliveryUploadSignaturePost(body);
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
| **deliveryId** | `string` |  | [Defaults to `undefined`] |

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


## apiV1DriverDeliveriesDeliveryIdStatusPatch

> apiV1DriverDeliveriesDeliveryIdStatusPatch(deliveryId, updateDeliveryStatusRequest)



### Example

```ts
import {
  Configuration,
  DriverApi,
} from '';
import type { ApiV1DriverDeliveriesDeliveryIdStatusPatchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DriverApi(config);

  const body = {
    // string
    deliveryId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // UpdateDeliveryStatusRequest (optional)
    updateDeliveryStatusRequest: ...,
  } satisfies ApiV1DriverDeliveriesDeliveryIdStatusPatchRequest;

  try {
    const data = await api.apiV1DriverDeliveriesDeliveryIdStatusPatch(body);
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
| **deliveryId** | `string` |  | [Defaults to `undefined`] |
| **updateDeliveryStatusRequest** | [UpdateDeliveryStatusRequest](UpdateDeliveryStatusRequest.md) |  | [Optional] |

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


## apiV1DriverRoutesRouteIdConfirmPickupPost

> apiV1DriverRoutesRouteIdConfirmPickupPost(routeId, confirmPickupRequest)



### Example

```ts
import {
  Configuration,
  DriverApi,
} from '';
import type { ApiV1DriverRoutesRouteIdConfirmPickupPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DriverApi(config);

  const body = {
    // string
    routeId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // ConfirmPickupRequest (optional)
    confirmPickupRequest: ...,
  } satisfies ApiV1DriverRoutesRouteIdConfirmPickupPostRequest;

  try {
    const data = await api.apiV1DriverRoutesRouteIdConfirmPickupPost(body);
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
| **confirmPickupRequest** | [ConfirmPickupRequest](ConfirmPickupRequest.md) |  | [Optional] |

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


## apiV1DriverRoutesRouteIdReorderPost

> apiV1DriverRoutesRouteIdReorderPost(routeId, reorderRouteRequest)



### Example

```ts
import {
  Configuration,
  DriverApi,
} from '';
import type { ApiV1DriverRoutesRouteIdReorderPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DriverApi(config);

  const body = {
    // string
    routeId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // ReorderRouteRequest (optional)
    reorderRouteRequest: ...,
  } satisfies ApiV1DriverRoutesRouteIdReorderPostRequest;

  try {
    const data = await api.apiV1DriverRoutesRouteIdReorderPost(body);
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
| **reorderRouteRequest** | [ReorderRouteRequest](ReorderRouteRequest.md) |  | [Optional] |

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


## apiV1DriverRoutesRouteIdStartPost

> apiV1DriverRoutesRouteIdStartPost(routeId)



### Example

```ts
import {
  Configuration,
  DriverApi,
} from '';
import type { ApiV1DriverRoutesRouteIdStartPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DriverApi(config);

  const body = {
    // string
    routeId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1DriverRoutesRouteIdStartPostRequest;

  try {
    const data = await api.apiV1DriverRoutesRouteIdStartPost(body);
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


## apiV1DriverRoutesTodayGet

> apiV1DriverRoutesTodayGet()



### Example

```ts
import {
  Configuration,
  DriverApi,
} from '';
import type { ApiV1DriverRoutesTodayGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DriverApi(config);

  try {
    const data = await api.apiV1DriverRoutesTodayGet();
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

