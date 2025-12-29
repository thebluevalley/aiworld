const GROQ_KEYS = process.env.GROQ_KEYS?.split(',') || [];
const SILICON_KEYS = process.env.SILICON_KEYS?.split(',') || [];

let groqIndex = 0;
let siliconIndex = 0;

// 强力清洗函数：去除 markdown 符号，提取 JSON
function cleanJson(text: string): string {
  if (!text) return "{}";
  // 1. 去除 ```json 和 ```
  let clean = text.replace(/```json/g, "").replace(/```/g, "");
  // 2. 尝试提取第一个 { 和 最后一个 } 中间的内容
  const firstOpen = clean.indexOf("{");
  const lastClose = clean.lastIndexOf("}");
  if (firstOpen !== -1 && lastClose !== -1) {
    clean = clean.substring(firstOpen, lastClose + 1);
  }
  return clean;
}

export async function callAI(
  prompt: string, 
  systemPrompt: string, 
  type: 'fast' | 'deep'
) {
  let apiKey = '';
  let url = '';
  let model = '';

  if (type === 'fast') {
    apiKey = GROQ_KEYS[groqIndex % GROQ_KEYS.length];
    groqIndex++;
    url = '[https://api.groq.com/openai/v1/chat/completions](https://api.groq.com/openai/v1/chat/completions)';
    model = 'llama3-8b-8192'; 
  } else {
    apiKey = SILICON_KEYS[siliconIndex % SILICON_KEYS.length];
    siliconIndex++;
    url = '[https://api.siliconflow.cn/v1/chat/completions](https://api.siliconflow.cn/v1/chat/completions)';
    model = 'deepseek-ai/DeepSeek-V3';
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7, // 稍微降低随机性，保证 JSON 格式稳定
        max_tokens: 800,
        // Groq 必须开启 JSON 模式，SiliconFlow 不强制
        response_format: type === 'fast' ? { type: "json_object" } : undefined
      })
    });

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "";
    
    // 如果是 Fast 模式，我们期望返回 JSON，必须清洗
    if (type === 'fast') {
      return cleanJson(rawContent);
    }
    
    return rawContent;
  } catch (error) {
    console.error(`AI Call Failed (${type}):`, error);
    return null;
  }
}