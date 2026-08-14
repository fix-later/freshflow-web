# MarketSessionsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiV1MarketSessionsGet**](MarketSessionsApi.md#apiv1marketsessionsget) | **GET** /api/v1/market-sessions |  |



## apiV1MarketSessionsGet

> apiV1MarketSessionsGet(from, to, marketId)



### Example

```ts
import {
  Configuration,
  MarketSessionsApi,
} from '';
import type { ApiV1MarketSessionsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MarketSessionsApi(config);

  const body = {
    // Date (optional)
    from: 2013-10-20,
    // Date (optional)
    to: 2013-10-20,
    // string (optional)
    marketId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1MarketSessionsGetRequest;

  try {
    const data = await api.apiV1MarketSessionsGet(body);
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
| **from** | `Date` |  | [Optional] [Defaults to `undefined`] |
| **to** | `Date` |  | [Optional] [Defaults to `undefined`] |
| **marketId** | `string` |  | [Optional] [Defaults to `undefined`] |

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

