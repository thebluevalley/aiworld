import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { callAI } from '@/lib/ai_client';

export const maxDuration = 60;

interface NPC {
  id: string;
  name: string;
  role: string;
  personality: string;
  status: { hp: number; hunger: number; };
  is_alive: boolean;
}

export async function POST() {
  // 1. 获取存活 NPC
  const { data: npcs } = await supabase
    .from('npcs')
    .select('*')
    .eq('is_alive', true)
    .returns<NPC[]>();
  
  if (!npcs || npcs.length === 0) return NextResponse.json({ message: 'No NPCs' });

  // 2. 并行生成决策
  const actions = await Promise.all(npcs.map(async (npc) => {
    // 获取记忆
    const { data: memories } = await supabase
      .from('memories')
      .select('memory_text')
      .eq('npc_name', npc.name)
      .order('importance', { ascending: false })
      .limit(3);
    
    const memoryText = memories?.map((m:any) => m.memory_text).join('; ') || "我刚来到这个世界，一切都很陌生。";

    // --- 核心：高级 Prompt 设计 ---
    const systemPrompt = `你是一个残酷生存游戏中的角色。你的名字是${npc.name}，职业是${npc.role}。
    性格特征: ${npc.personality}。
    
    你必须时刻关注自己的生理状态：
    - 当前 HP: ${npc.status.hp} (如果低于30，你会感到剧痛和恐惧)
    - 当前 饥饿: ${npc.status.hunger}% (如果高于80，你必须不择手段找吃的)
    
    你的近期记忆: ${memoryText}

    请输出一个标准的 JSON 对象来描述你本回合的行动。不要包含任何 Markdown 格式。
    格式要求:
    {
      "thought": "你的内心独白，必须体现你的性格和当前状态的焦虑感。",
      "action": "你具体做了什么 (例如：搜寻食物、休息、攻击某人、与某人交易)。",
      "public_speech": "你嘴里说出来的话 (如果不想说话，请填空字符串)。",
      "status_change": { "hunger": 5, "hp": 0 } 
    }
    注意：status_change 表示本回合数值的变化。例如吃饭可以让 hunger: -20，被打会 hp: -10。自然消耗通常是 hunger: 5。
    `;

    const userPrompt = `新回合开始。现在的环境是破败的营地，物资匮乏。请开始行动。`;

    // 调用 AI
    const resultJson = await callAI(userPrompt, systemPrompt, 'fast');
    
    let decision = {
      thought: "...",
      action: "发呆",
      public_speech: "...",
      status_change: { hunger: 5, hp: 0 }
    };

    try {
      const parsed = JSON.parse(resultJson || "{}");
      decision = { ...decision, ...parsed }; // 合并，防止缺字段
    } catch (e) {
      console.error("JSON Parse Error:", e);
      // 如果解析失败，把原始文本当作思考
      decision.thought = resultJson || "思维混乱中...";
    }

    return { npc, decision };
  }));

  // 3. 结算状态 & 生成故事 (使用 Deep 模型)
  const summaryPrompt = actions.map(a => 
    `角色 [${a.npc.name}] (${a.npc.role}): 
     动作: ${a.decision.action}
     说话: "${a.decision.public_speech}"
     心理: (${a.decision.thought})`
  ).join('\n');

  const story = await callAI(
    summaryPrompt, 
    "你是一位史诗传记作家。根据以下角色的行动，写一段沉浸感极强的微型小说（100字左右）。重点描写环境氛围和人物之间的张力。不要写成流水账。", 
    'deep'
  );

  // 4. 写入数据库
  if (story) {
    await supabase.from('game_logs').insert({ event_type: 'turn_summary', content: story });
  }

  for (const act of actions) {
    // 更新 NPC 数值
    const newHunger = Math.min(100, Math.max(0, act.npc.status.hunger + (act.decision.status_change?.hunger || 5)));
    const newHp = Math.min(100, Math.max(0, act.npc.status.hp + (act.decision.status_change?.hp || 0)));
    
    await supabase.from('npcs').update({ 
      status: { ...act.npc.status, hunger: newHunger, hp: newHp } 
    }).eq('id', act.npc.id);

    // 写入日志
    await supabase.from('game_logs').insert({
      event_type: 'action',
      content: JSON.stringify({
        name: act.npc.name,
        role: act.npc.role,
        action: act.decision.action,
        speech: act.decision.public_speech,
        thought: act.decision.thought
      })
    });
  }

  return NextResponse.json({ success: true });
}