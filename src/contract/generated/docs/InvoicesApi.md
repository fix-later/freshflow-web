# InvoicesApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiV1InvoicesGet**](InvoicesApi.md#apiv1invoicesget) | **GET** /api/v1/invoices |  |
| [**apiV1InvoicesInvoiceIdExportGet**](InvoicesApi.md#apiv1invoicesinvoiceidexportget) | **GET** /api/v1/invoices/{invoiceId}/export |  |
| [**apiV1InvoicesInvoiceIdGet**](InvoicesApi.md#apiv1invoicesinvoiceidget) | **GET** /api/v1/invoices/{invoiceId} |  |
| [**apiV1InvoicesInvoiceIdPdfGet**](InvoicesApi.md#apiv1invoicesinvoiceidpdfget) | **GET** /api/v1/invoices/{invoiceId}/pdf |  |



## apiV1InvoicesGet

> apiV1InvoicesGet(restaurantId, status, page, pageSize)



### Example

```ts
import {
  Configuration,
  InvoicesApi,
} from '';
import type { ApiV1InvoicesGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new InvoicesApi(config);

  const body = {
    // string (optional)
    restaurantId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string (optional)
    status: status_example,
    // number (optional)
    page: 56,
    // number (optional)
    pageSize: 56,
  } satisfies ApiV1InvoicesGetRequest;

  try {
    const data = await api.apiV1InvoicesGet(body);
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
| **restaurantId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `string` |  | [Optional] [Defaults to `undefined`] |
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


## apiV1InvoicesInvoiceIdExportGet

> apiV1InvoicesInvoiceIdExportGet(invoiceId)



### Example

```ts
import {
  Configuration,
  InvoicesApi,
} from '';
import type { ApiV1InvoicesInvoiceIdExportGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new InvoicesApi(config);

  const body = {
    // string
    invoiceId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1InvoicesInvoiceIdExportGetRequest;

  try {
    const data = await api.apiV1InvoicesInvoiceIdExportGet(body);
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
| **invoiceId** | `string` |  | [Defaults to `undefined`] |

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


## apiV1InvoicesInvoiceIdGet

> apiV1InvoicesInvoiceIdGet(invoiceId)



### Example

```ts
import {
  Configuration,
  InvoicesApi,
} from '';
import type { ApiV1InvoicesInvoiceIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new InvoicesApi(config);

  const body = {
    // string
    invoiceId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1InvoicesInvoiceIdGetRequest;

  try {
    const data = await api.apiV1InvoicesInvoiceIdGet(body);
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
| **invoiceId** | `string` |  | [Defaults to `undefined`] |

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


## apiV1InvoicesInvoiceIdPdfGet

> apiV1InvoicesInvoiceIdPdfGet(invoiceId)



### Example

```ts
import {
  Configuration,
  InvoicesApi,
} from '';
import type { ApiV1InvoicesInvoiceIdPdfGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new InvoicesApi(config);

  const body = {
    // string
    invoiceId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1InvoicesInvoiceIdPdfGetRequest;

  try {
    const data = await api.apiV1InvoicesInvoiceIdPdfGet(body);
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
| **invoiceId** | `string` |  | [Defaults to `undefined`] |

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

