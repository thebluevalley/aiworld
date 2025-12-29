import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { callAI } from '@/lib/ai_client';

// --- 新的类型定义 ---
interface NPC {
  id: string;
  name: string;
  role: string;
  personality: string;
  status: { hp: number; hunger: number; sanity: number };
  location_id: string;
  relationships: Record<string, number>; // { "Name": score }
  is_alive: boolean;
}

interface Location {
  id: string;
  name: string;
  resource_type: string;
  danger_level: number;
}

interface Item {
  name: string;
  quantity: number;
  type: string;
}

// 必须严格定义的 AI 输出结构
interface AIDecision {
  thought: string;
  move_to: string; // 'camp', 'forest', 'ruins', 'lake' (如果不移动则填当前位置)
  action_type: 'GATHER' | 'CRAFT' | 'BUILD' | 'STEAL' | 'ATTACK' | 'REST' | 'SOCIAL'; 
  target: string; // 目标对象或物品名
  speech: string;
}

export const maxDuration = 60;

export async function POST() {
  // 1. 获取全局状态
  const { data: world } = await supabase.from('world_state').select('*').single();
  const turn = world?.turn_count || 1;
  const weather = world?.weather || '晴朗';

  // 2. 获取所有活着的 NPC
  const { data: npcs } = await supabase.from('npcs').select('*').eq('is_alive', true).returns<NPC[]>();
  if (!npcs || npcs.length === 0) return NextResponse.json({ message: 'Game Over' });

  // 3. 获取公共资源库存 (owner_id is null)
  const { data: publicItems } = await supabase.from('items').select('*').is('owner_id', null);
  const publicInvText = publicItems?.map(i => `${i.name}x${i.quantity}`).join(', ') || "空";

  // 4. 并行生成决策
  const actions = await Promise.all(npcs.map(async (npc) => {
    // 获取个人物品
    const { data: myItems } = await supabase.from('items').select('*').eq('owner_id', npc.id);
    const myInvText = myItems?.map(i => `${i.name}x${i.quantity}`).join(', ') || "无";

    // 获取当前位置信息
    const { data: location } = await supabase.from('locations').select('*').eq('id', npc.location_id).single();

    // 记忆检索
    const { data: memories } = await supabase.from('memories').select('memory_text').eq('npc_name', npc.name).order('importance', { ascending: false }).limit(3);
    const memoryText = memories?.map((m: any) => m.memory_text).join('; ') || "";

    // --- 高级游戏化 Prompt ---
    const systemPrompt = `这是一个残酷的生存策略游戏。
    角色: ${npc.name} (${npc.role}) | 性格: ${npc.personality}
    状态: HP=${npc.status.hp}, 饥饿=${npc.status.hunger}, 理智=${npc.status.sanity}
    当前位置: ${location.name} (产出: ${location.resource_type}, 危险: ${location.danger_level})
    你的背包: ${myInvText}
    公共仓库: ${publicInvText}
    人际关系: ${JSON.stringify(npc.relationships)}

    世界目标: 收集物资(Metal/Wood)修复信号塔(BUILD)，或者囤积食物(Food)活下去。
    
    可用指令说明:
    - GATHER: 在当前地点搜集资源 (Forest->Wood, Lake->Food, Ruins->Metal)。会有危险。
    - CRAFT: 消耗资源制作工具/武器 (需要Wood/Metal)。
    - BUILD: 在【核心营地】消耗Wood/Metal增加信号塔进度。
    - ATTACK/STEAL: 攻击他人或偷窃私人物品。
    - REST: 恢复HP和理智，略微增加饥饿。
    - SOCIAL: 与同地点的某人交谈，改变好感度。
    - 移动: 改变 location_id 到新地点。

    请输出 JSON 决策:
    {
      "thought": "基于性格和状态的内心博弈",
      "move_to": "目标地点ID (camp/forest/ruins/lake)",
      "action_type": "指令类型",
      "target": "具体目标 (如: Wood, Old Man, Signal Tower)",
      "speech": "公开说的话"
    }`;

    const userPrompt = `第 ${turn} 回合。天气: ${weather}。如果饥饿>80必须优先找吃的。如果理智<30可能会发疯攻击人。请行动。`;

    // 调用 AI
    const resultJson = await callAI(userPrompt, systemPrompt, 'fast');
    
    // 解析与兜底
    let decision: AIDecision = {
      thought: "...",
      move_to: npc.location_id,
      action_type: 'REST',
      target: "Self",
      speech: "..."
    };

    try {
      const parsed = JSON.parse(resultJson || "{}");
      decision = { ...decision, ...parsed };
    } catch (e) {
      decision.thought = resultJson || "思维混乱";
    }

    return { npc, decision, location };
  }));

  // 5. 结算逻辑 (Game Engine Logic) - 这里的代码负责把 AI 的决策变成数据库的数字变化
  const logs = [];
  let constructionAdded = 0;

  for (const act of actions) {
    const { npc, decision, location } = act;
    let logContent = "";
    
    // 5.1 移动处理
    if (decision.move_to !== npc.location_id) {
        await supabase.from('npcs').update({ location_id: decision.move_to }).eq('id', npc.id);
        logContent = `离开了 ${location.name}，前往 ${decision.move_to}。`;
    }

    // 5.2 动作处理
    let hpChange = 0;
    let hungerChange = 5; // 每回合基础消耗
    let sanityChange = 0;

    switch (decision.action_type) {
        case 'GATHER':
            // 简单概率判定
            const success = Math.random() > (location.danger_level * 0.1);
            if (success && location.resource_type !== 'none') {
                // 获得物品
                await supabase.from('items').insert({ 
                    owner_id: npc.id, 
                    name: location.resource_type === 'wood' ? '木材' : location.resource_type === 'metal' ? '废铁' : '生鱼',
                    type: 'resource',
                    quantity: 1
                });
                logContent += `在 ${location.name} 成功搜集到了 ${location.resource_type}。`;
                hungerChange += 5; // 劳动消耗更多
            } else {
                logContent += `搜集失败，而且受了点伤。`;
                hpChange -= 5;
            }
            break;
        case 'BUILD':
            if (npc.location_id === 'camp') {
                // 检查背包
                const { data: mats } = await supabase.from('items').select('*').eq('owner_id', npc.id).in('name', ['木材', '废铁']);
                if (mats && mats.length > 0) {
                    // 消耗一个材料
                    await supabase.from('items').delete().eq('id', mats[0].id);
                    constructionAdded += 5;
                    logContent += `消耗了 ${mats[0].name} 修复信号塔！进度提升。`;
                } else {
                    logContent += `想修塔但是没有材料。`;
                }
            }
            break;
        case 'ATTACK':
            logContent += `突然发狂，攻击了 ${decision.target}！`;
            // 这里可以添加扣除目标HP的逻辑
            break;
        case 'REST':
            hpChange += 5;
            sanityChange += 5;
            logContent += `原地休息，恢复体力。`;
            break;
        default:
            logContent += `正在 ${decision.action_type} ${decision.target || ''}`;
    }

    // 更新状态
    const newStatus = {
        hp: Math.max(0, Math.min(100, npc.status.hp + hpChange)),
        hunger: Math.max(0, Math.min(100, npc.status.hunger + hungerChange)),
        sanity: Math.max(0, Math.min(100, npc.status.sanity + sanityChange))
    };
    
    await supabase.from('npcs').update({ status: newStatus }).eq('id', npc.id);

    // 写入日志
    await supabase.from('game_logs').insert({
        event_type: 'action',
        content: JSON.stringify({
            name: npc.name,
            role: npc.role,
            location: decision.move_to,
            action: logContent,
            speech: decision.speech,
            thought: decision.thought
        })
    });
  }

  // 6. 更新世界状态
  if (constructionAdded > 0) {
      await supabase.rpc('increment_construction', { val: constructionAdded }); // 需要在supabase定义rpc，或者先简单查再更
      // 简单版：
      const { data: w } = await supabase.from('world_state').select('construction_progress').single();
      await supabase.from('world_state').update({ construction_progress: (w?.construction_progress || 0) + constructionAdded }).eq('id', 1);
  }
  await supabase.from('world_state').update({ turn_count: turn + 1 }).eq('id', 1);

  return NextResponse.json({ success: true });
}