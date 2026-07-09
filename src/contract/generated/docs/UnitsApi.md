# UnitsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiV1UnitsGet**](UnitsApi.md#apiv1unitsget) | **GET** /api/v1/units |  |
| [**apiV1UnitsIdDeactivatePatch**](UnitsApi.md#apiv1unitsiddeactivatepatch) | **PATCH** /api/v1/units/{id}/deactivate |  |
| [**apiV1UnitsIdGet**](UnitsApi.md#apiv1unitsidget) | **GET** /api/v1/units/{id} |  |
| [**apiV1UnitsIdPut**](UnitsApi.md#apiv1unitsidput) | **PUT** /api/v1/units/{id} |  |
| [**apiV1UnitsPost**](UnitsApi.md#apiv1unitspost) | **POST** /api/v1/units |  |



## apiV1UnitsGet

> apiV1UnitsGet(activeOnly)



### Example

```ts
import {
  Configuration,
  UnitsApi,
} from '';
import type { ApiV1UnitsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new UnitsApi(config);

  const body = {
    // boolean (optional)
    activeOnly: true,
  } satisfies ApiV1UnitsGetRequest;

  try {
    const data = await api.apiV1UnitsGet(body);
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


## apiV1UnitsIdDeactivatePatch

> apiV1UnitsIdDeactivatePatch(id)



### Example

```ts
import {
  Configuration,
  UnitsApi,
} from '';
import type { ApiV1UnitsIdDeactivatePatchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new UnitsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1UnitsIdDeactivatePatchRequest;

  try {
    const data = await api.apiV1UnitsIdDeactivatePatch(body);
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


## apiV1UnitsIdGet

> apiV1UnitsIdGet(id)



### Example

```ts
import {
  Configuration,
  UnitsApi,
} from '';
import type { ApiV1UnitsIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new UnitsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1UnitsIdGetRequest;

  try {
    const data = await api.apiV1UnitsIdGet(body);
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


## apiV1UnitsIdPut

> apiV1UnitsIdPut(id, updateUnitRequest)



### Example

```ts
import {
  Configuration,
  UnitsApi,
} from '';
import type { ApiV1UnitsIdPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new UnitsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // UpdateUnitRequest (optional)
    updateUnitRequest: ...,
  } satisfies ApiV1UnitsIdPutRequest;

  try {
    const data = await api.apiV1UnitsIdPut(body);
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
| **updateUnitRequest** | [UpdateUnitRequest](UpdateUnitRequest.md) |  | [Optional] |

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


## apiV1UnitsPost

> apiV1UnitsPost(createUnitRequest)



### Example

```ts
import {
  Configuration,
  UnitsApi,
} from '';
import type { ApiV1UnitsPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new UnitsApi(config);

  const body = {
    // CreateUnitRequest (optional)
    createUnitRequest: ...,
  } satisfies ApiV1UnitsPostRequest;

  try {
    const data = await api.apiV1UnitsPost(body);
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
| **createUnitRequest** | [CreateUnitRequest](CreateUnitRequest.md) |  | [Optional] |

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

