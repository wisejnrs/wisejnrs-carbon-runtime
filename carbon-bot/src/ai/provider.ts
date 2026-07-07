export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Called with short human-readable notes while a reply is being produced. */
export type ChatProgress = (note: string) => void;

export interface ChatResult {
  text: string;
  /** Absolute paths of files the session produced (empty for API providers). */
  files: string[];
  /** Session working directory to clean up after files have been delivered. */
  workDir?: string;
}

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  chat(history: ChatMessage[], system: string, onProgress?: ChatProgress): Promise<ChatResult>;
}
