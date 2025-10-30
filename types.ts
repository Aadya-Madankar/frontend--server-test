
export type AppMode = 'Welcome' | 'Chat' | 'Talk';

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  sources?: GroundingSource[];
  reaction?: string;
}

export interface GroundingSource {
    uri: string;
    title: string;
}

/**
 * Defines the structure of each JSON object streamed from the backend
 * for a chat response.
 */
export interface StreamResponse {
    textChunk?: string;
    sources?: GroundingSource[];
}