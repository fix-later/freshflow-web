
# UpdateOperationalSettingsRequest


## Properties

Name | Type
------------ | -------------
`dailyCutoffTime` | string
`batchingEnabled` | boolean
`defaultRouteType` | string
`deliveryWindowDays` | number

## Example

```typescript
import type { UpdateOperationalSettingsRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "dailyCutoffTime": null,
  "batchingEnabled": null,
  "defaultRouteType": null,
  "deliveryWindowDays": null,
} satisfies UpdateOperationalSettingsRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as UpdateOperationalSettingsRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


