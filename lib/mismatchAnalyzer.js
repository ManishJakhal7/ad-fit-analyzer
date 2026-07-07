const { callLLMForJson } = require('./llmClient');

const DIMENSIONS = [
  { key: 'persona_fit', label: 'Persona Fit' },
  { key: 'offer_continuity', label: 'Offer Continuity' },
  { key: 'product_framing', label: 'Product Framing' },
  { key: 'proof_credibility', label: 'Proof & Credibility' },
  { key: 'objection_handling', label: 'Objection Handling' },
  { key: 'above_fold_continuity', label: 'Above-the-Fold Continuity' },
];

/**
 * Compares extracted ad content against extracted page content across fixed
 * dimensions. Each dimension must be grounded in the specific extracted
 * fields — the prompt forces an `evidence` quote/reference so the model
 * can't hand-wave a generic mismatch.
 */
async function analyzeMismatch(adContent, pageContent) {
  const system = `You are a conversion-rate analyst comparing an ad's promise against the actual landing page experience.
For EACH dimension listed, you must ground your assessment in the specific extracted fields provided — cite the actual ad field and page field you're comparing in "evidence". Never invent claims that aren't in the extracted data.
A high match score (4-5) means the ad and page are consistent on that dimension. A low score (1-2) means there's a real, actionable gap.
Respond with ONLY a JSON array, no preamble, no markdown fences.`;

  const content = [
    {
      type: 'text',
      text: `AD CONTENT (extracted):
${JSON.stringify(adContent, null, 2)}

PAGE CONTENT (extracted):
${JSON.stringify(pageContent, null, 2)}

Score each of these dimensions and return a JSON array of exactly ${DIMENSIONS.length} objects, one per dimension, in this order:
${DIMENSIONS.map((d, i) => `${i + 1}. ${d.key} (${d.label})`).join('\n')}
Keep every text field to one short sentence, under 20 words. Do not write paragraphs. Be concise across all 6 objects — you must fit all 6 within the response.
Each object must have exactly these fields:
{
  "dimension": "the dimension key exactly as given",
  "matchScore": integer 1-5 (5 = fully consistent, 1 = severe mismatch),
  "severity": "high" | "medium" | "low"  (derived from matchScore: 1-2=high, 3=medium, 4-5=low),
  "adClaim": "what the ad specifically claims/shows relevant to this dimension, referencing the extracted ad fields (under 20 words)",
  "pageReality": "what the page specifically shows relevant to this dimension, referencing the extracted page fields (under 20 words)",
  "evidence": "the specific extracted field(s) this judgment is based on, e.g. 'ad.offer vs page.heroOffer'",
  "fixSuggestion": "one concrete, specific fix for the page to close this gap — no generic advice (under 20 words)"
}`,
    },
  ];

  const dimensions = await callLLMForJson({ system, content, maxTokens: 4000 });

  // Attach human-readable labels and normalize severity from score as a safety net
  // in case the model's stated severity doesn't match its own score.
  const enriched = dimensions.map((d) => {
    const meta = DIMENSIONS.find((dim) => dim.key === d.dimension) || { label: d.dimension };
    return {
      ...d,
      label: meta.label,
      severity: severityFromScore(d.matchScore),
    };
  });

  const overallFitScore =
    enriched.reduce((sum, d) => sum + d.matchScore, 0) / enriched.length;

  return { dimensions: enriched, overallFitScore: Number(overallFitScore.toFixed(1)) };
}

function severityFromScore(score) {
  if (score <= 2) return 'high';
  if (score === 3) return 'medium';
  return 'low';
}

module.exports = { analyzeMismatch, DIMENSIONS };
