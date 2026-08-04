
# CalculateRouteRequest


## Properties

Name | Type
------------ | -------------
`hubId` | string
`destinationRestaurantIds` | Array&lt;string&gt;
`optimizationCriteria` | string
`serviceDate` | Date

## Example

```typescript
import type { CalculateRouteRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "hubId": null,
  "destinationRestaurantIds": null,
  "optimizationCriteria": null,
  "serviceDate": null,
} satisfies CalculateRouteRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CalculateRouteRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


