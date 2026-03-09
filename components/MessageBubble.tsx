
import React from 'react';
import { Message } from '../types';
import { User, Sparkles, Play, Square, Loader2, Circle, Globe, Download } from 'lucide-react';
import { TTSStatus } from '../App';

interface MessageBubbleProps {
  message: Message;
  isTTSActive?: boolean;
  isPlaying?: boolean;
  isAudioLoading?: boolean;
  ttsStatus?: TTSStatus; 
  onPlay?: (text: string, id: string) => void;
  onStop?: () => void;
  onDownload?: (text: string, id: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = React.memo(({ 
  message, 
  isTTSActive, 
  isPlaying, 
  isAudioLoading,
  ttsStatus = 'idle',
  onPlay, 
  onStop,
  onDownload
}) => {
  const isUser = message.role === 'user';
  
  // HIDE EMPTY MODEL MESSAGES (Waiting for stream to start)
  if (!isUser && !message.text && (!message.sources || message.sources.length === 0)) {
    return null;
  }

  // Formatting helper with Title highlighting and **Text** coloring
  const formatText = (text: string) => {
    return text.split('\n').map((line, i) => {
      const trimmed = line.trim();
      
      // Improved Heuristic for "Titles", "List Headers", "Speakers", or "Dialogue Headers"
      // e.g., "Dialogue 1", "Dialogue:", "Customer:", "Barista:", "Step 1:"
      const isTitleLike = 
        /^[▣◈■•]/.test(trimmed) || 
        /^\d+\.\s/.test(trimmed) ||
        // Check for specific script keywords followed by space or colon
        /^(Dialogue|Scene|Mission|Step|Scenario|Situation|Role|Part)(:|\s|$)/i.test(trimmed) ||
        // Check for Speaker names (English/Korean) ending with colon, strictly short length
        (/^[\w\s가-힣]+:/.test(trimmed) && trimmed.length < 40);

      // Process inline formatting (detect **text** for Sky Blue/Slate highlighting)
      const parseInline = (contentStr: string) => {
        // Split by **...** pattern
        const parts = contentStr.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, idx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                // Remove the ** delimiters and apply Slate-300 (Blue Gray) style
                return (
                    <span key={idx} className="text-slate-300 font-semibold">
                        {part.slice(2, -2)}
                    </span>
                );
            }
            return part;
        });
      };

      const content = isTitleLike ? (
        // Indigo-400 for headers/speakers to distinguish from English text
        <span className="text-indigo-400 font-bold">{parseInline(line)}</span>
      ) : (
        <>{parseInline(line)}</>
      );

      return (
        <React.Fragment key={i}>
          {content}
          {i < text.split('\n').length - 1 && <br />}
        </React.Fragment>
      );
    });
  };

  const getStatusIndicator = () => {
    switch(ttsStatus) {
        case 'playing':
            return <Circle size={8} className="fill-emerald-500 text-emerald-500 animate-pulse" />;
        case 'loading':
            return <Circle size={8} className="fill-yellow-500 text-yellow-500 animate-bounce" />;
        case 'suspended': // Red alert for silence issue
        case 'error':
            return <Circle size={8} className="fill-red-500 text-red-500" />;
        default:
            return <Circle size={8} className="fill-gray-600 text-gray-600" />;
    }
  };

  const getStatusText = () => {
      switch(ttsStatus) {
          case 'playing': return "재생 중";
          case 'loading': return "생성 중...";
          case 'suspended': return "일시 중단됨 (소리 안 남)";
          case 'error': return "오류";
          default: return "";
      }
  };

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[95%] md:max-w-[90%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start gap-2`}>
        
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-blue-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md'}`}>
          {isUser ? <User size={16} className="text-white" /> : (
            <Sparkles size={16} className="text-white fill-white/20" />
          )}
        </div>

