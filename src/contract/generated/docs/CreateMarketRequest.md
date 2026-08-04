
# CreateMarketRequest


## Properties

Name | Type
------------ | -------------
`name` | string
`location` | string
`address` | string
`latitude` | number
`longitude` | number
`imageUrl` | string
`description` | string

## Example

```typescript
import type { CreateMarketRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "name": null,
  "location": null,
  "address": null,
  "latitude": null,
  "longitude": null,
  "imageUrl": null,
  "description": null,
} satisfies CreateMarketRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CreateMarketRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


