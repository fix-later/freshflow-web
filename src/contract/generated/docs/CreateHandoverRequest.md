
# CreateHandoverRequest


## Properties

Name | Type
------------ | -------------
`deliveryRouteId` | string
`driverUserId` | string
`outboundEventId` | string
`notes` | string

## Example

```typescript
import type { CreateHandoverRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "deliveryRouteId": null,
  "driverUserId": null,
  "outboundEventId": null,
  "notes": null,
} satisfies CreateHandoverRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CreateHandoverRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


