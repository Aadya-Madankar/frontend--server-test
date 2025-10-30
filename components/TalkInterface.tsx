import React, { useState, useRef, useEffect, useCallback } from 'react';
import { startLiveConversation } from '../services/geminiService';
import type { LiveServerMessage, Blob as GeminiBlob } from '@google/genai';
import { MicIcon, StopIcon } from './icons';

// Audio utility functions
function encode(bytes: Uint8Array) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function createBlob(data: Float32Array): GeminiBlob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length;
    const buffer = ctx.createBuffer(1, frameCount, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
}

function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

interface LiveMessage {
    id: string;
    text: string;
    sender: 'user' | 'bot';
}

const TalkInterface: React.FC = () => {
    const [isLive, setIsLive] = useState(false);
    const [liveStatus, setLiveStatus] = useState('Click the button to start talking');
    const [transcriptions, setTranscriptions] = useState<LiveMessage[]>([]);

    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const nextStartTimeRef = useRef(0);
    const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
    const isLiveRef = useRef(isLive);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        isLiveRef.current = isLive;
    }, [isLive]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcriptions]);

    const handleStopLive = useCallback(() => {
        if (!isLiveRef.current) return;
        setIsLive(false);
        setLiveStatus('Conversation ended. Click to start again.');

        sessionPromiseRef.current?.then(session => session.close()).catch(e => console.error("Error closing:", e));
        streamRef.current?.getTracks().forEach(track => track.stop());
        
        scriptProcessorRef.current?.disconnect();
        mediaStreamSourceRef.current?.disconnect();

        inputAudioContextRef.current?.close().catch(() => {});
        outputAudioContextRef.current?.close().catch(() => {});

        sessionPromiseRef.current = null;
        streamRef.current = null;
        scriptProcessorRef.current = null;
        mediaStreamSourceRef.current = null;
    }, []);

    const handleStartLive = async () => {
        if (isLive) return;
        setTranscriptions([]);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            setIsLive(true);
            setLiveStatus('Connecting...');

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            let currentUserTranscription = '';
            let currentBotTranscription = '';

            const callbacks = {
                onopen: () => {
                    setLiveStatus("Connection open. You can start talking.");
                    if (!inputAudioContextRef.current || !streamRef.current) return;

                    const source = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
                    mediaStreamSourceRef.current = source;
                    
                    const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                    scriptProcessorRef.current = scriptProcessor;

                    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        if (!isLiveRef.current) return;
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        sessionPromiseRef.current?.then((session) => {
                            session.sendRealtimeInput({ media: createBlob(inputData) });
                        });
                    };
                    
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(inputAudioContextRef.current.destination);
                },
                onmessage: async (message: LiveServerMessage) => {
                    try {
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio && outputAudioContextRef.current?.state === 'running') {
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current);
                            const sourceNode = outputAudioContextRef.current.createBufferSource();
                            sourceNode.buffer = audioBuffer;
                            sourceNode.connect(outputAudioContextRef.current.destination);
                            sourceNode.addEventListener('ended', () => sourcesRef.current.delete(sourceNode));
                            sourceNode.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            sourcesRef.current.add(sourceNode);
                        }

                        if (message.serverContent?.inputTranscription) {
                            currentUserTranscription += message.serverContent.inputTranscription.text;
                        }
                        if (message.serverContent?.outputTranscription) {
                            currentBotTranscription += message.serverContent.outputTranscription.text;
                        }

                        if (message.serverContent?.turnComplete) {
                            setTranscriptions(prev => {
                                const newMessages = [...prev];
                                if (currentUserTranscription.trim()) newMessages.push({ id: `live-user-${Date.now()}`, text: currentUserTranscription.trim(), sender: 'user' });
                                if (currentBotTranscription.trim()) newMessages.push({ id: `live-bot-${Date.now()}`, text: currentBotTranscription.trim(), sender: 'bot' });
                                return newMessages;
                            });
                            currentUserTranscription = '';
                            currentBotTranscription = '';
                        }
                    } catch (error) {
                        console.error("Error processing message:", error);
                        setLiveStatus("An error occurred.");
                        handleStopLive();
                    }
                },
                onerror: (e: ErrorEvent) => {
                    console.error('Error:', e);
                    setLiveStatus('An error occurred. Please try again.');
                    handleStopLive();
                },
                onclose: () => {
                    handleStopLive();
                },
            };
            
            // ✅ CLEAN: Just call with agent name, server handles everything
            sessionPromiseRef.current = startLiveConversation('rani-bhat', callbacks);
        } catch (error) {
            console.error('Microphone error:', error);
            setLiveStatus('Microphone permission denied.');
            setIsLive(false);
        }
    };

    useEffect(() => {
        return () => { handleStopLive(); };
    }, [handleStopLive]);

    return (
        <div className="flex flex-col h-[80vh] bg-brand-surface rounded-lg shadow-2xl overflow-hidden border border-brand-bg-alt">
            <div className="flex-grow p-6 overflow-y-auto space-y-4 bg-brand-bg-light">
                {transcriptions.length === 0 && !isLive && (
                     <div className="flex flex-col items-center justify-center h-full text-center text-brand-secondary/60">
                        <MicIcon className="w-16 h-16 mb-4"/>
                        <p className="text-lg">Your conversation will appear here.</p>
                     </div>
                )}
                {transcriptions.map((msg) => (
                    <div key={msg.id} className={`flex items-end gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`w-fit max-w-lg p-3 px-4 rounded-2xl shadow-sm ${msg.sender === 'user' ? 'bg-brand-primary text-white rounded-br-none' : 'bg-brand-bg-alt text-brand-secondary rounded-bl-none'}`}>
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                        </div>
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>
            <div className="p-6 bg-brand-surface/90 border-t border-brand-bg-alt flex flex-col items-center justify-center space-y-4">
                <p className="text-center text-lg text-brand-secondary/80 h-8 transition-all duration-300">{liveStatus}</p>
                <button
                    onClick={isLive ? handleStopLive : handleStartLive}
                    className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ease-in-out shadow-lg text-white ${isLive ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-brand-primary hover:bg-brand-primary-light'}`}
                >
                    {isLive ? <StopIcon className="w-10 h-10" /> : <MicIcon className="w-10 h-10" />}
                </button>
            </div>
        </div>
    );
};

export default TalkInterface;
