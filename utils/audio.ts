
export function base64ToUint8Array(base64: string): Uint8Array {
  try {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    // Ensure byte length is even for Int16 conversion to prevent offsets
    if (bytes.length % 2 !== 0) {
        return bytes.slice(0, bytes.length - 1);
    }
    return bytes;
  } catch (e) {
    console.error("Base64 decoding failed:", e);
    return new Uint8Array(0);
  }
}

// --- WAV FILE GENERATION ---
const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

export const createWavBlob = (base64PCM: string, sampleRate: number = 24000): Blob | null => {
  try {
    const pcmBytes = base64ToUint8Array(base64PCM);
    const numChannels = 1; 
    const bitsPerSample = 16;
    
    // WAV Header is 44 bytes
    const wavHeaderSize = 44;
    const totalFileSize = wavHeaderSize + pcmBytes.length;
    
    const buffer = new ArrayBuffer(totalFileSize);
    const view = new DataView(buffer);
    
    // 1. RIFF Chunk Descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, totalFileSize - 8, true); // File size - 8
    writeString(view, 8, 'WAVE');
    
    // 2. fmt Sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Sub-chunk size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
    view.setUint16(22, numChannels, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true); // ByteRate
    view.setUint16(32, numChannels * (bitsPerSample / 8), true); // BlockAlign
    view.setUint16(34, bitsPerSample, true); // BitsPerSample
    
    // 3. data Sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, pcmBytes.length, true); // Sub-chunk 2 size
    
    // 4. Write PCM Data
    const wavBytes = new Uint8Array(buffer);
    wavBytes.set(pcmBytes, 44);
    
    return new Blob([buffer], { type: 'audio/wav' });
  } catch (e) {
    console.error("Failed to create WAV blob", e);
    return null;
  }
};

export const downloadWav = (base64PCM: string, filename: string = 'audio.wav') => {
    const blob = createWavBlob(base64PCM, 24000); // Gemini TTS is 24kHz
    if (!blob) return;
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
};

let audioContext: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;
let analyser: AnalyserNode | null = null; // Visualizer Analyser
let limiter: DynamicsCompressorNode | null = null; // Digital Limiter

// Track all active PCM sources for immediate cancellation
const activePCMSources = new Set<AudioBufferSourceNode>();

// Global Audio Config State
let globalOutputSampleRate = 24000;
let globalOutputVolume = 1.0; // Default Gain (1.0 = 100%)
let isLimiterEnabled = true; // Global limiter toggle

export const setGlobalOutputSampleRate = (rate: 24000 | 48000) => {
    // Only update if changed
    if (globalOutputSampleRate !== rate) {
        console.log(`[Audio Config] Output Sample Rate changed: ${globalOutputSampleRate} -> ${rate}`);
        globalOutputSampleRate = rate;
    }
};

export const setGlobalOutputVolume = (volume: number) => {
    globalOutputVolume = volume;
};

export const setDigitalLimiterEnabled = (enabled: boolean) => {
    isLimiterEnabled = enabled;
    if (limiter) {
        const now = audioContext?.currentTime || 0;
        if (enabled) {
            // Apply limiting parameters
            limiter.threshold.setValueAtTime(-1.0, now);
            limiter.knee.setValueAtTime(40, now);
            limiter.ratio.setValueAtTime(12, now);
            limiter.attack.setValueAtTime(0, now);
            limiter.release.setValueAtTime(0.25, now);
        } else {
            // Make limiter transparent
            limiter.threshold.setValueAtTime(0, now);
            limiter.ratio.setValueAtTime(1, now);
        }
    }
};

export const setSmartTVMode = (enabled: boolean) => {
    setGlobalOutputSampleRate(enabled ? 48000 : 24000);
};

// Simple string queue
export interface AudioTask {
    type: 'audio' | 'silence';
    data?: string;     // for audio (base64)
    duration?: number; // for silence (ms)
    rate?: number;     // playback rate (0.5 ~ 2.0)
    isPCM?: boolean;   // true if data is raw PCM base64
}

let audioQueue: AudioTask[] = [];
let isPlaying = false;
let isProcessingNext = false; 
let onPlayStateChange: ((isPlaying: boolean) => void) | null = null;
let onAudioError: ((error: string) => void) | null = null;

