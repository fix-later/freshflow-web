
# DeliveryAddressRequest


## Properties

Name | Type
------------ | -------------
`addressLine` | string
`recipientName` | string
`phone` | string
`latitude` | number
`longitude` | number
`isDefault` | boolean

## Example

```typescript
import type { DeliveryAddressRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "addressLine": null,
  "recipientName": null,
  "phone": null,
  "latitude": null,
  "longitude": null,
  "isDefault": null,
} satisfies DeliveryAddressRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as DeliveryAddressRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


