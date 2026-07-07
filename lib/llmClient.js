const { GoogleGenAI } = require('@google/genai');

// Free tier: no credit card, ~15 requests/min, ~1,500/day as of mid-2026.
// Check current numbers in Google AI Studio — free tier limits change over time.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = 'gemini-2.5-flash';

/**
 * Gemini's part format, so pageExtractor/adExtractor/mismatchAnalyzer don't
 * need to know or care which provider is behind callLLM.
 */
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

/**
 * Calls Gemini in JSON mode and parses the result. Still strips stray
 * markdown fences defensively — JSON mode is reliable but not airtight.
 */
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
