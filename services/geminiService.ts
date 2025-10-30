import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import type { StreamResponse } from "../types";

// The backend server is expected to be running on this address during local development.
const API_BASE_URL = 'https://serrver-test-production.up.railway.app';

// The client-side AI instance is now created on-demand after fetching the key from the server.
let ai: GoogleGenAI | null = null;

/**
 * Gets a singleton instance of the GoogleGenAI client.
 * On first run, it fetches the API key from the backend server.
 */
async function getAiClient(): Promise<GoogleGenAI> {
    if (ai) {
        return ai;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/key`);
        if (!response.ok) {
            throw new Error('Failed to fetch API key from server.');
        }
        const { apiKey } = await response.json();
        if (!apiKey) {
            throw new Error('API key not provided by the server. Ensure it is set in the server/.env file.');
        }
        ai = new GoogleGenAI({ apiKey });
        return ai;
    } catch (error) {
        console.error("Could not initialize AI Client:", error);
        throw error;
    }
}


/**
 * Generates a streaming text response by calling the backend server's API.
 * This ensures all prompts and API keys are handled server-side.
 */
export async function* streamTextResponse(
    agentName: string,
    prompt: string,
    history: { role: 'user' | 'model'; parts: { text: string }[] }[]
): AsyncGenerator<StreamResponse> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/agents/${encodeURIComponent(agentName)}/chat/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt,
                history,
            }),
        });

        if (!response.ok || !response.body) {
            const errorText = await response.text();
            console.error('Server error:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                 // Process any remaining data in the buffer
                if (buffer.trim()) {
                    try {
                        yield JSON.parse(buffer);
                    } catch (e) {
                        console.error('Failed to parse final stream chunk:', buffer, e);
                    }
                }
                break;
            }
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            
            // Keep the last, possibly incomplete, line for the next chunk
            buffer = lines.pop() || ''; 

            for (const line of lines) {
                if (line.trim()) {
                    try {
                        const chunk = JSON.parse(line);
                        yield chunk;
                    } catch (e) {
                        console.error('Failed to parse stream chunk:', line, e);
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error fetching streaming response:", error);
        // Yield the specific error message the user reported.
        yield { textChunk: "Error: Could not connect to the agent. Please ensure the server is running." };
    }
}


/**
 * Initializes a live voice conversation.
 * 1. Fetches the API key from our backend to initialize a client-side Gemini connection.
 * 2. Fetches the agent-specific configuration (prompts, voice) from the backend server.
 * 3. Uses that configuration to establish a direct, low-latency connection to the Gemini API.
 */
export async function startLiveConversation(
    agentName: string,
    callbacks: {
        onopen: () => void;
        onmessage: (message: LiveServerMessage) => void;
        onerror: (e: ErrorEvent) => void;
        onclose: (e: CloseEvent) => void;
    }
) {
     // 1. Get the AI client, which fetches the key from our server on the first call.
    const client = await getAiClient();

     // 2. Fetch the live configuration for the specified agent from the backend server.
    const response = await fetch(`${API_BASE_URL}/api/agents/${encodeURIComponent(agentName)}/live/config`);
    if (!response.ok) {
        throw new Error(`Failed to fetch live config for agent "${agentName}". Please ensure the server is running.`);
    }
    const liveConfig = await response.json();
    
    // Check if we got a valid config
    if (!liveConfig || !liveConfig.systemInstruction || !liveConfig.voiceName) {
         throw new Error(`Received invalid live config from server for agent "${agentName}"`);
    }

    // 3. Use the fetched configuration to connect directly to the Gemini API.
    const sessionPromise = client.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks,
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: liveConfig.voiceName } },
            },
            systemInstruction: liveConfig.systemInstruction,
            inputAudioTranscription: {},
            outputAudioTranscription: {},
        },
    });
    return sessionPromise;
};