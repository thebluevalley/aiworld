const GROQ_KEYS = process.env.GROQ_KEYS?.split(',') || [];
const SILICON_KEYS = process.env.SILICON_KEYS?.split(',') || [];

let groqIndex = 0;
let siliconIndex = 0;

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
        temperature: 0.7,
        max_tokens: 500,
        response_format: type === 'fast' ? { type: "json_object" } : undefined
      })
    });

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error(`AI Call Failed (${type}):`, error);
    return null;
  }
}