```typescript 
export class ExampleClient {
  #baseUrl!: string;
  #headers!: Record<string, string>;

  // The constructor is the ONLY place where the 'private' keyword is allowed.
  private constructor(baseUrl: string, defaultHeaders: Record<string, string>) {
    this.#baseUrl = baseUrl;
    this.#headers = defaultHeaders;
  }

  // Example factory for Bearer token
  public static withBearerToken(token: string): ExampleClient {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    return new ExampleClient('https://api.example.com/v1', headers);
  }

  // Example factory for API Key
  public static withApiKey(apiKey: string): ExampleClient {
    const headers = {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    };
    return new ExampleClient('https://api.example.com/v1', headers);
  }
}
```
