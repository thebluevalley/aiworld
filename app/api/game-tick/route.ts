import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { callAI } from '@/lib/ai_client';

interface NPC {
  id: string;
  name: string;
  role: string;
  personality: string;
  status: {
    hp: number;
    hunger: number;
    location: string;
  };
  inventory: any[];
  is_alive: boolean;
}

interface Decision {
  thought: string;
  action: string;
  target: string;
  public_speech: string;
}

export const maxDuration = 60;

export async function POST() {
  const { data: npcs } = await supabase
    .from('npcs')
    .select('*')
    .eq('is_alive', true)
    .returns<NPC[]>();
  
  if (!npcs || npcs.length === 0) return NextResponse.json({ message: 'No NPCs' });

  const actions = await Promise.all(npcs.map(async (npc: NPC) => {
    const { data: memories } = await supabase
      .from('memories')
      .select('memory_text')
      .eq('npc_name', npc.name)
      .order('importance', { ascending: false })
      .limit(3);
    
    const memoryContext = memories?.map((m: { memory_text: string }) => m.memory_text).join('; ') || "无特殊记忆";

    const systemPrompt = `你正在扮演一个生存游戏中的角色。必须输出 JSON 格式。
    你的名字: ${npc.name}, 职业: ${npc.role}, 性格: ${npc.personality}
    当前状态: ${JSON.stringify(npc.status)}
    你的记忆: ${memoryContext}
    
    请决定你这一回合的行动。行动必须符合逻辑。
    输出格式: { "thought": "你的内心独白", "action": "具体动作", "target": "目标对象或无", "public_speech": "你说的话" }`;

    const userPrompt = `现在是新的一回合。如果你饿了就找吃的，如果有人冒犯你虽然表面客气但心里要记仇。请行动。`;

    const resultRaw = await callAI(userPrompt, systemPrompt, 'fast');
    let decision: Decision;
    try {
        decision = JSON.parse(resultRaw || '{}');
    } catch (e) {
        decision = { thought: "发呆...", action: "nothing", target: "none", public_speech: "..." };
    }
    return { npc, decision };
  }));

  const summaryPrompt = actions.map((a: { npc: NPC, decision: Decision }) => 
    `${a.npc.name} (${a.npc.role}): 心里想 "${a.decision.thought}", 做了 "${a.decision.action}", 说了 "${a.decision.public_speech}"`
  ).join('\n');

  const story = await callAI(
    summaryPrompt, 
    "你是一位史诗作家。根据以下角色的零散行动，写一段不超过100字的微型小说片段，要有画面感，不仅是流水账。不要用列表，写成一段话。", 
    'deep'
  );

  await supabase.from('game_logs').insert({ event_type: 'turn_summary', content: story });

  for (const act of actions) {
    await supabase.from('game_logs').insert({
        event_type: 'action',
        content: `【${act.npc.name}】: ${act.decision.public_speech} (动作: ${act.decision.action})`
    });

    if (act.decision.action !== 'nothing') {
         await supabase.from('memories').insert({
             npc_name: act.npc.name,
             memory_text: `我在本回合做了: ${act.decision.action}。想法: ${act.decision.thought}`,
             importance: 5
         });
    }
  }

  return NextResponse.json({ success: true, story });
}