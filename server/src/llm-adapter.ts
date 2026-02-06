import fetch from 'node-fetch';

export class LLMAdapter {
  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor(baseUrl: string, apiKey: string, model: string = 'gpt-3.5-turbo') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateResponse(text: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: text,
            },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      }) as any;

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`LLM API error: ${response.status} - ${error}`);
      }

      const data: any = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('[LLM Adapter] Error:', error);
      throw error;
    }
  }
}
