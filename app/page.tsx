'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase'; // 确保 tsconfig.json 中 paths 配置正确，或者改成 '../lib/supabase'
import { 
  Play, RefreshCw, Zap, Heart, Utensils, Brain, 
  Home as HomeIcon, Trees, Factory, Droplets, 
  Terminal, Hammer
} from 'lucide-react';

interface NPC {
  id: string;
  name: string;
  role: string;
  status: { hp: number; hunger: number; sanity: number };
  location_id: string;
}

interface WorldState {
  turn_count: number;
  construction_progress: number;
}

interface GameLog {
  id: number;
  content: string;
  created_at: string;
}

const LOCATIONS: Record<string, { name: string, icon: any, color: string, desc: string }> = {
  'camp': { name: '核心营地', icon: HomeIcon, color: 'text-amber-400 border-amber-500/30 bg-amber-950/20', desc: '庇护所与信号塔' },
  'forest': { name: '迷雾森林', icon: Trees, color: 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20', desc: '资源: 木材' },
  'ruins': { name: '旧城废墟', icon: Factory, color: 'text-rose-400 border-rose-500/30 bg-rose-950/20', desc: '资源: 废铁' },
  'lake': { name: '寂静湖', icon: Droplets, color: 'text-cyan-400 border-cyan-500/30 bg-cyan-950/20', desc: '资源: 食物' },
};

export default function Home() {
  const [world, setWorld] = useState<WorldState | null>(null);
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [logs, setLogs] = useState<GameLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [whisperTarget, setWhisperTarget] = useState<NPC | null>(null);
  const [whisperText, setWhisperText] = useState('');

  const fetchData = async () => {
    const { data: w } = await supabase.from('world_state').select('*').single();
    const { data: n } = await supabase.from('npcs').select('*').eq('is_alive', true).order('name');
    const { data: l } = await supabase.from('game_logs').select('*').order('created_at', { ascending: false }).limit(20);
    if (w) setWorld(w);
    if (n) setNpcs(n);
    if (l) setLogs(l);
  };

  const nextTurn = async () => {
    if (loading) return;
    setLoading(true);
    await fetch('/api/game-tick', { method: 'POST' });
    await fetchData();
    setLoading(false);
  };

  const sendWhisper = async () => {
    if (!whisperTarget || !whisperText) return;
    await fetch('/api/whisper', {
      method: 'POST',
      body: JSON.stringify({ npc_id: whisperTarget.id, npc_name: whisperTarget.name, message: whisperText })
    });
    setWhisperText('');
    setWhisperTarget(null);
    alert('神谕已发送');
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const parseLog = (content: string) => {
    try {
      const data = JSON.parse(content);
      return (
        <div className="flex gap-2 items-start text-sm">
          <span className="font-bold text-slate-300 whitespace-nowrap">[{data.name}]</span>
          <div className="flex flex-col">
            <span className="text-slate-400">{data.action}</span>
            {data.speech && <span className="text-cyan-600/80 italic">"{data.speech}"</span>}
          </div>
        </div>
      );
    } catch {
      return <span className="text-slate-500 text-sm">{content}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-mono p-4 md:p-6 selection:bg-amber-500/30">
      
      {/* 顶部仪表盘 */}
      <header className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-600 rounded flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.5)]">
            <Terminal size={24} className="text-black" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-widest text-slate-100">SHELTER</h1>
            <div className="flex items-center gap-2 text-xs text-amber-500 font-bold uppercase tracking-wider">
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
              Online | Turn {world?.turn_count || 0}
            </div>
          </div>
        </div>

        {/* 进度条 */}
        <div className="bg-slate-900/50 border border-slate-800 rounded p-3 flex flex-col justify-center">
          <div className="flex justify-between text-xs mb-2 font-bold text-slate-400 uppercase">
            <span className="flex items-center gap-2"><Hammer size={12}/> Babel Tower Protocol</span>
            <span>{world?.construction_progress || 0}%</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-amber-700 to-amber-500 transition-all duration-700 shadow-[0_0_10px_rgba(245,158,11,0.3)]" 
              style={{width: `${world?.construction_progress || 0}%`}}
            ></div>
          </div>
        </div>

        {/* 控制区 */}
        <div className="flex items-center justify-end">
          <button 
            onClick={nextTurn} 
            disabled={loading}
            className="group relative bg-slate-800 hover:bg-slate-700 text-slate-200 px-6 py-3 rounded border border-slate-700 transition-all overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 w-1 bg-amber-500 transition-all group-hover:w-full opacity-10"></div>
            <div className="flex items-center gap-2 font-bold relative z-10">
              {loading ? <RefreshCw className="animate-spin" size={18}/> : <Play size={18} fill="currentColor"/>}
              <span>{loading ? 'PROCESSING...' : 'NEXT CYCLE'}</span>
            </div>
          </button>
        </div>
      </header>

      {/* 主地图区域 */}
      <main className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        {Object.entries(LOCATIONS).map(([key, loc]) => {
          const Icon = loc.icon;
          const localNpcs = npcs.filter(n => n.location_id === key);
          
          return (
            <div key={key} className={`border rounded-lg p-4 min-h-[240px] flex flex-col transition-all relative overflow-hidden group ${loc.color}`}>
              {/* 背景装饰网格 */}
              <div className="absolute inset-0 opacity-5 bg-[length:30px_30px] bg-grid-white"></div>
              
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="flex items-center gap-2">
                  <Icon size={18} />
                  <h2 className="font-bold tracking-wider">{loc.name}</h2>
                </div>
                <span className="text-[10px] uppercase opacity-70 border border-current px-1 rounded">{loc.desc}</span>
              </div>

              <div className="space-y-3 relative z-10 flex-1">
                {localNpcs.map(npc => (
                  <div key={npc.id} className="bg-slate-950/80 backdrop-blur border border-slate-800 p-3 rounded hover:border-slate-600 transition-colors group/card">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-slate-200 text-sm">{npc.name}</span>
                      <button 
                        onClick={() => setWhisperTarget(npc)}
                        className="opacity-0 group-hover/card:opacity-100 transition-opacity text-xs bg-slate-800 hover:bg-amber-600 hover:text-black px-2 py-0.5 rounded text-slate-400"
                      >
                        Whisper
                      </button>
                    </div>
                    
                    {/* 状态条 */}
                    <div className="space-y-1">
                      <Bar value={npc.status.hp} color="bg-rose-600" label="HP" />
                      <Bar value={npc.status.hunger} color="bg-amber-600" label="HUN" />
                      <Bar value={npc.status.sanity} color="bg-purple-600" label="SAN" />
                    </div>
                  </div>
                ))}
                {localNpcs.length === 0 && (
                  <div className="h-full flex items-center justify-center opacity-20">
                    <span className="text-4xl font-thin tracking-widest">EMPTY</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </main>

      {/* 日志区 */}
      <footer className="border-t border-slate-800 pt-4 grid grid-cols-1 lg:grid-cols-1 gap-4">
        <div className="bg-black/30 rounded border border-slate-800 p-4 font-mono text-xs h-64 overflow-y-auto">
          <div className="sticky top-0 bg-slate-950/90 backdrop-blur pb-2 mb-2 border-b border-slate-800 text-slate-500 font-bold uppercase flex justify-between items-center">
             <span>System Logs</span>
             <span className="animate-pulse text-green-500">● LIVE</span>
          </div>
          <div className="space-y-1.5">
            {logs.map(log => (
              <div key={log.id} className="border-l-2 border-slate-800 pl-2 hover:border-amber-500 transition-colors py-0.5">
                <span className="text-slate-600 mr-3">[{new Date(log.created_at).toLocaleTimeString()}]</span>
                {parseLog(log.content)}
              </div>
            ))}
          </div>
        </div>
      </footer>

      {/* 神谕弹窗 */}
      {whisperTarget && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-amber-500 mb-2">WHISPER PROTOCOL</h3>
            <p className="text-sm text-slate-400 mb-4">Target: {whisperTarget.name}</p>
            <textarea 
              value={whisperText}
              onChange={(e) => setWhisperText(e.target.value)}
              className="w-full bg-black border border-slate-700 rounded p-3 text-slate-200 focus:border-amber-500 outline-none h-32 mb-4 font-mono text-sm"
              placeholder="Inject command directly into cortex..."
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setWhisperTarget(null)} className="px-4 py-2 text-slate-500 hover:text-slate-300">CANCEL</button>
              <button onClick={sendWhisper} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-black font-bold rounded">EXECUTE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Bar({ value, color, label }: { value: number, color: string, label: string }) {
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="text-slate-500 w-6 text-right">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }}></div>
      </div>
    </div>
  );
}