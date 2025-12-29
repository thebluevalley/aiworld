const GROQ_KEYS = process.env.GROQ_KEYS?.split(',') || [];
const SILICON_KEYS = process.env.SILICON_KEYS?.split(',') || [];

let groqIndex = 0;
let siliconIndex = 0;

// 暴力清洗 JSON：不管 AI 输出什么，只抓取最外层 {}
function cleanJson(text: string): string {
  if (!text) return "{}";
  try {
    JSON.parse(text);
    return text;
  } catch (e) {
    if (text.includes('{')) {
      const extracted = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
      return extracted.replace(/[\n\r]/g, " "); 
    }
    return "{}";
  }
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
    url = 'https://api.groq.com/openai/v1/chat/completions';
    model = 'llama3-8b-8192'; 
  } else {
    apiKey = SILICON_KEYS[siliconIndex % SILICON_KEYS.length];
    siliconIndex++;
    url = 'https://api.siliconflow.cn/v1/chat/completions';
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
        temperature: 0.8,
        max_tokens: 500,
        response_format: { type: "json_object" } 
      })
    });

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "";
    return cleanJson(rawContent);

  } catch (error) {
    console.error(`AI Call Failed (${type}):`, error);
    return "{}";
  }
}