// PCM Streaming state
let nextPCMStartTime = 0;

// --- PCM BATCHING STATE (v1.7.5 Optimization) ---
let pcmBufferQueue: Uint8Array[] = [];
let pcmBufferLengthBytes = 0;
let pcmFlushTimer: ReturnType<typeof setTimeout> | null = null;
const PCM_BATCH_THRESHOLD = 6400; 

export const setPlayStateCallback = (callback: (isPlaying: boolean) => void) => {
  onPlayStateChange = callback;
};

export const setAudioErrorCallback = (callback: (error: string) => void) => {
  onAudioError = callback;
};

// Initialize or get AudioContext with dynamic Sample Rate
export const getAudioContext = async (targetSampleRate?: number) => {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  
  const rate = targetSampleRate || globalOutputSampleRate;

  if (audioContext) {
      if (audioContext.sampleRate !== rate && audioContext.state !== 'closed') {
          console.log(`[AudioContext] Switching SampleRate: ${audioContext.sampleRate} -> ${rate}`);
          try {
              await audioContext.close();
          } catch(e) {
              console.warn("Error closing old context", e);
          }
          audioContext = null;
          analyser = null;
          limiter = null;
      }
  }
  
  if (!audioContext) {
    const config: AudioContextOptions = {
        sampleRate: rate,
        latencyHint: 'interactive' 
    };
    
    try {
        audioContext = new AudioContextClass(config);
    } catch (e) {
        audioContext = new AudioContextClass(); 
    }
    
    // Setup Limiter
    limiter = audioContext.createDynamicsCompressor();
    setDigitalLimiterEnabled(isLimiterEnabled); // Apply initial state
    
    // Setup Analyser
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024; 
    analyser.smoothingTimeConstant = 0.5;

    // Graph: Limiter -> Analyser -> Destination
    limiter.connect(analyser);
    analyser.connect(audioContext.destination);
  }
  return audioContext;
};

export const getAudioContextState = () => {
  return audioContext?.state || 'none';
};

// Audio Test Function
export const runAudioTest = async (type: 'sine' | 'pulse' = 'sine', forceSampleRate?: number) => {
    try {
        const ctx = await getAudioContext(forceSampleRate);
        if (ctx.state === 'suspended') await ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const masterGain = ctx.createGain();
        masterGain.gain.value = globalOutputVolume;

        osc.connect(gain);
        gain.connect(masterGain);
        
        // Connect through Limiter if available
        if (limiter) masterGain.connect(limiter);
        else masterGain.connect(ctx.destination);

        const now = ctx.currentTime;

        if (type === 'sine') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.5);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.5, now + 0.1);
            gain.gain.linearRampToValueAtTime(0, now + 0.5);
            
            osc.start(now);
            osc.stop(now + 0.5);
        } else {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(1500, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.4);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.8, now + 0.02); 
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

            osc.start(now);
            osc.stop(now + 0.45);
        }
        return true;
    } catch (e) {
        console.error("Audio Test Failed:", e);
        return false;
    }
};

// Get Visualization Data
export const getAudioVisualData = (): Uint8Array | null => {
    if (!analyser) return null;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    return dataArray;
};

export const getAudioWaveformData = (): Uint8Array | null => {
    if (!analyser) return null;
    const dataArray = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(dataArray);
    return dataArray;
};

export const initAudioContext = async () => {
    try {
        const ctx = await getAudioContext();
        if (ctx) {
            if (ctx.state === 'suspended') {
                await ctx.resume();
            }
            const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            source.start(0);
        }
    } catch (e) {
        console.error("Audio warm-up failed", e);
    }
}

