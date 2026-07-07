export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  chat(history: ChatMessage[], system: string): Promise<string>;
}
