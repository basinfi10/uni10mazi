
import React, { useState, useRef, useEffect } from 'react';
import { X, MessageSquarePlus, Settings, BookOpen, MoreVertical, Trash2, Edit2, ArrowUp, Pin, MessageSquare, ChevronRight, Utensils, Heart, Lightbulb, Download, Upload, CloudSun, Languages, Flower, Laugh, GraduationCap, Atom, Code, BrainCircuit, UserCheck, Play, Check, Clapperboard, ChefHat } from 'lucide-react';
import { ChatSession } from '../types';
import { SERVICE_DATA, LIVE_PERSONAS, LivePersona } from './Service_Prompts';

interface SidebarProps {
  isOpen: boolean;
  sessions: ChatSession[];
  currentSessionId: string | null;
  activeCategoryId?: string | null;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onTogglePin: (id: string) => void;
  onOpenSettings: () => void;
  onOpenEnglish: () => void;
  onSelectServiceCategory: (categoryId: string) => void;
  onClose?: () => void;
  onImportSessions: (sessions: ChatSession[]) => void;
  aiModel: 'standard' | 'live';
  activeLivePersonaId?: string; // Currently active persona ID
  onSelectLivePersona: (id: string, command: string) => void; // Updated signature
}

const Sidebar: React.FC<SidebarProps> = React.memo(({
  isOpen,
  sessions,
  currentSessionId,
  activeCategoryId,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  onTogglePin,
  onOpenSettings,
  onOpenEnglish,
  onSelectServiceCategory,
  onClose,
  onImportSessions,
  aiModel,
  activeLivePersonaId,
  onSelectLivePersona
}) => {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingId]);

  const handleStartEdit = (session: ChatSession) => {
    setEditingId(session.id);
    setEditTitle(session.title);
    setMenuOpenId(null);
  };

  const handleFinishEdit = () => {
    if (editingId && editTitle.trim()) {
      onRenameSession(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleFinishEdit();
    if (e.key === 'Escape') setEditingId(null);
  };

  // --- Import / Export Handlers ---

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(sessions));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    const date = new Date().toISOString().slice(0, 10);
    downloadAnchorNode.setAttribute("download", `mazi-chat-backup-${date}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        onImportSessions(parsed);
      } catch (err) {
        console.error("Failed to parse backup file", err);
        alert("파일을 읽는 중 오류가 발생했습니다.");
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };


  const getServiceIcon = (id: string) => {
    // Icons 20% smaller (18 * 0.8 ~= 14.4 -> 15)
    switch (id) {
      case 'weather_news': return <CloudSun size={15} />;
      case 'english': return <BookOpen size={15} />;
      case 'japanese': return <Flower size={15} />;
      case 'cooking': return <Utensils size={15} />;
      case 'health': return <Heart size={15} />;
      case 'life': return <Lightbulb size={15} />;
      default: return <BookOpen size={15} />;
    }
  };

  const getLivePersonaIcon = (iconId: string) => {
    switch (iconId) {
      case 'smile': return <MessageSquare size={15} />;
      case 'laugh': return <Laugh size={15} />;
      case 'culture': return <Clapperboard size={15} />;
      case 'chef': return <ChefHat size={15} />;
      case 'quiz': return <Lightbulb size={15} />;
      case 'eng_beg': return <BookOpen size={15} />;
      case 'eng_int': return <GraduationCap size={15} />;
      case 'jp_beg': return <Flower size={15} />;
      case 'jp_int': return <Languages size={15} />;
      case 'knowledge': return <BrainCircuit size={15} />;
      case 'mentor': return <UserCheck size={15} />;
      case 'science': return <Atom size={15} />;
      case 'code': return <Code size={15} />;
      default: return <MessageSquare size={15} />;
    }
  };

  // Helper to check for mobile width
  const checkMobileAndClose = () => {
    if (window.innerWidth < 768 && onClose) {
      onClose();
    }
  };

  // Sort sessions: Pinned first, then by updatedAt desc
  const sortedSessions = [...sessions].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.updatedAt - a.updatedAt;
  });

  return (
    <aside
      className={`
        bg-[#1a1a1a] border-r border-gray-800 flex flex-col shadow-2xl z-20
        transition-all duration-300 ease-in-out overflow-hidden
        ${isOpen ? 'w-[210px] min-w-[210px] opacity-100' : 'w-0 min-w-0 opacity-0'}
      `}
    >
      <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#1e1e1e] min-w-[210px]">
        {aiModel === 'live' ? (
          <div className="flex-1 bg-emerald-900/20 border border-emerald-500/30 rounded-xl px-3 py-1.5 flex items-center justify-center">
            <h2 className="font-bold text-xl text-emerald-400">
              Live Personas
            </h2>
          </div>
        ) : (
          <h2 className="font-bold text-base text-gray-100 pl-2">
            Standard Menu
          </h2>
        )}

        {onClose && (
          <button
            onClick={onClose}
            className="p-2 ml-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-800 transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-2 min-w-[210px] custom-scrollbar">

        {/* === LIVE MODE MENU === */}
        {aiModel === 'live' ? (
          <div className="px-3 pb-4">
            <p className="px-2 text-[10px] font-semibold text-purple-400 mb-2 uppercase tracking-wider flex items-center gap-1 mt-2">
              <Play size={10} fill="currentColor" />
              Live 페르소나 선택
            </p>
            <div className="space-y-1">
              {LIVE_PERSONAS.map((persona) => {
                const isActive = activeLivePersonaId === persona.id;
                return (
                  <button
                    key={persona.id}
                    onClick={() => {
                      onSelectLivePersona(persona.id, persona.command);
                      checkMobileAndClose();
                    }}
                    className={`
                                    w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-all border group relative
                                    ${isActive
                        ? 'bg-purple-900/30 border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.15)]'
                        : 'bg-[#252525] border-transparent hover:border-purple-500/30 hover:bg-gray-800'
                      }
                                `}
                  >
                    <span className={`${isActive ? 'text-purple-300' : 'text-gray-400 group-hover:text-purple-400'} transition-colors`}>
                      {getLivePersonaIcon(persona.iconId)}
                    </span>
                    <div className="flex flex-col overflow-hidden flex-1">
                      <span className={`font-medium text-xs truncate ${isActive ? 'text-purple-200' : 'text-gray-200 group-hover:text-purple-300'}`}>
                        {persona.label}
                      </span>
                      <span className={`text-[10px] truncate ${isActive ? 'text-purple-300/70' : 'text-gray-500'}`}>
                        {persona.desc}
                      </span>
                    </div>
                    {isActive && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <Check size={14} className="text-purple-400" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 px-2 py-3 bg-purple-900/10 rounded-lg border border-purple-900/30">
              <p className="text-[10px] text-purple-300 leading-relaxed">
                Tip: 역할을 선택하면 AI가 해당 페르소나로 즉시 전환됩니다. "모드 종료"라고 말하면 기본 상태로 돌아갑니다.
              </p>
            </div>
          </div>
        ) : (
          /* === STANDARD MODE MENU === */
          <>
            <div className="px-3 pb-4 border-b border-gray-800">
              <button
                onClick={() => { onNewChat(); checkMobileAndClose(); }}
                className="w-full text-left px-4 py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center justify-center gap-3 transition-all shadow-lg active:scale-95 mb-4 group"
              >
                <MessageSquarePlus size={20} className="group-hover:rotate-12 transition-transform" />
                <span className="font-bold text-sm tracking-wide">MAZI Service</span>
              </button>

              <p className="px-2 text-[10px] font-semibold text-gray-400 mb-2 uppercase tracking-wider flex items-center gap-1">
                <BookOpen size={10} />
                기능 선택 (Features)
              </p>
              <div className="space-y-1">
                {SERVICE_DATA.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => {
                      onSelectServiceCategory(category.id);
                      checkMobileAndClose();
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between group ${activeCategoryId === category.id ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-500/30' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={activeCategoryId === category.id ? 'text-emerald-400' : 'text-gray-500 group-hover:text-emerald-400 transition-colors'}>
                        {getServiceIcon(category.id)}
                      </span>
                      {category.label}
                    </div>
                    {activeCategoryId === category.id && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-3 py-4">
              {/* Header with Backup Controls inline */}
              <div className="flex items-center justify-between px-2 mb-2">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <MessageSquare size={10} />
                  최근 대화
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExport}
                    className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-emerald-400 transition-colors"
                    title="백업 저장"
                  >
                    <Download size={14} />
                  </button>
                  <button
                    onClick={handleImportClick}
                    className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-blue-400 transition-colors"
                    title="백업 불러오기"
                  >
                    <Upload size={14} />
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".json"
                    onChange={handleFileChange}
                  />
                </div>
              </div>

              {sessions.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-600 text-xs italic bg-[#1e1e1e] rounded-xl border border-gray-800 mx-1">
                  대화 기록이 없습니다
                </div>
              ) : (
                <div className="space-y-1">
                  {sortedSessions.map((session) => (
                    <div key={session.id} className="group relative">
                      {editingId === session.id ? (
                        <div className="flex items-center p-2 bg-gray-800 rounded-lg border border-emerald-500/50">
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onBlur={handleFinishEdit}
                            onKeyDown={handleKeyDown}
                            className="w-full bg-transparent text-xs text-white outline-none"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => { onSelectSession(session.id); checkMobileAndClose(); }}
                          className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all flex items-center gap-3 group/btn relative overflow-hidden ${currentSessionId === session.id
                            ? 'bg-[#252525] text-white font-medium border-l-2 border-emerald-500 shadow-md'
                            : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                            }`}
                        >
                          <MessageSquare size={14} className={`flex-shrink-0 transition-colors ${currentSessionId === session.id ? 'text-emerald-400' : 'text-gray-600 group-hover/btn:text-gray-400'}`} />
                          <span className="truncate pr-6">{session.title}</span>
                          {session.pinned && <Pin size={10} className="absolute right-8 text-amber-500 fill-amber-500" />}

                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId(menuOpenId === session.id ? null : session.id);
                            }}
                            className={`absolute right-1 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-700 ${menuOpenId === session.id ? 'opacity-100 bg-gray-700 text-white' : 'text-gray-500'}`}
                          >
                            <MoreVertical size={14} />
                          </div>
                        </button>
                      )}

                      {/* Dropdown Menu */}
                      {menuOpenId === session.id && (
                        <div ref={menuRef} className="absolute right-0 top-8 w-32 bg-[#2a2a2a] border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                          <button
                            onClick={() => { onTogglePin(session.id); setMenuOpenId(null); }}
                            className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 hover:text-amber-400 flex items-center gap-2"
                          >
                            <Pin size={12} />
                            {session.pinned ? '고정 해제' : '상단 고정'}
                          </button>
                          <button
                            onClick={() => handleStartEdit(session)}
                            className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 hover:text-blue-400 flex items-center gap-2"
                          >
                            <Edit2 size={12} />
                            이름 변경
                          </button>
                          <div className="h-px bg-gray-700 my-1"></div>
                          <button
                            onClick={() => { onDeleteSession(session.id); setMenuOpenId(null); }}
                            className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-gray-700 hover:text-red-300 flex items-center gap-2"
                          >
                            <Trash2 size={12} />
                            삭제
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer Settings */}
      <div className="p-3 border-t border-gray-800 bg-[#1e1e1e] min-w-[210px] space-y-1">

        <button
          onClick={onOpenSettings}
          className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-3"
        >
          <Settings size={16} />
          설정
        </button>
        <div className="pt-2 text-[10px] text-gray-600 text-center">
          v2.04 (Auto-start Live)
        </div>
      </div>
    </aside>
  );
});

export default Sidebar;
