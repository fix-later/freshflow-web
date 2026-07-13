
# CreateUserCommand


## Properties

Name | Type
------------ | -------------
`email` | string
`password` | string
`role` | string
`marketId` | string
`restaurantName` | string
`phone` | string

## Example

```typescript
import type { CreateUserCommand } from ''

// TODO: Update the object below with actual values
const example = {
  "email": null,
  "password": null,
  "role": null,
  "marketId": null,
  "restaurantName": null,
  "phone": null,
} satisfies CreateUserCommand

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CreateUserCommand
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


