---
description: Bootstraps a robust, strictly-typed API client in TypeScript based on provided API documentation, utilizing a Result-pattern (Maybe type) for error handling and private field syntax for encapsulation.
---

# Objective
Your goal is to parse API documentation and generate a fully functional, strictly-typed API client class in TypeScript. The resulting code must handle initialization via specific authorization methods, execute HTTP requests, handle errors verbosely, and strictly adhere to internal conventions.

# Step-by-Step Instructions

## Step 1: Analyze the API Documentation
Before writing any code, carefully review the provided API documentation or context.
1. **Identify the Base URL**: Determine the primary endpoint(s) for the API.
2. **List all HTTP Methods**: Extract every HTTP method used by the API (e.g., `GET`, `POST`, `PUT`, `PATCH`, `DELETE`). You will only generate methods that the API actually supports.
3. **List Authorization Mechanisms**: Identify all supported ways to authenticate (e.g., Bearer Token, Basic Auth, API Key in headers, API Key in query string).

## Step 2: Establish the `Maybe` Utility Type
All API calls must return a declarative result type rather than throwing exceptions directly. 
Check if a NON GENERIC `Maybe` type is already available in the working directory. If it is not found, generate it at the top of your file. 
```typescript 
  type Maybe = {
    success: true
    response: unknown
  } | 
  { 
    success: false
    error: Error
  }
```

## Step 3: Architect the Client Class and Instantiation

Create the main client class named {Source}Client (e.g., GithubClient, StripeClient).
The class must enforce private encapsulation for its state.

1. State Fields: Use the # prefix for private properties. Store at least the base URL. If API uses headers for authorization, store headers, if API uses query for authorization, store query.
2. Constructor: The constructor must be marked with the private keyword so the class cannot be instantiated directly with new.
3. Static Factory Methods: For every authorization method identified in Step 1, create a public static method that returns an instance of the class. This method configures the specific headers or state needed for that auth type.

Sample implementation [/reference/client.sample.md]

## Step 4: Create Verbose Error Handling

Provide extremely detailed error responses. When an API call fails, the developer should know exactly why.
Create a private helper method (using `#` syntax, e.g., `#createError`) that formats HTTP status codes, status texts, and any parsed error body from the API into a comprehensive Error object.

## Step 5: Implement Exposed HTTP Call Methods

For each HTTP method identified in Step 1, create a public instance method.

1. Method Signatures: The signature should accept parameters for the path, body, query strings, and custom headers.
2. Return Type: Every method must return Promise<Maybe<T>>.
3. URL Construction: Ensure the base URL, path parameters, and query strings are safely combined.
4. If API uses headers for auth, always merge stored headers with parameter ones. If API uses query for auth, do accordingly for query.
5. Error Catching: Wrap the execution in a try/catch block. Ensure both network-level failures and non-2xx HTTP responses result in { success: false, error: Error }.

Sample implementation: [/reference/get.sample.md]. (You will replicate and adjust this pattern for POST, PUT, DELETE, etc., ensuring body is stringified if required.). Assume body is `Record<string,string>` until proven otherwise.

# Strict Conventions & Rules

- Encapsulation Syntax: The private keyword is strictly reserved for the constructor ONLY. For all internal fields and private methods, you MUST use the ECMAScript standard # syntax (e.g., #baseUrl, #buildUrl()).
- File Naming: The output must be provided as a single file. The filename must follow the pattern {name}.client.ts (e.g., aws.client.ts, slack.client.ts).
- No Context Modification: Do not write, generate, or modify any files within the /context folder under any circumstances.
- No Throwing: Exposed methods must never throw exceptions. All errors must be safely caught and returned wrapped inside the Maybe type { success: false, error: Error }.
