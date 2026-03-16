
// Polyfill for process in browser environment to prevent crash
if (typeof window !== 'undefined') {
    // Only polyfill if not already present
    if (!(window as any).process) {
        (window as any).process = { env: {} };
    }
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Mic, Menu, Sparkles, Volume2, VolumeX, MicOff, AlertCircle, Loader2, AudioLines, MessageCircle, Zap, WifiOff, Radio, LayoutGrid, ChevronUp } from 'lucide-react';
import { Message, Source, ChatSession, AudioSettings } from './types';
import { initializeChat, sendMessageStream, generateSpeech, LiveClient, setUserApiKey } from './services/geminiService';
import { stopAudio, enqueueAudio, enqueueSilence, clearAudioQueue, setPlayStateCallback, resetPCMStream, initAudioContext, setAudioErrorCallback, getAudioContextState, playWakeSound, playPCMChunk, getAudioContext, setSmartTVMode, setGlobalOutputSampleRate, resetAudioContext, downloadWav, setGlobalOutputVolume, setDigitalLimiterEnabled } from './utils/audio';
import MessageBubble from './components/MessageBubble';
import TypingIndicator from './components/TypingIndicator';
import Sidebar from './components/Sidebar';
import SettingsModal from './components/SettingsModal';
import ServiceSubMenu from './components/ServiceSubMenu';
import LiveVisualizer from './components/LiveVisualizer';
import DebugOverlay from './components/DebugOverlay';
import { ServiceItem, LIVE_PERSONAS } from './components/Service_Prompts';

export type TTSStatus = 'idle' | 'loading' | 'playing' | 'suspended' | 'error';
type AIModelType = 'standard' | 'live';

// --- INLINE LOGO COMPONENT (Image Version with Animations) ---
const MaziLogo: React.FC = () => (
    <div className="flex items-center justify-center select-none cursor-default gap-1" aria-label="MAZI Logo">
        <style>{`
      @keyframes mazi-float-high {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-20px); }
      }
      @keyframes mazi-float-normal {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-12px); }
      }
      .mazi-anim-A {
        animation: mazi-float-high 2.8s ease-in-out infinite;
      }
      .mazi-anim-i {
        animation: mazi-float-normal 2.8s ease-in-out infinite;
        animation-delay: 1.4s;
      }
      .mazi-logo-img {
          height: 50px;
          object-fit: contain;
      }
      .mazi-logo-img-i {
          height: 78px;
          margin-top: -6px;
          transform: scaleX(1.2) scaleY(1.05);
      }
      @media (min-width: 768px) {
          .mazi-logo-img {
              height: 70px;
          }
          .mazi-logo-img-i {
              height: 106px;
              margin-top: -8px;
          }
      }
    `}</style>
        <img src="/m.png" alt="M" className="mazi-logo-img" />
        <img src="/a.png" alt="A" className="mazi-logo-img mazi-anim-A" />
        <img src="/z.png" alt="Z" className="mazi-logo-img" />
        <img src="/i.png" alt="i" className="mazi-logo-img mazi-anim-i mazi-logo-img-i" />
    </div>
);

