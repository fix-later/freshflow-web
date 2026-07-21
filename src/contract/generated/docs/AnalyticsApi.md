# AnalyticsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiV1AnalyticsDeliveryPerformanceGet**](AnalyticsApi.md#apiv1analyticsdeliveryperformanceget) | **GET** /api/v1/analytics/delivery-performance |  |
| [**apiV1AnalyticsDemandHeatmapGet**](AnalyticsApi.md#apiv1analyticsdemandheatmapget) | **GET** /api/v1/analytics/demand-heatmap |  |
| [**apiV1AnalyticsDemandHeatmapTimeDistributionGet**](AnalyticsApi.md#apiv1analyticsdemandheatmaptimedistributionget) | **GET** /api/v1/analytics/demand-heatmap/time-distribution |  |
| [**apiV1AnalyticsExportGet**](AnalyticsApi.md#apiv1analyticsexportget) | **GET** /api/v1/analytics/export |  |
| [**apiV1AnalyticsHubThroughputGet**](AnalyticsApi.md#apiv1analyticshubthroughputget) | **GET** /api/v1/analytics/hub-throughput |  |
| [**apiV1AnalyticsOrderMetricsGet**](AnalyticsApi.md#apiv1analyticsordermetricsget) | **GET** /api/v1/analytics/order-metrics |  |
| [**apiV1AnalyticsOverviewGet**](AnalyticsApi.md#apiv1analyticsoverviewget) | **GET** /api/v1/analytics/overview |  |
| [**apiV1AnalyticsPriceTrendsGet**](AnalyticsApi.md#apiv1analyticspricetrendsget) | **GET** /api/v1/analytics/price-trends |  |
| [**apiV1AnalyticsProcurementMetricsGet**](AnalyticsApi.md#apiv1analyticsprocurementmetricsget) | **GET** /api/v1/analytics/procurement-metrics |  |
| [**apiV1AnalyticsRecentActivitiesGet**](AnalyticsApi.md#apiv1analyticsrecentactivitiesget) | **GET** /api/v1/analytics/recent-activities |  |



## apiV1AnalyticsDeliveryPerformanceGet

> apiV1AnalyticsDeliveryPerformanceGet(from, to)



### Example

```ts
import {
  Configuration,
  AnalyticsApi,
} from '';
import type { ApiV1AnalyticsDeliveryPerformanceGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AnalyticsApi(config);

  const body = {
    // Date
    from: 2013-10-20,
    // Date
    to: 2013-10-20,
  } satisfies ApiV1AnalyticsDeliveryPerformanceGetRequest;

  try {
    const data = await api.apiV1AnalyticsDeliveryPerformanceGet(body);
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
| **from** | `Date` |  | [Defaults to `undefined`] |
| **to** | `Date` |  | [Defaults to `undefined`] |

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


## apiV1AnalyticsDemandHeatmapGet

> apiV1AnalyticsDemandHeatmapGet(from, to)



### Example

```ts
import {
  Configuration,
  AnalyticsApi,
} from '';
import type { ApiV1AnalyticsDemandHeatmapGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AnalyticsApi(config);

  const body = {
    // Date
    from: 2013-10-20,
    // Date
    to: 2013-10-20,
  } satisfies ApiV1AnalyticsDemandHeatmapGetRequest;

  try {
    const data = await api.apiV1AnalyticsDemandHeatmapGet(body);
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
| **from** | `Date` |  | [Defaults to `undefined`] |
| **to** | `Date` |  | [Defaults to `undefined`] |

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


## apiV1AnalyticsDemandHeatmapTimeDistributionGet

> apiV1AnalyticsDemandHeatmapTimeDistributionGet(from, to)



### Example

```ts
import {
  Configuration,
  AnalyticsApi,
} from '';
import type { ApiV1AnalyticsDemandHeatmapTimeDistributionGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AnalyticsApi(config);

  const body = {
    // Date
    from: 2013-10-20,
    // Date
    to: 2013-10-20,
  } satisfies ApiV1AnalyticsDemandHeatmapTimeDistributionGetRequest;

  try {
    const data = await api.apiV1AnalyticsDemandHeatmapTimeDistributionGet(body);
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
| **from** | `Date` |  | [Defaults to `undefined`] |
| **to** | `Date` |  | [Defaults to `undefined`] |

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


## apiV1AnalyticsExportGet

> apiV1AnalyticsExportGet(dataset, from, to, marketProductId, format)



### Example

```ts
import {
  Configuration,
  AnalyticsApi,
} from '';
import type { ApiV1AnalyticsExportGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AnalyticsApi(config);

  const body = {
    // string
    dataset: dataset_example,
    // Date
    from: 2013-10-20,
    // Date
    to: 2013-10-20,
    // Array<string> (optional)
    marketProductId: ...,
    // string (optional)
    format: format_example,
  } satisfies ApiV1AnalyticsExportGetRequest;

  try {
    const data = await api.apiV1AnalyticsExportGet(body);
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
| **dataset** | `string` |  | [Defaults to `undefined`] |
| **from** | `Date` |  | [Defaults to `undefined`] |
| **to** | `Date` |  | [Defaults to `undefined`] |
| **marketProductId** | `Array<string>` |  | [Optional] |
| **format** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## apiV1AnalyticsHubThroughputGet

> apiV1AnalyticsHubThroughputGet(from, to, hubId)



### Example

```ts
import {
  Configuration,
  AnalyticsApi,
} from '';
import type { ApiV1AnalyticsHubThroughputGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AnalyticsApi(config);

  const body = {
    // Date
    from: 2013-10-20,
    // Date
    to: 2013-10-20,
    // string (optional)
    hubId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1AnalyticsHubThroughputGetRequest;

  try {
    const data = await api.apiV1AnalyticsHubThroughputGet(body);
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
| **from** | `Date` |  | [Defaults to `undefined`] |
| **to** | `Date` |  | [Defaults to `undefined`] |
| **hubId** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## apiV1AnalyticsOrderMetricsGet

> apiV1AnalyticsOrderMetricsGet(from, to, restaurantId, groupBy)



### Example

```ts
import {
  Configuration,
  AnalyticsApi,
} from '';
import type { ApiV1AnalyticsOrderMetricsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AnalyticsApi(config);

  const body = {
    // Date
    from: 2013-10-20,
    // Date
    to: 2013-10-20,
    // string (optional)
    restaurantId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string (optional)
    groupBy: groupBy_example,
  } satisfies ApiV1AnalyticsOrderMetricsGetRequest;

  try {
    const data = await api.apiV1AnalyticsOrderMetricsGet(body);
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
| **from** | `Date` |  | [Defaults to `undefined`] |
| **to** | `Date` |  | [Defaults to `undefined`] |
| **restaurantId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **groupBy** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## apiV1AnalyticsOverviewGet

> apiV1AnalyticsOverviewGet(date)



### Example

```ts
import {
  Configuration,
  AnalyticsApi,
} from '';
import type { ApiV1AnalyticsOverviewGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AnalyticsApi(config);

  const body = {
    // Date (optional)
    date: 2013-10-20,
  } satisfies ApiV1AnalyticsOverviewGetRequest;

  try {
    const data = await api.apiV1AnalyticsOverviewGet(body);
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
| **date** | `Date` |  | [Optional] [Defaults to `undefined`] |

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


## apiV1AnalyticsPriceTrendsGet

> apiV1AnalyticsPriceTrendsGet(from, to, marketProductId, interval)



### Example

```ts
import {
  Configuration,
  AnalyticsApi,
} from '';
import type { ApiV1AnalyticsPriceTrendsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AnalyticsApi(config);

  const body = {
    // Date
    from: 2013-10-20,
    // Date
    to: 2013-10-20,
    // Array<string> (optional)
    marketProductId: ...,
    // string (optional)
    interval: interval_example,
  } satisfies ApiV1AnalyticsPriceTrendsGetRequest;

  try {
    const data = await api.apiV1AnalyticsPriceTrendsGet(body);
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
| **from** | `Date` |  | [Defaults to `undefined`] |
| **to** | `Date` |  | [Defaults to `undefined`] |
| **marketProductId** | `Array<string>` |  | [Optional] |
| **interval** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## apiV1AnalyticsProcurementMetricsGet

> apiV1AnalyticsProcurementMetricsGet(from, to, marketId)



### Example

```ts
import {
  Configuration,
  AnalyticsApi,
} from '';
import type { ApiV1AnalyticsProcurementMetricsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AnalyticsApi(config);

  const body = {
    // Date
    from: 2013-10-20,
    // Date
    to: 2013-10-20,
    // string (optional)
    marketId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1AnalyticsProcurementMetricsGetRequest;

  try {
    const data = await api.apiV1AnalyticsProcurementMetricsGet(body);
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
| **from** | `Date` |  | [Defaults to `undefined`] |
| **to** | `Date` |  | [Defaults to `undefined`] |
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


## apiV1AnalyticsRecentActivitiesGet

> apiV1AnalyticsRecentActivitiesGet(entityType, action, page, pageSize)



### Example

```ts
import {
  Configuration,
  AnalyticsApi,
} from '';
import type { ApiV1AnalyticsRecentActivitiesGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AnalyticsApi(config);

  const body = {
    // string (optional)
    entityType: entityType_example,
    // string (optional)
    action: action_example,
    // number (optional)
    page: 56,
    // number (optional)
    pageSize: 56,
  } satisfies ApiV1AnalyticsRecentActivitiesGetRequest;

  try {
    const data = await api.apiV1AnalyticsRecentActivitiesGet(body);
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
| **entityType** | `string` |  | [Optional] [Defaults to `undefined`] |
| **action** | `string` |  | [Optional] [Defaults to `undefined`] |
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

