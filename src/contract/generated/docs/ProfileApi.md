# ProfileApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiV1ProfileMeAvatarUploadSignaturePost**](ProfileApi.md#apiv1profilemeavataruploadsignaturepost) | **POST** /api/v1/profile/me/avatar/upload-signature |  |
| [**apiV1ProfileMeGet**](ProfileApi.md#apiv1profilemeget) | **GET** /api/v1/profile/me |  |
| [**apiV1ProfileMePut**](ProfileApi.md#apiv1profilemeput) | **PUT** /api/v1/profile/me |  |



## apiV1ProfileMeAvatarUploadSignaturePost

> apiV1ProfileMeAvatarUploadSignaturePost()



### Example

```ts
import {
  Configuration,
  ProfileApi,
} from '';
import type { ApiV1ProfileMeAvatarUploadSignaturePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ProfileApi(config);

  try {
    const data = await api.apiV1ProfileMeAvatarUploadSignaturePost();
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


## apiV1ProfileMeGet

> apiV1ProfileMeGet()



### Example

```ts
import {
  Configuration,
  ProfileApi,
} from '';
import type { ApiV1ProfileMeGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ProfileApi(config);

  try {
    const data = await api.apiV1ProfileMeGet();
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


## apiV1ProfileMePut

> apiV1ProfileMePut(updateMyProfileRequest)



### Example

```ts
import {
  Configuration,
  ProfileApi,
} from '';
import type { ApiV1ProfileMePutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ProfileApi(config);

  const body = {
    // UpdateMyProfileRequest (optional)
    updateMyProfileRequest: ...,
  } satisfies ApiV1ProfileMePutRequest;

  try {
    const data = await api.apiV1ProfileMePut(body);
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
| **updateMyProfileRequest** | [UpdateMyProfileRequest](UpdateMyProfileRequest.md) |  | [Optional] |

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

