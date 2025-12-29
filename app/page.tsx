'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Play, Pause, RefreshCw, Zap, Heart, Utensils, Brain, MessageSquare } from 'lucide-react';

interface NPC {
  id: string;
  name: string;
  role: string;
  personality: string;
  status: { hp: number; hunger: number; };
}

interface ActionLog {
  name: string;
  role: string;
  action: string;
  speech: string;
  thought: string;
}

interface LogEntry {
  id: number;
  created_at: string;
  event_type: string;
  content: string; // 可能是 JSON 字符串，也可能是普通文本
}

export default function Home() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAuto, setIsAuto] = useState(false);
  const autoRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = async () => {
    const { data: logData } = await supabase.from('game_logs').select('*').order('created_at', { ascending: false }).limit(50);
    const { data: npcData } = await supabase.from('npcs').select('*').order('name');
    if (logData) setLogs(logData);
    if (npcData) setNpcs(npcData);
  };

  const nextTurn = async () => {
    if (loading) return;
    setLoading(true);
    await fetch('/api/game-tick', { method: 'POST' });
    await fetchData();
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000); // 3秒刷新一次前端显示
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isAuto) {
      autoRef.current = setInterval(nextTurn, 10000); // 10秒自动跑一回合
    } else if (autoRef.current) {
      clearInterval(autoRef.current);
    }
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, [isAuto]);

  // 解析日志内容
  const renderLogContent = (log: LogEntry) => {
    // 1. 回合总结 (史诗故事)
    if (log.event_type === 'turn_summary') {
      return (
        <div className="bg-slate-800 border-l-4 border-purple-500 p-4 rounded text-gray-200 text-sm leading-relaxed italic shadow-md">
          <span className="text-purple-400 font-bold block mb-1 not-italic">✦ 回合纪事</span>
          {log.content}
        </div>
      );
    }

    // 2. 角色行动 (尝试解析 JSON)
    try {
      const data: ActionLog = JSON.parse(log.content);
      return (
        <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm hover:shadow-md transition-all relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900">{data.name}</span>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full border border-gray-200">{data.role}</span>
            </div>
            <span className="text-xs text-gray-400 font-mono">{new Date(log.created_at).toLocaleTimeString()}</span>
          </div>
          
          <div className="space-y-2">
            {/* 动作 */}
            <div className="text-gray-800 text-sm font-medium flex items-start gap-2">
              <Zap size={14} className="mt-1 text-yellow-600" />
              <span>{data.action}</span>
            </div>

            {/* 说话 */}
            {data.speech && (
              <div className="text-blue-700 text-sm bg-blue-50 p-2 rounded flex items-start gap-2">
                <MessageSquare size={14} className="mt-1 shrink-0" />
                <span>"{data.speech}"</span>
              </div>
            )}

            {/* 内心独白 (核心差异化) */}
            <div className="text-gray-500 text-xs italic flex items-start gap-2 border-t border-gray-100 pt-2 mt-2">
              <Brain size={14} className="mt-0.5 shrink-0" />
              <span>(心想: {data.thought})</span>
            </div>
          </div>
        </div>
      );
    } catch (e) {
      // 解析失败兜底
      return <div className="text-red-500 text-xs">数据解析错误: {log.content}</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* 顶部控制栏 */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200 px-6 py-4 flex justify-between items-center shadow-sm">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-800">旧世遗民 <span className="text-purple-600 font-light">OBSERVER</span></h1>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsAuto(!isAuto)} 
            className={`flex items-center gap-2 px-4 py-2 rounded-md font-bold text-sm transition-all ${isAuto ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
          >
            {isAuto ? <Pause size={16}/> : <Play size={16}/>} {isAuto ? '暂停模拟' : '自动演化'}
          </button>
          <button 
            onClick={nextTurn} 
            disabled={loading || isAuto}
            className="p-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 左侧：角色监控面板 (占4列) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">
            <ActivityIcon /> 实时生命体征
          </div>
          {npcs.map(npc => (
            <div key={npc.id} className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">{npc.name}</h3>
                <span className={`text-xs px-2 py-1 rounded font-medium ${npc.status.hp < 30 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {npc.status.hp < 30 ? '危急' : '健康'}
                </span>
              </div>
              
              <div className="space-y-4">
                {/* HP Bar */}
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span className="flex items-center gap-1"><Heart size={12}/> 生命值</span>
                    <span>{npc.status.hp}/100</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 transition-all duration-500" style={{width: `${npc.status.hp}%`}}></div>
                  </div>
                </div>

                {/* Hunger Bar */}
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span className="flex items-center gap-1"><Utensils size={12}/> 饥饿度</span>
                    <span>{npc.status.hunger}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 transition-all duration-500" style={{width: `${npc.status.hunger}%`}}></div>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500 italic">
                {npc.personality}
              </div>
            </div>
          ))}
        </div>

        {/* 右侧：事件流 (占8列) */}
        <div className="lg:col-span-8">
           <div className="flex items-center gap-2 text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
            <TerminalIcon /> 世界时间轴
          </div>
          <div className="space-y-4 pb-20">
            {logs.map(log => (
              <div key={log.id} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                {renderLogContent(log)}
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-center py-20 text-gray-400">
                暂无数据，请点击右上角“开始演化”
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// 简单的图标组件
function ActivityIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
}
function TerminalIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
}