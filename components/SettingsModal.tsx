
import React, { useState } from 'react';
import { X, Check, History, AlertTriangle, RefreshCw, Cpu, Zap, Activity, Mic2, Settings2, PlayCircle, Zap as ZapIcon, BarChart3, Activity as WaveIcon, Circle, Cloud, CloudFog, Speaker, Bug, ShieldAlert, Sparkles } from 'lucide-react';
import { runAudioTest } from '../utils/audio';
import { AudioSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVoice: string;
  onVoiceChange: (voice: string) => void;
  isHistoryEnabled: boolean;
  onHistoryEnabledChange: (enabled: boolean) => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  aiModel: 'standard' | 'live';
  onAiModelChange: (model: 'standard' | 'live') => void;
  audioSettings: AudioSettings;
  onAudioSettingsChange: (settings: AudioSettings) => void;
  isBrowserVoiceAvailable: boolean | null;
}

const VOICES = [
  { id: 'Kore', name: 'Kore (여성/기본)', desc: '차분하고 또렷한 목소리' },
  { id: 'Puck', name: 'Puck (남성)', desc: '부드럽고 안정적인 목소리' },
  { id: 'Charon', name: 'Charon (남성)', desc: '깊고 신뢰감 있는 목소리' },
  { id: 'Fenrir', name: 'Fenrir (남성)', desc: '강하고 에너지 넘치는 목소리' },
  { id: 'Zephyr', name: 'Zephyr (여성)', desc: '상쾌하고 밝은 목소리' },
];

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  selectedVoice, 
  onVoiceChange,
  isHistoryEnabled,
  onHistoryEnabledChange,
  apiKey,
  onApiKeyChange,
  aiModel,
  onAiModelChange,
  audioSettings,
  onAudioSettingsChange,
  isBrowserVoiceAvailable
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'audio'>('general');
  const [testPlaying, setTestPlaying] = useState<'sine' | 'pulse' | null>(null);

  if (!isOpen) return null;

  const handleAudioTest = async (type: 'sine' | 'pulse') => {
      setTestPlaying(type);
      await runAudioTest(type, audioSettings.outputSampleRate);
      setTestPlaying(null);
  };

  const updateAudioSetting = (key: keyof AudioSettings, value: any) => {
      onAudioSettingsChange({
          ...audioSettings,
          [key]: value
      });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-[#1e1e1e] border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header & Tabs */}
        <div className="bg-[#252525] border-b border-gray-800">
             <div className="flex items-center justify-between p-4 pb-2">
                <h2 className="text-lg font-bold text-gray-100">설정</h2>
                <button 
                    onClick={onClose}
                    className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-700 transition-colors"
                >
                    <X size={20} />
                </button>
             </div>
             <div className="flex px-4 gap-4">
                 <button 
                    onClick={() => setActiveTab('general')}
                    className={`pb-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'general' ? 'text-emerald-400 border-emerald-500' : 'text-gray-400 border-transparent hover:text-gray-200'}`}
                 >
                     일반 설정
                 </button>
                 <button 
                    onClick={() => setActiveTab('audio')}
                    className={`pb-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${activeTab === 'audio' ? 'text-blue-400 border-blue-500' : 'text-gray-400 border-transparent hover:text-gray-200'}`}
                 >
                     <Activity size={14} />
                     오디오 고급
                 </button>
             </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar flex-1">
          
          {activeTab === 'general' ? (
              <>
                {/* AI Model Setting */}
                <div>
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    AI 모델 엔진
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => onAiModelChange('standard')}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                        aiModel === 'standard' 
                        ? 'bg-blue-900/20 border-blue-500 text-blue-400' 
                        : 'bg-[#2a2a2a] border-gray-700 text-gray-400 hover:bg-[#333]'
                        }`}
                    >
                        <Cpu size={24} />
                        <div className="text-center">
                            <span className="block text-sm font-bold">Standard</span>
                            <span className="block text-[10px] opacity-70">Gemini 2.0 Flash<br/>(안정적/TTS)</span>
                        </div>
                        {aiModel === 'standard' && <Check size={16} className="mt-1" />}
                    </button>

                    <button 
                        onClick={() => onAiModelChange('live')}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                        aiModel === 'live' 
                        ? 'bg-purple-900/20 border-purple-500 text-purple-400' 
                        : 'bg-[#2a2a2a] border-gray-700 text-gray-400 hover:bg-[#333]'
                        }`}
                    >
                        <Zap size={24} />
                        <div className="text-center">
                            <span className="block text-sm font-bold">Live</span>
                            <span className="block text-[10px] opacity-70">Gemini 2.0 Flash-Exp<br/>(실시간 대화)</span>
                        </div>
                        {aiModel === 'live' && <Check size={16} className="mt-1" />}
                    </button>
                    </div>
                </div>
                
                {/* History Setting */}
                <div>
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    대화 설정
                    </h3>
                    <div className="flex items-center justify-between p-4 rounded-xl border border-gray-700 bg-[#2a2a2a]">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isHistoryEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700 text-gray-400'}`}>
                            <History size={20} />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-medium text-gray-200">대화 기록 저장</span>
                            <span className="text-xs text-gray-500">대화 내용을 기기에 자동 저장합니다.</span>
                        </div>
                    </div>
                    <button 
                        type="button"
                        onClick={() => onHistoryEnabledChange(!isHistoryEnabled)}
                        className={`w-12 h-6 rounded-full transition-colors relative ${isHistoryEnabled ? 'bg-emerald-600' : 'bg-gray-600'}`}
                    >
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${isHistoryEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                    </div>
                </div>

                {/* TTS Engine Setting */}
                <div>
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <ZapIcon size={14} />
                        음성 재생 엔진 (Standard 모드)
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={() => updateAudioSetting('ttsEngine', 'gemini')}
                            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                            audioSettings.ttsEngine === 'gemini' 
                            ? 'bg-emerald-900/20 border-emerald-500 text-emerald-400' 
                            : 'bg-[#2a2a2a] border-gray-700 text-gray-400 hover:bg-[#333]'
                            }`}
                        >
                            <Sparkles size={20} />
                            <div className="text-center">
                                <span className="block text-sm font-bold">Gemini AI</span>
                                <span className="block text-[10px] opacity-70">고품질 / 느림(약 3초)</span>
                            </div>
                            {audioSettings.ttsEngine === 'gemini' && <Check size={16} className="mt-1" />}
                        </button>

                        <button 
                            onClick={() => updateAudioSetting('ttsEngine', 'browser')}
                            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                            audioSettings.ttsEngine === 'browser' 
                            ? 'bg-blue-900/20 border-blue-500 text-blue-400' 
                            : 'bg-[#2a2a2a] border-gray-700 text-gray-400 hover:bg-[#333]'
                            }`}
                        >
                            <Cpu size={20} />
                            <div className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                    <span className="block text-sm font-bold">브라우저 엔진</span>
                                    {isBrowserVoiceAvailable === true && <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1 rounded border border-blue-500/30">Beta</span>}
                                </div>
                                <span className="block text-[10px] opacity-70">
                                    {isBrowserVoiceAvailable === null && "지원 여부 확인 중..."}
                                    {isBrowserVoiceAvailable === false && "⚠️ 현재 기기 미지원"}
                                    {isBrowserVoiceAvailable === true && "표준 / 즉시 재생(빠름)"}
                                </span>
                            </div>
                            {audioSettings.ttsEngine === 'browser' && <Check size={16} className="mt-1" />}
                        </button>
                    </div>
                </div>

                {/* Browser TTS Language Setting (v2.25) */}
                <div className="mt-4">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Activity size={14} />
                        브라우저 음성 언어
                    </h3>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => onAudioSettingsChange({ ...audioSettings, browserTtsLang: 'ko-KR' })}
                            className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                            audioSettings.browserTtsLang === 'ko-KR' 
                            ? 'bg-blue-900/20 border-blue-500 text-blue-400' 
                            : 'bg-[#2a2a2a] border-gray-700 text-gray-400 hover:bg-[#333]'
                            }`}
                        >
                            한국어 (ko-KR)
                        </button>
                        <button 
                            onClick={() => onAudioSettingsChange({ ...audioSettings, browserTtsLang: 'en-US' })}
                            className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                            audioSettings.browserTtsLang === 'en-US' 
                            ? 'bg-blue-900/20 border-blue-500 text-blue-400' 
                            : 'bg-[#2a2a2a] border-gray-700 text-gray-400 hover:bg-[#333]'
                            }`}
                        >
                            English (en-US)
                        </button>
                    </div>
                </div>

                {/* Voice Setting */}
                <div>
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    음성 선택 (Gemini AI 전용)
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                    {VOICES.map((voice) => (
                        <button
                        key={voice.id}
                        onClick={() => onVoiceChange(voice.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                            selectedVoice === voice.id 
                            ? 'bg-emerald-900/20 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                            : 'bg-[#2a2a2a] border-gray-700 hover:border-gray-600 hover:bg-[#333]'
                        }`}
                        >
                        <div className="flex flex-col items-start text-left gap-0.5">
                            <span className={`font-medium ${selectedVoice === voice.id ? 'text-emerald-400' : 'text-gray-200'}`}>
                            {voice.name}
                            </span>
                            <span className="text-xs text-gray-500">
                            {voice.desc}
                            </span>
                        </div>
                        {selectedVoice === voice.id && (
                            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                            <Check size={12} className="text-white" />
                            </div>
                        )}
                        </button>
                    ))}
                    </div>
                </div>

                {/* API Key Setting */}
                <div>
                    <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <ZapIcon size={14} />
                    Gemini API 설정
                    </h3>
                    <div className="p-4 rounded-xl border border-emerald-900/30 bg-emerald-900/10">
                        <p className="text-xs text-gray-300 mb-4 leading-relaxed">
                        개인 Gemini API 키를 입력하여 사용하세요.<br/>
                        <span className="text-emerald-400 font-medium">설정 시 서버 환경변수보다 우선적으로 사용됩니다.</span>
                        </p>
                        <div className="relative">
                            <input 
                                type="password"
                                value={apiKey}
                                onChange={(e) => onApiKeyChange(e.target.value)}
                                placeholder="API 키를 입력하세요"
                                className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-emerald-500 transition-colors"
                            />
                        </div>
                    </div>
                </div>
              </>
          ) : (
              // === AUDIO ADVANCED TAB ===
              <div className="space-y-6">
                  
                  {/* Debug Info Toggle */}
                  <div className="flex items-center justify-between p-3 rounded-xl border border-gray-700 bg-[#2a2a2a]">
                      <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${audioSettings.showDebugInfo ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-700 text-gray-400'}`}>
                              <Bug size={20} />
                          </div>
                          <div className="flex flex-col">
                              <span className="font-medium text-gray-200">디버그 정보 표시</span>
                              <span className="text-xs text-gray-500">마이크 감도, 에코 상태 등을 화면에 표시</span>
                          </div>
                      </div>
                      <button 
                          type="button"
                          onClick={() => updateAudioSetting('showDebugInfo', !audioSettings.showDebugInfo)}
                          className={`w-12 h-6 rounded-full transition-colors relative ${audioSettings.showDebugInfo ? 'bg-emerald-600' : 'bg-gray-600'}`}
                      >
                          <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${audioSettings.showDebugInfo ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                  </div>

                  {/* Digital Distortion Prevention Limiter Toggle (v1.9.3 New) */}
                  <div className="flex items-center justify-between p-3 rounded-xl border border-blue-900/30 bg-[#2a2a2a]">
                      <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${audioSettings.digitalLimiter ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700 text-gray-400'}`}>
                              <ShieldAlert size={20} />
                          </div>
                          <div className="flex flex-col">
                              <span className="font-medium text-gray-200">디지털 왜곡 방지 리미터</span>
                              <span className="text-[10px] text-gray-500 leading-tight">스마트 TV 등에서 고음 왜곡(찢어짐) 방지</span>
                          </div>
                      </div>
                      <button 
                          type="button"
                          onClick={() => updateAudioSetting('digitalLimiter', !audioSettings.digitalLimiter)}
                          className={`w-12 h-6 rounded-full transition-colors relative ${audioSettings.digitalLimiter ? 'bg-blue-600' : 'bg-gray-600'}`}
                      >
                          <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${audioSettings.digitalLimiter ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                  </div>

                  {/* Visualizer Selector */}
                  <div>
                      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                          Live 시각화 효과
                      </h3>
                      <div className="grid grid-cols-5 gap-2">
                          {[
                              { id: 'bar', label: 'Bar', icon: BarChart3 },
                              { id: 'line', label: 'Line', icon: WaveIcon },
                              { id: 'circle', label: 'Circle', icon: Circle },
                              { id: 'cloud', label: 'Cloud', icon: Cloud },
                              { id: 'fog', label: 'Fog', icon: CloudFog }
                          ].map((type) => (
                              <button
                                key={type.id}
                                onClick={() => updateAudioSetting('visualizerType', type.id)}
                                className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                                    audioSettings.visualizerType === type.id
                                    ? 'bg-emerald-900/30 border-emerald-500 text-emerald-400'
                                    : 'bg-[#2a2a2a] border-gray-700 text-gray-400 hover:bg-[#333]'
                                }`}
                              >
                                  <type.icon size={18} className="mb-1" />
                                  <span className="text-[10px] font-medium">{type.label}</span>
                              </button>
                          ))}
                      </div>
                  </div>
                  
                  <div className="h-px bg-gray-800" />

                  {/* Mic Input Settings */}
                  <div>
                      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <Mic2 size={14} />
                          마이크 고급 설정 (입력)
                      </h3>
                      <div className="space-y-2 bg-[#2a2a2a] p-3 rounded-xl border border-gray-700">
                          <div className="flex items-center justify-between">
                              <div className="flex flex-col">
                                  <span className="text-sm text-gray-300">에코 캔슬링 (Echo Cancellation)</span>
                              </div>
                              <button 
                                type="button"
                                onClick={() => updateAudioSetting('echoCancellation', !audioSettings.echoCancellation)}
                                className={`w-10 h-5 rounded-full transition-colors relative ${audioSettings.echoCancellation ? 'bg-emerald-600' : 'bg-gray-600'}`}
                              >
                                <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${audioSettings.echoCancellation ? 'translate-x-5' : 'translate-x-0'}`} />
                              </button>
                          </div>
                          <div className="flex items-center justify-between mt-3">
                              <div className="flex flex-col">
                                  <span className="text-sm text-gray-300">자동 증폭 (Auto Gain Control)</span>
                              </div>
                              <button 
                                type="button"
                                onClick={() => updateAudioSetting('autoGainControl', !audioSettings.autoGainControl)}
                                className={`w-10 h-5 rounded-full transition-colors relative ${audioSettings.autoGainControl ? 'bg-emerald-600' : 'bg-gray-600'}`}
                              >
                                <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${audioSettings.autoGainControl ? 'translate-x-5' : 'translate-x-0'}`} />
                              </button>
                          </div>
                          <div className="flex items-center justify-between mt-3">
                              <div className="flex flex-col">
                                  <span className="text-sm text-gray-300">잡음 제거 (Noise Suppression)</span>
                              </div>
                              <button 
                                type="button"
                                onClick={() => updateAudioSetting('noiseSuppression', !audioSettings.noiseSuppression)}
                                className={`w-10 h-5 rounded-full transition-colors relative ${audioSettings.noiseSuppression ? 'bg-emerald-600' : 'bg-gray-600'}`}
                              >
                                <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${audioSettings.noiseSuppression ? 'translate-x-5' : 'translate-x-0'}`} />
                              </button>
                          </div>
                      </div>
                  </div>

                  <div className="h-px bg-gray-800" />
                  
                  {/* Speaker Output Settings */}
                  <div>
                      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center justify-between">
                          <span className="flex items-center gap-2"><Speaker size={14} /> 스피커 출력 증폭 (Gain)</span>
                          <span className="text-emerald-400 font-mono">x{audioSettings.outputVolume.toFixed(1)}</span>
                      </h3>
                      <div className="bg-[#2a2a2a] p-3 rounded-xl border border-gray-700">
                          <input 
                              type="range" 
                              min="0.1" 
                              max="3.0" 
                              step="0.1" 
                              value={audioSettings.outputVolume}
                              onChange={(e) => updateAudioSetting('outputVolume', parseFloat(e.target.value))}
                              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 mb-2"
                          />
                      </div>
                  </div>

                  <div>
                      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                          스피커 테스트
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                          <button onClick={() => handleAudioTest('sine')} disabled={testPlaying !== null} className="py-3 rounded-xl border border-gray-700 bg-[#2a2a2a] hover:bg-[#333] flex flex-col items-center justify-center gap-1 transition-all">
                              <PlayCircle size={20} className={testPlaying === 'sine' ? "text-emerald-400 animate-pulse" : "text-gray-400"} />
                              <span className="text-xs font-medium text-gray-300">기본 (Sine)</span>
                          </button>
                          <button onClick={() => handleAudioTest('pulse')} disabled={testPlaying !== null} className="py-3 rounded-xl border border-gray-700 bg-[#2a2a2a] hover:bg-[#333] flex flex-col items-center justify-center gap-1 transition-all">
                              <ZapIcon size={20} className={testPlaying === 'pulse' ? "text-amber-400 animate-pulse" : "text-gray-400"} />
                              <span className="text-xs font-medium text-gray-300">노이즈 (Pulse)</span>
                          </button>
                      </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                        출력 샘플 레이트 (스마트 TV)
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                         <button onClick={() => updateAudioSetting('outputSampleRate', 24000)} className={`p-3 rounded-lg border text-xs font-medium transition-all ${audioSettings.outputSampleRate === 24000 ? 'bg-blue-600 text-white border-blue-500' : 'bg-[#2a2a2a] text-gray-400 border-gray-700'}`}>24,000Hz (표준)</button>
                         <button onClick={() => updateAudioSetting('outputSampleRate', 48000)} className={`p-3 rounded-lg border text-xs font-medium transition-all ${audioSettings.outputSampleRate === 48000 ? 'bg-amber-600 text-white border-amber-500' : 'bg-[#2a2a2a] text-gray-400 border-gray-700'}`}>48,000Hz (TV)</button>
                    </div>
                  </div>

                  <div>
                      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center justify-between">
                          <span>마이크 민감도</span>
                          <span className="text-emerald-400">{audioSettings.micThreshold}</span>
                      </h3>
                      <input type="range" min="0.001" max="0.05" step="0.001" value={audioSettings.micThreshold} onChange={(e) => updateAudioSetting('micThreshold', parseFloat(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                  </div>

              </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-[#1a1a1a] border-t border-gray-800 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors"
          >
            완료
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
