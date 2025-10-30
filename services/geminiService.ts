import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import type { StreamResponse } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://aadya.com';

let ai: GoogleGenAI | null = null;

// ============================================
// BACKEND INTEGRATION FUNCTIONS
// ============================================

// Fetch API key from backend
async function getApiKeyFromBackend(): Promise<string> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/key`);
    if (!response.ok) throw new Error('Failed to fetch API key from backend');
    const { apiKey } = await response.json();
    if (!apiKey) throw new Error('API key not provided by backend');
    return apiKey;
  } catch (error) {
    console.error('Error fetching API key:', error);
    throw error;
  }
}

// Get singleton instance of GoogleGenAI
async function getAiClient(): Promise<GoogleGenAI> {
  if (ai) return ai;
  
  try {
    const apiKey = await getApiKeyFromBackend();
    ai = new GoogleGenAI({ apiKey });
    return ai;
  } catch (error) {
    console.error('Error initializing AI client:', error);
    throw error;
  }
}

// ============================================
// AGENT DISCOVERY ENDPOINTS
// ============================================

// Get all available agents from backend
export async function getAvailableAgents() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/agents`);
    if (!response.ok) throw new Error('Failed to fetch agents');
    const data = await response.json();
    return data.agents; // Array of { name, displayName }
  } catch (error) {
    console.error('Error fetching agents:', error);
    throw error;
  }
}

// Get specific agent config from backend
export async function getAgentConfig(agentName: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/agents/${agentName}/config`);
    if (!response.ok) throw new Error('Failed to fetch agent config');
    const config = await response.json();
    return config;
  } catch (error) {
    console.error('Error fetching agent config:', error);
    throw error;
  }
}

// ============================================
// CHAT ENDPOINTS
// ============================================

// Stream chat response from backend
export async function* streamTextResponse(
  agentName: string,
  message: string,
  history: any[]
): AsyncGenerator<string> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/agents/${agentName}/chat/stream`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: message, history })
      }
    );

    if (!response.ok) throw new Error('Failed to stream chat response');
    if (!response.body) throw new Error('No response body');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield decoder.decode(value, { stream: true });
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    console.error('Error streaming chat:', error);
    throw error;
  }
}

// ============================================
// LIVE CONVERSATION ENDPOINTS
// ============================================

// Get live config for voice conversation
export async function getLiveConfig(agentName: string) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/agents/${agentName}/live/config`
    );
    if (!response.ok) throw new Error('Failed to fetch live config');
    const config = await response.json();
    return config;
  } catch (error) {
    console.error('Error fetching live config:', error);
    throw error;
  }
}

// Start live conversation with backend
export async function startLiveConversation(agentName: string, callbacks: any) {
  try {
    // Get live config and API key
    const [config, aiClient] = await Promise.all([
      getLiveConfig(agentName),
      getAiClient()
    ]);

    // Connect to Gemini Live API with backend config
    const session = await aiClient.liveConnect({
      model: config.model,
      systemInstruction: config.systemInstruction,
      voiceConfig: {
        voiceName: config.voiceName || 'Puck'
      },
      onopen: () => {
        console.log('Live session opened');
        callbacks?.onopen?.();
      },
      onmessage: (message: LiveServerMessage) => {
        console.log('Live message received:', message);
        callbacks?.onmessage?.(message);
      },
      onerror: (error: Error) => {
        console.error('Live session error:', error);
        callbacks?.onerror?.(error);
      },
      onclose: () => {
        console.log('Live session closed');
        callbacks?.onclose?.();
      }
    });

    return session;
  } catch (error) {
    console.error('Error starting live conversation:', error);
    throw error;
  }
}

// Legacy functions (keep for compatibility)
export async function streamResponse(prompt: string) {
  try {
    const aiClient = await getAiClient();
    const response = await aiClient.generateContentStream({
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });

    for await (const chunk of response.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  } catch (error) {
    console.error('Error in streamResponse:', error);
    throw error;
  }
}
