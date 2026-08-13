# ClaimsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiV1ClaimsClaimIdApprovePatch**](ClaimsApi.md#apiv1claimsclaimidapprovepatch) | **PATCH** /api/v1/claims/{claimId}/approve |  |
| [**apiV1ClaimsClaimIdGet**](ClaimsApi.md#apiv1claimsclaimidget) | **GET** /api/v1/claims/{claimId} |  |
| [**apiV1ClaimsClaimIdRejectPatch**](ClaimsApi.md#apiv1claimsclaimidrejectpatch) | **PATCH** /api/v1/claims/{claimId}/reject |  |
| [**apiV1ClaimsGet**](ClaimsApi.md#apiv1claimsget) | **GET** /api/v1/claims |  |
| [**apiV1OrdersOrderIdClaimsPost**](ClaimsApi.md#apiv1ordersorderidclaimspost) | **POST** /api/v1/orders/{orderId}/claims |  |



## apiV1ClaimsClaimIdApprovePatch

> apiV1ClaimsClaimIdApprovePatch(claimId, approveClaimRequest)



### Example

```ts
import {
  Configuration,
  ClaimsApi,
} from '';
import type { ApiV1ClaimsClaimIdApprovePatchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ClaimsApi(config);

  const body = {
    // string
    claimId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // ApproveClaimRequest (optional)
    approveClaimRequest: ...,
  } satisfies ApiV1ClaimsClaimIdApprovePatchRequest;

  try {
    const data = await api.apiV1ClaimsClaimIdApprovePatch(body);
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
| **claimId** | `string` |  | [Defaults to `undefined`] |
| **approveClaimRequest** | [ApproveClaimRequest](ApproveClaimRequest.md) |  | [Optional] |

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


## apiV1ClaimsClaimIdGet

> apiV1ClaimsClaimIdGet(claimId)



### Example

```ts
import {
  Configuration,
  ClaimsApi,
} from '';
import type { ApiV1ClaimsClaimIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ClaimsApi(config);

  const body = {
    // string
    claimId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1ClaimsClaimIdGetRequest;

  try {
    const data = await api.apiV1ClaimsClaimIdGet(body);
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
| **claimId** | `string` |  | [Defaults to `undefined`] |

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


## apiV1ClaimsClaimIdRejectPatch

> apiV1ClaimsClaimIdRejectPatch(claimId, rejectClaimRequest)



### Example

```ts
import {
  Configuration,
  ClaimsApi,
} from '';
import type { ApiV1ClaimsClaimIdRejectPatchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ClaimsApi(config);

  const body = {
    // string
    claimId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // RejectClaimRequest (optional)
    rejectClaimRequest: ...,
  } satisfies ApiV1ClaimsClaimIdRejectPatchRequest;

  try {
    const data = await api.apiV1ClaimsClaimIdRejectPatch(body);
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
| **claimId** | `string` |  | [Defaults to `undefined`] |
| **rejectClaimRequest** | [RejectClaimRequest](RejectClaimRequest.md) |  | [Optional] |

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


## apiV1ClaimsGet

> apiV1ClaimsGet(restaurantId, status, cursor, pageSize)



### Example

```ts
import {
  Configuration,
  ClaimsApi,
} from '';
import type { ApiV1ClaimsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ClaimsApi(config);

  const body = {
    // string (optional)
    restaurantId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string (optional)
    status: status_example,
    // string (optional)
    cursor: cursor_example,
    // number (optional)
    pageSize: 56,
  } satisfies ApiV1ClaimsGetRequest;

  try {
    const data = await api.apiV1ClaimsGet(body);
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
| **restaurantId** | `string` |  | [Optional] [Defaults to `undefined`] |
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


## apiV1OrdersOrderIdClaimsPost

> apiV1OrdersOrderIdClaimsPost(orderId, fileClaimRequest)



### Example

```ts
import {
  Configuration,
  ClaimsApi,
} from '';
import type { ApiV1OrdersOrderIdClaimsPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ClaimsApi(config);

  const body = {
    // string
    orderId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // FileClaimRequest (optional)
    fileClaimRequest: ...,
  } satisfies ApiV1OrdersOrderIdClaimsPostRequest;

  try {
    const data = await api.apiV1OrdersOrderIdClaimsPost(body);
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
| **orderId** | `string` |  | [Defaults to `undefined`] |
| **fileClaimRequest** | [FileClaimRequest](FileClaimRequest.md) |  | [Optional] |

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

