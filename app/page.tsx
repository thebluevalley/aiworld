'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Terminal, RefreshCw, Play } from 'lucide-react';

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

  const fetchData = async () => {
    const { data: logData } = await supabase.from('game_logs').select('*').order('created_at', { ascending: false }).limit(20);
    const { data: npcData } = await supabase.from('npcs').select('*').order('name');
    if (logData) setLogs(logData as Log[]);
    if (npcData) setNpcs(npcData as NPC[]);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const nextTurn = async () => {
    setLoading(true);
    await fetch('/api/game-tick', { method: 'POST' });
    await fetchData();
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono p-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 border border-green-800 rounded p-4 bg-gray-900 h-[80vh] overflow-y-auto flex flex-col">
          <div className="flex justify-between items-center mb-4 border-b border-green-800 pb-2">
            <h1 className="text-xl flex items-center gap-2"><Terminal size={20} /> 旧世遗民_LOG</h1>
            <button onClick={nextTurn} disabled={loading} className="flex items-center gap-1 px-4 py-2 bg-green-900 hover:bg-green-700 text-white rounded disabled:opacity-50">
              {loading ? <RefreshCw className="animate-spin" size={16}/> : <Play size={16}/>} {loading ? '演算中...' : '下一回合'}
            </button>
          </div>
          <div className="space-y-4 flex-1">
            {logs.map((log) => (
              <div key={log.id} className={`p-2 rounded ${log.event_type === 'turn_summary' ? 'bg-green-900/30 border border-green-700' : 'opacity-80'}`}>
                <span className="text-xs text-green-600 block mb-1">[{new Date(log.created_at).toLocaleTimeString()}]</span>
                <p>{log.content}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="border border-green-800 rounded p-4 bg-gray-900 h-[80vh] overflow-y-auto">
          <h2 className="text-lg mb-4 border-b border-green-800 pb-2">生命体征</h2>
          <div className="space-y-4">
            {npcs.map((npc) => (
              <div key={npc.id} className="border border-green-800 p-3 rounded">
                <div className="flex justify-between font-bold"><span>{npc.name}</span><span className="text-xs border px-1 rounded">{npc.role}</span></div>
                <div className="mt-2 text-sm">HP: {npc.status.hp} | Hunger: {npc.status.hunger}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}