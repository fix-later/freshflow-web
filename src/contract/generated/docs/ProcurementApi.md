# ProcurementApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiV1ProcurementTasksBatchIdExceptionsPost**](ProcurementApi.md#apiv1procurementtasksbatchidexceptionspost) | **POST** /api/v1/procurement/tasks/{batchId}/exceptions |  |
| [**apiV1ProcurementTasksBatchIdExceptionsUploadSignaturePost**](ProcurementApi.md#apiv1procurementtasksbatchidexceptionsuploadsignaturepost) | **POST** /api/v1/procurement/tasks/{batchId}/exceptions/upload-signature |  |
| [**apiV1ProcurementTasksBatchIdGet**](ProcurementApi.md#apiv1procurementtasksbatchidget) | **GET** /api/v1/procurement/tasks/{batchId} |  |
| [**apiV1ProcurementTasksBatchIdHandoverPatch**](ProcurementApi.md#apiv1procurementtasksbatchidhandoverpatch) | **PATCH** /api/v1/procurement/tasks/{batchId}/handover |  |
| [**apiV1ProcurementTasksBatchIdPurchasePatch**](ProcurementApi.md#apiv1procurementtasksbatchidpurchasepatch) | **PATCH** /api/v1/procurement/tasks/{batchId}/purchase |  |
| [**apiV1ProcurementTasksGet**](ProcurementApi.md#apiv1procurementtasksget) | **GET** /api/v1/procurement/tasks |  |



## apiV1ProcurementTasksBatchIdExceptionsPost

> apiV1ProcurementTasksBatchIdExceptionsPost(batchId, reportProcurementExceptionRequest)



### Example

```ts
import {
  Configuration,
  ProcurementApi,
} from '';
import type { ApiV1ProcurementTasksBatchIdExceptionsPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ProcurementApi(config);

  const body = {
    // string
    batchId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // ReportProcurementExceptionRequest (optional)
    reportProcurementExceptionRequest: ...,
  } satisfies ApiV1ProcurementTasksBatchIdExceptionsPostRequest;

  try {
    const data = await api.apiV1ProcurementTasksBatchIdExceptionsPost(body);
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
| **reportProcurementExceptionRequest** | [ReportProcurementExceptionRequest](ReportProcurementExceptionRequest.md) |  | [Optional] |

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


## apiV1ProcurementTasksBatchIdExceptionsUploadSignaturePost

> apiV1ProcurementTasksBatchIdExceptionsUploadSignaturePost(batchId)



### Example

```ts
import {
  Configuration,
  ProcurementApi,
} from '';
import type { ApiV1ProcurementTasksBatchIdExceptionsUploadSignaturePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ProcurementApi(config);

  const body = {
    // string
    batchId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1ProcurementTasksBatchIdExceptionsUploadSignaturePostRequest;

  try {
    const data = await api.apiV1ProcurementTasksBatchIdExceptionsUploadSignaturePost(body);
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


## apiV1ProcurementTasksBatchIdGet

> apiV1ProcurementTasksBatchIdGet(batchId)



### Example

```ts
import {
  Configuration,
  ProcurementApi,
} from '';
import type { ApiV1ProcurementTasksBatchIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ProcurementApi(config);

  const body = {
    // string
    batchId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1ProcurementTasksBatchIdGetRequest;

  try {
    const data = await api.apiV1ProcurementTasksBatchIdGet(body);
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


## apiV1ProcurementTasksBatchIdHandoverPatch

> apiV1ProcurementTasksBatchIdHandoverPatch(batchId)



### Example

```ts
import {
  Configuration,
  ProcurementApi,
} from '';
import type { ApiV1ProcurementTasksBatchIdHandoverPatchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ProcurementApi(config);

  const body = {
    // string
    batchId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1ProcurementTasksBatchIdHandoverPatchRequest;

  try {
    const data = await api.apiV1ProcurementTasksBatchIdHandoverPatch(body);
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


## apiV1ProcurementTasksBatchIdPurchasePatch

> apiV1ProcurementTasksBatchIdPurchasePatch(batchId, confirmPurchaseRequest)



### Example

```ts
import {
  Configuration,
  ProcurementApi,
} from '';
import type { ApiV1ProcurementTasksBatchIdPurchasePatchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ProcurementApi(config);

  const body = {
    // string
    batchId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // ConfirmPurchaseRequest (optional)
    confirmPurchaseRequest: ...,
  } satisfies ApiV1ProcurementTasksBatchIdPurchasePatchRequest;

  try {
    const data = await api.apiV1ProcurementTasksBatchIdPurchasePatch(body);
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
| **confirmPurchaseRequest** | [ConfirmPurchaseRequest](ConfirmPurchaseRequest.md) |  | [Optional] |

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


## apiV1ProcurementTasksGet

> apiV1ProcurementTasksGet(page, pageSize)



### Example

```ts
import {
  Configuration,
  ProcurementApi,
} from '';
import type { ApiV1ProcurementTasksGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ProcurementApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    pageSize: 56,
  } satisfies ApiV1ProcurementTasksGetRequest;

  try {
    const data = await api.apiV1ProcurementTasksGet(body);
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

