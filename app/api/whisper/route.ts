import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { npc_id, npc_name, message } = await req.json();

    if (!npc_id || !message) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // 插入一条高优先级的记忆
    const { error } = await supabase.from('memories').insert({
      npc_name: npc_name,
      memory_text: `【神谕】脑海中响起一个威严的声音: "${message}"`,
      importance: 10 // 最高优先级，强制 AI 重视
    });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Whisper failed:', error);
    return NextResponse.json({ error: 'Failed to whisper' }, { status: 500 });
  }
}