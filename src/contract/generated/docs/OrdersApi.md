# OrdersApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiV1OrdersGet**](OrdersApi.md#apiv1ordersget) | **GET** /api/v1/orders |  |
| [**apiV1OrdersHistoryGet**](OrdersApi.md#apiv1ordershistoryget) | **GET** /api/v1/orders/history |  |
| [**apiV1OrdersOrderIdAdvanceStatusPost**](OrdersApi.md#apiv1ordersorderidadvancestatuspost) | **POST** /api/v1/orders/{orderId}/advance-status |  |
| [**apiV1OrdersOrderIdCancelPatch**](OrdersApi.md#apiv1ordersorderidcancelpatch) | **PATCH** /api/v1/orders/{orderId}/cancel |  |
| [**apiV1OrdersOrderIdConfirmPost**](OrdersApi.md#apiv1ordersorderidconfirmpost) | **POST** /api/v1/orders/{orderId}/confirm |  |
| [**apiV1OrdersOrderIdConfirmPreviewGet**](OrdersApi.md#apiv1ordersorderidconfirmpreviewget) | **GET** /api/v1/orders/{orderId}/confirm-preview |  |
| [**apiV1OrdersOrderIdGet**](OrdersApi.md#apiv1ordersorderidget) | **GET** /api/v1/orders/{orderId} |  |
| [**apiV1OrdersOrderIdIssuesPost**](OrdersApi.md#apiv1ordersorderidissuespost) | **POST** /api/v1/orders/{orderId}/issues |  |
| [**apiV1OrdersOrderIdItemsItemIdActualQuantityPatch**](OrdersApi.md#apiv1ordersorderiditemsitemidactualquantitypatch) | **PATCH** /api/v1/orders/{orderId}/items/{itemId}/actual-quantity |  |
| [**apiV1OrdersOrderIdItemsItemIdDelete**](OrdersApi.md#apiv1ordersorderiditemsitemiddelete) | **DELETE** /api/v1/orders/{orderId}/items/{itemId} |  |
| [**apiV1OrdersOrderIdItemsItemIdPut**](OrdersApi.md#apiv1ordersorderiditemsitemidput) | **PUT** /api/v1/orders/{orderId}/items/{itemId} |  |
| [**apiV1OrdersOrderIdItemsPost**](OrdersApi.md#apiv1ordersorderiditemspost) | **POST** /api/v1/orders/{orderId}/items |  |
| [**apiV1OrdersOrderIdReceiptPatch**](OrdersApi.md#apiv1ordersorderidreceiptpatch) | **PATCH** /api/v1/orders/{orderId}/receipt |  |
| [**apiV1OrdersOrderIdReorderPost**](OrdersApi.md#apiv1ordersorderidreorderpost) | **POST** /api/v1/orders/{orderId}/reorder |  |
| [**apiV1OrdersOrderingWindowGet**](OrdersApi.md#apiv1ordersorderingwindowget) | **GET** /api/v1/orders/ordering-window |  |
| [**apiV1OrdersPost**](OrdersApi.md#apiv1orderspost) | **POST** /api/v1/orders |  |
| [**apiV1OrdersScheduledGet**](OrdersApi.md#apiv1ordersscheduledget) | **GET** /api/v1/orders/scheduled |  |
| [**apiV1OrdersScheduledPost**](OrdersApi.md#apiv1ordersscheduledpost) | **POST** /api/v1/orders/scheduled |  |
| [**apiV1OrdersScheduledScheduledOrderIdCancelPatch**](OrdersApi.md#apiv1ordersscheduledscheduledorderidcancelpatch) | **PATCH** /api/v1/orders/scheduled/{scheduledOrderId}/cancel |  |
| [**apiV1OrdersScheduledScheduledOrderIdGet**](OrdersApi.md#apiv1ordersscheduledscheduledorderidget) | **GET** /api/v1/orders/scheduled/{scheduledOrderId} |  |
| [**apiV1OrdersScheduledScheduledOrderIdInstancesGet**](OrdersApi.md#apiv1ordersscheduledscheduledorderidinstancesget) | **GET** /api/v1/orders/scheduled/{scheduledOrderId}/instances |  |
| [**apiV1OrdersScheduledScheduledOrderIdPatch**](OrdersApi.md#apiv1ordersscheduledscheduledorderidpatch) | **PATCH** /api/v1/orders/scheduled/{scheduledOrderId} |  |



## apiV1OrdersGet

> apiV1OrdersGet(restaurantId, status, from, to, sort, page, pageSize)



### Example

```ts
import {
  Configuration,
  OrdersApi,
} from '';
import type { ApiV1OrdersGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OrdersApi(config);

  const body = {
    // string (optional)
    restaurantId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string (optional)
    status: status_example,
    // Date (optional)
    from: 2013-10-20T19:20:30+01:00,
    // Date (optional)
    to: 2013-10-20T19:20:30+01:00,
    // string (optional)
    sort: sort_example,
    // number (optional)
    page: 56,
    // number (optional)
    pageSize: 56,
  } satisfies ApiV1OrdersGetRequest;

  try {
    const data = await api.apiV1OrdersGet(body);
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
| **from** | `Date` |  | [Optional] [Defaults to `undefined`] |
| **to** | `Date` |  | [Optional] [Defaults to `undefined`] |
| **sort** | `string` |  | [Optional] [Defaults to `&#39;createdAt:desc&#39;`] |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **pageSize** | `number` |  | [Optional] [Defaults to `20`] |

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

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1OrdersHistoryGet

> apiV1OrdersHistoryGet(restaurantId, status, from, to, sort, page, pageSize)



### Example

```ts
import {
  Configuration,
  OrdersApi,
} from '';
import type { ApiV1OrdersHistoryGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OrdersApi(config);

  const body = {
    // string (optional)
    restaurantId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string (optional)
    status: status_example,
    // Date (optional)
    from: 2013-10-20T19:20:30+01:00,
    // Date (optional)
    to: 2013-10-20T19:20:30+01:00,
    // string (optional)
    sort: sort_example,
    // number (optional)
    page: 56,
    // number (optional)
    pageSize: 56,
  } satisfies ApiV1OrdersHistoryGetRequest;

  try {
    const data = await api.apiV1OrdersHistoryGet(body);
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
| **from** | `Date` |  | [Optional] [Defaults to `undefined`] |
| **to** | `Date` |  | [Optional] [Defaults to `undefined`] |
| **sort** | `string` |  | [Optional] [Defaults to `&#39;createdAt:desc&#39;`] |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **pageSize** | `number` |  | [Optional] [Defaults to `20`] |

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

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1OrdersOrderIdAdvanceStatusPost

> apiV1OrdersOrderIdAdvanceStatusPost(orderId, advanceOrderStatusRequest)



### Example

```ts
import {
  Configuration,
  OrdersApi,
} from '';
import type { ApiV1OrdersOrderIdAdvanceStatusPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OrdersApi(config);

  const body = {
    // string
    orderId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // AdvanceOrderStatusRequest (optional)
    advanceOrderStatusRequest: ...,
  } satisfies ApiV1OrdersOrderIdAdvanceStatusPostRequest;

  try {
    const data = await api.apiV1OrdersOrderIdAdvanceStatusPost(body);
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
| **advanceOrderStatusRequest** | [AdvanceOrderStatusRequest](AdvanceOrderStatusRequest.md) |  | [Optional] |

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
| **404** | Not Found |  -  |
| **409** | Conflict |  -  |
| **422** | Unprocessable Content |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1OrdersOrderIdCancelPatch

> apiV1OrdersOrderIdCancelPatch(orderId, cancelOrderRequest)



### Example

```ts
import {
  Configuration,
  OrdersApi,
} from '';
import type { ApiV1OrdersOrderIdCancelPatchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OrdersApi(config);

  const body = {
    // string
    orderId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // CancelOrderRequest (optional)
    cancelOrderRequest: ...,
  } satisfies ApiV1OrdersOrderIdCancelPatchRequest;

  try {
    const data = await api.apiV1OrdersOrderIdCancelPatch(body);
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
| **cancelOrderRequest** | [CancelOrderRequest](CancelOrderRequest.md) |  | [Optional] |

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
| **403** | Forbidden |  -  |
| **404** | Not Found |  -  |
| **409** | Conflict |  -  |
| **422** | Unprocessable Content |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1OrdersOrderIdConfirmPost

> apiV1OrdersOrderIdConfirmPost(orderId, confirmOrderRequest)



### Example

```ts
import {
  Configuration,
  OrdersApi,
} from '';
import type { ApiV1OrdersOrderIdConfirmPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OrdersApi(config);

  const body = {
    // string
    orderId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // ConfirmOrderRequest (optional)
    confirmOrderRequest: ...,
  } satisfies ApiV1OrdersOrderIdConfirmPostRequest;

  try {
    const data = await api.apiV1OrdersOrderIdConfirmPost(body);
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
| **confirmOrderRequest** | [ConfirmOrderRequest](ConfirmOrderRequest.md) |  | [Optional] |

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
| **403** | Forbidden |  -  |
| **404** | Not Found |  -  |
| **409** | Conflict |  -  |
| **422** | Unprocessable Content |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1OrdersOrderIdConfirmPreviewGet

> apiV1OrdersOrderIdConfirmPreviewGet(orderId, deliveryAddressId)



### Example

```ts
import {
  Configuration,
  OrdersApi,
} from '';
import type { ApiV1OrdersOrderIdConfirmPreviewGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OrdersApi(config);

  const body = {
    // string
    orderId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string (optional)
    deliveryAddressId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1OrdersOrderIdConfirmPreviewGetRequest;

  try {
    const data = await api.apiV1OrdersOrderIdConfirmPreviewGet(body);
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
| **deliveryAddressId** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## apiV1OrdersOrderIdGet

> apiV1OrdersOrderIdGet(orderId)



### Example

```ts
import {
  Configuration,
  OrdersApi,
} from '';
import type { ApiV1OrdersOrderIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OrdersApi(config);

  const body = {
    // string
    orderId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1OrdersOrderIdGetRequest;

  try {
    const data = await api.apiV1OrdersOrderIdGet(body);
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


## apiV1OrdersOrderIdIssuesPost

> apiV1OrdersOrderIdIssuesPost(orderId, reportOrderIssueRequest)



### Example

```ts
import {
  Configuration,
  OrdersApi,
} from '';
import type { ApiV1OrdersOrderIdIssuesPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OrdersApi(config);

  const body = {
    // string
    orderId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // ReportOrderIssueRequest (optional)
    reportOrderIssueRequest: ...,
  } satisfies ApiV1OrdersOrderIdIssuesPostRequest;

  try {
    const data = await api.apiV1OrdersOrderIdIssuesPost(body);
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
| **reportOrderIssueRequest** | [ReportOrderIssueRequest](ReportOrderIssueRequest.md) |  | [Optional] |

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
| **201** | Created |  -  |
| **400** | Bad Request |  -  |
| **403** | Forbidden |  -  |
| **404** | Not Found |  -  |
| **409** | Conflict |  -  |
| **422** | Unprocessable Content |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1OrdersOrderIdItemsItemIdActualQuantityPatch

> apiV1OrdersOrderIdItemsItemIdActualQuantityPatch(orderId, itemId, recordActualQuantityRequest)



### Example

```ts
import {
  Configuration,
  OrdersApi,
} from '';
import type { ApiV1OrdersOrderIdItemsItemIdActualQuantityPatchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OrdersApi(config);

  const body = {
    // string
    orderId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    itemId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // RecordActualQuantityRequest (optional)
    recordActualQuantityRequest: ...,
  } satisfies ApiV1OrdersOrderIdItemsItemIdActualQuantityPatchRequest;

  try {
    const data = await api.apiV1OrdersOrderIdItemsItemIdActualQuantityPatch(body);
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
| **itemId** | `string` |  | [Defaults to `undefined`] |
| **recordActualQuantityRequest** | [RecordActualQuantityRequest](RecordActualQuantityRequest.md) |  | [Optional] |

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
| **404** | Not Found |  -  |
| **409** | Conflict |  -  |
| **422** | Unprocessable Content |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1OrdersOrderIdItemsItemIdDelete

> apiV1OrdersOrderIdItemsItemIdDelete(orderId, itemId)



### Example

```ts
import {
  Configuration,
  OrdersApi,
} from '';
import type { ApiV1OrdersOrderIdItemsItemIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OrdersApi(config);

  const body = {
    // string
    orderId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    itemId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1OrdersOrderIdItemsItemIdDeleteRequest;

  try {
    const data = await api.apiV1OrdersOrderIdItemsItemIdDelete(body);
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
| **itemId** | `string` |  | [Defaults to `undefined`] |

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


## apiV1OrdersOrderIdItemsItemIdPut

> apiV1OrdersOrderIdItemsItemIdPut(orderId, itemId, updateOrderItemRequest)



### Example

```ts
import {
  Configuration,
  OrdersApi,
} from '';
import type { ApiV1OrdersOrderIdItemsItemIdPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OrdersApi(config);

  const body = {
    // string
    orderId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    itemId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // UpdateOrderItemRequest (optional)
    updateOrderItemRequest: ...,
  } satisfies ApiV1OrdersOrderIdItemsItemIdPutRequest;

  try {
    const data = await api.apiV1OrdersOrderIdItemsItemIdPut(body);
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
| **itemId** | `string` |  | [Defaults to `undefined`] |
| **updateOrderItemRequest** | [UpdateOrderItemRequest](UpdateOrderItemRequest.md) |  | [Optional] |

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
| **403** | Forbidden |  -  |
| **404** | Not Found |  -  |
| **422** | Unprocessable Content |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1OrdersOrderIdItemsPost

> apiV1OrdersOrderIdItemsPost(orderId, addOrderItemRequest)



### Example

```ts
import {
  Configuration,
  OrdersApi,
} from '';
import type { ApiV1OrdersOrderIdItemsPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OrdersApi(config);

  const body = {
    // string
    orderId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // AddOrderItemRequest (optional)
    addOrderItemRequest: ...,
  } satisfies ApiV1OrdersOrderIdItemsPostRequest;

  try {
    const data = await api.apiV1OrdersOrderIdItemsPost(body);
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
| **addOrderItemRequest** | [AddOrderItemRequest](AddOrderItemRequest.md) |  | [Optional] |

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
| **403** | Forbidden |  -  |
| **404** | Not Found |  -  |
| **422** | Unprocessable Content |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1OrdersOrderIdReceiptPatch

> apiV1OrdersOrderIdReceiptPatch(orderId)



### Example

```ts
import {
  Configuration,
  OrdersApi,
} from '';
import type { ApiV1OrdersOrderIdReceiptPatchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OrdersApi(config);

  const body = {
    // string
    orderId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1OrdersOrderIdReceiptPatchRequest;

  try {
    const data = await api.apiV1OrdersOrderIdReceiptPatch(body);
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
| **409** | Conflict |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1OrdersOrderIdReorderPost

> apiV1OrdersOrderIdReorderPost(orderId, reorderFromHistoryRequest)



### Example

```ts
import {
  Configuration,
  OrdersApi,
} from '';
import type { ApiV1OrdersOrderIdReorderPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OrdersApi(config);

  const body = {
    // string
    orderId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // ReorderFromHistoryRequest (optional)
    reorderFromHistoryRequest: ...,
  } satisfies ApiV1OrdersOrderIdReorderPostRequest;

  try {
    const data = await api.apiV1OrdersOrderIdReorderPost(body);
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
| **reorderFromHistoryRequest** | [ReorderFromHistoryRequest](ReorderFromHistoryRequest.md) |  | [Optional] |

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
| **201** | Created |  -  |
| **400** | Bad Request |  -  |
| **403** | Forbidden |  -  |
| **404** | Not Found |  -  |
| **422** | Unprocessable Content |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1OrdersOrderingWindowGet

> apiV1OrdersOrderingWindowGet()



### Example

```ts
import {
  Configuration,
  OrdersApi,
} from '';
import type { ApiV1OrdersOrderingWindowGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OrdersApi(config);

  try {
    const data = await api.apiV1OrdersOrderingWindowGet();
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


## apiV1OrdersPost

> apiV1OrdersPost(createDraftOrderRequest)



### Example

```ts
import {
  Configuration,
  OrdersApi,
} from '';
import type { ApiV1OrdersPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OrdersApi(config);

  const body = {
    // CreateDraftOrderRequest (optional)
    createDraftOrderRequest: ...,
  } satisfies ApiV1OrdersPostRequest;

  try {
    const data = await api.apiV1OrdersPost(body);
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
| **createDraftOrderRequest** | [CreateDraftOrderRequest](CreateDraftOrderRequest.md) |  | [Optional] |

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
| **201** | Created |  -  |
| **400** | Bad Request |  -  |
| **403** | Forbidden |  -  |
| **422** | Unprocessable Content |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1OrdersScheduledGet

> apiV1OrdersScheduledGet(restaurantId, includeCancelled, page, pageSize)



### Example

```ts
import {
  Configuration,
  OrdersApi,
} from '';
import type { ApiV1OrdersScheduledGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OrdersApi(config);

  const body = {
    // string (optional)
    restaurantId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // boolean (optional)
    includeCancelled: true,
    // number (optional)
    page: 56,
    // number (optional)
    pageSize: 56,
  } satisfies ApiV1OrdersScheduledGetRequest;

  try {
    const data = await api.apiV1OrdersScheduledGet(body);
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
| **includeCancelled** | `boolean` |  | [Optional] [Defaults to `false`] |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **pageSize** | `number` |  | [Optional] [Defaults to `20`] |

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

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1OrdersScheduledPost

> apiV1OrdersScheduledPost(createScheduledOrderRequest)



### Example

```ts
import {
  Configuration,
  OrdersApi,
} from '';
import type { ApiV1OrdersScheduledPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OrdersApi(config);

  const body = {
    // CreateScheduledOrderRequest (optional)
    createScheduledOrderRequest: ...,
  } satisfies ApiV1OrdersScheduledPostRequest;

  try {
    const data = await api.apiV1OrdersScheduledPost(body);
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
| **createScheduledOrderRequest** | [CreateScheduledOrderRequest](CreateScheduledOrderRequest.md) |  | [Optional] |

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
| **201** | Created |  -  |
| **400** | Bad Request |  -  |
| **403** | Forbidden |  -  |
| **422** | Unprocessable Content |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1OrdersScheduledScheduledOrderIdCancelPatch

> apiV1OrdersScheduledScheduledOrderIdCancelPatch(scheduledOrderId)



### Example

```ts
import {
  Configuration,
  OrdersApi,
} from '';
import type { ApiV1OrdersScheduledScheduledOrderIdCancelPatchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OrdersApi(config);

  const body = {
    // string
    scheduledOrderId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1OrdersScheduledScheduledOrderIdCancelPatchRequest;

  try {
    const data = await api.apiV1OrdersScheduledScheduledOrderIdCancelPatch(body);
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
| **scheduledOrderId** | `string` |  | [Defaults to `undefined`] |

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
| **409** | Conflict |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1OrdersScheduledScheduledOrderIdGet

> apiV1OrdersScheduledScheduledOrderIdGet(scheduledOrderId)



### Example

```ts
import {
  Configuration,
  OrdersApi,
} from '';
import type { ApiV1OrdersScheduledScheduledOrderIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OrdersApi(config);

  const body = {
    // string
    scheduledOrderId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1OrdersScheduledScheduledOrderIdGetRequest;

  try {
    const data = await api.apiV1OrdersScheduledScheduledOrderIdGet(body);
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
| **scheduledOrderId** | `string` |  | [Defaults to `undefined`] |

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


## apiV1OrdersScheduledScheduledOrderIdInstancesGet

> apiV1OrdersScheduledScheduledOrderIdInstancesGet(scheduledOrderId, page, pageSize)



### Example

```ts
import {
  Configuration,
  OrdersApi,
} from '';
import type { ApiV1OrdersScheduledScheduledOrderIdInstancesGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OrdersApi(config);

  const body = {
    // string
    scheduledOrderId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // number (optional)
    page: 56,
    // number (optional)
    pageSize: 56,
  } satisfies ApiV1OrdersScheduledScheduledOrderIdInstancesGetRequest;

  try {
    const data = await api.apiV1OrdersScheduledScheduledOrderIdInstancesGet(body);
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
| **scheduledOrderId** | `string` |  | [Defaults to `undefined`] |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **pageSize** | `number` |  | [Optional] [Defaults to `20`] |

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


## apiV1OrdersScheduledScheduledOrderIdPatch

> apiV1OrdersScheduledScheduledOrderIdPatch(scheduledOrderId, updateScheduledOrderRequest)



### Example

```ts
import {
  Configuration,
  OrdersApi,
} from '';
import type { ApiV1OrdersScheduledScheduledOrderIdPatchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OrdersApi(config);

  const body = {
    // string
    scheduledOrderId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // UpdateScheduledOrderRequest (optional)
    updateScheduledOrderRequest: ...,
  } satisfies ApiV1OrdersScheduledScheduledOrderIdPatchRequest;

  try {
    const data = await api.apiV1OrdersScheduledScheduledOrderIdPatch(body);
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
| **scheduledOrderId** | `string` |  | [Defaults to `undefined`] |
| **updateScheduledOrderRequest** | [UpdateScheduledOrderRequest](UpdateScheduledOrderRequest.md) |  | [Optional] |

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
| **409** | Conflict |  -  |
| **422** | Unprocessable Content |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