        {/* Bubble Column */}
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} w-full`}>
          <div
            className={`px-4 py-3 rounded-2xl shadow-sm text-sm md:text-base leading-relaxed break-words relative ${
              isUser
                ? 'bg-blue-600 text-white rounded-tr-sm'
                : 'bg-[#1E1E1E] text-gray-100 border border-gray-700 rounded-tl-sm'
            }`}
          >
            {formatText(message.text)}
            {message.isStreaming && (
              <span className="inline-block w-2 h-4 ml-1 align-middle bg-emerald-400 animate-pulse"></span>
            )}
          </div>

          {/* AI Message Controls & Sources */}
          {!isUser && (
            <div className="flex flex-col w-full gap-2 mt-2">
              
              {/* Voice Controls with Indicator */}
              {message.text.trim().length > 0 && (
                <div className="flex items-center gap-2">
                   {isAudioLoading ? (
                     <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-900/20 border border-emerald-500/30 rounded-full text-emerald-400 text-xs" title={getStatusText()}>
                        {getStatusIndicator()}
                        <Loader2 size={12} className="animate-spin" />
                        <span>음성 생성 중...</span>
                     </div>
                   ) : isPlaying ? (
                      <button 
                        onClick={onStop}
                        className="flex items-center gap-2 px-3 py-1.5 bg-red-900/20 border border-red-500/30 hover:bg-red-900/40 rounded-full text-red-400 text-xs transition-colors"
                        title={getStatusText()}
                      >
                         {getStatusIndicator()}
                         <Square size={12} fill="currentColor" />
                         <span>음성 정지 {ttsStatus === 'suspended' ? '(오류)' : ''}</span>
                         {/* Wave animation */}
                         {ttsStatus === 'playing' && (
                            <div className="flex gap-0.5 h-3 items-end ml-1">
                                <div className="w-0.5 bg-red-400 h-full animate-[bounce_0.8s_infinite]" />
                                <div className="w-0.5 bg-red-400 h-2/3 animate-[bounce_0.8s_infinite_0.1s]" />
                                <div className="w-0.5 bg-red-400 h-full animate-[bounce_0.8s_infinite_0.2s]" />
                            </div>
                         )}
                      </button>
                   ) : (
                      <button 
                          onClick={() => onPlay && onPlay(message.text, message.id)}
                          className={`flex items-center gap-2 px-3 py-1.5 border rounded-full text-xs transition-colors ${
                          isTTSActive || message.audioData
                              ? 'bg-gray-800 border-gray-600 text-gray-300 hover:text-white hover:border-gray-500' 
                              : 'bg-transparent border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-600'
                          }`}
                      >
                          <Play size={12} fill="currentColor" />
                          <span>{message.audioData ? "다시 듣기" : "음성 듣기"}</span>
                      </button>
                   )}

                   {/* Download Button (Always visible if audio cached and not loading) */}
                   {message.audioData && onDownload && !isAudioLoading && (
                        <button
                            onClick={() => onDownload(message.text, message.id)}
                            className="flex items-center gap-2 px-3 py-1.5 border border-gray-700 rounded-full text-xs text-gray-400 hover:text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-900/10 transition-colors"
                            title="WAV 파일로 저장"
                        >
                            <Download size={12} />
                            <span>저장</span>
                        </button>
                   )}
                </div>
              )}

              {/* Sources (Grounding) */}
              {message.sources && message.sources.length > 0 && (
                <div className="p-2 bg-[#1a1a1a] rounded-lg border border-gray-800 w-full max-w-full">
                  <div className="flex items-center gap-1 text-xs text-gray-400 mb-2 uppercase tracking-wider font-semibold">
                    <Globe size={12} />
                    참고 자료 (Sources)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {message.sources.map((source, idx) => (
                      <a
                        key={idx}
                        href={source.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs bg-gray-800 hover:bg-gray-700 text-blue-400 px-2 py-1 rounded-md transition-colors truncate max-w-full"
                      >
                        {source.title || new URL(source.uri).hostname}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Timestamp */}
          <span className="text-[10px] text-gray-500 mt-1 px-1">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
    return (
        prev.message.id === next.message.id &&
        prev.message.text === next.message.text &&
        prev.message.isStreaming === next.message.isStreaming &&
        prev.message.audioData === next.message.audioData && // Check audio cache update
        prev.isPlaying === next.isPlaying &&
        prev.isAudioLoading === next.isAudioLoading &&
        prev.ttsStatus === next.ttsStatus &&
        prev.isTTSActive === next.isTTSActive
    );
});

export default MessageBubble;
