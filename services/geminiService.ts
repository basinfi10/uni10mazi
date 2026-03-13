
import { GoogleGenAI, Chat, Modality } from "@google/genai";
import { Source } from "../types";
import { float32ToPCMBase64, resetPCMStream, stopAudio } from "../utils/audio";

let ai: GoogleGenAI | null = null;
let chatSession: Chat | null = null;
let customUserApiKey: string = "";

export const setUserApiKey = (key: string) => {
  if (customUserApiKey !== key) {
    customUserApiKey = key;
    ai = null; // Force client re-initialization
    chatSession = null;
  }
};

const MODEL_NAME = 'gemini-2.5-flash';
const TTS_MODEL_NAME = 'gemini-2.5-flash'; 
const LIVE_MODEL_NAME = 'gemini-2.5-flash-live-preview';

const DEFAULT_SYSTEM_INSTRUCTION = `
당신의 이름은 '마지(Mazi)'입니다.
도움이 되고 친절한 AI 비서로서 사용자에게 봉사하세요.
한국어로 자연스럽게 대화하세요.

[필수 자아 및 반응 수칙]
1. **이름 질문**: 사용자가 "너의 이름은?", "누구야?", "이름이 뭐야?", "너는 누구야?"라고 물으면, 반드시 **"나는 마지입니다"** 또는 **"나는 마지야"**라고 대답하세요. 다른 수식어(예: "친절한 AI")를 붙이지 말고 이름만 명확히 밝히세요.
2. **호칭 반응**: 사용자가 "마지야", "마지", "맏이야", "맞이야"라고 부르면, **"네, 마지입니다"**, **"응, 마지 여기 있어"**, **"응, 말해"** 중 하나로 대답하세요.
3. **중단 명령**: 사용자가 "그만해", "그만하자", "그만", "스톱", "정지", "알았으니까 그만", "알았어"라고 하면, 즉시 답변을 멈추거나 짧게 "네"라고 하고 대화를 종료하는 느낌으로 마무리하세요.

사용자의 질문에 대해 명확하고 정확한 정보를 제공하세요.
정보가 필요하면 Google 검색 도구를 적극적으로 활용하세요.
답변은 읽기 쉽게 서식을 갖추어 작성하세요.
`;

// Helper to initialize AI client lazily and safely
const getAIClient = (): GoogleGenAI => {
  if (!ai) {
    let apiKey = '';

    // 1. Try Vite standard (import.meta.env)
    try {
      // @ts-ignore
      if (typeof import.meta !== 'undefined' && import.meta.env) {
        // @ts-ignore
        apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY || import.meta.env.GEMINI_API_KEY || '';
      }
    } catch (e) {
      console.warn("import.meta.env access failed", e);
    }

    // 2. Fallback to process.env (for compatibility or other build tools)
    if (!apiKey) {
      apiKey = (process.env as any).VITE_GEMINI_API_KEY ||
        (process.env as any).VITE_API_KEY ||
        (process.env as any).GEMINI_API_KEY ||
        (process.env as any).NEXT_PUBLIC_API_KEY ||
        (process.env as any).REACT_APP_API_KEY ||
        '';
    }

    // 3. Fallback to user-provided key in settings
    if (!apiKey) {
      apiKey = customUserApiKey;
      if (apiKey) console.log("[AIClient] Using user-provided API key from settings");
    }

    // Clean and validate
    apiKey = apiKey.trim();

    if (!apiKey || apiKey === 'undefined' || apiKey === 'null') {
      console.error("[AIClient] No API Key found in Env or Settings");
      throw new Error("API 키가 설정되지 않았습니다. 설정에서 개인 API 키를 입력하거나, 서버 환경 변수(VITE_GEMINI_API_KEY)를 확인해주세요.");
    }

    console.log("[AIClient] Initializing with key prefix:", apiKey.substring(0, 5) + "...");
    // [CRITICAL] Specify v1beta for Multimodal Live API support
    ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
  }
  return ai;
};

export const initializeChat = (customSystemInstruction?: string): boolean => {
  try {
    const client = getAIClient();
    chatSession = client.chats.create({
      model: MODEL_NAME,
      config: {
        systemInstruction: customSystemInstruction || DEFAULT_SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }],
      },
    });
    return true;
  } catch (error) {
    console.error("Failed to initialize chat session:", error);
    return false;
  }
};

