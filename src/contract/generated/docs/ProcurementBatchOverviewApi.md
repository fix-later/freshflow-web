# ProcurementBatchOverviewApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiV1ProcurementBatchesBatchIdOverviewGet**](ProcurementBatchOverviewApi.md#apiv1procurementbatchesbatchidoverviewget) | **GET** /api/v1/procurement/batches/{batchId}/overview |  |



## apiV1ProcurementBatchesBatchIdOverviewGet

> apiV1ProcurementBatchesBatchIdOverviewGet(batchId)



### Example

```ts
import {
  Configuration,
  ProcurementBatchOverviewApi,
} from '';
import type { ApiV1ProcurementBatchesBatchIdOverviewGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ProcurementBatchOverviewApi(config);

  const body = {
    // string
    batchId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1ProcurementBatchesBatchIdOverviewGetRequest;

  try {
    const data = await api.apiV1ProcurementBatchesBatchIdOverviewGet(body);
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

