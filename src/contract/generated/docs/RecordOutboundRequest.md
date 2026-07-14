
# RecordOutboundRequest


## Properties

Name | Type
------------ | -------------
`destinationRouteId` | string
`items` | [Array&lt;RecordOutboundItemRequest&gt;](RecordOutboundItemRequest.md)
`dispatchedAt` | Date

## Example

```typescript
import type { RecordOutboundRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "destinationRouteId": null,
  "items": null,
  "dispatchedAt": null,
} satisfies RecordOutboundRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as RecordOutboundRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