const App: React.FC = () => {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [isHistoryEnabled, setIsHistoryEnabled] = useState(true);

    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isTTSActive, setIsTTSActive] = useState(false);
    const [isListening, setIsListeningState] = useState(false);
    const setIsListening = useCallback((val: boolean, source: string = 'unknown') => {
        console.log(`[State] isListening: ${isListeningRef.current} -> ${val} (Source: ${source})`);
        setIsListeningState(val);
        isListeningRef.current = val;
    }, []);

    const [isAiSpeaking, setIsAiSpeakingState] = useState(false);
    const setIsAiSpeaking = useCallback((val: boolean, source: string = 'unknown') => {
        if (isAiSpeakingRef.current !== val) {
            console.log(`[State] isAiSpeaking: ${isAiSpeakingRef.current} -> ${val} (Source: ${source})`);
        }
        setIsAiSpeakingState(val);
        isAiSpeakingRef.current = val;
    }, []);

    const [isMicChecking, setIsMicCheckingState] = useState(false);
    const setIsMicChecking = useCallback((val: boolean) => {
        console.log(`[State] isMicChecking changed to ${val}`);
        setIsMicCheckingState(val);
    }, []);
    const [isMicInputDetected, setIsMicInputDetected] = useState(false);
    const [isContinuousMode, setIsContinuousMode] = useState(false);
    const [currentVoice, setCurrentVoice] = useState('Kore');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [toast, setToast] = useState<{ message: string, type: 'error' | 'info' } | null>(null);
    const [isConfigError, setIsConfigError] = useState(false);
    const [userApiKey, setUserApiKeyLocal] = useState('');
    const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

    const [aiModel, setAiModel] = useState<AIModelType>('live');
    const [isSmartTVMode, setIsSmartTVMode] = useState(false);

    const [activeLivePersonaId, setActiveLivePersonaId] = useState<string>('standard_gen');

    const [audioSettings, setAudioSettings] = useState<AudioSettings>({
        outputSampleRate: 24000,
        inputSampleRate: 16000,
        outputVolume: 1.0,
        digitalLimiter: true,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        micThreshold: 0.01,
        visualizerType: 'circle',
        showDebugInfo: true,
        ttsEngine: 'gemini'
    });

    const [userVolume, setUserVolume] = useState(0);
    const [isLiveThinking, setIsLiveThinkingState] = useState(false);
    const setIsLiveThinking = useCallback((val: boolean) => {
        setIsLiveThinkingState(val);
        isLiveThinkingRef.current = val;
    }, []);

    const [debugRms, setDebugRms] = useState(0);
    const [debugThreshold, setDebugThreshold] = useState(0);
    const [debugGateOpen, setDebugGateOpen] = useState(false);

    const [isWakeWordMode, setIsWakeWordMode] = useState(false);
    const [isConversationMode, setIsConversationMode] = useState(false);
    const [cooldownSeconds, setCooldownSeconds] = useState(0);
    const [liveToggleCooldown, setLiveToggleCooldown] = useState(0);
    const [activeServiceCategoryId, setActiveServiceCategoryId] = useState<string | null>(null);
    const [isServiceMenuMinimized, setIsServiceMenuMinimized] = useState(false);
    const [isDrillMode, setIsDrillMode] = useState(false);

    const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
    const [isAudioLoading, setIsAudioLoading] = useState(false);
    const [ttsStatus, setTtsStatus] = useState<TTSStatus>('idle');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const recognitionRef = useRef<any>(null);
    const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const loadingSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const diagnosticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isContinuousModeRef = useRef(false);
    const isAiSpeakingRef = useRef(false);
    const isLoadingRef = useRef(false);
    const isDrillModeRef = useRef(false);
    const isWakeWordModeRef = useRef(false);
    const isTTSActiveRef = useRef(false);
    const wakeWordLockRef = useRef(false);
    const aiModelRef = useRef<AIModelType>('live');
    const isMicDetectedRef = useRef(false);
    const isListeningRef = useRef(false);
    const isConnectingSessionRef = useRef(false);
    const hasAutoStartedRef = useRef(false);
    const audioSettingsRef = useRef<AudioSettings>(audioSettings);
    const aiSpeakingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const currentSessionIdRef = useRef<string | null>(null);
    const handleSendMessageRef = useRef<(text?: string, displayText?: string) => Promise<void>>(async () => { });

    const liveClientRef = useRef<LiveClient | null>(null);
    const liveAudioContextRef = useRef<AudioContext | null>(null);
    const liveScriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const liveMediaStreamRef = useRef<MediaStream | null>(null);
    const liveThinkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isLiveThinkingRef = useRef(false);

    const STOP_KEYWORDS = ["그만", "멈춰", "스톱", "stop", "wait", "잠깐", "조용", "종료"];

    const ttsBufferRef = useRef<string>("");
    const audioCharCountRef = useRef<number>(0);
    const ttsQueueRef = useRef<{ text: string, isEnglishDrill: boolean }[]>([]);
    const isGeneratingTTS = useRef<boolean>(false);
    const audioSessionIdRef = useRef<number>(0);

    const WAKE_WORD_REGEX = /(마\s*지\s*야|마\s*지|헤\s*이\s*마\s*지|hey\s*mazi|mazi|맞\s*이\s*야|맏\s*이\s*야|하\s*지\s*야|바\s*지\s*야|마\s*지\s*막)(.*)/i;

    useEffect(() => {
        // Initial configuration check
        const isInit = initializeChat();
        if (!isInit) {
            setIsConfigError(true);
        }

        setPlayStateCallback((isPlaying) => {
            if (isPlaying) {
                if (aiSpeakingTimerRef.current) clearTimeout(aiSpeakingTimerRef.current);
                setIsAiSpeaking(true);
            } else {
                if (aiSpeakingTimerRef.current) clearTimeout(aiSpeakingTimerRef.current);
                aiSpeakingTimerRef.current = setTimeout(() => {
                    setIsAiSpeaking(false);
                }, 800);
            }
        });
        return () => {
            setPlayStateCallback(() => { });
            if (aiSpeakingTimerRef.current) clearTimeout(aiSpeakingTimerRef.current);
        };
    }, []);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            showToast("인터넷이 다시 연결되었습니다.");
        };
        const handleOffline = () => {
            setIsOnline(false);
            showToast("인터넷 연결이 끊어졌습니다. 네트워크를 확인해주세요.", "error");
            if (aiModelRef.current === 'live') {
                stopLiveSession();
            }
        };
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        const handleTouchStart = () => {
            initAudioContext();
        };
        window.addEventListener('touchstart', handleTouchStart, { once: true });
        return () => window.removeEventListener('touchstart', handleTouchStart);
    }, []);

    useEffect(() => {
        try {
            const savedSessions = localStorage.getItem('chatSessions');
            if (savedSessions) {
                const parsed = JSON.parse(savedSessions);
                const revived = parsed.map((s: any) => ({
                    ...s,
                    messages: s.messages.map((m: any) => ({
                        ...m,
                        timestamp: new Date(m.timestamp),
                        audioData: undefined
                    }))
                }));
                setSessions(revived);
            }
            const savedHistoryPref = localStorage.getItem('isHistoryEnabled');
            if (savedHistoryPref !== null) setIsHistoryEnabled(savedHistoryPref === 'true');

            const savedTVMode = localStorage.getItem('isSmartTVMode') === 'true';
            setIsSmartTVMode(savedTVMode);
            setSmartTVMode(savedTVMode);

            const savedAudioSettings = localStorage.getItem('audioSettings');
            if (savedAudioSettings) {
                const parsed = JSON.parse(savedAudioSettings);
                setAudioSettings(prev => ({ ...prev, ...parsed }));
            } else if (savedTVMode) {
                setAudioSettings(prev => ({ ...prev, outputSampleRate: 48000 }));
            }

            const savedApiKey = localStorage.getItem('userApiKey');
            if (savedApiKey) {
                setUserApiKeyLocal(savedApiKey);
                setUserApiKey(savedApiKey);
            }

            setCurrentSessionId(null);
        } catch (e) {
            console.error("Failed to load history/settings", e);
        }
    }, []);

    useEffect(() => {
        if (isHistoryEnabled) {
            const sessionsToSave = sessions.map(session => ({
                ...session,
                messages: session.messages.map(msg => {
                    const { audioData, ...rest } = msg;
                    return rest;
                })
            }));
            localStorage.setItem('chatSessions', JSON.stringify(sessionsToSave));
        }
    }, [sessions, isHistoryEnabled]);

    useEffect(() => {
        localStorage.setItem('userApiKey', userApiKey);
        setUserApiKey(userApiKey);
        // If API key is set, try to clear config error if it was a key issue
        if (userApiKey && isConfigError) {
            const isInit = initializeChat();
            if (isInit) setIsConfigError(false);
        }
    }, [userApiKey]);

    useEffect(() => {
        localStorage.setItem('isHistoryEnabled', String(isHistoryEnabled));
        if (!isHistoryEnabled) localStorage.removeItem('chatSessions');
    }, [isHistoryEnabled]);

    const updateCurrentSessionHistory = useCallback((newMessages: Message[]) => {
        const sessionId = currentSessionIdRef.current;
        if (!sessionId || !isHistoryEnabled) return;

        setSessions(prev => prev.map(session => {
            if (session.id === sessionId) {
                return { ...session, messages: newMessages, updatedAt: Date.now() };
            }
            return session;
        }));
    }, [isHistoryEnabled]);

    useEffect(() => {
        currentSessionIdRef.current = currentSessionId;
    }, [currentSessionId]);

    useEffect(() => {
        isContinuousModeRef.current = isContinuousMode;
    }, [isContinuousMode]);

    useEffect(() => {
        isDrillModeRef.current = isDrillMode;
    }, [isDrillMode]);

    useEffect(() => {
        isWakeWordModeRef.current = isWakeWordMode;
    }, [isWakeWordMode]);

    useEffect(() => {
        isTTSActiveRef.current = isTTSActive;
    }, [isTTSActive]);

    useEffect(() => {
        aiModelRef.current = aiModel;
    }, [aiModel]);

    useEffect(() => {
        audioSettingsRef.current = audioSettings;
        localStorage.setItem('audioSettings', JSON.stringify(audioSettings));
        setGlobalOutputSampleRate(audioSettings.outputSampleRate);
        setGlobalOutputVolume(audioSettings.outputVolume);
        setDigitalLimiterEnabled(audioSettings.digitalLimiter);

        if (liveClientRef.current) {
            liveClientRef.current.setThreshold(audioSettings.micThreshold);
        }
    }, [audioSettings]);

    useEffect(() => {
        isAiSpeakingRef.current = isAiSpeaking;

        if (isAiSpeaking) {
            setIsAudioLoading(false);
            setTtsStatus('playing');

            if (aiModel === 'live') {
                setIsLiveThinking(false);
                if (liveThinkingTimerRef.current) clearTimeout(liveThinkingTimerRef.current);
            }

            if (loadingSafetyTimerRef.current) clearTimeout(loadingSafetyTimerRef.current);

            if (isListening && aiModel === 'standard') {
                try {
                    recognitionRef.current?.abort();
                } catch (e) { }
            }
        } else {
            if (!isAudioLoading) {
                setTtsStatus('idle');
            }

            if (!isGeneratingTTS.current && ttsQueueRef.current.length === 0) {
                setPlayingMessageId(null);

                if (isContinuousModeRef.current && !isLoadingRef.current && !isAudioLoading && aiModel === 'standard') {
                    setTimeout(() => {
                        startRecognitionSafe();
                    }, 800);
                }
            }
        }
    }, [isAiSpeaking, isListening, aiModel]);

    useEffect(() => {
        diagnosticTimerRef.current = setInterval(() => {
            if (isAiSpeakingRef.current) {
                const state = getAudioContextState();
                if (state === 'suspended') {
                    setTtsStatus('suspended');
                } else if (state === 'running') {
                    setTtsStatus('playing');
                }
            }
        }, 1000);

        return () => {
            if (diagnosticTimerRef.current) clearInterval(diagnosticTimerRef.current);
        }
    }, []);

    useEffect(() => {
        if (isAudioLoading) setTtsStatus('loading');
        else if (isAiSpeaking) setTtsStatus('playing');
        else setTtsStatus('idle');
    }, [isAudioLoading, isAiSpeaking]);

    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (cooldownSeconds > 0) {
            timer = setInterval(() => {
                setCooldownSeconds(prev => prev - 1);
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [cooldownSeconds]);

    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (liveToggleCooldown > 0) {
            timer = setInterval(() => {
                setLiveToggleCooldown(prev => prev - 1);
            }, 1000);
        }
        return () => { if (timer) clearInterval(timer); };
    }, [liveToggleCooldown]);

    const showToast = useCallback((message: string, type: 'error' | 'info' = 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const stopLiveAudioStream = useCallback(() => {
        if (liveMediaStreamRef.current) {
            liveMediaStreamRef.current.getTracks().forEach(track => track.stop());
            liveMediaStreamRef.current = null;
        }
        if (liveScriptProcessorRef.current) {
            liveScriptProcessorRef.current.disconnect();
            liveScriptProcessorRef.current = null;
        }
        if (liveAudioContextRef.current) {
            try { liveAudioContextRef.current.close(); } catch (e) { }
            liveAudioContextRef.current = null;
        }
        if (liveThinkingTimerRef.current) clearTimeout(liveThinkingTimerRef.current);
    }, []);

    const stopLiveSession = useCallback(() => {
        console.log("[Action] stopLiveSession triggered");
        if (liveClientRef.current) {
            liveClientRef.current.disconnect();
            liveClientRef.current = null;
        }
        stopLiveAudioStream();
        setIsListening(false, 'stopLiveSession');
        setIsMicInputDetected(false);
        setIsAiSpeaking(false, 'stopLiveSession');
        setIsLiveThinking(false);
        stopAudio();
    }, [stopLiveAudioStream, setIsListening, setIsAiSpeaking, setIsLiveThinking]);

    const startLiveAudioStream = useCallback(async (client: LiveClient) => {
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const config = audioSettingsRef.current;

            let ctx: AudioContext;
            try {
                ctx = new AudioContextClass({ sampleRate: config.inputSampleRate });
            } catch (e) {
                ctx = new AudioContextClass();
            }
            liveAudioContextRef.current = ctx;
            if (ctx.state === 'suspended') {
                await ctx.resume();
            }

            // [FIX] Guard: If context was closed while waiting for resume or previous cleanup
            if ((ctx.state as any) === 'closed') return;

            const constraints: MediaTrackConstraints = {
                channelCount: 1,
                echoCancellation: config.echoCancellation,
                noiseSuppression: config.noiseSuppression,
                autoGainControl: config.autoGainControl
            };

            let stream: MediaStream;
            try {
                console.log("[MicStream] Requesting microphone access...");
                stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
            } catch (e) {
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                } catch (err) {
                    throw new Error("마이크 장치를 찾을 수 없거나 접근이 거부되었습니다.");
                }
            }

            // [CRITICAL FIX] Post-Capture Guard: If the session was closed while waiting for getUserMedia
            if (liveClientRef.current !== client || !isListeningRef.current) {
                console.warn("[MicStream] Session closed during mic capture. Releasing hardware.");
                stream.getTracks().forEach(track => track.stop());
                return;
            }

            liveMediaStreamRef.current = stream;
            const source = ctx.createMediaStreamSource(stream);
            const processor = ctx.createScriptProcessor(4096, 1, 1);
            liveScriptProcessorRef.current = processor;

            client.setThreshold(config.micThreshold);

            let frameCount = 0;

            processor.onaudioprocess = (e) => {
                // [FIX] Instance Guard: If this is a stale context (after session change), do nothing
                if (liveClientRef.current !== client) {
                    try {
                        source.disconnect();
                        processor.disconnect();
                        console.log("[MicStream] Stale processor disconnected");
                    } catch (err) {}
                    return;
                }

                const inputData = e.inputBuffer.getChannelData(0);
                const currentSampleRate = e.inputBuffer.sampleRate;

                let sum = 0;
                for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
                const rms = Math.sqrt(sum / inputData.length);

                setUserVolume(rms);

                const activeThreshold = isAiSpeakingRef.current
                    ? config.micThreshold * 12.0
                    : config.micThreshold;

                const isGateOpen = rms > activeThreshold;

                frameCount++;
                if (frameCount % 10 === 0) {
                    setDebugRms(rms);
                    setDebugThreshold(activeThreshold);
                    setDebugGateOpen(isGateOpen);
                }

                if (isGateOpen) {
                    client.sendAudioChunk(inputData, currentSampleRate);
                    setIsMicInputDetected(true);
                    setIsLiveThinking(false);
                    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                    silenceTimerRef.current = setTimeout(() => setIsMicInputDetected(false), 500);
                    if (liveThinkingTimerRef.current) clearTimeout(liveThinkingTimerRef.current);
                } else {
                    const silenceBuffer = new Float32Array(inputData.length);
                    client.sendAudioChunk(silenceBuffer, currentSampleRate);
                }

                if (!isAiSpeakingRef.current && !isLiveThinkingRef.current && isListeningRef.current && !isGateOpen) {
                    if (!liveThinkingTimerRef.current) {
                        liveThinkingTimerRef.current = setTimeout(() => {
                            if (!isAiSpeakingRef.current) {
                                setIsLiveThinking(true);
                            }
                            liveThinkingTimerRef.current = null;
                        }, 1500);
                    }
                }
            };

            source.connect(processor);
            
            // [FIX] Guard: Final check before connecting to destination (Cast to any for TS compatibility)
            if ((ctx.state as any) !== 'closed') {
                processor.connect(ctx.destination);
            }

        } catch (e: any) {
            console.error("Mic Stream Error:", e);
            stopLiveSession();
            throw e; // [FIX] Re-throw to inform startLiveSession of failure
        }
    }, [stopLiveSession, showToast]);

    const handleLiveTranscript = useCallback((text: string, isModel: boolean) => {
        if (!isModel) {
            const lowerText = text.trim().toLowerCase();
            const isStopCommand = STOP_KEYWORDS.some(k => lowerText.includes(k));
            if (isStopCommand) {
                stopAudio();
                if (liveClientRef.current) liveClientRef.current.sendText(" ");
            }
        }
    }, []);

    const startLiveSession = useCallback(async () => {
        if (isOnline && isConnectingSessionRef.current) return;
        isConnectingSessionRef.current = true;
        setIsMicChecking(true);

        try {
            stopLiveSession();
            const client = new LiveClient();
            liveClientRef.current = client;
            
            setIsListening(true, 'startLiveSession');
            await client.connect(
                (base64PCM) => {
                    // Instance check
                    if (liveClientRef.current !== client) return;
                    setIsAiSpeaking(true, 'LiveClient.onAudioData');
                    setIsLiveThinking(false);
                    playPCMChunk(base64PCM);
                },
                (err: any) => {
                    // [CRITICAL FIX] Instance Guard: Only stop if this is the ACTIVE client.
                    if (liveClientRef.current !== client) {
                        console.log("[LiveClient] Ignoring disconnect from stale session");
                        return;
                    }
                    
                    const code = err?.code || 'Unknown';
                    const reason = err?.reason || 'No reason';
                    console.error(`[LiveClient] Disconnected. Code: ${code}, Reason: ${reason}`, err);

                    setIsListening(false, 'LiveClient.onDisconnect');
                    setIsAiSpeaking(false, 'LiveClient.onDisconnect');
                    setIsLiveThinking(false);
                    
                    showToast(`Live 연결 종료 (${code})`, 'error');
                    stopLiveSession();
                },
                handleLiveTranscript
            );
            try {
                await startLiveAudioStream(client);
                console.log("[LiveSession] Stream started, showing success toast");
                showToast("Live 세션이 연결되었습니다. 말씀하세요.");
            } catch (micErr: any) {
                console.warn("Initial mic capture failed:", micErr);
                showToast("마이크를 사용할 수 없습니다. 대화를 위해 마이크 권한을 허용해 주세요.", 'info');
            }

            // 백그라운드에서 초기 인사 지시 전송 (웹소켓 연결 및 준비 시간을 위해 충분한 지연 추가)
            setTimeout(() => {
                if (liveClientRef.current) {
                    liveClientRef.current.sendText('사용자가 접속했습니다. "안녕하세요 마지입니다. 무엇을 함께 할까요"라고 친절하게 인사해주세요.');
                }
            }, 2000);
        } catch (e: any) {
            console.error("Live Session Start Error:", e);
            showToast("Live 연결 실패: " + (e.message || "서버 응답 없음"), 'error');
            stopLiveSession();
        } finally {
            isConnectingSessionRef.current = false;
            setIsMicChecking(false);
        }
    }, [isOnline, stopLiveSession, startLiveAudioStream, handleLiveTranscript]);

    const checkMicPermission = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showToast("마이크 접근이 지원되지 않는 브라우저입니다.", 'error');
            return false;
        }
        try {
            // 브라우저 정책으로 인해 자동 시작 시 차단될 수 있으므로 짧은 타임아웃 처리
            const stream = await Promise.race([
                navigator.mediaDevices.getUserMedia({ audio: true }),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3000))
            ]) as MediaStream;

            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (e: any) {
            console.warn("Mic Permission Check Error:", e);
            if (e.message === "Timeout") {
                // 타임아웃은 보통 사용자가 팝업을 못 봤거나 브라우저가 막은 경우
                return false;
            }
            if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
                showToast("마이크 권한이 거부된 상태입니다. 주소창 설정을 확인해 주세요.", 'error');
            }
            return false;
        }
    };

    useEffect(() => {
        if (hasAutoStartedRef.current) return;
        hasAutoStartedRef.current = true;

        // [MOD] Removed auto-activation of mic to prevent browser state conflicts.
        // Only show greeting on start.
        showToast("안녕하세요🎵 마지입니다. 무엇을 함께 할까요?", 'info');
    }, []);

    const startRecognitionSafe = useCallback(() => {
        if (!recognitionRef.current) return;
        try { recognitionRef.current.start(); } catch (e) { }
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'ko-KR';
            recognitionRef.current = recognition;
            recognition.onstart = () => { 
                if (aiModelRef.current === 'standard') setIsListening(true, 'Recognition.onstart'); 
            };
            recognition.onend = () => {
                // [FIX] Double guard: only act if we are STILL in standard mode
                if (aiModel === 'standard' && aiModelRef.current === 'standard') {
                    setIsListening(false, 'Recognition.onend');
                    setIsMicInputDetected(false);
                    if ((isContinuousModeRef.current || isWakeWordModeRef.current) && !isAiSpeakingRef.current) {
                        setTimeout(() => { 
                            if (aiModelRef.current === 'standard') {
                                try { recognition.start(); } catch (e) { } 
                            }
                        }, 1000);
                    }
                }
            };
            recognition.onresult = (event: any) => {
                const result = event.results[event.results.length - 1];
                const transcript = result[0].transcript;
                if (result.isFinal) {
                    if (isWakeWordModeRef.current) {
                        if (WAKE_WORD_REGEX.test(transcript)) {
                            if (!wakeWordLockRef.current) {
                                wakeWordLockRef.current = true;
                                playWakeSound();
                                showToast("네, 듣고 있습니다.");
                                setIsConversationMode(true);
                                setIsTTSActive(true);
                                setTimeout(() => { wakeWordLockRef.current = false; }, 2000);
                            }
                        } else if (isConversationMode) handleSendMessageRef.current(transcript);
                    } else if (transcript.trim()) handleSendMessageRef.current(transcript);
                }
                if (transcript) {
                    setIsMicInputDetected(true);
                    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                    silenceTimerRef.current = setTimeout(() => setIsMicInputDetected(false), 500);
                }
            };
            recognition.onerror = (event: any) => {
                // [FIX] Guard: ignore errors if not in standard mode
                if (aiModelRef.current !== 'standard') return;
                
                if (event.error === 'not-allowed') {
                    setIsListening(false, 'Recognition.onerror');
                    showToast("마이크 권한이 차단되었습니다.", 'error');
                }
            };
        }
    }, [showToast]);

    const toggleListening = async () => {
        // [FIX] Explicitly resume AudioContext to bypass browser auto-play restrictions
        await initAudioContext();
        if (liveAudioContextRef.current && liveAudioContextRef.current.state === 'suspended') {
            await liveAudioContextRef.current.resume();
        }

        if (aiModel === 'live') {
            if (isListening) {
                stopLiveSession();
            } else {
                const hasPermission = await checkMicPermission();
                if (hasPermission) {
                    // startLiveSession internally sets isMicChecking
                    await startLiveSession();
                }
            }
            return;
        }
        if (isListening) {
            setIsContinuousMode(false);
            setIsWakeWordMode(false);
            try { recognitionRef.current?.stop(); } catch (e) { }
        } else {
            const hasPermission = await checkMicPermission();
            if (hasPermission) startRecognitionSafe();
        }
    };

    const playTTS = useCallback(async (text: string, messageId: string) => {
        if (isAudioLoading) return;
        stopAudio();
        setPlayingMessageId(messageId);

        // 1. Browser Native TTS Engine (v2.22)
        if (audioSettings.ttsEngine === 'browser') {
            if (typeof window !== 'undefined' && window.speechSynthesis) {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'ko-KR';
                utterance.rate = 1.0;
                utterance.pitch = 1.0;
                utterance.onstart = () => setIsAiSpeaking(true, 'browser-tts-start');
                utterance.onend = () => {
                    setIsAiSpeaking(false, 'browser-tts-end');
                    setPlayingMessageId(null);
                };
                utterance.onerror = () => {
                    setIsAiSpeaking(false, 'browser-tts-error');
                    setPlayingMessageId(null);
                };
                window.speechSynthesis.speak(utterance);
            }
            return;
        }

        // 2. Gemini API TTS Engine (High Quality)
        const targetMsg = messages.find(m => m.id === messageId);
        if (targetMsg && targetMsg.audioData) {
            enqueueAudio(targetMsg.audioData);
            return;
        }
        setIsAudioLoading(true);
        try {
            const audioData = await generateSpeech(text, currentVoice);
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, audioData: audioData } : m));
            enqueueAudio(audioData);
        } catch (e: any) {
            showToast("음성 생성 실패: " + e.message, 'error');
            setPlayingMessageId(null);
        } finally {
            setIsAudioLoading(false);
        }
    }, [audioSettings.ttsEngine, currentVoice, isAudioLoading, messages, showToast, setIsAiSpeaking]);

    const handleManualPlay = (text: string, id: string) => playTTS(text, id);
    const handleManualStop = () => {
        stopAudio();
        setPlayingMessageId(null);
    };

    const handleDownloadAudio = useCallback((text: string, id: string) => {
        const targetMsg = messages.find(m => m.id === id);
        if (targetMsg && targetMsg.audioData) {
            downloadWav(targetMsg.audioData, `mazi-audio-${id}.wav`);
            showToast("음성 파일을 다운로드했습니다.");
        } else showToast("먼저 재생 버튼을 눌러 음성을 생성해주세요.", 'error');
    }, [messages, showToast]);

    const toggleTTS = () => {
        const newState = !isTTSActive;
        setIsTTSActive(newState);
        if (!newState) stopAudio();
        showToast(newState ? "음성 답변 ON" : "음성 답변 OFF");
    };

    const handleSendMessage = async (text: string = inputValue, displayText?: string) => {
        if (!text.trim()) return;
        if (cooldownSeconds > 0) {
            showToast(`사용량 초과로 인해 ${cooldownSeconds}초 대기 중입니다.`, 'error');
            return;
        }
        stopAudio();
        if (aiModel === 'live') {
            if (!liveClientRef.current) {
                showToast("Live 세션이 연결되지 않았습니다.", 'error');
                return;
            }
            liveClientRef.current.sendText(text);
            setInputValue('');
            return;
        }
        const finalDisplayText = displayText || text;
        const userMsgId = Date.now().toString();
        const userMsg: Message = { id: userMsgId, role: 'user', text: finalDisplayText, timestamp: new Date() };
        setMessages(prev => {
            const newMsgs = [...prev, userMsg];
            updateCurrentSessionHistory(newMsgs);
            return newMsgs;
        });
        setInputValue('');
        setIsLoading(true);
        isLoadingRef.current = true;
        const aiMsgId = (Date.now() + 1).toString();
        const aiMsg: Message = { id: aiMsgId, role: 'model', text: '', timestamp: new Date(), isStreaming: true };
        setMessages(prev => [...prev, aiMsg]);
        try {
            if (!currentSessionIdRef.current) {
                const newId = createNewSession();
                setCurrentSessionId(newId);
            }
            let accumulatedText = "";
            await sendMessageStream(text, (chunkText, sources) => {
                accumulatedText = chunkText;
                setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: chunkText, sources: sources || m.sources } : m));
            });
            setMessages(prev => {
                const newMsgs = prev.map(m => m.id === aiMsgId ? { ...m, isStreaming: false } : m);
                updateCurrentSessionHistory(newMsgs);
                return newMsgs;
            });
            if (isTTSActiveRef.current) playTTS(accumulatedText, aiMsgId);
        } catch (error: any) {
            showToast(error.message || "메시지 전송 실패", 'error');
            setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, isStreaming: false, text: m.text + "\n[오류 발생]" } : m));
        } finally {
            setIsLoading(false);
            isLoadingRef.current = false;
        }
    };

    useEffect(() => { handleSendMessageRef.current = handleSendMessage; }, [handleSendMessage]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const createNewSession = (initialTitle: string = "새로운 대화") => {
        const newSession: ChatSession = {
            id: Date.now().toString(),
            title: initialTitle,
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            pinned: false
        };
        if (isHistoryEnabled) setSessions(prev => [newSession, ...prev]);
        setCurrentSessionId(newSession.id);
        return newSession.id;
    };

    const startNewAudioSession = () => {
        audioSessionIdRef.current += 1;
        clearAudioQueue();
        stopAudio();
        setIsAudioLoading(false);
        setPlayingMessageId(null);
        setTtsStatus('idle');
        ttsQueueRef.current = [];
        isGeneratingTTS.current = false;
    };

    const handleFactoryReset = async () => {
        localStorage.clear();
        startNewAudioSession();
        await resetAudioContext();
        stopLiveSession();
        setSmartTVMode(false);
        setSessions([]);
        setCurrentSessionId(null);
        setMessages([]);
        setInputValue('');
        setIsTTSActive(false);
        setIsListening(false);
        setIsContinuousMode(false);
        setIsHistoryEnabled(true);
        setCurrentVoice('Kore');
        setActiveServiceCategoryId(null);
        setIsDrillMode(false);
        setIsWakeWordMode(false);
        setIsConversationMode(false);
        setAiModel('live');
        setActiveLivePersonaId('standard_gen');
        setIsSmartTVMode(false);
        setAudioSettings({
            outputSampleRate: 24000,
            inputSampleRate: 16000,
            outputVolume: 1.0,
            digitalLimiter: true,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            micThreshold: 0.01,
            visualizerType: 'circle',
            showDebugInfo: true,
            ttsEngine: 'gemini'
        });
        const isInit = initializeChat();
        if (!isInit) setIsConfigError(true);
        else setIsConfigError(false);
        showToast("앱이 초기화되었습니다. Live 모드로 시작합니다.");
        setIsSettingsOpen(false);
        setTimeout(() => startLiveSession(), 1000);
        setIsSidebarOpen(true);
    };

    const handleNewChat = async () => {
        if (cooldownSeconds > 0) return;
        startNewAudioSession();
        await resetAudioContext();
        stopLiveSession();
        setMessages([]);
        setCurrentSessionId(null);
        setIsAiSpeaking(false);
        setActiveServiceCategoryId(null);
        setIsDrillMode(false);
        initializeChat();
    };

    const handleSelectSession = async (sessionId: string) => {
        if (aiModel === 'live') handleAiModelChange('standard');
        startNewAudioSession();
        await resetAudioContext();
        stopLiveSession();
        const session = sessions.find(s => s.id === sessionId);
        if (session) {
            setMessages(session.messages);
            setCurrentSessionId(sessionId);
            setIsAiSpeaking(false);
            setActiveServiceCategoryId(null);
            setIsDrillMode(false);
            initializeChat();
        }
    };

    const handleDeleteSession = (sessionId: string) => {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        if (currentSessionId === sessionId) handleNewChat();
    };

    const handleRenameSession = (sessionId: string, newTitle: string) => {
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: newTitle } : s));
    };

    const handleTogglePin = (sessionId: string) => {
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, pinned: !s.pinned } : s));
    };

    const handleImportSessions = (importedSessions: ChatSession[]) => {
        setSessions(prev => {
            const currentIds = new Set(prev.map(s => s.id));
            const newSessions = importedSessions.filter(s => !currentIds.has(s.id));
            if (newSessions.length === 0) {
                showToast("추가할 새로운 대화 기록이 없습니다.", 'info');
                return prev;
            }
            const merged = [...newSessions, ...prev].sort((a, b) => b.updatedAt - a.updatedAt);
            if (isHistoryEnabled) localStorage.setItem('chatSessions', JSON.stringify(merged));
            return merged;
        });
        showToast("대화 기록을 성공적으로 불러왔습니다.");
    };

    const handleSelectServiceCategory = (categoryId: string) => {
        if (aiModel === 'live') {
            showToast("서브 메뉴는 일반 모드에서만 사용 가능합니다", 'info');
            return;
        }
        setActiveServiceCategoryId(categoryId);
        setIsServiceMenuMinimized(false);
    };

    const handleServiceItemSelect = (item: ServiceItem) => {
        if (cooldownSeconds > 0) return;
        setIsServiceMenuMinimized(true);
        if (aiModel === 'live') handleAiModelChange('standard');
        if (activeServiceCategoryId === 'english' || activeServiceCategoryId === 'japanese') setIsDrillMode(true);
        else setIsDrillMode(false);
        if (!currentSessionIdRef.current) setCurrentSessionId(createNewSession(item.label));
        handleSendMessage(item.prompt, item.label);
    };

    const handleLivePersonaSelect = (id: string, command: string) => {
        if (!isListening && !isContinuousMode) {
            showToast("먼저 마이크 버튼을 눌러 Live 세션을 연결해주세요.", 'info');
            return;
        }
        if (liveClientRef.current) {
            liveClientRef.current.sendText(command);
            setActiveLivePersonaId(id);
            showToast(`'${LIVE_PERSONAS.find(p => p.id === id)?.label}' 모드로 전환했습니다.`);
            if (window.innerWidth < 768) setIsSidebarOpen(false);
        }
    };

    const handleCloseServiceMenu = () => { setActiveServiceCategoryId(null); setIsServiceMenuMinimized(false); };
    const handleRestoreServiceMenu = () => { setIsServiceMenuMinimized(false); };

    const toggleConversationMode = async () => {
        const newState = !isConversationMode;
        setIsConversationMode(newState);
        if (newState) {
            setIsTTSActive(true);
            await initAudioContext();
            showToast("🗣️ 대화 모드 ON: 짧고 자연스러운 대화 (TTS 자동 켜짐)");
        } else showToast("대화 모드 OFF");
    };

    const toggleWakeWordMode = async () => {
        const newState = !isWakeWordMode;
        if (newState) {
            const hasPermission = await checkMicPermission();
            if (!hasPermission) return;
            setIsWakeWordMode(true);
            if (aiModel === 'standard') { setIsTTSActive(false); setIsContinuousMode(true); }
            setIsListening(true);
            startNewAudioSession();
            await initAudioContext();
            wakeWordLockRef.current = false;
            try { recognitionRef.current?.start(); } catch (e) { }
            showToast("호출어 대기 중: '마지야'라고 불러주세요.");
        } else {
            setIsWakeWordMode(false);
            showToast("대기 모드 종료");
            if (isContinuousMode || aiModel === 'standard') {
                setIsContinuousMode(false);
                try { recognitionRef.current?.abort(); } catch (e) { }
            }
        }
    };

    const switchToStandard = () => {
        if (aiModel === 'standard' || liveToggleCooldown > 0) return;
        handleAiModelChange('standard');
        setLiveToggleCooldown(5);
    };

    const switchToLive = () => {
        if (aiModel === 'live' || liveToggleCooldown > 0) return;
        handleAiModelChange('live');
        setLiveToggleCooldown(5);
    };

    const handleAiModelChange = (model: AIModelType) => {
        // [CRITICAL] Synchronously update ref to avoid race conditions in callbacks
        aiModelRef.current = model;
        setAiModel(model);
        
        setIsContinuousMode(false);
        setIsListening(false);
        stopLiveSession();
        
        try { 
            recognitionRef.current?.abort(); 
        } catch (e) { }
        
        startNewAudioSession();
        setIsWakeWordMode(false);
        
        if (model === 'live') {
            // [FIX] Slightly longer delay to ensure hardware is released and state transition is complete
            setTimeout(() => startLiveSession(), 800);
        }
        showToast(`AI 엔진이 ${model === 'standard' ? 'Standard' : 'Live'} 모드로 변경되었습니다.`);
    };

    const handleSmartTVModeChange = async (enabled: boolean) => {
        setIsSmartTVMode(enabled);
        localStorage.setItem('isSmartTVMode', String(enabled));
        setAudioSettings(prev => ({ ...prev, outputSampleRate: enabled ? 48000 : 24000 }));
        setSmartTVMode(enabled);
        await resetAudioContext();
        showToast(`스마트 TV 모드가 ${enabled ? '켜졌습니다' : '꺼졌습니다'}.`);
    };

    return (
        <div className="flex h-screen bg-[#121212] text-gray-100 overflow-hidden font-sans">
            <Sidebar
                isOpen={isSidebarOpen}
                sessions={sessions}
                currentSessionId={currentSessionId}
                activeCategoryId={activeServiceCategoryId}
                onNewChat={handleNewChat}
                onSelectSession={handleSelectSession}
                onDeleteSession={handleDeleteSession}
                onRenameSession={handleRenameSession}
                onTogglePin={handleTogglePin}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onOpenEnglish={() => { }}
                onSelectServiceCategory={handleSelectServiceCategory}
                onClose={() => setIsSidebarOpen(false)}
                onImportSessions={handleImportSessions}
                aiModel={aiModel}
                activeLivePersonaId={activeLivePersonaId}
                onSelectLivePersona={handleLivePersonaSelect}
            />

            <div className="flex-1 flex flex-col h-full relative w-full">
                <header className="relative flex items-center justify-between px-4 py-2 bg-[#1e1e1e] border-b border-gray-800 shadow-md z-10 min-h-[50px]">
                    <div className="flex items-center gap-3 z-20">
                        {!isSidebarOpen && (
                            <button onClick={() => setIsSidebarOpen(true)} className="p-1.5 -ml-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-800 transition-colors">
                                <Menu size={18} />
                            </button>
                        )}
                        <div className="flex items-center gap-2">
                            <h1 className="text-sm md:text-base font-bold bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent flex items-center gap-2">
                                <Sparkles size={14} className="text-emerald-400" />
                                MAZI AI v2.23
                            </h1>
                        </div>
                    </div>
                    <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 flex items-center gap-1 bg-[#252525] rounded-full p-1 border border-gray-700">
                        <button onClick={switchToLive} disabled={liveToggleCooldown > 0} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-all duration-300 ${aiModel === 'live' ? 'bg-purple-900/40 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)] border border-purple-500 animate-pulse' : 'bg-transparent text-gray-500 hover:text-gray-300'} ${liveToggleCooldown > 0 ? 'cursor-not-allowed opacity-50' : ''}`}>
                            <Zap size={12} fill={aiModel === 'live' ? "currentColor" : "none"} />
                            LIVE 대화
                        </button>
                        <button onClick={switchToStandard} disabled={liveToggleCooldown > 0} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-all duration-300 ${aiModel === 'standard' ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm' : 'bg-transparent text-gray-500 hover:text-gray-300'} ${liveToggleCooldown > 0 ? 'cursor-not-allowed opacity-50' : ''}`}>
                            <MessageCircle size={12} fill={aiModel === 'standard' ? "currentColor" : "none"} />
                            Standard Mode
                        </button>
                    </div>
                    <div className="flex items-center gap-2 z-20">
                        {!isOnline && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-900/50 text-red-300 border border-red-500/30 flex items-center gap-1 animate-pulse"><WifiOff size={10} /></span>}
                        <button onClick={toggleWakeWordMode} disabled={!isOnline} className={`p-1.5 rounded-full transition-all duration-700 ${isWakeWordMode ? 'text-amber-400 bg-amber-900/10 animate-[pulse_3s_ease-in-out_infinite]' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`} title={isWakeWordMode ? "호출 대기 중 ('마지야')" : "호출어 모드 켜기"}>
                            <AudioLines size={16} fill={isWakeWordMode ? "currentColor" : "none"} />
                        </button>
                        {aiModel === 'standard' && (
                            <button onClick={toggleConversationMode} disabled={!isOnline} className={`p-1.5 rounded-full transition-all duration-300 ${isConversationMode ? 'bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,10,129,0.5)]' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`} title={isConversationMode ? "대화 모드 끄기" : "대화 모드 켜기"}>
                                <MessageCircle size={16} fill={isConversationMode ? "currentColor" : "none"} />
                            </button>
                        )}
                    </div>
                </header>

                {isConfigError && <div className="bg-red-900/20 border-b border-red-900/50 p-2 text-center text-xs text-red-200 flex items-center justify-center gap-2"><AlertCircle size={14} /><span>AI 엔진 초기화 실패. 설정에서 API 키를 입력하거나 서버 환경 변수(VITE_GEMINI_API_KEY)를 확인해주세요.</span></div>}
                {aiModel === 'live' && audioSettings.showDebugInfo && (
                    <DebugOverlay rms={debugRms} threshold={debugThreshold} isGateOpen={debugGateOpen} isAiSpeaking={isAiSpeaking} aecEnabled={audioSettings.echoCancellation} outputVolume={audioSettings.outputVolume} outputSampleRate={audioSettings.outputSampleRate} />
                )}

                 <main className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#121212] relative">
                    {isSidebarOpen && <div className="absolute inset-0 z-10 md:hidden bg-transparent" onClick={() => setIsSidebarOpen(false)} />}
                    
                    {/* Message list - rendered always to show greeting and history */}
                    <div className="max-w-4xl mx-auto flex flex-col min-h-full">
                        {messages.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 opacity-60 mt-10 md:mt-0">
                                <div className="mb-6"><MaziLogo /></div>
                                <span className="text-[10px] text-gray-500 font-medium">v2.23</span>
                                <p className="text-lg font-medium mb-2">좋은 시간 함께 해요</p>
                                <p className="text-sm text-center max-w-xs">다양한 작업을 도와드립니다</p>
                            </div>
                        ) : (
                            <>
                                {messages.map((msg) => (
                                    <MessageBubble key={msg.id} message={msg} isTTSActive={isTTSActive} isPlaying={playingMessageId === msg.id} isAudioLoading={playingMessageId === msg.id && isAudioLoading} ttsStatus={playingMessageId === msg.id ? ttsStatus : 'idle'} onPlay={handleManualPlay} onStop={handleManualStop} onDownload={handleDownloadAudio} />
                                ))}
                                {isLoading && <TypingIndicator />}
                                <div ref={messagesEndRef} className="h-4" />
                            </>
                        )}
                    </div>

                    {/* Live mode visualizer - overlays the message area when active */}
                    {aiModel === 'live' && (
                        <div className="absolute inset-0 p-4 pointer-events-none flex items-center justify-center z-10">
                            <div
                                className="w-full h-full pointer-events-auto cursor-pointer"
                                onClick={() => {
                                    if (isAiSpeaking || isLiveThinking) {
                                        stopAudio();
                                        if (liveClientRef.current) liveClientRef.current.sendText("그만해");
                                        showToast("대화를 중단합니다.");
                                    }
                                }}
                            >
                                <LiveVisualizer userVolume={userVolume} isAiSpeaking={isAiSpeaking} isThinking={isLiveThinking} visualizerType={audioSettings.visualizerType} />
                            </div>
                        </div>
                    )}
                </main>

                {activeServiceCategoryId && !isServiceMenuMinimized && (
                    <ServiceSubMenu activeCategoryId={activeServiceCategoryId} isLoading={isLoading || cooldownSeconds > 0} onSelect={handleServiceItemSelect} onClose={handleCloseServiceMenu} onMinimize={() => setIsServiceMenuMinimized(true)} />
                )}

                <div className="p-4 bg-[#1e1e1e] border-t border-gray-800 relative">
                    {activeServiceCategoryId && isServiceMenuMinimized && (
                        <div className="absolute -top-10 right-4 z-30 animate-in fade-in slide-in-from-bottom-2">
                            <button onClick={handleRestoreServiceMenu} className="flex items-center gap-2 px-3 py-2 bg-[#252525] hover:bg-[#333] border border-gray-600 rounded-full text-xs text-gray-300 shadow-lg transition-all active:scale-95" title="메뉴 다시 열기"><ChevronUp size={16} className="text-emerald-400" /><span>메뉴 펼치기</span></button>
                        </div>
                    )}
                    <div className="max-w-4xl mx-auto flex items-end gap-2">
                        <button onClick={toggleTTS} disabled={cooldownSeconds > 0 || aiModel === 'live' || !isOnline} className={`p-3 mb-1 rounded-full transition-all border ${isTTSActive || aiModel === 'live' ? 'bg-emerald-900/20 border-emerald-500/50 text-emerald-400' : 'bg-transparent border-transparent text-gray-500 hover:bg-gray-800'} ${cooldownSeconds > 0 || !isOnline ? 'opacity-50 cursor-not-allowed' : ''}`} title={aiModel === 'live' ? "Live 모드는 항상 켜져 있음" : "음성 답변 (TTS) 켜기/끄기"}>
                            {isTTSActive || aiModel === 'live' ? <Volume2 size={22} /> : <VolumeX size={22} />}
                        </button>
                        <div className={`flex-1 relative bg-[#2a2a2a] rounded-2xl border border-gray-700 flex items-end transition-colors ${cooldownSeconds > 0 || !isOnline ? 'opacity-50' : (aiModel === 'live' ? 'focus-within:border-purple-500/50' : 'focus-within:border-emerald-500/50')}`}>
                            <button onClick={toggleListening} disabled={cooldownSeconds > 0 || isMicChecking || !isOnline} className={`p-2 ml-1 my-1 rounded-xl transition-all flex items-center gap-1 ${(isListening || isContinuousMode) ? (aiModel === 'live' ? 'bg-purple-500/20 text-purple-400 animate-pulse' : (isWakeWordMode ? 'text-gray-100 hover:bg-gray-700' : 'bg-red-500/20 text-red-500 animate-pulse')) : 'text-gray-400 hover:text-white hover:bg-gray-700'} ${cooldownSeconds > 0 || !isOnline ? 'cursor-not-allowed' : ''}`}>
                                <div className={`w-3 h-3 rounded-full mr-2 transition-all duration-200 ${isMicInputDetected ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,1)] animate-pulse' : 'bg-gray-700'}`} title={isMicInputDetected ? "소리 감지됨" : "소리 없음"} />
                                {isMicChecking ? <Loader2 size={20} className="animate-spin text-gray-400" /> : ((isListening || isContinuousMode) ? <Mic size={20} /> : <MicOff size={20} />)}
                            </button>
                            <textarea ref={inputRef} value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} placeholder={!isOnline ? "인터넷 연결이 오프라인입니다." : cooldownSeconds > 0 ? `서비스 사용량 초과. ${cooldownSeconds}초 후 이용 가능합니다.` : (isMicChecking ? "오디오 연결 중..." : (aiModel === 'live' ? (isListening ? "듣고 있습니다... (말씀하세요)" : "마이크 버튼을 눌러 연결하세요") : (isContinuousMode ? (isWakeWordMode ? "'마지야'라고 불러보세요..." : "말씀해 주세요...") : "메시지를 입력하세요...")))} className="flex-1 bg-transparent border-none text-white p-3 max-h-32 min-h-[48px] resize-none focus:ring-0 custom-scrollbar text-base disabled:cursor-not-allowed" rows={1} disabled={(isContinuousMode && isListening && !isWakeWordMode) || cooldownSeconds > 0 || isMicChecking || aiModel === 'live' || !isOnline} />
                        </div>
                        <button onClick={() => handleSendMessage()} disabled={!inputValue.trim() || isLoading || cooldownSeconds > 0 || aiModel === 'live' || !isOnline} className={`p-3 mb-1 rounded-full shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[44px] ${cooldownSeconds > 0 || !isOnline ? 'bg-gray-700 text-gray-400' : (aiModel === 'live' ? 'bg-gray-700 text-gray-400' : 'bg-emerald-600 text-white hover:bg-emerald-500')}`} title={aiModel === 'live' ? "Live 모드는 음성만 지원합니다" : "전송"}>
                            {cooldownSeconds > 0 ? <span className="text-xs font-bold font-mono">{cooldownSeconds}</span> : <Send size={20} />}
                        </button>
                    </div>
                </div>
                {toast && <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg shadow-xl border text-sm animate-in fade-in slide-in-from-top-2 z-50 ${toast.type === 'error' ? 'bg-red-900/90 border-red-800 text-white' : 'bg-gray-800/90 border-gray-700 text-white'}`}>{toast.message}</div>}
                <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} selectedVoice={currentVoice} onVoiceChange={setCurrentVoice} isHistoryEnabled={isHistoryEnabled} onHistoryEnabledChange={setIsHistoryEnabled} apiKey={userApiKey} onApiKeyChange={setUserApiKeyLocal} aiModel={aiModel} onAiModelChange={handleAiModelChange} audioSettings={audioSettings} onAudioSettingsChange={setAudioSettings} />
            </div>
        </div>
    );
};

export default App;
