# ShippingApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiV1LogisticsShippingOrdersOrderIdEstimateGet**](ShippingApi.md#apiv1logisticsshippingordersorderidestimateget) | **GET** /api/v1/logistics/shipping/orders/{orderId}/estimate |  |



## apiV1LogisticsShippingOrdersOrderIdEstimateGet

> apiV1LogisticsShippingOrdersOrderIdEstimateGet(orderId, vehicleId)



### Example

```ts
import {
  Configuration,
  ShippingApi,
} from '';
import type { ApiV1LogisticsShippingOrdersOrderIdEstimateGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ShippingApi(config);

  const body = {
    // string
    orderId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string (optional)
    vehicleId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1LogisticsShippingOrdersOrderIdEstimateGetRequest;

  try {
    const data = await api.apiV1LogisticsShippingOrdersOrderIdEstimateGet(body);
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
| **vehicleId** | `string` |  | [Optional] [Defaults to `undefined`] |

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

