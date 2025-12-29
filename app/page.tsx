'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Play, RefreshCw, Zap, Heart, Utensils, Brain, 
  MapPin, Home, Trees, Factory, Droplets, 
  MessageCircle, Hammer, CloudRain, Sun, CloudFog 
} from 'lucide-react';

// --- 类型定义 ---
interface NPC {
  id: string;
  name: string;
  role: string;
  status: { hp: number; hunger: number; sanity: number };
  location_id: string;
}

interface WorldState {
  turn_count: number;
  weather: string;
  construction_progress: number;
}

interface GameLog {
  id: number;
  content: string;
  created_at: string;
}

// --- 地点配置 ---
const LOCATIONS: Record<string, { name: string, icon: any, color: string, desc: string }> = {
  'camp': { name: '核心营地', icon: Home, color: 'bg-amber-50 border-amber-200 text-amber-800', desc: '建设巴别塔的基地' },
  'forest': { name: '迷雾森林', icon: Trees, color: 'bg-emerald-50 border-emerald-200 text-emerald-800', desc: '产出: 木材 (危险: 中)' },
  'ruins': { name: '旧城废墟', icon: Factory, color: 'bg-slate-50 border-slate-200 text-slate-800', desc: '产出: 废铁 (危险: 高)' },
  'lake': { name: '寂静湖', icon: Droplets, color: 'bg-cyan-50 border-cyan-200 text-cyan-800', desc: '产出: 食物 (危险: 低)' },
};

