const form = document.getElementById('analyzeForm');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('adImages');
const thumbList = document.getElementById('thumbList');
const submitBtn = document.getElementById('submitBtn');
const formError = document.getElementById('formError');
const resultsEl = document.getElementById('results');

let selectedFiles = [];

// ---------- File upload UX (click + drag/drop) ----------
dropzone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  addFiles(Array.from(e.target.files));
});

['dragenter', 'dragover'].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  })
);
['dragleave', 'drop'].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
  })
);
dropzone.addEventListener('drop', (e) => {
  const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
  addFiles(files);
});

function addFiles(files) {
  selectedFiles = [...selectedFiles, ...files].slice(0, 6);
  renderThumbs();
}

function renderThumbs() {
  thumbList.innerHTML = '';
  selectedFiles.forEach((file, i) => {
    const div = document.createElement('div');
    div.className = 'thumb';
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.alt = `Ad screenshot ${i + 1}`;
    div.appendChild(img);
    thumbList.appendChild(div);
  });
}

// ---------- Form submission ----------
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.textContent = '';

  const landingPageUrl = document.getElementById('landingPageUrl').value.trim();
  const adCopy = document.getElementById('adCopy').value.trim();

  if (!adCopy && selectedFiles.length === 0) {
    formError.textContent = 'Add ad copy text or at least one ad screenshot before running the analysis.';
    return;
  }

  const fd = new FormData();
  fd.append('landingPageUrl', landingPageUrl);
  fd.append('adCopy', adCopy);
  selectedFiles.forEach((file) => fd.append('adImages', file));

  setLoading(true);
  resultsEl.hidden = true;

  try {
    const res = await fetch('/api/analyze', { method: 'POST', body: fd });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Something went wrong analyzing this page.');
    }
    renderResults(data);
  } catch (err) {
    formError.textContent = err.message;
  } finally {
    setLoading(false);
  }
});

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.querySelector('.btn-label').textContent = isLoading
    ? 'Analyzing…'
    : 'Run fit analysis';
}

// ---------- Results rendering ----------
function renderResults(data) {
  resultsEl.innerHTML = '';
  resultsEl.hidden = false;

  const header = document.createElement('div');
  header.className = 'results-header';
  header.innerHTML = `
    <h2>Fit report — ${escapeHtml(data.landingPageUrl)}</h2>
    <span class="fit-score">Overall fit <strong>${data.overallFitScore.toFixed(1)}</strong> / 5</span>
  `;
  resultsEl.appendChild(header);

  data.dimensions
    .slice()
    .sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity))
    .forEach((dim) => resultsEl.appendChild(renderDimensionCard(dim)));

  if (data.note) {
    const note = document.createElement('p');
    note.className = 'mock-note';
    note.textContent = data.note;
    resultsEl.appendChild(note);
  }

  resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderDimensionCard(dim) {
  const card = document.createElement('article');
  card.className = 'dimension-card';
  card.dataset.severity = dim.severity;

  card.innerHTML = `
    <div class="dimension-head">
      <h3>${escapeHtml(dim.label)}</h3>
      <span class="severity-tag" data-severity="${dim.severity}">${dim.severity} · ${dim.matchScore}/5</span>
    </div>
    <div class="compare-grid">
      <div class="compare-cell">
        <span class="cell-label">AD CLAIMS</span>
        <p>${escapeHtml(dim.adClaim)}</p>
      </div>
      <div class="compare-cell">
        <span class="cell-label">PAGE SHOWS</span>
        <p>${escapeHtml(dim.pageReality)}</p>
      </div>
    </div>
    <p class="fix-suggestion"><strong>Fix:</strong> ${escapeHtml(dim.fixSuggestion)}</p>
  `;
  return card;
}

function severityWeight(s) {
  return { high: 3, medium: 2, low: 1 }[s] || 0;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
