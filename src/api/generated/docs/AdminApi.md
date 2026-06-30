# AdminApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiV1AdminRestaurantsRestaurantIdApprovePatch**](AdminApi.md#apiv1adminrestaurantsrestaurantidapprovepatch) | **PATCH** /api/v1/admin/restaurants/{restaurantId}/approve |  |
| [**apiV1AdminRestaurantsRestaurantIdCreditLimitPut**](AdminApi.md#apiv1adminrestaurantsrestaurantidcreditlimitput) | **PUT** /api/v1/admin/restaurants/{restaurantId}/credit/limit |  |
| [**apiV1AdminRestaurantsRestaurantIdCreditSettlePost**](AdminApi.md#apiv1adminrestaurantsrestaurantidcreditsettlepost) | **POST** /api/v1/admin/restaurants/{restaurantId}/credit/settle |  |
| [**apiV1AdminRolesGet**](AdminApi.md#apiv1adminrolesget) | **GET** /api/v1/admin/roles |  |
| [**apiV1AdminUsersGet**](AdminApi.md#apiv1adminusersget) | **GET** /api/v1/admin/users |  |
| [**apiV1AdminUsersPost**](AdminApi.md#apiv1adminuserspost) | **POST** /api/v1/admin/users |  |
| [**apiV1AdminUsersUserIdActivatePatch**](AdminApi.md#apiv1adminusersuseridactivatepatch) | **PATCH** /api/v1/admin/users/{userId}/activate |  |
| [**apiV1AdminUsersUserIdMarketAssignmentsGet**](AdminApi.md#apiv1adminusersuseridmarketassignmentsget) | **GET** /api/v1/admin/users/{userId}/market-assignments |  |
| [**apiV1AdminUsersUserIdMarketAssignmentsPut**](AdminApi.md#apiv1adminusersuseridmarketassignmentsput) | **PUT** /api/v1/admin/users/{userId}/market-assignments |  |
| [**apiV1AdminUsersUserIdRolePatch**](AdminApi.md#apiv1adminusersuseridrolepatch) | **PATCH** /api/v1/admin/users/{userId}/role |  |
| [**apiV1AdminUsersUserIdUnlockPost**](AdminApi.md#apiv1adminusersuseridunlockpost) | **POST** /api/v1/admin/users/{userId}/unlock |  |



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

> apiV1AdminUsersGet(role, isActive, search, page, pageSize)



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

