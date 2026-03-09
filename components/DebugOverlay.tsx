
import React from 'react';
import { Activity, Mic, MicOff, Volume2 } from 'lucide-react';

interface DebugOverlayProps {
  rms: number;
  threshold: number;
  isGateOpen: boolean;
  isAiSpeaking: boolean;
  aecEnabled: boolean;
  outputVolume: number;
  outputSampleRate: number;
}

const DebugOverlay: React.FC<DebugOverlayProps> = ({ 
  rms, 
  threshold, 
  isGateOpen, 
  isAiSpeaking,
  aecEnabled,
  outputVolume,
  outputSampleRate
}) => {
  return (
    <div className="absolute bottom-20 left-4 z-50 p-2 rounded-lg bg-black/70 border border-gray-700 backdrop-blur-md text-[10px] font-mono text-gray-300 shadow-xl pointer-events-none min-w-[140px]">
      <div className="flex items-center justify-between mb-2 pb-1 border-b border-gray-600">
        <span className="font-bold text-emerald-400">AUDIO DEBUG</span>
        <Activity size={10} className="text-emerald-400 animate-pulse" />
      </div>
      
      {/* Common Status */}
      <div className="flex items-center justify-between mb-1">
        <span>AEC (Echo):</span>
        <span className={aecEnabled ? "text-blue-400" : "text-red-400"}>
            {aecEnabled ? "ON" : "OFF"}
        </span>
      </div>

      <div className="flex items-center justify-between mb-1">
        <span>AI State:</span>
        <span className={isAiSpeaking ? "text-yellow-400 font-bold" : "text-gray-400"}>
            {isAiSpeaking ? "SPEAKING" : "LISTENING"}
        </span>
      </div>

      {/* Speaker Stats Section */}
      <div className="mt-2 pt-1 border-t border-gray-600/50 mb-1">
          <div className="flex items-center gap-1 text-gray-500 mb-1">
              <Volume2 size={8} /> <span>OUTPUT</span>
          </div>
          <div className="flex items-center justify-between mb-1 pl-1">
            <span>Gain:</span>
            <span className="text-blue-300 font-bold">x{outputVolume.toFixed(1)}</span>
          </div>
          <div className="flex items-center justify-between pl-1">
            <span>Rate:</span>
            <span className="text-blue-300">{outputSampleRate / 1000}kHz</span>
          </div>
      </div>

      {/* Mic Input Section */}
      <div className="mt-2 pt-1 border-t border-gray-600/50 mb-1">
          <div className="flex items-center gap-1 text-gray-500 mb-1">
              <Mic size={8} /> <span>INPUT (RMS)</span>
          </div>
          <div className="flex items-center justify-between mb-1 pl-1">
            <span>Level:</span>
            <span className={rms > threshold ? "text-white font-bold" : "text-gray-500"}>
                {rms.toFixed(4)}
            </span>
          </div>
          <div className="flex items-center justify-between pl-1">
            <span>Thres:</span>
            <span className="text-purple-300">
                {threshold.toFixed(4)}
            </span>
          </div>
      </div>

      {/* Gate Status */}
      <div className="mt-2 pt-1 border-t border-gray-600 flex items-center justify-center gap-2">
          {isGateOpen ? (
              <span className="flex items-center gap-1 text-emerald-400 font-bold bg-emerald-900/30 px-2 rounded">
                  <Mic size={10} /> OPEN (Sending)
              </span>
          ) : (
              <span className="flex items-center gap-1 text-gray-500 font-bold bg-gray-800 px-2 rounded">
                  <MicOff size={10} /> CLOSED
              </span>
          )}
      </div>
      
      {isAiSpeaking && (
          <div className="mt-1 text-center text-[9px] text-yellow-500/80">
              *감도 대폭 저하 (x12.0)*
          </div>
      )}
    </div>
  );
};

export default DebugOverlay;
