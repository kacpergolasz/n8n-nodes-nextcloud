```typescript 
public async get(
    path: string,
    query?: Record<string, string>,
    headers?: Record<string, string>
  ): Promise<Maybe> {
    try {
      const url = new URL(`${this.#baseUrl}${path}`);

      if (query) {
        Object.entries(query).forEach(([key, value]) => {
          url.searchParams.append(key, value);
        });
      }

      const mergedHeaders = { ...this.#headers, ...headers };

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: mergedHeaders,
      });

      if (!response.ok) {
        return {
          success: false,
          error: await this.#createError(response)
        };
      }

      const data = await response.json();
      return {
        success: true,
        response: data
      };

    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err : new Error(String(err))
      };
    }
  }
```
