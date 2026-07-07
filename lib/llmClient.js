const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = 'gemini-2.5-flash';


function toGeminiParts(content) {
  return content.map((block) => {
    if (block.type === 'text') {
      return { text: block.text };
    }
    if (block.type === 'image') {
      return {
        inlineData: {
          mimeType: block.source.media_type,
          data: Buffer.isBuffer(block.source.data)
          ? block.source.data.toString('base64')
          :block.source.data,
        },
      };
    }
    throw new Error(`Unsupported content block type: ${block.type}`);
  });
}

async function callLLM({ system, content, maxTokens = 3000, jsonMode = false }) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: toGeminiParts(content) }],
    config: {
      systemInstruction: system,
      maxOutputTokens: maxTokens,
      ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error(`Gemini returned no text. Full response: ${JSON.stringify(response, null, 2)}`);
  }
  return text;
}

async function callLLMForJson(opts) {
  const raw = await callLLM({ ...opts, jsonMode: true });
  const cleaned = raw.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Gemini did not return valid JSON. Raw response:\n${raw}`);
  }
}

module.exports = { callLLM, callLLMForJson, MODEL };
