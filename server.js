require('dotenv').config();

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');

const { extractPageContent } = require('./lib/pageExtractor');
const { extractAdContent } = require('./lib/adExtractor');
const { analyzeMismatch } = require('./lib/mismatchAnalyzer');

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.GEMINI_API_KEY) {
  console.warn('⚠️  GEMINI_API_KEY is not set. Copy .env.example to .env and add your free key from https://aistudio.google.com/apikey');
}

// Accept up to 6 ad screenshots in memory (no disk writes needed for this scale)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

/**
 * POST /api/analyze
 * multipart/form-data fields:
 *   - landingPageUrl: string (required)
 *   - adCopy: string (optional — free text ad copy)
 *   - adImages: file[] (optional — one or more ad screenshots)
 *
 * Returns a mismatch report: fetches + screenshots the landing page, extracts
 * structured content from both the ad and the page via Claude, then scores
 * their fit across fixed dimensions (persona, offer, framing, proof,
 * objections, above-the-fold continuity).
 */
app.post('/api/analyze', upload.array('adImages', 6), async (req, res) => {
  const { landingPageUrl, adCopy } = req.body;
  const adImages = req.files || [];

  if (!landingPageUrl) {
    return res.status(400).json({ error: 'landingPageUrl is required' });
  }
  if (!adCopy && adImages.length === 0) {
    return res.status(400).json({ error: 'Provide ad copy text or at least one ad screenshot' });
  }

  try {
    // Page capture/extraction and ad extraction are independent — run in parallel.
    const [pageContent, adContent] = await Promise.all([
      extractPageContent(landingPageUrl),
      extractAdContent(adCopy, adImages),
    ]);

    const { dimensions, overallFitScore } = await analyzeMismatch(adContent, pageContent);

    res.json({
      landingPageUrl,
      overallFitScore,
      dimensions,
      adContent,
      pageContent,
    });
  } catch (err) {
    console.error('Analysis failed:', err);
    res.status(500).json({
      error: 'Analysis failed. This is often a page-fetch timeout or an unreachable URL — check the server console for details.',
      detail: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Ad-Fit Analyzer running at http://localhost:${PORT}`);
});
