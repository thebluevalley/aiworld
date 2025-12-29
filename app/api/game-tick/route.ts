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
    // 获取记忆
    const { data: memories } = await supabase
      .from('memories')
      .select('memory_text')
      .eq('npc_name', npc.name)
      .order('importance', { ascending: false })
      .limit(3);
    
    const memoryContext = memories?.map((m: { memory_text: string }) => m.memory_text).join('; ') || "";

    const systemPrompt = `你是一个文字生存游戏中的NPC。
    角色: ${npc.name} (${npc.role})
    性格: ${npc.personality}
    状态: HP=${npc.status.hp}, 饥饿=${npc.status.hunger}%
    记忆: ${memoryContext}
    
    请决定本回合行动。必须严格输出标准的 JSON 格式，不要包含 Markdown 代码块符号。
    
    JSON格式要求:
    { 
      "thought": "内心独白(必须有)", 
      "action": "动作关键词(如:休息/进食/攻击/交谈/探索)", 
      "target": "目标对象(人名或物体)", 
      "public_speech": "公开说的话(如果是沉默则输出空字符串)" 
    }`;

    const userPrompt = `新回合开始。请基于你的性格自由行动。`;

    // 调用 AI
    const resultRaw = await callAI(userPrompt, systemPrompt, 'fast');
    
    let decision: Decision;
    
    try {
        // 尝试解析 JSON
        const parsed = JSON.parse(resultRaw || '{}');
        
        // 【核心修改】这里不再设置 "|| 默认值"，完全信任 AI。
        // 如果 AI 返回的字段是空的，那就让它是空的，表现出 AI 的真实意图。
        decision = {
            thought: parsed.thought,
            action: parsed.action,
            target: parsed.target,
            public_speech: parsed.public_speech
        };
    } catch (e) {
        // 【核心修改】如果 JSON 解析失败，说明 AI 输出了非结构化的文本。
        // 我们不使用“系统错误”等死代码，而是直接将 AI 的原始输出作为角色的“混乱思维”或“胡言乱语”展示。
        // 这样所有的内容依然是 100% AI 生成的。
        console.warn(`NPC ${npc.name} JSON parsing failed, using raw output.`);
        decision = { 
            thought: resultRaw || "", // 将乱码/错误文本作为内心戏
            action: "混乱",            // 标记为特殊状态
            target: "未知", 
            public_speech: resultRaw || "" // 将乱码/错误文本直接喊出来
        };
    }

    return { npc, decision };
  }));

  // 生成回合总结 (使用 Deep 模型)
  const summaryPrompt = actions.map((a: { npc: NPC, decision: Decision }) => 
    `${a.npc.name} (${a.npc.role}): 说了"${a.decision.public_speech}", 做了"${a.decision.action}"`
  ).join('\n');

  const story = await callAI(
    summaryPrompt, 
    "你是一位史诗作家。根据以下角色的行动，写一段微型小说片段。不要列清单，写成一段完整的叙事。", 
    'deep'
  );

  // 存入数据库
  if (story) {
    await supabase.from('game_logs').insert({ event_type: 'turn_summary', content: story });
  }

  for (const act of actions) {
    // 只有当 AI 真的产出了内容时才记录
    if (act.decision.public_speech || act.decision.action) {
        await supabase.from('game_logs').insert({
            event_type: 'action',
            content: `【${act.npc.name}】: ${act.decision.public_speech || "..."} (动作: ${act.decision.action})`
        });

        await supabase.from('memories').insert({
             npc_name: act.npc.name,
             memory_text: `我做了: ${act.decision.action}。我说: "${act.decision.public_speech}"。想法: ${act.decision.thought}`,
             importance: 5
         });
    }
  }

  return NextResponse.json({ success: true, story });
}