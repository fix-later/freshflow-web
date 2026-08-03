# RestaurantFavoritesApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiV1RestaurantsMeFavoritesGet**](RestaurantFavoritesApi.md#apiv1restaurantsmefavoritesget) | **GET** /api/v1/restaurants/me/favorites |  |
| [**apiV1RestaurantsMeFavoritesMarketProductIdDelete**](RestaurantFavoritesApi.md#apiv1restaurantsmefavoritesmarketproductiddelete) | **DELETE** /api/v1/restaurants/me/favorites/{marketProductId} |  |
| [**apiV1RestaurantsMeFavoritesPost**](RestaurantFavoritesApi.md#apiv1restaurantsmefavoritespost) | **POST** /api/v1/restaurants/me/favorites |  |



## apiV1RestaurantsMeFavoritesGet

> apiV1RestaurantsMeFavoritesGet()



### Example

```ts
import {
  Configuration,
  RestaurantFavoritesApi,
} from '';
import type { ApiV1RestaurantsMeFavoritesGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new RestaurantFavoritesApi(config);

  try {
    const data = await api.apiV1RestaurantsMeFavoritesGet();
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


## apiV1RestaurantsMeFavoritesMarketProductIdDelete

> apiV1RestaurantsMeFavoritesMarketProductIdDelete(marketProductId)



### Example

```ts
import {
  Configuration,
  RestaurantFavoritesApi,
} from '';
import type { ApiV1RestaurantsMeFavoritesMarketProductIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new RestaurantFavoritesApi(config);

  const body = {
    // string
    marketProductId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ApiV1RestaurantsMeFavoritesMarketProductIdDeleteRequest;

  try {
    const data = await api.apiV1RestaurantsMeFavoritesMarketProductIdDelete(body);
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
| **marketProductId** | `string` |  | [Defaults to `undefined`] |

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


## apiV1RestaurantsMeFavoritesPost

> apiV1RestaurantsMeFavoritesPost(addFavoriteRequest)



### Example

```ts
import {
  Configuration,
  RestaurantFavoritesApi,
} from '';
import type { ApiV1RestaurantsMeFavoritesPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new RestaurantFavoritesApi(config);

  const body = {
    // AddFavoriteRequest (optional)
    addFavoriteRequest: ...,
  } satisfies ApiV1RestaurantsMeFavoritesPostRequest;

  try {
    const data = await api.apiV1RestaurantsMeFavoritesPost(body);
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
| **addFavoriteRequest** | [AddFavoriteRequest](AddFavoriteRequest.md) |  | [Optional] |

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

