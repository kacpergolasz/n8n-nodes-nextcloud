---
description: Bootstraps a robust, strictly-typed API repositories in TypeScript based on provided API documentation, utilizing a Result-pattern (Maybe type) for error handling and private field syntax for encapsulation.
---

# Objective
Your goal is to parse API documentation and generate a fully functional, strictly-typed API repository.

# Step-by-Step Instructions

## Step 1: Analyze the API Documentation
1. **Find entities** For each entity we will create repository to interact with it.
2. **Find conflicts** Check if entities interact directly with each other. If yes, ask user and point to endpoint

## Step 2: Establish the `Maybe` Utility Type
All API calls must return a declarative result type rather than throwing exceptions directly. 
Check if a GENERIC `Maybe` type is already available in the working directory. If it is not found, generate it at the top of your file. 
```typescript 
  type Maybe<T> = {
    success: true
    response: T
  } | 
  { 
    success: false
    error: Error
  }
```

## Step 3: Architect repository files
1. For each repository create file {Source}{RepositoryName}.repository.ts
2. Find api client in folder. If you won't, stop and ask user to use /api-client skill.
3. Use function pattern until asked otherwise. Every function must implement pattern `function operation(client: ApiClient,...)`
4. Use strictly typed parameters for functions.
5. Every response must be validated with zod. Every zod schema should be included in repository file. DO NOT USE:
    - z.any()
    - z.unknown()
    - .passthrough()
6. Every function must return `Maybe<>` type


# Conventions
- No Context Modification: Do not write, generate, or modify any files within the /context folder under any circumstances.
- No Throwing: Exposed methods must never throw exceptions. All errors must be safely caught and returned wrapped inside the Maybe type { success: false, error: Error }.
