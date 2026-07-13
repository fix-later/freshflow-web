
# UpdateScheduledOrderRequest


## Properties

Name | Type
------------ | -------------
`recurrenceType` | string
`firstRunAt` | Date
`notes` | string

## Example

```typescript
import type { UpdateScheduledOrderRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "recurrenceType": null,
  "firstRunAt": null,
  "notes": null,
} satisfies UpdateScheduledOrderRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as UpdateScheduledOrderRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


