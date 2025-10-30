import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import type { StreamResponse } from "../types";

const API_BASE_URL = 'https://serrver-test-production.up.railway.app';

let ai: GoogleGenAI | null = null;

async function getAiClient(): Promise<GoogleGenAI> {
    if (ai) return ai;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/key`);
        if (!response.ok) throw new Error('Failed to fetch API key.');
        const { apiKey } = await response.json();
        if (!apiKey) throw new Error('API key not provided.');
        ai = new GoogleGenAI({ apiKey });
        return ai;
    } catch (error) {
        console.error("AI Client error:", error);
        throw error;
    }
}

export async function* streamTextResponse(
    agentName: string,
    prompt: string,
    history: { role: 'user' | 'model'; parts: { text: string }[] }[]
): AsyncGenerator<StreamResponse> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/agents/${encodeURIComponent(agentName)}/chat/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, history }),
        });

        if (!response.ok || !response.body) throw new Error(`HTTP error: ${response.status}`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                if (buffer.trim()) {
                    try { yield JSON.parse(buffer); } catch (e) { console.error('Parse error:', e); }
                }
                break;
            }
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.trim()) {
                    try {
                        yield JSON.parse(line);
                    } catch (e) {
                        console.error('Parse error:', e);
                    }
                }
            }
        }
    } catch (error) {
        console.error("Stream error:", error);
        yield { textChunk: "Error: Could not connect to server." };
    }
}

// ✅ CLEAN: Server handles agent config, voice, prompts - frontend just passes agent name
export async function startLiveConversation(
    agentName: string,
    callbacks: {
        onopen: () => void;
        onmessage: (message: LiveServerMessage) => void;
        onerror: (e: ErrorEvent) => void;
        onclose: (e: CloseEvent) => void;
    }
) {
    const client = await getAiClient();

    // ✅ Fetch config from server - server knows voice, system prompt, etc
    const response = await fetch(`${API_BASE_URL}/api/agents/${encodeURIComponent(agentName)}/live/config`);
    if (!response.ok) throw new Error(`Failed to fetch config for "${agentName}"`);
    
    const liveConfig = await response.json();
    if (!liveConfig?.systemInstruction || !liveConfig?.voiceName) {
        throw new Error('Invalid config received from server');
    }

    // ✅ Server config drives everything
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
}
