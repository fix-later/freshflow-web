
# RegisterRestaurantRequest


## Properties

Name | Type
------------ | -------------
`email` | string
`password` | string
`restaurantName` | string
`phone` | string
`taxCode` | string
`invoiceLegalName` | string
`invoiceAddress` | string

## Example

```typescript
import type { RegisterRestaurantRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "email": null,
  "password": null,
  "restaurantName": null,
  "phone": null,
  "taxCode": null,
  "invoiceLegalName": null,
  "invoiceAddress": null,
} satisfies RegisterRestaurantRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as RegisterRestaurantRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


