# Ad–Page Fit Analyzer

A tool that compares an ad's promise against the actual landing page it sends
traffic to, and produces a scored mismatch report across six dimensions:
persona fit, offer continuity, product framing, proof & credibility,
objection handling, and above-the-fold continuity.

Instead of generic "improve your messaging" advice, every finding is grounded
in specific extracted evidence from both sources — e.g. *the ad promises 50%
off, but the page's hero section shows no discount* — so the output is
actionable rather than templated.

## Why this exists

Ad-to-landing-page mismatch is one of the most common, highest-leverage
conversion problems in performance marketing, and it's usually diagnosed by
a human manually eyeballing an ad next to a page. This tool automates that
comparison using an LLM with real evidence as input (a live screenshot +
scraped content of the page, and the actual ad copy/creative) rather than
asking the model to guess or generalize.

## How it works

1. **You submit** a landing page URL plus ad copy text and/or ad screenshots.
2. **Page extraction** — Puppeteer loads the URL in headless Chrome, captures
   an above-the-fold screenshot, and scrapes visible text. Both are sent to
   Gemini to extract structured fields: headline, subheadline, hero CTA,
   hero offer, persona signals, proof elements, objection handling.
3. **Ad extraction** — the ad copy and/or screenshots are sent to Gemini with
   a matching prompt, extracting: promise, offer, product framing, persona
   signals, tone.
4. **Mismatch scoring** — both structured extractions are fed into one more
   Gemini call that scores fit 1–5 across six fixed dimensions, citing which
   specific extracted fields the score is based on, plus a concrete fix
   suggestion per dimension.
5. **Report rendered** — results are sorted worst-mismatch-first and shown
   as ad-claim vs. page-reality side by side, so you look at the highest
   -impact gap first.

Page extraction and ad extraction run in parallel (they don't depend on each
other); mismatch scoring runs after both complete.

## Tech stack

- **Backend:** Node.js + Express
- **Browser automation:** Puppeteer (headless Chrome for page screenshots)
- **LLM:** Google Gemini (`gemini-2.5-flash`) via the `@google/genai` SDK —
  chosen for its free tier and native multimodal + JSON-mode support
- **Frontend:** vanilla HTML/CSS/JS (no framework) — two-panel comparison
  layout with drag-and-drop image upload
- **File upload:** Multer (in-memory, no disk writes)

## Project structure

```
ad-fit-analyzer/
├── server.js               Express app, /api/analyze route
├── lib/
│   ├── llmClient.js         Gemini SDK wrapper (text + JSON-mode calls)
│   ├── pageExtractor.js     Puppeteer screenshot + page content extraction
│   ├── adExtractor.js       Ad copy/screenshot extraction
│   └── mismatchAnalyzer.js  Six-dimension comparison + scoring
└── public/
    ├── index.html            Form UI
    ├── style.css             Diagnostic/comparison visual design
    └── app.js                Upload handling, fetch call, results rendering
```

## Setup

```bash
git clone https://github.com/ManishJakhal7/ad-fit-analyzer.git
cd ad-fit-analyzer
npm install
cp .env.example .env
```

Get a free Gemini API key at https://aistudio.google.com/apikey (no credit
card required) and add it to `.env`:

```
GEMINI_API_KEY=your-key-here
```

Run it:

```bash
npm start
# open http://localhost:3000
```

## Design decisions worth knowing

- **Structured extraction before comparison.** Rather than one prompt doing
  "analyze this ad and page," the pipeline extracts each source into
  structured JSON first, then compares the structured data. This makes the
  comparison step's output traceable to specific fields instead of vague
  impressions.
- **Evidence field is mandatory.** Every scored dimension must cite which
  extracted field(s) it's comparing (`ad.offer vs page.heroOffer`). This is
  the main guardrail against generic, unfalsifiable advice.
- **Severity is recomputed in code, not trusted from the model.** The LLM
  returns a 1–5 score; severity (`high`/`medium`/`low`) is derived from that
  score in plain JavaScript, so a labeling inconsistency in the model's own
  output can't silently slip through.
- **Field length limits in prompts.** Early versions hit token-limit
  truncation on content-heavy pages because free-text fields ran long. Every
  extraction/scoring prompt now caps expected field length explicitly.

## Known limitations / not yet built

- No multi-ad clustering by angle (planned bonus feature)
- No handling for pages that block headless browsers or require login
- Puppeteer screenshot is a single 1440×900 viewport capture — doesn't
  handle responsive breakpoints or scroll-triggered content
- No test suite yet
- Gemini free tier has rate limits (~15 req/min); heavy usage will need a
  paid tier or a different provider

