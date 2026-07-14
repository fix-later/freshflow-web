
# UpdateRestaurantProfileRequest


## Properties

Name | Type
------------ | -------------
`name` | string
`address` | string
`contactPerson` | string
`pickupStart` | string
`pickupEnd` | string
`businessLicenseUrl` | string

## Example

```typescript
import type { UpdateRestaurantProfileRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "name": null,
  "address": null,
  "contactPerson": null,
  "pickupStart": null,
  "pickupEnd": null,
  "businessLicenseUrl": null,
} satisfies UpdateRestaurantProfileRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as UpdateRestaurantProfileRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


