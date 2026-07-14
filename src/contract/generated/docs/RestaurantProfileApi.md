# RestaurantProfileApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiV1RestaurantsMeApprovalStatusGet**](RestaurantProfileApi.md#apiv1restaurantsmeapprovalstatusget) | **GET** /api/v1/restaurants/me/approval-status |  |
| [**apiV1RestaurantsMeBusinessLicenseUploadSignaturePost**](RestaurantProfileApi.md#apiv1restaurantsmebusinesslicenseuploadsignaturepost) | **POST** /api/v1/restaurants/me/business-license/upload-signature |  |
| [**apiV1RestaurantsMeDeliveryAddressesGet**](RestaurantProfileApi.md#apiv1restaurantsmedeliveryaddressesget) | **GET** /api/v1/restaurants/me/delivery-addresses |  |
| [**apiV1RestaurantsMeDeliveryAddressesIdDelete**](RestaurantProfileApi.md#apiv1restaurantsmedeliveryaddressesiddelete) | **DELETE** /api/v1/restaurants/me/delivery-addresses/{id} |  |
| [**apiV1RestaurantsMeDeliveryAddressesIdPut**](RestaurantProfileApi.md#apiv1restaurantsmedeliveryaddressesidput) | **PUT** /api/v1/restaurants/me/delivery-addresses/{id} |  |
| [**apiV1RestaurantsMeDeliveryAddressesPost**](RestaurantProfileApi.md#apiv1restaurantsmedeliveryaddressespost) | **POST** /api/v1/restaurants/me/delivery-addresses |  |
| [**apiV1RestaurantsMeProfileGet**](RestaurantProfileApi.md#apiv1restaurantsmeprofileget) | **GET** /api/v1/restaurants/me/profile |  |
| [**apiV1RestaurantsMeProfilePut**](RestaurantProfileApi.md#apiv1restaurantsmeprofileput) | **PUT** /api/v1/restaurants/me/profile |  |



## apiV1RestaurantsMeApprovalStatusGet

> apiV1RestaurantsMeApprovalStatusGet()



### Example

```ts
import {
  Configuration,
  RestaurantProfileApi,
} from '';
import type { ApiV1RestaurantsMeApprovalStatusGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new RestaurantProfileApi(config);

  try {
    const data = await api.apiV1RestaurantsMeApprovalStatusGet();
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


## apiV1RestaurantsMeBusinessLicenseUploadSignaturePost

> apiV1RestaurantsMeBusinessLicenseUploadSignaturePost()



### Example

```ts
import {
  Configuration,
  RestaurantProfileApi,
} from '';
import type { ApiV1RestaurantsMeBusinessLicenseUploadSignaturePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new RestaurantProfileApi(config);

  try {
    const data = await api.apiV1RestaurantsMeBusinessLicenseUploadSignaturePost();
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


## apiV1RestaurantsMeDeliveryAddressesGet

> apiV1RestaurantsMeDeliveryAddressesGet()



### Example

```ts
import {
  Configuration,
  RestaurantProfileApi,
} from '';
import type { ApiV1RestaurantsMeDeliveryAddressesGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new RestaurantProfileApi(config);

  try {
    const data = await api.apiV1RestaurantsMeDeliveryAddressesGet();
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


## apiV1RestaurantsMeDeliveryAddressesIdDelete

> apiV1RestaurantsMeDeliveryAddressesIdDelete(id)



### Example

```ts
import {
  Configuration,
  RestaurantProfileApi,
} from '';
import type { ApiV1RestaurantsMeDeliveryAddressesIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new RestaurantProfileApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1RestaurantsMeDeliveryAddressesIdDeleteRequest;

  try {
    const data = await api.apiV1RestaurantsMeDeliveryAddressesIdDelete(body);
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


## apiV1RestaurantsMeDeliveryAddressesIdPut

> apiV1RestaurantsMeDeliveryAddressesIdPut(id, deliveryAddressRequest)



### Example

```ts
import {
  Configuration,
  RestaurantProfileApi,
} from '';
import type { ApiV1RestaurantsMeDeliveryAddressesIdPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new RestaurantProfileApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // DeliveryAddressRequest (optional)
    deliveryAddressRequest: ...,
  } satisfies ApiV1RestaurantsMeDeliveryAddressesIdPutRequest;

  try {
    const data = await api.apiV1RestaurantsMeDeliveryAddressesIdPut(body);
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
| **deliveryAddressRequest** | [DeliveryAddressRequest](DeliveryAddressRequest.md) |  | [Optional] |

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


## apiV1RestaurantsMeDeliveryAddressesPost

> apiV1RestaurantsMeDeliveryAddressesPost(deliveryAddressRequest)



### Example

```ts
import {
  Configuration,
  RestaurantProfileApi,
} from '';
import type { ApiV1RestaurantsMeDeliveryAddressesPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new RestaurantProfileApi(config);

  const body = {
    // DeliveryAddressRequest (optional)
    deliveryAddressRequest: ...,
  } satisfies ApiV1RestaurantsMeDeliveryAddressesPostRequest;

  try {
    const data = await api.apiV1RestaurantsMeDeliveryAddressesPost(body);
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
| **deliveryAddressRequest** | [DeliveryAddressRequest](DeliveryAddressRequest.md) |  | [Optional] |

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


## apiV1RestaurantsMeProfileGet

> apiV1RestaurantsMeProfileGet()



### Example

```ts
import {
  Configuration,
  RestaurantProfileApi,
} from '';
import type { ApiV1RestaurantsMeProfileGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new RestaurantProfileApi(config);

  try {
    const data = await api.apiV1RestaurantsMeProfileGet();
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


## apiV1RestaurantsMeProfilePut

> apiV1RestaurantsMeProfilePut(updateRestaurantProfileRequest)



### Example

```ts
import {
  Configuration,
  RestaurantProfileApi,
} from '';
import type { ApiV1RestaurantsMeProfilePutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new RestaurantProfileApi(config);

  const body = {
    // UpdateRestaurantProfileRequest (optional)
    updateRestaurantProfileRequest: ...,
  } satisfies ApiV1RestaurantsMeProfilePutRequest;

  try {
    const data = await api.apiV1RestaurantsMeProfilePut(body);
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
| **updateRestaurantProfileRequest** | [UpdateRestaurantProfileRequest](UpdateRestaurantProfileRequest.md) |  | [Optional] |

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

