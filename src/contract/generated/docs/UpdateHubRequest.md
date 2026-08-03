
# UpdateHubRequest


## Properties

Name | Type
------------ | -------------
`name` | string
`address` | string
`latitude` | number
`longitude` | number
`capacityKg` | number
`managedBy` | string
`marketId` | string

## Example

```typescript
import type { UpdateHubRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "name": null,
  "address": null,
  "latitude": null,
  "longitude": null,
  "capacityKg": null,
  "managedBy": null,
  "marketId": null,
} satisfies UpdateHubRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as UpdateHubRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


