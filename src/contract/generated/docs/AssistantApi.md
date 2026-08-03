# AssistantApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiV1AssistantChatPost**](AssistantApi.md#apiv1assistantchatpost) | **POST** /api/v1/assistant/chat |  |



## apiV1AssistantChatPost

> apiV1AssistantChatPost(assistantChatRequest)



### Example

```ts
import {
  Configuration,
  AssistantApi,
} from '';
import type { ApiV1AssistantChatPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AssistantApi(config);

  const body = {
    // AssistantChatRequest (optional)
    assistantChatRequest: ...,
  } satisfies ApiV1AssistantChatPostRequest;

  try {
    const data = await api.apiV1AssistantChatPost(body);
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
| **assistantChatRequest** | [AssistantChatRequest](AssistantChatRequest.md) |  | [Optional] |

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
| **404** | Not Found |  -  |
| **429** | Too Many Requests |  -  |
| **502** | Bad Gateway |  -  |
| **504** | Gateway Timeout |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

