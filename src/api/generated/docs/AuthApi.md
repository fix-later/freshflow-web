# AuthApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiV1AuthChangePasswordPost**](AuthApi.md#apiv1authchangepasswordpost) | **POST** /api/v1/auth/change-password |  |
| [**apiV1AuthForgotPasswordPost**](AuthApi.md#apiv1authforgotpasswordpost) | **POST** /api/v1/auth/forgot-password |  |
| [**apiV1AuthLoginPost**](AuthApi.md#apiv1authloginpost) | **POST** /api/v1/auth/login |  |
| [**apiV1AuthLogoutPost**](AuthApi.md#apiv1authlogoutpost) | **POST** /api/v1/auth/logout |  |
| [**apiV1AuthRefreshPost**](AuthApi.md#apiv1authrefreshpost) | **POST** /api/v1/auth/refresh |  |
| [**apiV1AuthRegisterPost**](AuthApi.md#apiv1authregisterpost) | **POST** /api/v1/auth/register |  |
| [**apiV1AuthResetPasswordPost**](AuthApi.md#apiv1authresetpasswordpost) | **POST** /api/v1/auth/reset-password |  |
| [**apiV1AuthVerifyPost**](AuthApi.md#apiv1authverifypost) | **POST** /api/v1/auth/verify |  |
| [**apiV1AuthVerifyRequestPost**](AuthApi.md#apiv1authverifyrequestpost) | **POST** /api/v1/auth/verify/request |  |



## apiV1AuthChangePasswordPost

> apiV1AuthChangePasswordPost(changePasswordRequest)



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { ApiV1AuthChangePasswordPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthApi(config);

  const body = {
    // ChangePasswordRequest (optional)
    changePasswordRequest: ...,
  } satisfies ApiV1AuthChangePasswordPostRequest;

  try {
    const data = await api.apiV1AuthChangePasswordPost(body);
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
| **changePasswordRequest** | [ChangePasswordRequest](ChangePasswordRequest.md) |  | [Optional] |

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


## apiV1AuthForgotPasswordPost

> apiV1AuthForgotPasswordPost(forgotPasswordRequest)



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { ApiV1AuthForgotPasswordPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthApi(config);

  const body = {
    // ForgotPasswordRequest (optional)
    forgotPasswordRequest: ...,
  } satisfies ApiV1AuthForgotPasswordPostRequest;

  try {
    const data = await api.apiV1AuthForgotPasswordPost(body);
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
| **forgotPasswordRequest** | [ForgotPasswordRequest](ForgotPasswordRequest.md) |  | [Optional] |

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


## apiV1AuthLoginPost

> apiV1AuthLoginPost(loginRequest)



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { ApiV1AuthLoginPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthApi(config);

  const body = {
    // LoginRequest (optional)
    loginRequest: ...,
  } satisfies ApiV1AuthLoginPostRequest;

  try {
    const data = await api.apiV1AuthLoginPost(body);
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
| **loginRequest** | [LoginRequest](LoginRequest.md) |  | [Optional] |

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


## apiV1AuthLogoutPost

> apiV1AuthLogoutPost(logoutRequest)



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { ApiV1AuthLogoutPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthApi(config);

  const body = {
    // LogoutRequest (optional)
    logoutRequest: ...,
  } satisfies ApiV1AuthLogoutPostRequest;

  try {
    const data = await api.apiV1AuthLogoutPost(body);
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
| **logoutRequest** | [LogoutRequest](LogoutRequest.md) |  | [Optional] |

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


## apiV1AuthRefreshPost

> apiV1AuthRefreshPost(refreshRequest)



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { ApiV1AuthRefreshPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthApi(config);

  const body = {
    // RefreshRequest (optional)
    refreshRequest: ...,
  } satisfies ApiV1AuthRefreshPostRequest;

  try {
    const data = await api.apiV1AuthRefreshPost(body);
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
| **refreshRequest** | [RefreshRequest](RefreshRequest.md) |  | [Optional] |

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


## apiV1AuthRegisterPost

> apiV1AuthRegisterPost(registerRestaurantRequest)



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { ApiV1AuthRegisterPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthApi(config);

  const body = {
    // RegisterRestaurantRequest (optional)
    registerRestaurantRequest: ...,
  } satisfies ApiV1AuthRegisterPostRequest;

  try {
    const data = await api.apiV1AuthRegisterPost(body);
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
| **registerRestaurantRequest** | [RegisterRestaurantRequest](RegisterRestaurantRequest.md) |  | [Optional] |

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


## apiV1AuthResetPasswordPost

> apiV1AuthResetPasswordPost(resetPasswordRequest)



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { ApiV1AuthResetPasswordPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthApi(config);

  const body = {
    // ResetPasswordRequest (optional)
    resetPasswordRequest: ...,
  } satisfies ApiV1AuthResetPasswordPostRequest;

  try {
    const data = await api.apiV1AuthResetPasswordPost(body);
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
| **resetPasswordRequest** | [ResetPasswordRequest](ResetPasswordRequest.md) |  | [Optional] |

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


## apiV1AuthVerifyPost

> apiV1AuthVerifyPost(verifyRequest)



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { ApiV1AuthVerifyPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthApi(config);

  const body = {
    // VerifyRequest (optional)
    verifyRequest: ...,
  } satisfies ApiV1AuthVerifyPostRequest;

  try {
    const data = await api.apiV1AuthVerifyPost(body);
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
| **verifyRequest** | [VerifyRequest](VerifyRequest.md) |  | [Optional] |

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


## apiV1AuthVerifyRequestPost

> apiV1AuthVerifyRequestPost(requestVerificationRequest)



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { ApiV1AuthVerifyRequestPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthApi(config);

  const body = {
    // RequestVerificationRequest (optional)
    requestVerificationRequest: ...,
  } satisfies ApiV1AuthVerifyRequestPostRequest;

  try {
    const data = await api.apiV1AuthVerifyRequestPost(body);
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
| **requestVerificationRequest** | [RequestVerificationRequest](RequestVerificationRequest.md) |  | [Optional] |

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