export const sendMessageStream = async (
  message: string,
  onChunk: (text: string, sources?: Source[]) => void
): Promise<void> => {
  // Ensure client is initialized
  if (!chatSession) {
    const success = initializeChat();
    if (!success) {
      throw new Error("채팅 세션을 초기화할 수 없습니다. API 키 설정을 확인해주세요.");
    }
  }

  if (!chatSession) {
    throw new Error("Chat session is not available.");
  }

  try {
    const resultStream = await chatSession.sendMessageStream({
      message: message,
    });

    let accumulatedText = "";

    for await (const chunk of resultStream) {
      const text = chunk.text || "";
      accumulatedText += text;

      let sources: Source[] | undefined = undefined;
      const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;

      if (groundingChunks) {
        sources = groundingChunks
          .map((c: any) => c.web)
          .filter((w: any) => w && w.uri)
          .map((w: any) => ({
            title: w.title || "출처",
            uri: w.uri
          }))
          .slice(0, 5); // Limit to maximum 5 reliable sources
      }

      onChunk(accumulatedText, sources);
    }
  } catch (error: any) {
    console.error("Error sending message:", error);

    // Detect Quota errors (429)
    const msg = error.message || '';
    if (error.status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
      throw new Error("AI 모델 사용량이 초과되었습니다. (Quota Exceeded)\n잠시 후 다시 시도하거나 내일 이용해 주세요.");
    }

    throw error;
  }
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Strip emojis and non-standard chars that might confuse TTS
const cleanTextForTTS = (text: string): string => {
  if (!text) return "";

  let cleaned = text;

  // 1. Completely Remove Markdown Bold/Italic markers (*, **)
  // Using a global regex to remove all occurrences of *
  cleaned = cleaned.replace(/[\*]/g, '');

  // 2. Remove Markdown Headers (#)
  cleaned = cleaned.replace(/[#]+/g, '');

  // 3. Remove common emoji ranges
  cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

  // 4. Remove backticks and other distraction characters
  cleaned = cleaned.replace(/[`]/g, '');

  // 5. Collapse multiple spaces into one
  cleaned = cleaned.replace(/\s+/g, ' ');

  return cleaned.trim();
};

export const generateSpeech = async (text: string, voiceName: string = "Kore"): Promise<string> => {
  // Reduce max retries to 2 to prevent hitting quota limits (429) too fast
  const MAX_RETRIES = 2;
  let lastError: any;

  // Clean text before sending to API to reduce "OTHER" errors caused by complex emojis or markdown
  const cleanedText = cleanTextForTTS(text);

  if (!cleanedText || cleanedText.length === 0) {
    throw new Error("TTS 텍스트가 비어 있습니다.");
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const client = getAIClient();

      // Attempt to catch generic network failures (like offline) from the SDK call
      const response = await client.models.generateContent({
        model: TTS_MODEL_NAME,
        contents: [{ parts: [{ text: cleanedText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName },
            },
          },
        },
      });

      // Check for candidates
      const candidate = response.candidates?.[0];

      if (!candidate) {
        throw new Error("응답 후보(Candidate)가 없습니다.");
      }

      // Handle specific finish reasons that block generation
      if (candidate.finishReason === "SAFETY") {
        throw new Error("안전 정책에 의해 음성이 차단되었습니다.");
      }
      if (candidate.finishReason === "RECITATION") {
        throw new Error("저작권/암기 컨텐츠 감지로 인해 음성이 차단되었습니다.");
      }

      // 'OTHER' is often transient (server load, internal error). Treat as retryable error.
      if (candidate.finishReason === "OTHER") {
        throw new Error(`모델 일시적 오류 (FinishReason: OTHER)`);
      }

      const audioData = candidate.content?.parts?.[0]?.inlineData?.data;

      if (!audioData) {
        // Sometimes the model returns text in part.text if it refuses to generate audio but doesn't set a flag
        const textFallback = candidate.content?.parts?.[0]?.text;
        if (textFallback) {
          console.warn("TTS fallback text:", textFallback);
          // If model returns text saying "I cannot...", treat as safety/refusal -> do not retry
          if (textFallback.includes("sorry") || textFallback.includes("cannot")) {
            throw new Error(`모델이 음성 생성을 거부했습니다: ${textFallback}`);
          }
        }
        throw new Error(`오디오 데이터가 수신되지 않았습니다. (FinishReason: ${candidate.finishReason})`);
      }

      return audioData;

    } catch (error: any) {
      lastError = error;
      const msg = error.message || "";

      // Log warning with attempt number
      if (attempt < MAX_RETRIES) {
        console.warn(`TTS Attempt ${attempt + 1}/${MAX_RETRIES} failed:`, msg);
      }

      // Fatal errors - do not retry
      // 429/Quota errors should NOT be retried to avoid ban
      if (msg.includes("API key") || msg.includes("quota") || msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("안전 정책") || msg.includes("거부했습니다")) {
        break;
      }

      // Retry for network/RPC/Empty/Transient/OTHER errors
      if (attempt < MAX_RETRIES) {
        // Increase delay significantly to give quota bucket time to refill and reduce server load
        // Base 4s -> 4s, 8s
        const delay = 4000 * Math.pow(2, attempt);
        await wait(delay);
        continue;
      }
    }
  }

  // If we reached here, all attempts failed
  console.error("TTS Final generation error:", lastError);

  let userMessage = "음성 생성 오류";
  const msg = lastError?.message || "";

  if (msg.includes("API key")) {
    userMessage = "API 키 오류";
  } else if (msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED")) {
    userMessage = "TTS 할당량 초과 (Quota Exceeded)";
  } else if (msg.includes("fetch failed") || msg.includes("network")) {
    userMessage = "네트워크 연결 오류";
  } else if (msg.includes("Rpc failed") || msg.includes("xhr error")) {
    userMessage = "서버 연결 불안정 (재시도 실패)";
  } else if (msg.includes("empty") || msg.includes("수신되지")) {
    userMessage = "오디오 데이터 수신 실패";
  } else if (msg.includes("안전 정책") || msg.includes("차단")) {
    userMessage = "안전 정책으로 인해 음성을 생성할 수 없습니다";
  }

  throw new Error(userMessage);
};


// --- LIVE API CLIENT ---
export class LiveClient {
  private session: any = null;
  private isConnected = false;
  private isConnecting = false;
  private micThreshold = 0.01; // Default sensitivity

  setThreshold(val: number) {
    this.micThreshold = val;
  }

  async connect(
    onAudioData: (base64PCM: string) => void,
    onDisconnect: (err?: any) => void,
    onTranscript?: (text: string, isModel: boolean) => void // New Callback for Echo/Interrupt Logic
  ) {
    if (this.isConnected || this.isConnecting) return;

    // Explicit Offline Check
    if (!navigator.onLine) {
      throw new Error("인터넷 연결이 오프라인입니다.");
    }

    this.isConnecting = true;
    const ai = getAIClient();
    resetPCMStream();

    // Unified System Instruction for Live Mode
    const systemInstruction = `
    [SYSTEM: Unified AI Role Framework]

    Assistant은 아래 10개의 역할 중 사용자가 선택한 하나의 역할만 활성화한다.
    역할은 사용자가 명령으로 변경하지 않는 한 유지된다.
    공통으로 전부 이름은 "마지" 임. "마지야", "마지" 로 답함.

    [중요 공통 규칙]
    1. **중복 인사 절대 금지**: 대화가 이어질 때 "안녕하세요", "반갑습니다", "마지입니다" 같은 인사말을 반복하지 마세요. 이미 인사했으면 바로 본론이나 대답으로 넘어가세요.
    2. **명확한 종료**: 사용자가 "그만", "종료", "멈춰"를 외치면 "네", "알겠습니다" 정도로 짧게 답하고 말을 아끼세요.
    3. **문맥 유지**: 사용자가 주제를 명시적으로 바꾸지 않는 한, 이전 대화의 맥락을 유지하며 답변하세요. 뜬금없이 화제를 전환하지 마세요.
    4. **일관성**: 정보를 제공할 때는 이전 답변과 결을 같이 하세요.

    사용자는 다음과 같이 선택한다:
    "#0 시작" -> 표준 일반 AI
    "#1 시작" -> 문화지기
    "#2 시작" -> 요리 전문가
    "#3 시작" -> 친한 친구
    "#4 시작" -> 상식.지식 퀴즈
    ... 등등

    ◆ 10개 역할 목록

    0. 표준 일반 AI (기본)
    이름: 마지 (Mazi)
    성격: 가장 일반적이고 유능한 AI 비서 페르소나.
    반응: "마지야", "마지" 호출 또는 "#0 시작" 수신 시 "네, 안녕하세요 마지입니다. 무엇을 함께 할까요?"라고 답한다. (단, 이미 대화 중이면 인사 생략)
    기능: 친절하게 답하고, 사용자 최근 정보나 질문에 대해 필요할 시 인증된 사이트를 웹검색(Google Search 도구 활용)하여 정확한 정보를 제공한다.
    언어: 한국어 (명확하고 정중함)

    1. 문화지기 마지 (Culture Guide)
    이름: 마지 (문화지기)
    성격: 예술과 문화를 사랑하는 지적이고 감성적인 가이드.
    반응 필수 규칙:
    - "마지야", "마지" 호출 또는 "#1 시작" 수신 시 반드시 다음과 같이 시작: "네 안녕하세요 문화지기 마지입니다. 오늘은 [책, 영화, 음악, 뮤지컬 중 하나 랜덤 선택] 어떨까요?"
    기능:
    - 탁월한 문화 지기 답게 다양한 책, 영화, 음악을 추천해 주고 내용과 의미를 상세하게 이야기함.
    - 사용자 요구하면 책과 영화는 해당 스토리를 상세하게 이어가며 이야기해 줌 (스토리텔링 모드).
    - 다양한 문화 관련 정보 공유.
    말투: 정중하면서도 감수성이 풍부한 어조 (~해요체 권장).

    2. 요리 전문가 마지 (Cooking Expert)
    이름: 마지 (요리 전문가)
    성격: 탁월한 세계적인 요리 전문가.
    반응 필수 규칙:
    - "마지야", "마지" 호출 또는 "#2 시작" 수신 시 반드시: "네 안녕 하세요 당신의 요리친구 마지입니다. 오늘 무슨 요리 해 볼까요." 라고 답함.
    기능:
    - 국내 요리 뿐만 아니라 일본, 중국, 태국, 프랑스, 이탈리아 요리 등 세계적인 요리 정보 제공.
    - 요리 추천 (오늘의 요리, 건강식, 날씨별 요리), 레시피 상세 설명.
    - 요리 할 때 주의 점, 꿀팁, 음식물 관리 법, 재료 고르는 법, 손질하는 법 등 전문가적 조언 제공.
    말투: 친절하고 전문적인 어조.

    3. 친한 친구 (Close Friend)
    성격: 편안하고 따뜻하지만, 때로는 밝고 유머러스함.
    규칙:
    - 친근하고 정감 있는 반말 사용 (친구 사이).
    - 대화 템포가 처지지 않게 적절한 유머와 최신 이슈/밈을 섞어서 대화.
    - 사용자의 기분에 맞춰 위로할 땐 차분하게, 놀 땐 신나게 반응.
    - "#3 시작" 수신 시 "안녕! 나야 마지. 오늘 기분 어때?"라고 반말로 시작.
    언어: 한국어 (반말)
    목표: 지루하지 않으면서도 공감해주는 최고의 단짝 친구.

    4. 상식.지식 퀴즈 마지 (Quiz Master)
    이름: 마지 (퀴즈 친구)
    성격: 폭넓고 깊은 지식을 가진 퀴즈 전문가.
    반응 필수 규칙:
    - "마지야", "마지" 호출 또는 "#4 시작" 수신 시 반드시: "네 안녕 하세요 당신의 퀴즈 친구 마지입니다. 무슨 문제 내 볼까요." 라고 답함.
    기능:
    - 상식, 국사, 세계사, 문화, 과학 등 각종 지식에 대한 문제를 내며 소통.
    - 그때마다 다른 상식적인 중급 문제 10개를 하나씩 내서 답을 유도함.
    - 사용자의 지식 수준에 맞춰 힌트를 주거나 난이도를 조절하며 이끌어 줌.
    말투: 재치 있고 흥미를 유발하는 진행자 어조.

    5. 과학 선생님 (Science Teacher)
    성격: 논리적, 분석적, 친절함.
    반응: "#5 시작" 수신 시 "안녕하세요, 과학 선생님 마지입니다. 어떤 원리가 궁금한가요?"라고 시작.
    규칙: 물리, 수학, 천문학적 원리를 쉽게 풀어서 설명. 수식보다는 개념 위주 설명.

    6. 영어 학습 AI – 초급 (Tutor 지나)
    이름: 지나 (하지만 본체는 마지)
    반응: "#6 시작" 수신 시 "안녕하세요! 영어 튜터 지나입니다. 기초부터 천천히 시작해볼까요?"라고 시작.
    언어: 설명/피드백 한국어, 역할극 영어
    규칙: 초급 수준에 맞춰 천천히 또박또박 발음(텍스트 출력 시)

    7. 영어 학습 AI – 중급 (Tutor Alex)
    이름: Alex
    반응: "#7 시작" 수신 시 "Hello! I'm Alex. Let's discuss some interesting topics."라고 영어로 시작.
    언어: 100% 영어 진행 (피드백 포함)
    규칙: 논리적이고 세련된 표현 사용

    8. 일본어 학습 AI – 초급
    반응: "#8 시작" 수신 시 "곤니치와! 일본어 기초를 함께 공부할 마지입니다."라고 시작.
    언어: 설명 한국어, 회화 일본어
    규칙: 히라가나 위주 표기, 기초 문법

    9. 일본어 학습 AI – 중급
    반응: "#9 시작" 수신 시 "곤니치와. 비즈니스 일본어나 회화를 연습해봅시다."라고 일본어로 시작.
    언어: 자연스러운 일본어 회화
    규칙: 비즈니스 매너, 한자 혼용
    `;

    try {
      this.session = await ai.live.connect({
        model: LIVE_MODEL_NAME,
        callbacks: {
          onopen: () => {
            this.isConnected = true;
            this.isConnecting = false;
            console.log("Live Session Connected");
          },
          onmessage: (message: any) => {
            // 1. Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              onAudioData(base64Audio);
            }

            // 2. Handle Input/Output Transcription for Echo Detection
            // Check outputTranscription first as it's the specific feature for this
            const outputTrans = message.serverContent?.outputTranscription?.text;
            if (outputTrans && onTranscript) {
              onTranscript(outputTrans, true); // true = model
            } else {
              // Fallback to modelTurn if outputTranscription is empty (rare but possible)
              const modelText = message.serverContent?.modelTurn?.parts?.[0]?.text;
              if (modelText && onTranscript) {
                onTranscript(modelText, true);
              }
            }

            // User Input Transcript
            const inputTrans = message.serverContent?.inputTranscription?.text;
            if (inputTrans && onTranscript) {
              onTranscript(inputTrans, false); // false = user
            }

            // Handle Tool Calls (if any)
            // ...
          },
          onclose: (e: any) => {
            console.warn("[LiveClient] WebSocket closed:", e);
            this.isConnected = false;
            this.isConnecting = false;
            onDisconnect({ code: e.code, reason: e.reason, message: "Session closed" });
          },
          onerror: (e: any) => {
            console.error("[LiveClient] WebSocket error:", e);
            this.isConnected = false;
            this.isConnecting = false;
            onDisconnect({ message: "Session error", details: e });
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: systemInstruction,
          // Add Google Search tool for Standard Persona
          tools: [{ googleSearch: {} }],
          // CORRECT CONFIG according to docs (No model name required for empty config)
          inputAudioTranscription: {},
          outputAudioTranscription: {}, // Added to get model text
        },
      });
    } catch (e: any) {
      this.isConnecting = false;
      this.isConnected = false;
      throw e;
    }
  }

  // ... (rest of the class remains same)
  sendAudioChunk(data: Float32Array, sampleRate: number) {
    if (!this.session || !this.isConnected) return;

    const pcmBase64 = float32ToPCMBase64(data);
    this.session.sendRealtimeInput({
      media: {
        mimeType: `audio/pcm;rate=${sampleRate}`, // Dynamic Rate
        data: pcmBase64
      }
    });
  }

  sendText(text: string) {
    if (!this.session || !this.isConnected) return;
    try {
      this.session.send({ clientContent: { turns: [{ role: 'user', parts: [{ text: text }] }], turnComplete: true } });
    } catch (e) {
      try {
        this.session.send([{ text: text }]);
      } catch (e2) {
        console.error("Text send failed", e2);
      }
    }
  }

  disconnect() {
    if (this.session) {
      try {
        this.session.close();
      } catch (e) { }
      this.session = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
  }
}
