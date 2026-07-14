# HubHandoverApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiV1HubsHubIdHandoverIdCheckoutPost**](HubHandoverApi.md#apiv1hubshubidhandoveridcheckoutpost) | **POST** /api/v1/hubs/{hubId}/handover/{id}/checkout |  |
| [**apiV1HubsHubIdHandoverPost**](HubHandoverApi.md#apiv1hubshubidhandoverpost) | **POST** /api/v1/hubs/{hubId}/handover |  |
| [**apiV1HubsHubIdHandoversGet**](HubHandoverApi.md#apiv1hubshubidhandoversget) | **GET** /api/v1/hubs/{hubId}/handovers |  |



## apiV1HubsHubIdHandoverIdCheckoutPost

> apiV1HubsHubIdHandoverIdCheckoutPost(hubId, id)



### Example

```ts
import {
  Configuration,
  HubHandoverApi,
} from '';
import type { ApiV1HubsHubIdHandoverIdCheckoutPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new HubHandoverApi(config);

  const body = {
    // string
    hubId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1HubsHubIdHandoverIdCheckoutPostRequest;

  try {
    const data = await api.apiV1HubsHubIdHandoverIdCheckoutPost(body);
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
| **hubId** | `string` |  | [Defaults to `undefined`] |
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


## apiV1HubsHubIdHandoverPost

> apiV1HubsHubIdHandoverPost(hubId, createHandoverRequest)



### Example

```ts
import {
  Configuration,
  HubHandoverApi,
} from '';
import type { ApiV1HubsHubIdHandoverPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new HubHandoverApi(config);

  const body = {
    // string
    hubId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // CreateHandoverRequest (optional)
    createHandoverRequest: ...,
  } satisfies ApiV1HubsHubIdHandoverPostRequest;

  try {
    const data = await api.apiV1HubsHubIdHandoverPost(body);
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
| **hubId** | `string` |  | [Defaults to `undefined`] |
| **createHandoverRequest** | [CreateHandoverRequest](CreateHandoverRequest.md) |  | [Optional] |

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


## apiV1HubsHubIdHandoversGet

> apiV1HubsHubIdHandoversGet(hubId, cursor, pageSize)



### Example

```ts
import {
  Configuration,
  HubHandoverApi,
} from '';
import type { ApiV1HubsHubIdHandoversGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new HubHandoverApi(config);

  const body = {
    // string
    hubId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string (optional)
    cursor: cursor_example,
    // number (optional)
    pageSize: 56,
  } satisfies ApiV1HubsHubIdHandoversGetRequest;

  try {
    const data = await api.apiV1HubsHubIdHandoversGet(body);
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
| **hubId** | `string` |  | [Defaults to `undefined`] |
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

