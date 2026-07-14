# NotificationDeviceApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiV1NotificationsDevicesDelete**](NotificationDeviceApi.md#apiv1notificationsdevicesdelete) | **DELETE** /api/v1/notifications/devices |  |
| [**apiV1NotificationsDevicesPost**](NotificationDeviceApi.md#apiv1notificationsdevicespost) | **POST** /api/v1/notifications/devices |  |



## apiV1NotificationsDevicesDelete

> apiV1NotificationsDevicesDelete(unregisterNotificationDeviceRequest)



### Example

```ts
import {
  Configuration,
  NotificationDeviceApi,
} from '';
import type { ApiV1NotificationsDevicesDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new NotificationDeviceApi(config);

  const body = {
    // UnregisterNotificationDeviceRequest (optional)
    unregisterNotificationDeviceRequest: ...,
  } satisfies ApiV1NotificationsDevicesDeleteRequest;

  try {
    const data = await api.apiV1NotificationsDevicesDelete(body);
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
| **unregisterNotificationDeviceRequest** | [UnregisterNotificationDeviceRequest](UnregisterNotificationDeviceRequest.md) |  | [Optional] |

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
| **401** | Unauthorized |  -  |
| **404** | Not Found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1NotificationsDevicesPost

> apiV1NotificationsDevicesPost(registerNotificationDeviceRequest)



### Example

```ts
import {
  Configuration,
  NotificationDeviceApi,
} from '';
import type { ApiV1NotificationsDevicesPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new NotificationDeviceApi(config);

  const body = {
    // RegisterNotificationDeviceRequest (optional)
    registerNotificationDeviceRequest: ...,
  } satisfies ApiV1NotificationsDevicesPostRequest;

  try {
    const data = await api.apiV1NotificationsDevicesPost(body);
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
| **registerNotificationDeviceRequest** | [RegisterNotificationDeviceRequest](RegisterNotificationDeviceRequest.md) |  | [Optional] |

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
| **401** | Unauthorized |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

