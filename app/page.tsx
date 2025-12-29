'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Activity, Clock, Play, Pause, Database, User } from 'lucide-react';

interface Log {
  id: number;
  created_at: string;
  event_type: string;
  content: string;
}

interface NPC {
  id: string;
  name: string;
  role: string;
  personality: string;
  status: {
    hp: number;
    hunger: number;
  };
}

export default function Home() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 自动运行开关 (默认开启)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);

  // 1. 获取数据的函数
  const fetchData = async () => {
    const { data: logData } = await supabase
      .from('game_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30); // 获取更多日志
      
    const { data: npcData } = await supabase
      .from('npcs')
      .select('*')
      .order('name');

    if (logData) setLogs(logData as Log[]);
    if (npcData) setNpcs(npcData as NPC[]);
  };

  // 2. 核心：触发下一回合
  const nextTurn = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await fetch('/api/game-tick', { method: 'POST' });
      await fetchData(); // 完成后立即刷新数据
    } catch (error) {
      console.error("演化失败:", error);
    } finally {
      setLoading(false);
    }
  };

  // 3. 初始化加载 & 轮询数据
  useEffect(() => {
    fetchData();
    // 即使不演化，也每5秒刷新一次数据(为了看其他端产生的变化)
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  // 4. 自动运行逻辑
  useEffect(() => {
    if (isAutoPlaying) {
      // 如果开启自动，每10秒触发一次 nextTurn
      // 注意：这里设置10秒是为了防止API调用过频，你可以根据需要调整
      autoPlayRef.current = setInterval(() => {
        nextTurn();
      }, 10000); 
    } else {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    }
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, [isAutoPlaying]); // 依赖 isAutoPlaying 变化

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto font-sans">
      {/* 顶部标题栏 */}
      <header className="flex flex-col md:flex-row justify-between items-center mb-8 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Activity className="text-blue-600" />
            旧世遗民 <span className="text-gray-400 text-lg font-normal">观察者终端</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">基于 AI 驱动的微缩社会实验</p>
        </div>

        <div className="flex items-center gap-4 mt-4 md:mt-0">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-gray-200 text-sm text-gray-600 shadow-sm">
            <Database size={14} className="text-green-500" />
            <span>自动存档中</span>
          </div>

          <button 
            onClick={() => setIsAutoPlaying(!isAutoPlaying)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all shadow-sm ${
              isAutoPlaying 
                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isAutoPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            {isAutoPlaying ? '暂停演化' : '开始演化'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 左侧：历史记录 (时间轴样式) */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <Clock size={18} /> 世界演变日志
          </h2>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-[75vh] flex flex-col">
             {/* 滚动区域 */}
            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              {logs.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <Activity size={48} className="mb-4 opacity-20" />
                  <p>世界正在初始化...</p>
                </div>
              )}
              
              {logs.map((log) => (
                <div key={log.id} className="relative pl-6 border-l-2 border-gray-100 last:border-0 group">
                  {/* 时间点装饰 */}
                  <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                    log.event_type === 'turn_summary' ? 'bg-blue-500' : 'bg-gray-300'
                  }`}></div>
                  
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </span>
                    {log.event_type === 'turn_summary' && (
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        回合总结
                      </span>
                    )}
                  </div>
                  
                  <div className={`text-sm leading-relaxed ${
                    log.event_type === 'turn_summary' 
                      ? 'text-gray-800 font-medium bg-gray-50 p-3 rounded-lg border border-gray-100' 
                      : 'text-gray-600'
                  }`}>
                    {log.content}
                  </div>
                </div>
              ))}
            </div>
            
            {/* 底部状态条 */}
            <div className="bg-gray-50 px-4 py-2 text-xs text-gray-400 border-t border-gray-100 flex justify-between">
               <span>Log Count: {logs.length}</span>
               <span>{loading ? '正在计算下一步...' : '等待指令'}</span>
            </div>
          </div>
        </div>

        {/* 右侧：角色卡片 */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <User size={18} /> 幸存者状态
          </h2>
          
          <div className="space-y-4 h-[75vh] overflow-y-auto pr-2 pb-10">
            {npcs.map((npc) => (
              <div key={npc.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{npc.name}</h3>
                    <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-md border border-blue-100">
                      {npc.role}
                    </span>
                  </div>
                  {/* 这里可以加个头像占位符 */}
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 font-bold text-sm">
                    {npc.name[0]}
                  </div>
                </div>

                <p className="text-xs text-gray-500 mb-4 bg-gray-50 p-2 rounded border border-gray-100 italic">
                  "{npc.personality}"
                </p>

                <div className="space-y-3">
                  {/* HP 条 */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">生命值 (HP)</span>
                      <span className="font-medium text-gray-700">{npc.status.hp}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          npc.status.hp > 50 ? 'bg-green-500' : npc.status.hp > 20 ? 'bg-yellow-500' : 'bg-red-500'
                        }`} 
                        style={{ width: `${Math.max(0, npc.status.hp)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* 饥饿度 条 */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">饥饿度 (Hunger)</span>
                      <span className="font-medium text-gray-700">{npc.status.hunger}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className="h-full bg-orange-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, npc.status.hunger)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}