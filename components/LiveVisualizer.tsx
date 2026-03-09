
import React, { useRef, useEffect } from 'react';
import { Mic, BrainCircuit } from 'lucide-react';
import { getAudioVisualData, getAudioWaveformData } from '../utils/audio';
import { VisualizerType } from '../types';

interface LiveVisualizerProps {
  userVolume: number; // 0.0 to 1.0 (normalized)
  isAiSpeaking: boolean;
  isThinking?: boolean;
  visualizerType?: VisualizerType;
}

const LiveVisualizer: React.FC<LiveVisualizerProps> = ({ 
    userVolume, 
    isAiSpeaking, 
    isThinking = false,
    visualizerType = 'bar'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  
  // Persist state across re-renders
  const barsRef = useRef<number[]>([]);
  // Reuse particlesRef for cloud/fog
  const particlesRef = useRef<{x: number, y: number, r: number, vx: number, vy: number, alpha: number}[]>([]);

  // Determine colors based on type
  const getThemeColors = () => {
      switch(visualizerType) {
          case 'line': return { primary: '#22d3ee', secondary: '#0891b2', glow: 'rgba(34, 211, 238, 0.15)' }; // Cyan
          case 'circle': return { primary: '#38bdf8', secondary: '#0284c7', glow: 'rgba(56, 189, 248, 0.15)' }; // Sky Blue (Updated from Rose)
          case 'cloud': return { primary: '#a78bfa', secondary: '#7c3aed', glow: 'rgba(167, 139, 250, 0.15)' }; // Violet
          case 'fog': return { primary: '#94a3b8', secondary: '#cbd5e1', glow: 'rgba(148, 163, 184, 0.15)' }; // Slate/Blue Gray (Fog)
          case 'bar': 
          default: return { primary: '#34d399', secondary: '#059669', glow: 'rgba(52, 211, 153, 0.15)' }; // Emerald
      }
  };

  const theme = getThemeColors();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas resolution
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const CENTER_X = rect.width / 2;
    const CENTER_Y = rect.height / 2;
    
    // --- INIT PARTICLES (Cloud & Fog share same physics now) ---
    if (particlesRef.current.length === 0) {
        // Use standard cloud particle count for both cloud and fog
        const count = 25; 
        for(let i=0; i<count; i++) {
            particlesRef.current.push({
                x: CENTER_X + (Math.random() - 0.5) * 70, // Increased spread for larger canvas
                y: CENTER_Y + (Math.random() - 0.5) * 70,
                r: 12 + Math.random() * 22, // Slightly larger particles
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                alpha: 0.1 + Math.random() * 0.3
            });
        }
    }

    // --- RENDER FUNCTION ---
    const render = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);
      const time = Date.now() * 0.002;
      const colors = getThemeColors();

      // 1. BAR VISUALIZER (Emerald)
      if (visualizerType === 'bar') {
          const BAR_COUNT = 32;
          const BAR_WIDTH = 7; // Slightly wider
          const BAR_GAP = 5;   // Slightly wider gap
          
          if (barsRef.current.length !== BAR_COUNT) barsRef.current = new Array(BAR_COUNT).fill(0);
          
          const freqData = getAudioVisualData();
          let activeData = new Array(BAR_COUNT).fill(0);

          if (freqData && isAiSpeaking) {
              const step = Math.floor(freqData.length / BAR_COUNT);
              for (let i = 0; i < BAR_COUNT; i++) {
                  let sum = 0;
                  for (let j = 0; j < step; j++) sum += freqData[i * step + j];
                  activeData[i] = sum / step;
              }
          } else {
              // Idle Animation
              for(let i=0; i<BAR_COUNT; i++) {
                  activeData[i] = 30 + Math.sin(time + i * 0.3) * 18 + Math.sin(time * 0.5 + i * 0.1) * 6;
              }
          }

          // Smooth & Draw
          const totalWidth = BAR_COUNT * (BAR_WIDTH + BAR_GAP);
          const startX = CENTER_X - totalWidth / 2;

          for (let i = 0; i < BAR_COUNT; i++) {
              barsRef.current[i] += (activeData[i] - barsRef.current[i]) * 0.2;
              const height = Math.max(4, barsRef.current[i] * 0.85); // Taller bars
              const x = startX + i * (BAR_WIDTH + BAR_GAP);
              
              const gradient = ctx.createLinearGradient(0, CENTER_Y - height/2, 0, CENTER_Y + height/2);
              gradient.addColorStop(0, colors.primary);
              gradient.addColorStop(1, colors.secondary);
              ctx.fillStyle = gradient;
              
              ctx.beginPath();
              ctx.roundRect(x, CENTER_Y - height / 2, BAR_WIDTH, height, 4);
              ctx.fill();
          }
      } 
      
      // 2. LINE VISUALIZER (Cyan - Oscilloscope & Infinity Loop)
      else if (visualizerType === 'line') {
          const waveData = getAudioWaveformData();
          
          if (waveData && isAiSpeaking) {
              // --- SPEAKING STATE: Waveform ---
              ctx.beginPath();
              ctx.lineWidth = 3;
              ctx.strokeStyle = colors.primary;
              ctx.shadowBlur = 15;
              ctx.shadowColor = colors.primary;

              const sliceWidth = rect.width / waveData.length;
              let x = 0;
              for (let i = 0; i < waveData.length; i++) {
                  const v = waveData[i] / 128.0;
                  const y = (v * rect.height) / 2;
                  if (i === 0) ctx.moveTo(x, y);
                  else ctx.lineTo(x, y);
                  x += sliceWidth;
              }
              ctx.stroke();
              ctx.shadowBlur = 0;
          } else {
              // --- IDLE STATE: Circulating Infinity Loop (∞) ---
              // Lissajous curve: x = A cos(t), y = B sin(2t)
              
              // Scale to fit nicely within 360x240 canvas without clipping glow
              // Radius 100 + 6 padding + 20 glow = ~126 height usage (from center)
              // Center Y is 120. So we need to be careful.
              // Reducing slightly to 100 ensures no top/bottom clipping.
              const scaleX = 100; 
              const scaleY = 40; 
              const speed = time * 1.5; // Circulation speed

              // 0. Draw Outer Enclosing Circle (Perfect Fit)
              // Fit exactly to the width of the infinity loop + small padding for glow
              const outerRadius = scaleX + 6; 

              // Breathing effect for outer circle
              const outerAlpha = 0.15 + Math.sin(time * 2) * 0.05;

              // Base Circle
              ctx.beginPath();
              ctx.lineWidth = 1;
              ctx.strokeStyle = `rgba(34, 211, 238, ${outerAlpha})`; 
              ctx.arc(CENTER_X, CENTER_Y, outerRadius, 0, Math.PI * 2);
              ctx.stroke();

              // Rotating Arc (Scanner Effect)
              ctx.beginPath();
              ctx.lineWidth = 2;
              ctx.strokeStyle = `${colors.primary}40`; // Brighter
              const rot = time * 0.2; // Slow rotation
              ctx.arc(CENTER_X, CENTER_Y, outerRadius, rot, rot + Math.PI / 3); // 60 degree arc
              ctx.stroke();

              // 1. Draw Faint Background Track (Infinity)
              ctx.beginPath();
              ctx.lineWidth = 1;
              ctx.strokeStyle = `${colors.primary}20`; // Low opacity
              for (let t = 0; t <= Math.PI * 2; t += 0.05) {
                  const x = CENTER_X + scaleX * Math.cos(t);
                  const y = CENTER_Y + scaleY * Math.sin(2 * t);
                  if (t === 0) ctx.moveTo(x, y);
                  else ctx.lineTo(x, y);
              }
              ctx.closePath();
              ctx.stroke();

              // 2. Draw "Light Trail" Energy Effect
              const trailLength = 30; // Length of the comet tail
              ctx.lineWidth = 4;
              ctx.lineCap = 'round';

              for (let i = 0; i < trailLength; i++) {
                  // Calculate position for this segment of the trail
                  // Trail lags behind current time
                  const tCurrent = (speed - i * 0.04); 
                  const tNext = (speed - (i + 1) * 0.04);
                  
                  const x1 = CENTER_X + scaleX * Math.cos(tCurrent);
                  const y1 = CENTER_Y + scaleY * Math.sin(2 * tCurrent);
                  
                  const x2 = CENTER_X + scaleX * Math.cos(tNext);
                  const y2 = CENTER_Y + scaleY * Math.sin(2 * tNext);
                  
                  ctx.beginPath();
                  ctx.moveTo(x1, y1);
                  ctx.lineTo(x2, y2);
                  
                  // Gradient Opacity for Trail (Fade out tail)
                  const alpha = (1 - (i / trailLength));
                  ctx.strokeStyle = `rgba(34, 211, 238, ${alpha})`; // Cyan
                  ctx.stroke();
              }

              // 3. Draw Bright Head (Leading point)
              const headT = speed;
              const hx = CENTER_X + scaleX * Math.cos(headT);
              const hy = CENTER_Y + scaleY * Math.sin(2 * headT);
              
              ctx.shadowBlur = 15;
              ctx.shadowColor = colors.primary;
              ctx.fillStyle = '#fff';
              
              ctx.beginPath();
              ctx.arc(hx, hy, 4, 0, Math.PI * 2);
              ctx.fill();
              
              ctx.shadowBlur = 0;
          }
      }

      // 3. CIRCLE VISUALIZER (Sky Blue - Smooth Organic Shape)
      else if (visualizerType === 'circle') {
          const freqData = getAudioVisualData();
          const radius = 75; // Increased base radius for larger canvas
          // Fewer points for smoother curve
          const points = 16; 
          const angleStep = (Math.PI * 2) / points;
          
          const pathPoints: {x: number, y: number}[] = [];

          // 1. Calculate Points
          for (let i = 0; i < points; i++) {
              let val = 0;
              if (freqData && isAiSpeaking) {
                  // Map circle index to freq data (using lower frequencies for bass impact)
                  const bin = Math.floor((i / points) * (freqData.length / 2)); 
                  val = freqData[bin] * 0.6; // Increased sensitivity
              } else {
                  // Idle breathing effect
                  val = Math.sin(time * 2 + i) * 8 + 5;
              }

              const r = radius + val;
              const x = CENTER_X + Math.cos(i * angleStep) * r;
              const y = CENTER_Y + Math.sin(i * angleStep) * r;
              pathPoints.push({x, y});
          }

          // 2. Draw Smooth Curve (Quadratic Bezier) through points
          ctx.beginPath();
          ctx.strokeStyle = colors.primary;
          ctx.lineWidth = 3;
          ctx.shadowBlur = 20;
          ctx.shadowColor = colors.secondary;

          // Start from the midpoint between the last and first point
          const p0 = pathPoints[0];
          const pLast = pathPoints[pathPoints.length - 1];
          let midX = (pLast.x + p0.x) / 2;
          let midY = (pLast.y + p0.y) / 2;
          
          ctx.moveTo(midX, midY);

          for (let i = 0; i < pathPoints.length; i++) {
              const p1 = pathPoints[i];
              const p2 = pathPoints[(i + 1) % pathPoints.length];
              // Control point is p1, End point is midpoint(p1, p2)
              const nextMidX = (p1.x + p2.x) / 2;
              const nextMidY = (p1.y + p2.y) / 2;
              
              ctx.quadraticCurveTo(p1.x, p1.y, nextMidX, nextMidY);
          }
          
          ctx.closePath();
          ctx.stroke();
          
          // Inner Fill
          ctx.fillStyle = colors.glow;
          ctx.fill();
          ctx.shadowBlur = 0;
      }

      // 4 & 5. CLOUD & FOG VISUALIZER (Violet & Blue Gray - Particles)
      else if (visualizerType === 'cloud' || visualizerType === 'fog') {
          const freqData = getAudioVisualData();
          let avgVol = 0;
          if (freqData && isAiSpeaking) {
              let sum = 0;
              for(let i=0; i<freqData.length/2; i++) sum += freqData[i];
              avgVol = sum / (freqData.length/2);
          } else {
              avgVol = 20 + Math.sin(time) * 10;
          }
          
          // Color Config
          const r = visualizerType === 'cloud' ? 167 : 148;
          const g = visualizerType === 'cloud' ? 139 : 163;
          const b = visualizerType === 'cloud' ? 250 : 184;

          particlesRef.current.forEach((p, i) => {
              // Physics Update (Gentle floating)
              p.x += p.vx + Math.cos(time * 0.5 + i) * 0.3;
              p.y += p.vy + Math.sin(time * 0.5 + i) * 0.3;
              
              // Gentle center attraction
              const dx = CENTER_X - p.x;
              const dy = CENTER_Y - p.y;
              p.x += dx * 0.005;
              p.y += dy * 0.005;

              // Radius modulated by audio volume
              const pulse = Math.max(0, (avgVol - 20) * 0.5);
              const currentR = p.r + pulse * (0.5 + Math.random() * 0.5);
              
              // Gradient for soft particle look
              const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, currentR);
              gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${p.alpha + (pulse * 0.005)})`); 
              gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

              ctx.beginPath();
              ctx.arc(p.x, p.y, currentR, 0, Math.PI * 2);
              ctx.fillStyle = gradient;
              ctx.fill();
          });
      }

      requestRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isAiSpeaking, visualizerType]);

  // --- USER VOLUME VISUALS ---
  const scale = 1 + Math.min(userVolume * 15, 1.5);
  const opacity = Math.min(userVolume * 10, 0.6);

  // Dynamic Mic Color
  const getMicColorClass = () => {
      if (userVolume <= 0.01) return "text-gray-500";
      switch(visualizerType) {
          case 'line': return "text-cyan-400";
          case 'circle': return "text-sky-400"; // Changed from rose-400 to sky-400
          case 'cloud': return "text-violet-400";
          case 'fog': return "text-slate-400";
          default: return "text-blue-400";
      }
  };

  return (
    <div className="relative w-full h-full flex flex-col">
       
       {/* Top Left Thinking Indicator */}
       {isThinking && (
           <div className="absolute top-6 left-6 z-20 flex items-center gap-3 animate-in fade-in duration-300">
               <div className="relative">
                   <div className={`absolute inset-0 rounded-full animate-ping opacity-30`} style={{ backgroundColor: theme.primary }}></div>
                   <div className={`relative p-2 rounded-full border opacity-90`} style={{ borderColor: theme.primary, backgroundColor: `${theme.primary}20`, color: theme.primary }}>
                       <BrainCircuit size={20} className="animate-pulse" />
                   </div>
               </div>
               <div className="flex flex-col">
                   <span className="font-bold text-sm tracking-wider uppercase" style={{ color: theme.primary }}>Processing</span>
                   <span className="text-[10px] animate-pulse opacity-70" style={{ color: theme.primary }}>Thinking...</span>
               </div>
           </div>
       )}

       {/* AI Output Visualizer (Center) */}
       <div className="flex-1 flex items-center justify-center relative">
          {/* Glow Effect based on Theme Color */}
          <div 
            className={`absolute w-64 h-64 blur-[80px] rounded-full transition-all duration-1000 ${isAiSpeaking ? 'opacity-60 scale-110' : 'opacity-20 scale-100'}`} 
            style={{ backgroundColor: theme.primary }}
          />
          
          <div className="relative z-10 text-center flex flex-col items-center">
             {/* INCREASED CANVAS SIZE BY 20% (300x200 -> 360x240) */}
             <canvas ref={canvasRef} className="w-[360px] h-[240px]" />
             
             {/* Text Status Update */}
             <div className="mt-8 tracking-wider animate-pulse transition-all duration-300 flex items-center justify-center gap-2">
                {isAiSpeaking ? (
                    <span className="text-3xl font-bold" style={{ fontFamily: "'Dancing Script', cursive", color: theme.primary }}>Speaking...</span>
                ) : (
                    <span 
                        className="text-4xl font-bold transition-colors duration-500" 
                        style={{ fontFamily: "'Dancing Script', cursive", color: theme.primary }}
                    >
                        Listening...
                    </span>
                )}
             </div>
          </div>
       </div>

       {/* User Input Visualizer (Bottom Right) */}
       <div className="absolute bottom-6 right-6 flex items-center justify-center">
           {/* Ripples */}
           <div 
             className="absolute rounded-full transition-all duration-75 ease-out"
             style={{ 
                 width: '50px',
                 height: '50px',
                 backgroundColor: theme.primary,
                 opacity: opacity * 0.5,
                 transform: `scale(${scale})`
             }}
           />
           <div 
             className="absolute rounded-full transition-all duration-75 ease-out delay-75"
             style={{ 
                 width: '50px',
                 height: '50px',
                 backgroundColor: theme.secondary,
                 opacity: opacity * 0.3,
                 transform: `scale(${scale * 1.2})`
             }}
           />

           {/* Mic Icon */}
           <div className="relative z-10 bg-[#1e1e1e] p-3 rounded-full border border-gray-700 shadow-lg">
               <Mic size={24} className={`${getMicColorClass()} transition-colors duration-200`} />
           </div>
       </div>
    </div>
  );
};

export default LiveVisualizer;
