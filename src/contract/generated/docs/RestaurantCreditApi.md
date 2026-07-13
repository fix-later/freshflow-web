# RestaurantCreditApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiV1RestaurantsRestaurantIdCreditGet**](RestaurantCreditApi.md#apiv1restaurantsrestaurantidcreditget) | **GET** /api/v1/restaurants/{restaurantId}/credit |  |
| [**apiV1RestaurantsRestaurantIdCreditTransactionsGet**](RestaurantCreditApi.md#apiv1restaurantsrestaurantidcredittransactionsget) | **GET** /api/v1/restaurants/{restaurantId}/credit/transactions |  |



## apiV1RestaurantsRestaurantIdCreditGet

> apiV1RestaurantsRestaurantIdCreditGet(restaurantId)



### Example

```ts
import {
  Configuration,
  RestaurantCreditApi,
} from '';
import type { ApiV1RestaurantsRestaurantIdCreditGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new RestaurantCreditApi(config);

  const body = {
    // string
    restaurantId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1RestaurantsRestaurantIdCreditGetRequest;

  try {
    const data = await api.apiV1RestaurantsRestaurantIdCreditGet(body);
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
| **restaurantId** | `string` |  | [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `text/plain`, `application/json`, `text/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **403** | Forbidden |  -  |
| **404** | Not Found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1RestaurantsRestaurantIdCreditTransactionsGet

> apiV1RestaurantsRestaurantIdCreditTransactionsGet(restaurantId)



### Example

```ts
import {
  Configuration,
  RestaurantCreditApi,
} from '';
import type { ApiV1RestaurantsRestaurantIdCreditTransactionsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new RestaurantCreditApi(config);

  const body = {
    // string
    restaurantId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1RestaurantsRestaurantIdCreditTransactionsGetRequest;

  try {
    const data = await api.apiV1RestaurantsRestaurantIdCreditTransactionsGet(body);
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
| **restaurantId** | `string` |  | [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `text/plain`, `application/json`, `text/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **403** | Forbidden |  -  |
| **404** | Not Found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

