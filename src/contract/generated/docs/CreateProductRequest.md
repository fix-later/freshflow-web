
# CreateProductRequest


## Properties

Name | Type
------------ | -------------
`name` | string
`unitId` | string
`categoryId` | string
`description` | string
`packingCodeId` | string
`vatRate` | string
`minimumOrderQuantity` | number

## Example

```typescript
import type { CreateProductRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "name": null,
  "unitId": null,
  "categoryId": null,
  "description": null,
  "packingCodeId": null,
  "vatRate": null,
  "minimumOrderQuantity": null,
} satisfies CreateProductRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CreateProductRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


