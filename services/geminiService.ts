import { GoogleGenAI, LiveServerMessage } from "@google/genai";
import type { StreamResponse } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://aadya.com:8080';

let ai: GoogleGenAI | null = null;

// ============================================
// BACKEND INTEGRATION FUNCTIONS
// ============================================

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

export async function getAvailableAgents() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/agents`);
    if (!response.ok) throw new Error('Failed to fetch agents');
    const data = await response.json();
    return data.agents;
  } catch (error) {
    console.error('Error fetching agents:', error);
    throw error;
  }
}

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

// ============================================
// CHAT ENDPOINTS
// ============================================

export async function streamTextResponse(
  agentName: string,
  message: string,
  history: any[]
): Promise<ReadableStream<Uint8Array> | null> {
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
    return response.body;
  } catch (error) {
    console.error('Error streaming chat:', error);
    throw error;
  }
}


// ============================================
// LIVE CONVERSATION ENDPOINTS
// ============================================

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

export async function startLiveConversation(agentName: string, callbacks: any) {
  try {
    const [config, aiClient] = await Promise.all([
      getLiveConfig(agentName),
      getAiClient()
    ]);

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