export const playWakeSound = async () => {
  try {
    const ctx = await getAudioContext();
    if (!ctx) return;
    
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const masterGain = ctx.createGain();
    masterGain.gain.value = globalOutputVolume;

    oscillator.connect(gainNode);
    gainNode.connect(masterGain);
    
    // Connect through limiter
    if (limiter) masterGain.connect(limiter);
    else masterGain.connect(ctx.destination);
    
    const now = ctx.currentTime;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.setValueAtTime(1320, now + 0.05);
    
    gainNode.gain.setValueAtTime(3.0, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    
    oscillator.start(now);
    oscillator.stop(now + 0.2);
  } catch (e) {
    console.error("Failed to play wake sound", e);
  }
};

const waitForAudioContextRunning = async (ctx: AudioContext, timeoutMs = 2000): Promise<boolean> => {
  if ((ctx.state as any) === 'running') return true;
  const startTime = Date.now();
  try { await ctx.resume(); } catch(e) {}
  while ((ctx.state as any) !== 'running') {
      if (Date.now() - startTime > timeoutMs) return false;
      try { await ctx.resume(); } catch(e) {}
      await new Promise(resolve => setTimeout(resolve, 100)); 
  }
  return true;
};

export const resetAudioContext = async () => {
  try {
    stopAudio();
    clearAudioQueue();
    if (audioContext) {
      try {
        await audioContext.close();
      } catch (e) { /* ignore */ }
      audioContext = null;
      analyser = null;
      limiter = null;
    }
  } catch (e) {
    console.error("Failed to reset audio context:", e);
  }
};

const setPlayingState = (state: boolean) => {
  if (isPlaying !== state) {
    isPlaying = state;
    if (onPlayStateChange) {
      onPlayStateChange(state);
    }
  }
};

export const isAudioPlaying = () => {
  return isPlaying;
};

export const stopAudio = () => {
  if (currentSource) {
    try {
      currentSource.stop();
      currentSource.disconnect();
    } catch (e) { /* ignore */ }
    currentSource = null;
  }

  activePCMSources.forEach(source => {
      try {
          source.stop();
          source.disconnect();
      } catch(e) { /* ignore */ }
  });
  activePCMSources.clear();

  // Clear batching buffers
  pcmBufferQueue = [];
  pcmBufferLengthBytes = 0;
  if (pcmFlushTimer) {
      clearTimeout(pcmFlushTimer);
      pcmFlushTimer = null;
  }

  setPlayingState(false);
  isProcessingNext = false;
  nextPCMStartTime = 0;
};

export const clearAudioQueue = () => {
  audioQueue = [];
  stopAudio();
};

export const enqueueSilence = (durationMs: number) => {
    audioQueue.push({ type: 'silence', duration: durationMs });
    if (!isPlaying && !isProcessingNext) {
        playNext();
    }
}

export const enqueueAudio = (base64Data: string, playbackRate: number = 1.0) => {
  audioQueue.push({ type: 'audio', data: base64Data, rate: playbackRate });
  if (!isPlaying && !isProcessingNext) {
    playNext();
  }
};

const playNext = async () => {
  if (audioQueue.length === 0) {
    setPlayingState(false);
    isProcessingNext = false;
    return;
  }

  if (isProcessingNext) return;
  isProcessingNext = true;

  const task = audioQueue[0];

  try {
    const ctx = await getAudioContext();
    if (!ctx) throw new Error("AudioContext not available");

    const isRunning = await waitForAudioContextRunning(ctx, 1500); 

    if (!isRunning) {
         throw new Error("오디오 장치를 시작할 수 없습니다.");
    }

    if (audioQueue.length === 0) {
        setPlayingState(false);
        isProcessingNext = false;
        return;
    }

    audioQueue.shift();
    
    if (task.type === 'silence') {
        setPlayingState(true); 
        setTimeout(() => {
            isProcessingNext = false;
            playNext();
        }, task.duration || 500);
        return;
    }

    const base64Audio = task.data || "";
    const bytes = base64ToUint8Array(base64Audio);
    
    if (bytes.length === 0) {
        isProcessingNext = false;
        playNext();
        return;
    }

    const dataInt16 = new Int16Array(bytes.buffer);
    const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    
    for (let i = 0; i < dataInt16.length; i++) {
      channelData[i] = (dataInt16[i] / 32768.0) * 0.8;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    
    const gainNode = ctx.createGain();
    source.connect(gainNode);
    
    // Connect Gain -> Limiter (if exists) -> Analyser (if exists) -> Destination
    if (limiter) gainNode.connect(limiter);
    else if (analyser) gainNode.connect(analyser);
    else gainNode.connect(ctx.destination);
    
    if (task.rate && task.rate !== 1.0) {
        source.playbackRate.value = task.rate;
    }

    const startTime = ctx.currentTime + 0.05; 
    const duration = buffer.duration;
    
    gainNode.gain.cancelScheduledValues(startTime);
    gainNode.gain.setValueAtTime(0, startTime);
    
    const attackTime = 0.05;
    gainNode.gain.linearRampToValueAtTime(globalOutputVolume, startTime + attackTime);
    
    const releaseTime = 0.05;
    if (duration > (attackTime + releaseTime)) {
        gainNode.gain.setValueAtTime(globalOutputVolume, startTime + duration - releaseTime);
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
    } else {
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
    }

    source.onended = () => {
      if (currentSource === source) {
         currentSource = null;
      }
      isProcessingNext = false;
      playNext(); 
    };

    currentSource = source;
    source.start(startTime);
    setPlayingState(true); 

  } catch (error: any) {
    console.error("Error playing audio chunk:", error);
    setPlayingState(false);
    isProcessingNext = false;
    audioQueue = []; 
    if (onAudioError) onAudioError(error.message || "오디오 재생 오류");
  }
};

// --- PCM STREAMING HELPERS for LIVE API ---

export const playPCMChunk = async (base64PCM: string, sampleRate = 24000) => {
    const bytes = base64ToUint8Array(base64PCM);
    if (bytes.length === 0) return;

    pcmBufferQueue.push(bytes);
    pcmBufferLengthBytes += bytes.length;

    if (pcmFlushTimer) {
        clearTimeout(pcmFlushTimer);
        pcmFlushTimer = null;
    }

    if (pcmBufferLengthBytes >= PCM_BATCH_THRESHOLD) {
        await processAndPlayBatch(sampleRate);
    } else {
        pcmFlushTimer = setTimeout(() => {
            processAndPlayBatch(sampleRate);
        }, 40);
    }
};

const processAndPlayBatch = async (sampleRate: number) => {
    if (pcmBufferQueue.length === 0) return;

    try {
        const ctx = await getAudioContext(); 
        if (!ctx) return;
        if (ctx.state === 'suspended') await ctx.resume();

        const mergedBytes = new Uint8Array(pcmBufferLengthBytes);
        let offset = 0;
        for (const chunk of pcmBufferQueue) {
            mergedBytes.set(chunk, offset);
            offset += chunk.length;
        }

        pcmBufferQueue = [];
        pcmBufferLengthBytes = 0;

        const dataInt16 = new Int16Array(mergedBytes.buffer);
        const buffer = ctx.createBuffer(1, dataInt16.length, sampleRate);
        const channelData = buffer.getChannelData(0);
        
        for (let i = 0; i < dataInt16.length; i++) {
            channelData[i] = (dataInt16[i] / 32768.0) * 0.8;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        
        const gainNode = ctx.createGain();
        gainNode.gain.value = globalOutputVolume; 

        source.connect(gainNode);

        // Chain: Gain -> Limiter -> Analyser -> Dest
        if (limiter) gainNode.connect(limiter);
        else if (analyser) gainNode.connect(analyser);
        else gainNode.connect(ctx.destination);

        activePCMSources.add(source);

        const currentTime = ctx.currentTime;
        const LOOKAHEAD_MS = 0.02; 
        
        if (nextPCMStartTime < currentTime) {
            nextPCMStartTime = currentTime + LOOKAHEAD_MS;
        }
        
        source.start(nextPCMStartTime);
        nextPCMStartTime += buffer.duration;
        
        source.onended = () => {
             activePCMSources.delete(source);
             if (activePCMSources.size === 0) {
                 setPlayingState(false);
             }
        };
        
        setPlayingState(true);

    } catch (e) {
        console.error("PCM Batch Playback Error:", e);
        pcmBufferQueue = [];
        pcmBufferLengthBytes = 0;
    }
};

export const float32ToPCMBase64 = (float32Array: Float32Array): string => {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        let s = Math.max(-1, Math.min(1, float32Array[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    let binary = '';
    const bytes = new Uint8Array(int16Array.buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    
    return btoa(binary);
};

export const resetPCMStream = () => {
    nextPCMStartTime = 0;
    pcmBufferQueue = [];
    pcmBufferLengthBytes = 0;
    if (pcmFlushTimer) clearTimeout(pcmFlushTimer);
    pcmFlushTimer = null;
};
