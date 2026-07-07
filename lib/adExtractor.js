const { callLLMForJson } = require('./llmClient');

/**
 * @param {string} adCopy - free text ad copy (may be empty)
 * @param {Array<{buffer: Buffer, mimetype: string}>} images - uploaded ad screenshots (may be empty)
 */
async function extractAdContent(adCopy, images = []) {
  const system = `You extract structured marketing content from ad creative (text copy and/or screenshots).
Only report what is actually stated or shown. Do not infer claims that aren't present.
Respond with ONLY a JSON object, no preamble, no markdown fences.`;

  const content = [];

  images.forEach((img) => {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.mimetype || 'image/jpeg',
        data: Buffer.from(img.buffer).toString('base64'),
      },
    });
  });

  content.push({
    type: 'text',
    text: `${adCopy ? `Ad copy text:\n"""\n${adCopy}\n"""\n\n` : ''}${
      images.length ? `${images.length} ad screenshot(s) are attached above.\n\n` : ''
    }
    Keep every field short and factual. Do not write full sentences where a phrase will do. Hard limits: promise/offer/productFraming/personaSignals must each be under 12 words (or null). tone must be under 20 words. visualHook must be under 8 words.
    Extract a JSON object with exactly these fields:
{
  "promise": "the core promise or hook the ad makes (1 sentence, under 12 words)",
  "offer": "any specific price, discount, or offer stated, or null if none (under 12 words)",
  "productFraming": "how the product/service is framed or positioned (1 sentence, under 12 words)",
  "personaSignals": "who this ad's language/imagery/tone seems to target (1 sentence, under 12 words)",
  "tone": "the tone/style of the ad (e.g. urgent, aspirational, playful, clinical) (under 20 words)",
  "visualHook": "if screenshots were provided, what the dominant visual element is; null if text-only (under 8 words)"
}`,
  });

  return callLLMForJson({ system, content, maxTokens: 800 });
}

module.exports = { extractAdContent };
