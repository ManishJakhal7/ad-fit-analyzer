const puppeteer = require('puppeteer');
const { callLLMForJson } = require('./llmClient');

const VIEWPORT = { width: 1440, height: 900 };
const MAX_RAW_TEXT_CHARS = 6000;

/**
 * Loads the URL in a headless browser, captures an above-the-fold screenshot,
 * and pulls raw visible text as a fallback/supplement for extraction.
 */
async function captureLandingPage(url) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
    );

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });

    // Give lazy-loaded hero content a beat to settle.
    await new Promise((r) => setTimeout(r, 800));

    const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 80 });
    const screenshotBase64 = Buffer.from(screenshotBuffer).toString('base64');

    const rawText = await page.evaluate(() => {
      // Grab visible text only — skip script/style/nav noise where possible.
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll('script, style, noscript, svg').forEach((el) => el.remove());
      return clone.innerText.replace(/\s+/g, ' ').trim();
    });

    const title = await page.title();

    return {
      screenshotBase64,
      rawText: rawText.slice(0, MAX_RAW_TEXT_CHARS),
      title,
    };
  } finally {
    await browser.close();
  }
}

/**
 * Turns raw page capture (screenshot + text) into a structured content object
 * covering the fields the mismatch comparison needs.
 */
async function extractPageContent(url) {
  const { screenshotBase64, rawText, title } = await captureLandingPage(url);

  const system = `You extract structured marketing content from a landing page screenshot and its visible text.
Only report what is actually present. If a field is not present above the fold or in the provided text, say so explicitly rather than guessing.
Respond with ONLY a JSON object, no preamble, no markdown fences.`;

  const content = [
    { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: screenshotBase64 } },
    {
      type: 'text',
      text: `Page title: ${title}

Visible page text (may extend below the fold):
"""
${rawText}
"""
Keep every field short and factual. Do not write full sentences where a phrase will do. Hard limits: headline/subheadline/heroCta/heroOffer must each be under 12 words (or null). personaSignals and aboveFoldVisualSummary must each be ONE sentence, under 20 words. Each item in proofElements and objectionHandling must be under 8 words.
Extract a JSON object with exactly these fields:
{
  "headline": "the main hero headline, or null if none (under 12 words)",
  "subheadline": "supporting subhead text, or null (under 12 words)",
  "heroCta": "the primary call-to-action button text visible above the fold, or null (under 12 words)",
  "heroOffer": "any price, discount, or offer stated above the fold, or null (under 12 words)",
  "personaSignals": "who this page's language/imagery seems to target (1 sentence, under 20 words)",
  "proofElements": ["array of trust/proof signals actually present: reviews, ratings, press logos, guarantees, testimonials — empty array if none visible (under 8 words)"],
  "objectionHandling": ["array of objection-handling content present: shipping info, returns policy, FAQ, guarantee — empty array if none visible (under 8 words)"],
  "aboveFoldVisualSummary": "1-2 sentence factual description of what's visually in the hero/above-the-fold area (under 20 words)"
}`,
    },
  ];

  return callLLMForJson({ system, content, maxTokens: 2500 });
}

module.exports = { captureLandingPage, extractPageContent };
