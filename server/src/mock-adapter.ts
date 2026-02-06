import { randomInt } from 'crypto';

export class MockLLMAdapter {
  private minDelay: number;
  private maxDelay: number;

  constructor(minDelay: number = 1000, maxDelay: number = 2000) {
    this.minDelay = minDelay;
    this.maxDelay = maxDelay;
  }

  async generateResponse(text: string): Promise<string> {
    const delay = randomInt(this.minDelay, this.maxDelay);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return `Echo: ${text}`;
  }
}
