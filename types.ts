
export interface Source {
  title?: string;
  uri: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isStreaming?: boolean;
  sources?: Source[];
  audioData?: string; // Base64 PCM data for caching & download
  type?: 'welcome' | 'warning';
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
}

export type VisualizerType = 'bar' | 'line' | 'circle' | 'cloud' | 'fog';

export interface AudioSettings {
  outputSampleRate: 24000 | 48000; // 24k (Gemini Native) vs 48k (TV Standard)
  inputSampleRate: 16000;
  outputVolume: number; // 0.1 to 3.0 (Digital Gain)
  digitalLimiter: boolean; // v1.9.3 New: Digital Distortion Prevention
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  micThreshold: number; // 0.005 (Sensitive) ~ 0.05 (Loud env)
  visualizerType: VisualizerType;
  showDebugInfo: boolean; // v1.9.0 New: Toggle debug overlay
  ttsEngine: 'gemini' | 'browser'; // v2.24 New: Choose between high-quality API and fast Browser TTS
  browserTtsLang: 'ko-KR' | 'en-US'; // v2.25 New: Choose language for browser-native TTS
}
