
# SettleCreditRequest


## Properties

Name | Type
------------ | -------------
`amount` | number
`paymentMethod` | string
`reference` | string
`note` | string

## Example

```typescript
import type { SettleCreditRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "amount": null,
  "paymentMethod": null,
  "reference": null,
  "note": null,
} satisfies SettleCreditRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as SettleCreditRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