export default function Home() {
  const [world, setWorld] = useState<WorldState | null>(null);
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [logs, setLogs] = useState<GameLog[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 神谕相关状态
  const [whisperTarget, setWhisperTarget] = useState<NPC | null>(null);
  const [whisperText, setWhisperText] = useState('');
  const [sendingWhisper, setSendingWhisper] = useState(false);

  // 1. 获取数据
  const fetchData = async () => {
    const { data: w } = await supabase.from('world_state').select('*').single();
    const { data: n } = await supabase.from('npcs').select('*').eq('is_alive', true).order('name');
    const { data: l } = await supabase.from('game_logs').select('*').order('created_at', { ascending: false }).limit(10);
    
    if (w) setWorld(w);
    if (n) setNpcs(n);
    if (l) setLogs(l);
  };

  // 2. 下一回合
  const nextTurn = async () => {
    if (loading) return;
    setLoading(true);
    await fetch('/api/game-tick', { method: 'POST' });
    await fetchData();
    setLoading(false);
  };

  // 3. 发送神谕
  const sendWhisper = async () => {
    if (!whisperTarget || !whisperText) return;
    setSendingWhisper(true);
    await fetch('/api/whisper', {
      method: 'POST',
      body: JSON.stringify({ 
        npc_id: whisperTarget.id, 
        npc_name: whisperTarget.name,
        message: whisperText 
      })
    });
    setWhisperText('');
    setWhisperTarget(null);
    setSendingWhisper(false);
    alert('神谕已降下，该角色将在下回合收到指引。');
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  // 解析日志 (处理 JSON 或 纯文本)
  const parseLog = (content: string) => {
    try {
      const data = JSON.parse(content);
      return (
        <span>
          <span className="font-bold text-gray-800">{data.name}</span>: {data.action} 
          <span className="text-gray-400 text-xs ml-2">"{data.speech}"</span>
        </span>
      );
    } catch {
      return <span>{content}</span>;
    }
  };

  // 获取天气图标
  const getWeatherIcon = (w: string) => {
    if (w?.includes('雨')) return <CloudRain size={20} className="text-blue-500"/>;
    if (w?.includes('雾')) return <CloudFog size={20} className="text-gray-400"/>;
    return <Sun size={20} className="text-orange-500"/>;
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans p-4 md:p-8">
      
      {/* --- 顶部 HUD --- */}
      <header className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-slate-900 text-white p-3 rounded-lg">
            <h1 className="font-black text-xl tracking-tighter">SHELTER</h1>
            <p className="text-xs text-slate-400">BABEL PROJECT</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
              <RefreshCw size={16}/> 第 {world?.turn_count || 0} 回合
              <span className="mx-2 text-slate-300">|</span>
              {getWeatherIcon(world?.weather || '')} {world?.weather}
            </div>
            {/* 巴别塔进度条 */}
            <div className="w-48">
              <div className="flex justify-between text-xs mb-1 font-bold text-amber-600">
                <span className="flex items-center gap-1"><Hammer size={12}/> 信号塔修复进度</span>
                <span>{world?.construction_progress || 0}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div className="h-full bg-amber-500 transition-all duration-500" style={{width: `${world?.construction_progress || 0}%`}}></div>
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={nextTurn} 
          disabled={loading}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-lg font-bold transition-all disabled:opacity-50 shadow-lg shadow-slate-200"
        >
          {loading ? <RefreshCw className="animate-spin" /> : <Play fill="currentColor" />}
          {loading ? '演化中...' : '下一回合'}
        </button>
      </header>

      {/* --- 游戏主地图 (2x2 Grid) --- */}
      <main className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {Object.entries(LOCATIONS).map(([key, loc]) => {
          const Icon = loc.icon;
          // 筛选当前地点的 NPC
          const localNpcs = npcs.filter(n => n.location_id === key);

          return (
            <div key={key} className={`rounded-xl border-2 p-4 min-h-[200px] flex flex-col transition-all ${loc.color}`}>
              {/* 地点标题 */}
              <div className="flex justify-between items-start mb-4 border-b border-black/5 pb-2">
                <div className="flex items-center gap-2">
                  <Icon size={20} />
                  <h2 className="font-bold text-lg">{loc.name}</h2>
                </div>
                <span className="text-xs opacity-60 font-medium">{loc.desc}</span>
              </div>

              {/* NPC 列表 */}
              <div className="flex-1 space-y-3">
                {localNpcs.length === 0 && <div className="text-center py-8 opacity-40 text-sm italic">空无一人</div>}
                
                {localNpcs.map(npc => (
                  <div key={npc.id} className="bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-sm border border-black/5 hover:scale-[1.02] transition-transform group">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-slate-800 flex items-center gap-2">
                          {npc.name} 
                          <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 border border-slate-200">{npc.role}</span>
                        </div>
                        {/* 三维状态条 */}
                        <div className="flex gap-2 mt-2">
                          <StatusBadge icon={Heart} value={npc.status.hp} color="bg-rose-500" />
                          <StatusBadge icon={Utensils} value={npc.status.hunger} color="bg-orange-500" />
                          <StatusBadge icon={Brain} value={npc.status.sanity} color="bg-purple-500" />
                        </div>
                      </div>
                      
                      {/* 神谕按钮 */}
                      <button 
                        onClick={() => setWhisperTarget(npc)}
                        className="text-slate-400 hover:text-purple-600 p-1 rounded-md hover:bg-purple-50 transition-colors"
                        title="下达神谕"
                      >
                        <MessageCircle size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </main>

      {/* --- 底部日志 --- */}
      <footer className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">系统日志</h3>
        <div className="space-y-2 max-h-40 overflow-y-auto font-mono text-sm">
          {logs.map(log => (
            <div key={log.id} className="border-b border-slate-50 pb-1 mb-1 last:border-0">
              <span className="text-slate-400 mr-2">[{new Date(log.created_at).toLocaleTimeString()}]</span>
              {parseLog(log.content)}
            </div>
          ))}
        </div>
      </footer>

      {/* --- 神谕弹窗 (Modal) --- */}
      {whisperTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Zap className="text-purple-600" fill="currentColor"/> 
              神谕连接: {whisperTarget.name}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              你正在向该角色的潜意识植入一个念头。这将作为最高优先级记忆影响他/她的下一次行动。
            </p>
            <textarea 
              value={whisperText}
              onChange={(e) => setWhisperText(e.target.value)}
              placeholder="例如：去森林里伐木，不要再偷懒了..."
              className="w-full border border-slate-300 rounded-lg p-3 min-h-[100px] mb-4 focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setWhisperTarget(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                取消
              </button>
              <button 
                onClick={sendWhisper}
                disabled={sendingWhisper || !whisperText.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold disabled:opacity-50"
              >
                {sendingWhisper ? '发送中...' : '降下神谕'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// 小组件：状态徽章
function StatusBadge({ icon: Icon, value, color }: { icon: any, value: number, color: string }) {
  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded px-1.5 py-0.5" title={`${value}%`}>
      <Icon size={10} className="text-slate-500" />
      <div className="w-8 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }}></div>
      </div>
    </div>
  );
}