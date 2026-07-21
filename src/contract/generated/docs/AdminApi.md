# AdminApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiV1AdminAuditLogsGet**](AdminApi.md#apiv1adminauditlogsget) | **GET** /api/v1/admin/audit-logs |  |
| [**apiV1AdminOperationalSettingsGet**](AdminApi.md#apiv1adminoperationalsettingsget) | **GET** /api/v1/admin/operational-settings |  |
| [**apiV1AdminOperationalSettingsPut**](AdminApi.md#apiv1adminoperationalsettingsput) | **PUT** /api/v1/admin/operational-settings |  |
| [**apiV1AdminOrderGroupsAutoBatchPost**](AdminApi.md#apiv1adminordergroupsautobatchpost) | **POST** /api/v1/admin/order-groups/auto-batch |  |
| [**apiV1AdminOrderGroupsBatchIdAgentPost**](AdminApi.md#apiv1adminordergroupsbatchidagentpost) | **POST** /api/v1/admin/order-groups/{batchId}/agent |  |
| [**apiV1AdminOrderGroupsBatchIdCancelPost**](AdminApi.md#apiv1adminordergroupsbatchidcancelpost) | **POST** /api/v1/admin/order-groups/{batchId}/cancel |  |
| [**apiV1AdminOrderGroupsBatchIdManifestPost**](AdminApi.md#apiv1adminordergroupsbatchidmanifestpost) | **POST** /api/v1/admin/order-groups/{batchId}/manifest |  |
| [**apiV1AdminOrderGroupsGet**](AdminApi.md#apiv1adminordergroupsget) | **GET** /api/v1/admin/order-groups |  |
| [**apiV1AdminOrderGroupsProgressGet**](AdminApi.md#apiv1adminordergroupsprogressget) | **GET** /api/v1/admin/order-groups/progress |  |
| [**apiV1AdminPricingSettingsGet**](AdminApi.md#apiv1adminpricingsettingsget) | **GET** /api/v1/admin/pricing-settings |  |
| [**apiV1AdminPricingSettingsPut**](AdminApi.md#apiv1adminpricingsettingsput) | **PUT** /api/v1/admin/pricing-settings |  |
| [**apiV1AdminRestaurantsRestaurantIdApprovePatch**](AdminApi.md#apiv1adminrestaurantsrestaurantidapprovepatch) | **PATCH** /api/v1/admin/restaurants/{restaurantId}/approve |  |
| [**apiV1AdminRestaurantsRestaurantIdCreditLimitPut**](AdminApi.md#apiv1adminrestaurantsrestaurantidcreditlimitput) | **PUT** /api/v1/admin/restaurants/{restaurantId}/credit/limit |  |
| [**apiV1AdminRestaurantsRestaurantIdCreditSettlePost**](AdminApi.md#apiv1adminrestaurantsrestaurantidcreditsettlepost) | **POST** /api/v1/admin/restaurants/{restaurantId}/credit/settle |  |
| [**apiV1AdminRestaurantsRestaurantIdReactivatePatch**](AdminApi.md#apiv1adminrestaurantsrestaurantidreactivatepatch) | **PATCH** /api/v1/admin/restaurants/{restaurantId}/reactivate |  |
| [**apiV1AdminRestaurantsRestaurantIdSuspendPatch**](AdminApi.md#apiv1adminrestaurantsrestaurantidsuspendpatch) | **PATCH** /api/v1/admin/restaurants/{restaurantId}/suspend |  |
| [**apiV1AdminRolesGet**](AdminApi.md#apiv1adminrolesget) | **GET** /api/v1/admin/roles |  |
| [**apiV1AdminUsersGet**](AdminApi.md#apiv1adminusersget) | **GET** /api/v1/admin/users |  |
| [**apiV1AdminUsersPost**](AdminApi.md#apiv1adminuserspost) | **POST** /api/v1/admin/users |  |
| [**apiV1AdminUsersUserIdActivatePatch**](AdminApi.md#apiv1adminusersuseridactivatepatch) | **PATCH** /api/v1/admin/users/{userId}/activate |  |
| [**apiV1AdminUsersUserIdMarketAssignmentsGet**](AdminApi.md#apiv1adminusersuseridmarketassignmentsget) | **GET** /api/v1/admin/users/{userId}/market-assignments |  |
| [**apiV1AdminUsersUserIdMarketAssignmentsPut**](AdminApi.md#apiv1adminusersuseridmarketassignmentsput) | **PUT** /api/v1/admin/users/{userId}/market-assignments |  |
| [**apiV1AdminUsersUserIdRolePatch**](AdminApi.md#apiv1adminusersuseridrolepatch) | **PATCH** /api/v1/admin/users/{userId}/role |  |
| [**apiV1AdminUsersUserIdUnlockPost**](AdminApi.md#apiv1adminusersuseridunlockpost) | **POST** /api/v1/admin/users/{userId}/unlock |  |



## apiV1AdminAuditLogsGet

> apiV1AdminAuditLogsGet(actorId, action, entityType, from, to, page, pageSize)



### Example

```ts
import {
  Configuration,
  AdminApi,
} from '';
import type { ApiV1AdminAuditLogsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // string (optional)
    actorId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string (optional)
    action: action_example,
    // string (optional)
    entityType: entityType_example,
    // Date (optional)
    from: 2013-10-20T19:20:30+01:00,
    // Date (optional)
    to: 2013-10-20T19:20:30+01:00,
    // number (optional)
    page: 56,
    // number (optional)
    pageSize: 56,
  } satisfies ApiV1AdminAuditLogsGetRequest;

  try {
    const data = await api.apiV1AdminAuditLogsGet(body);
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
| **actorId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **action** | `string` |  | [Optional] [Defaults to `undefined`] |
| **entityType** | `string` |  | [Optional] [Defaults to `undefined`] |
| **from** | `Date` |  | [Optional] [Defaults to `undefined`] |
| **to** | `Date` |  | [Optional] [Defaults to `undefined`] |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **pageSize** | `number` |  | [Optional] [Defaults to `20`] |

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


## apiV1AdminOperationalSettingsGet

> apiV1AdminOperationalSettingsGet()



### Example

```ts
import {
  Configuration,
  AdminApi,
} from '';
import type { ApiV1AdminOperationalSettingsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  try {
    const data = await api.apiV1AdminOperationalSettingsGet();
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


## apiV1AdminOperationalSettingsPut

> apiV1AdminOperationalSettingsPut(updateOperationalSettingsRequest)



### Example

```ts
import {
  Configuration,
  AdminApi,
} from '';
import type { ApiV1AdminOperationalSettingsPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // UpdateOperationalSettingsRequest (optional)
    updateOperationalSettingsRequest: ...,
  } satisfies ApiV1AdminOperationalSettingsPutRequest;

  try {
    const data = await api.apiV1AdminOperationalSettingsPut(body);
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
| **updateOperationalSettingsRequest** | [UpdateOperationalSettingsRequest](UpdateOperationalSettingsRequest.md) |  | [Optional] |

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


## apiV1AdminOrderGroupsAutoBatchPost

> apiV1AdminOrderGroupsAutoBatchPost(runAutoBatchRequest)



### Example

```ts
import {
  Configuration,
  AdminApi,
} from '';
import type { ApiV1AdminOrderGroupsAutoBatchPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // RunAutoBatchRequest (optional)
    runAutoBatchRequest: ...,
  } satisfies ApiV1AdminOrderGroupsAutoBatchPostRequest;

  try {
    const data = await api.apiV1AdminOrderGroupsAutoBatchPost(body);
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
| **runAutoBatchRequest** | [RunAutoBatchRequest](RunAutoBatchRequest.md) |  | [Optional] |

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


## apiV1AdminOrderGroupsBatchIdAgentPost

> apiV1AdminOrderGroupsBatchIdAgentPost(batchId, assignAgentRequest)



### Example

```ts
import {
  Configuration,
  AdminApi,
} from '';
import type { ApiV1AdminOrderGroupsBatchIdAgentPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // string
    batchId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // AssignAgentRequest (optional)
    assignAgentRequest: ...,
  } satisfies ApiV1AdminOrderGroupsBatchIdAgentPostRequest;

  try {
    const data = await api.apiV1AdminOrderGroupsBatchIdAgentPost(body);
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
| **batchId** | `string` |  | [Defaults to `undefined`] |
| **assignAgentRequest** | [AssignAgentRequest](AssignAgentRequest.md) |  | [Optional] |

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


## apiV1AdminOrderGroupsBatchIdCancelPost

> apiV1AdminOrderGroupsBatchIdCancelPost(batchId, cancelOrderGroupRequest)



### Example

```ts
import {
  Configuration,
  AdminApi,
} from '';
import type { ApiV1AdminOrderGroupsBatchIdCancelPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // string
    batchId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // CancelOrderGroupRequest (optional)
    cancelOrderGroupRequest: ...,
  } satisfies ApiV1AdminOrderGroupsBatchIdCancelPostRequest;

  try {
    const data = await api.apiV1AdminOrderGroupsBatchIdCancelPost(body);
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
| **batchId** | `string` |  | [Defaults to `undefined`] |
| **cancelOrderGroupRequest** | [CancelOrderGroupRequest](CancelOrderGroupRequest.md) |  | [Optional] |

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


## apiV1AdminOrderGroupsBatchIdManifestPost

> apiV1AdminOrderGroupsBatchIdManifestPost(batchId)



### Example

```ts
import {
  Configuration,
  AdminApi,
} from '';
import type { ApiV1AdminOrderGroupsBatchIdManifestPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // string
    batchId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1AdminOrderGroupsBatchIdManifestPostRequest;

  try {
    const data = await api.apiV1AdminOrderGroupsBatchIdManifestPost(body);
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
| **batchId** | `string` |  | [Defaults to `undefined`] |

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


## apiV1AdminOrderGroupsGet

> apiV1AdminOrderGroupsGet(page, pageSize)



### Example

```ts
import {
  Configuration,
  AdminApi,
} from '';
import type { ApiV1AdminOrderGroupsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    pageSize: 56,
  } satisfies ApiV1AdminOrderGroupsGetRequest;

  try {
    const data = await api.apiV1AdminOrderGroupsGet(body);
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
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **pageSize** | `number` |  | [Optional] [Defaults to `20`] |

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


## apiV1AdminOrderGroupsProgressGet

> apiV1AdminOrderGroupsProgressGet(date, status)



### Example

```ts
import {
  Configuration,
  AdminApi,
} from '';
import type { ApiV1AdminOrderGroupsProgressGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // Date (optional)
    date: 2013-10-20,
    // string (optional)
    status: status_example,
  } satisfies ApiV1AdminOrderGroupsProgressGetRequest;

  try {
    const data = await api.apiV1AdminOrderGroupsProgressGet(body);
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
| **date** | `Date` |  | [Optional] [Defaults to `undefined`] |
| **status** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## apiV1AdminPricingSettingsGet

> apiV1AdminPricingSettingsGet()



### Example

```ts
import {
  Configuration,
  AdminApi,
} from '';
import type { ApiV1AdminPricingSettingsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  try {
    const data = await api.apiV1AdminPricingSettingsGet();
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


## apiV1AdminPricingSettingsPut

> apiV1AdminPricingSettingsPut(updatePricingSettingsRequest)



### Example

```ts
import {
  Configuration,
  AdminApi,
} from '';
import type { ApiV1AdminPricingSettingsPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // UpdatePricingSettingsRequest (optional)
    updatePricingSettingsRequest: ...,
  } satisfies ApiV1AdminPricingSettingsPutRequest;

  try {
    const data = await api.apiV1AdminPricingSettingsPut(body);
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
| **updatePricingSettingsRequest** | [UpdatePricingSettingsRequest](UpdatePricingSettingsRequest.md) |  | [Optional] |

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


## apiV1AdminRestaurantsRestaurantIdApprovePatch

> apiV1AdminRestaurantsRestaurantIdApprovePatch(restaurantId)



### Example

```ts
import {
  Configuration,
  AdminApi,
} from '';
import type { ApiV1AdminRestaurantsRestaurantIdApprovePatchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // string
    restaurantId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1AdminRestaurantsRestaurantIdApprovePatchRequest;

  try {
    const data = await api.apiV1AdminRestaurantsRestaurantIdApprovePatch(body);
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
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1AdminRestaurantsRestaurantIdCreditLimitPut

> apiV1AdminRestaurantsRestaurantIdCreditLimitPut(restaurantId, setCreditLimitRequest)



### Example

```ts
import {
  Configuration,
  AdminApi,
} from '';
import type { ApiV1AdminRestaurantsRestaurantIdCreditLimitPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // string
    restaurantId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // SetCreditLimitRequest (optional)
    setCreditLimitRequest: ...,
  } satisfies ApiV1AdminRestaurantsRestaurantIdCreditLimitPutRequest;

  try {
    const data = await api.apiV1AdminRestaurantsRestaurantIdCreditLimitPut(body);
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
| **setCreditLimitRequest** | [SetCreditLimitRequest](SetCreditLimitRequest.md) |  | [Optional] |

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


## apiV1AdminRestaurantsRestaurantIdCreditSettlePost

> apiV1AdminRestaurantsRestaurantIdCreditSettlePost(restaurantId, settleCreditRequest)



### Example

```ts
import {
  Configuration,
  AdminApi,
} from '';
import type { ApiV1AdminRestaurantsRestaurantIdCreditSettlePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // string
    restaurantId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // SettleCreditRequest (optional)
    settleCreditRequest: ...,
  } satisfies ApiV1AdminRestaurantsRestaurantIdCreditSettlePostRequest;

  try {
    const data = await api.apiV1AdminRestaurantsRestaurantIdCreditSettlePost(body);
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
| **settleCreditRequest** | [SettleCreditRequest](SettleCreditRequest.md) |  | [Optional] |

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

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1AdminRestaurantsRestaurantIdReactivatePatch

> apiV1AdminRestaurantsRestaurantIdReactivatePatch(restaurantId)



### Example

```ts
import {
  Configuration,
  AdminApi,
} from '';
import type { ApiV1AdminRestaurantsRestaurantIdReactivatePatchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // string
    restaurantId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1AdminRestaurantsRestaurantIdReactivatePatchRequest;

  try {
    const data = await api.apiV1AdminRestaurantsRestaurantIdReactivatePatch(body);
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
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1AdminRestaurantsRestaurantIdSuspendPatch

> apiV1AdminRestaurantsRestaurantIdSuspendPatch(restaurantId)



### Example

```ts
import {
  Configuration,
  AdminApi,
} from '';
import type { ApiV1AdminRestaurantsRestaurantIdSuspendPatchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // string
    restaurantId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1AdminRestaurantsRestaurantIdSuspendPatchRequest;

  try {
    const data = await api.apiV1AdminRestaurantsRestaurantIdSuspendPatch(body);
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
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1AdminRolesGet

> apiV1AdminRolesGet()



### Example

```ts
import {
  Configuration,
  AdminApi,
} from '';
import type { ApiV1AdminRolesGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  try {
    const data = await api.apiV1AdminRolesGet();
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


## apiV1AdminUsersGet

> apiV1AdminUsersGet(role, isActive, search, page, pageSize, restaurantStatus)



### Example

```ts
import {
  Configuration,
  AdminApi,
} from '';
import type { ApiV1AdminUsersGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // string (optional)
    role: role_example,
    // boolean (optional)
    isActive: true,
    // string (optional)
    search: search_example,
    // number (optional)
    page: 56,
    // number (optional)
    pageSize: 56,
    // string (optional)
    restaurantStatus: restaurantStatus_example,
  } satisfies ApiV1AdminUsersGetRequest;

  try {
    const data = await api.apiV1AdminUsersGet(body);
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
| **role** | `string` |  | [Optional] [Defaults to `undefined`] |
| **isActive** | `boolean` |  | [Optional] [Defaults to `undefined`] |
| **search** | `string` |  | [Optional] [Defaults to `undefined`] |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **pageSize** | `number` |  | [Optional] [Defaults to `20`] |
| **restaurantStatus** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## apiV1AdminUsersPost

> apiV1AdminUsersPost(createUserCommand)



### Example

```ts
import {
  Configuration,
  AdminApi,
} from '';
import type { ApiV1AdminUsersPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // CreateUserCommand (optional)
    createUserCommand: ...,
  } satisfies ApiV1AdminUsersPostRequest;

  try {
    const data = await api.apiV1AdminUsersPost(body);
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
| **createUserCommand** | [CreateUserCommand](CreateUserCommand.md) |  | [Optional] |

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


## apiV1AdminUsersUserIdActivatePatch

> apiV1AdminUsersUserIdActivatePatch(userId, activateRequest)



### Example

```ts
import {
  Configuration,
  AdminApi,
} from '';
import type { ApiV1AdminUsersUserIdActivatePatchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // string
    userId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // ActivateRequest (optional)
    activateRequest: ...,
  } satisfies ApiV1AdminUsersUserIdActivatePatchRequest;

  try {
    const data = await api.apiV1AdminUsersUserIdActivatePatch(body);
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
| **userId** | `string` |  | [Defaults to `undefined`] |
| **activateRequest** | [ActivateRequest](ActivateRequest.md) |  | [Optional] |

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


## apiV1AdminUsersUserIdMarketAssignmentsGet

> apiV1AdminUsersUserIdMarketAssignmentsGet(userId)



### Example

```ts
import {
  Configuration,
  AdminApi,
} from '';
import type { ApiV1AdminUsersUserIdMarketAssignmentsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // string
    userId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1AdminUsersUserIdMarketAssignmentsGetRequest;

  try {
    const data = await api.apiV1AdminUsersUserIdMarketAssignmentsGet(body);
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
| **userId** | `string` |  | [Defaults to `undefined`] |

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


## apiV1AdminUsersUserIdMarketAssignmentsPut

> apiV1AdminUsersUserIdMarketAssignmentsPut(userId, replaceMarketAssignmentsRequest)



### Example

```ts
import {
  Configuration,
  AdminApi,
} from '';
import type { ApiV1AdminUsersUserIdMarketAssignmentsPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // string
    userId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // ReplaceMarketAssignmentsRequest (optional)
    replaceMarketAssignmentsRequest: ...,
  } satisfies ApiV1AdminUsersUserIdMarketAssignmentsPutRequest;

  try {
    const data = await api.apiV1AdminUsersUserIdMarketAssignmentsPut(body);
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
| **userId** | `string` |  | [Defaults to `undefined`] |
| **replaceMarketAssignmentsRequest** | [ReplaceMarketAssignmentsRequest](ReplaceMarketAssignmentsRequest.md) |  | [Optional] |

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


## apiV1AdminUsersUserIdRolePatch

> apiV1AdminUsersUserIdRolePatch(userId, assignRoleRequest)



### Example

```ts
import {
  Configuration,
  AdminApi,
} from '';
import type { ApiV1AdminUsersUserIdRolePatchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // string
    userId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // AssignRoleRequest (optional)
    assignRoleRequest: ...,
  } satisfies ApiV1AdminUsersUserIdRolePatchRequest;

  try {
    const data = await api.apiV1AdminUsersUserIdRolePatch(body);
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
| **userId** | `string` |  | [Defaults to `undefined`] |
| **assignRoleRequest** | [AssignRoleRequest](AssignRoleRequest.md) |  | [Optional] |

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


## apiV1AdminUsersUserIdUnlockPost

> apiV1AdminUsersUserIdUnlockPost(userId)



### Example

```ts
import {
  Configuration,
  AdminApi,
} from '';
import type { ApiV1AdminUsersUserIdUnlockPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminApi(config);

  const body = {
    // string
    userId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1AdminUsersUserIdUnlockPostRequest;

  try {
    const data = await api.apiV1AdminUsersUserIdUnlockPost(body);
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
| **userId** | `string` |  | [Defaults to `undefined`] |

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

