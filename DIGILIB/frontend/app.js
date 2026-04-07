const API_BASE = window.__API_BASE__ || "/api";

function getToken() {
  return localStorage.getItem("audit_token");
}

function clearToken() {
  localStorage.removeItem("audit_token");
}

function decodeToken(token) {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch (err) {
    return null;
  }
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }
  return response.json();
}

const pdfCache = new Map();
const pageRenderCache = new Map();
const documentBlobUrlCache = new Map();
let currentOffset = 0;
const pageSize = 20;
let currentUsername = "guest";
const STOP_WORDS = new Set([
  "a", "an", "the", "of", "to", "in", "on", "at", "for", "from", "by", "with",
  "and", "or", "but", "is", "are", "was", "were", "be", "been", "being", "as",
  "that", "this", "these", "those", "it", "its", "into", "about", "over", "under",
  "up", "down", "out", "off", "not", "no", "do", "does", "did", "can", "could",
  "will", "would", "should", "may", "might", "must", "have", "has", "had", "all"
]);

const highlightMode = "terms";

function setLoading(isLoading) {
  document.getElementById("loadingState").style.display = isLoading ? "grid" : "none";
}

function setEmptyState(show) {
  document.getElementById("emptyState").style.display = show ? "block" : "none";
}

function updateHeader(text) {
  document.getElementById("mainSubtitle").textContent = text;
}

function updateFooterStats(stats) {
  document.getElementById("footerStats").style.display = "grid";
  document.getElementById("statTotal").textContent = stats.total;
  document.getElementById("statAvg").textContent = stats.avg.toFixed(2);
  document.getElementById("statTime").textContent = `${stats.time} ms`;
  document.getElementById("statCache").textContent = stats.cache ? "Yes" : "No";
}

async function refreshSidebarStats() {
  try {
    const data = await apiFetch("/stats");
    document.getElementById("totalDocs").textContent = String(data.total_documents || 0);
    document.getElementById("totalChunks").textContent = String(data.total_chunks || 0);
  } catch (err) {
    console.error(err);
  }
}

async function fetchDocumentBlobUrl(docId) {
  let cached = documentBlobUrlCache.get(docId);
  if (cached) {
    return cached;
  }

  const token = getToken();
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/documents/${docId}/file`, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch document (${response.status})`);
  }

  const blob = await response.blob();
  cached = URL.createObjectURL(blob);
  documentBlobUrlCache.set(docId, cached);
  return cached;
}

function highlightSnippet(text, rawQuery, terms, forceTerms = false) {
  if (!forceTerms && highlightMode === "none") {
    return text;
  }
  if (!text) {
    return text;
  }

  const phrase = (rawQuery || "").trim();
  const rawTokens = (rawQuery || "")
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (!phrase && !terms.length) {
    return text;
  }

  const combos = [];
  const filteredCombos = [];

  // Contiguous combinations from the raw query (includes words like "of").
  for (const size of [3, 2]) {
    if (rawTokens.length >= size) {
      for (let i = 0; i <= rawTokens.length - size; i += 1) {
        combos.push(rawTokens.slice(i, i + size).join(" "));
      }
    }
  }

  // Contiguous combinations from stopword-filtered terms.
  for (const size of [3, 2]) {
    if (terms.length >= size) {
      for (let i = 0; i <= terms.length - size; i += 1) {
        filteredCombos.push(terms.slice(i, i + size).join(" "));
      }
    }
  }

  // Pair combinations (non-contiguous) from filtered terms, e.g. "goods parallel".
  const pairCombos = [];
  for (let i = 0; i < terms.length; i += 1) {
    for (let j = i + 1; j < terms.length; j += 1) {
      pairCombos.push(`${terms[i]} ${terms[j]}`);
    }
  }

  const candidates = [...new Set([phrase, ...combos, ...filteredCombos, ...pairCombos, ...terms])]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  if (!candidates.length) {
    return text;
  }

  const regex = new RegExp(`(${candidates.join("|")})`, "gi");
  return text.replace(regex, "<mark>$1</mark>");
}

function extractHighlightTerms(query) {
  return (query || "")
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term));
}

function buildResultCard(result, index, queryTerms, rawQuery) {
  const scorePct = Math.round(result.score * 100);
  const card = document.createElement("article");
  card.className = "result-card";

  card.innerHTML = `
    <div class="result-top">
      <span class="badge">Result #${index + 1}</span>
      <span class="badge score">${scorePct}% Match</span>
      <button class="btn" data-action="open">View Full Document</button>
    </div>
    <div class="file-name">
      <span>PDF</span>
      <span>${result.file_name}</span>
    </div>
    <div class="info-grid">
      <div class="info-chip blue">Audit Year: ${result.audit_year || "-"}</div>
      <div class="info-chip purple">Division: ${result.division || "-"}</div>
      <div class="info-chip orange">Audit Type: ${result.audit_type || "-"}</div>
    </div>
    <div class="toggle-group">
      <button class="toggle-btn active" data-view="text">Text View</button>
      <button class="toggle-btn" data-view="pdf">PDF View</button>
    </div>
    <div class="snippet" data-text>
      ${highlightSnippet(result.snippet || "", rawQuery, queryTerms, true)}
    </div>
    <div class="pdf-viewer" data-pdf style="display: none;">
      <div style="width: 100%;">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 10px; flex-wrap: wrap;">
          <div class="toggle-group">
            <button class="toggle-btn" data-nav="prev">Prev</button>
            <span class="badge" data-page>Page ${result.page_number || 1}</span>
            <button class="toggle-btn" data-nav="next">Next</button>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <label style="font-size: 12px; color: var(--fg-muted);">Jump to page</label>
            <input type="number" min="1" class="page-input" data-page-input placeholder="1" />
            <button class="toggle-btn" data-nav="go">Go</button>
          </div>
        </div>
        <div class="pdf-layer" data-layer>Loading PDF...</div>
      </div>
    </div>
  `;

  const openBtn = card.querySelector("[data-action='open']");
  openBtn.addEventListener("click", async () => {
    try {
      const blobUrl = await fetchDocumentBlobUrl(result.doc_id);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error(err);
      alert("Unable to open PDF document.");
    }
  });

  const textView = card.querySelector("[data-text]");
  const pdfView = card.querySelector("[data-pdf]");
  const layer = card.querySelector("[data-layer]");
  const pageLabel = card.querySelector("[data-page]");
  const pageInput = card.querySelector("[data-page-input]");
  const prevBtn = card.querySelector("[data-nav='prev']");
  const nextBtn = card.querySelector("[data-nav='next']");
  const goBtn = card.querySelector("[data-nav='go']");
  const buttons = card.querySelectorAll(".toggle-btn[data-view]");

  let currentPage = result.page_number || 1;

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      buttons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      if (button.dataset.view === "pdf") {
        textView.style.display = "none";
        pdfView.style.display = "grid";
        renderPdfView(layer, result, queryTerms, rawQuery, currentPage, pageLabel);
      } else {
        textView.style.display = "block";
        pdfView.style.display = "none";
      }
    });
  });

  prevBtn.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage -= 1;
      renderPdfView(layer, result, queryTerms, rawQuery, currentPage, pageLabel);
    }
  });

  nextBtn.addEventListener("click", () => {
    const totalPages = Number(layer.dataset.totalPages || "0");
    if (totalPages && currentPage < totalPages) {
      currentPage += 1;
      renderPdfView(layer, result, queryTerms, rawQuery, currentPage, pageLabel);
    }
  });

  goBtn.addEventListener("click", () => {
    const totalPages = Number(layer.dataset.totalPages || "0");
    const target = Number(pageInput.value);
    if (!target || target < 1) return;
    if (totalPages && target > totalPages) return;
    currentPage = target;
    renderPdfView(layer, result, queryTerms, rawQuery, currentPage, pageLabel);
  });

  return card;
}

async function renderPdfView(container, result, queryTerms, rawQuery, pageNumber, pageLabel) {
  if (!window.pdfjsLib) {
    container.textContent = "PDF.js not loaded.";
    return;
  }

  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  let pdf = pdfCache.get(result.doc_id);
  if (!pdf) {
    const blobUrl = await fetchDocumentBlobUrl(result.doc_id);
    pdf = await window.pdfjsLib.getDocument(blobUrl).promise;
    pdfCache.set(result.doc_id, pdf);
  }

  const totalPages = pdf.numPages;
  container.dataset.totalPages = totalPages;
  if (pageLabel) {
    pageLabel.textContent = `Page ${pageNumber} / ${totalPages}`;
  }

  const scale = 1.35;
  const phrase = (rawQuery || "").trim();
  const cacheKey = `${result.doc_id}:${pageNumber}:${scale}:${phrase}:terms`;
  const cached = pageRenderCache.get(cacheKey);
  if (cached) {
    container.innerHTML = "";
    container.appendChild(cached.canvas.cloneNode(true));
    container.appendChild(cached.highlightLayer.cloneNode(true));
    container.appendChild(cached.textLayer.cloneNode(true));
    return;
  }

  container.innerHTML = "";
  const pageWrap = document.createElement("div");
  pageWrap.style.position = "relative";
  pageWrap.style.margin = "0 auto";
  pageWrap.style.width = "fit-content";
  pageWrap.style.height = "fit-content";

  const canvas = document.createElement("canvas");
  canvas.className = "pdf-canvas";
  canvas.style.position = "absolute";
  canvas.style.left = "0";
  canvas.style.top = "0";
  canvas.style.margin = "0";
  const textLayer = document.createElement("div");
  textLayer.className = "textLayer";
  const highlightLayer = document.createElement("div");
  highlightLayer.className = "highlight-layer";
  pageWrap.appendChild(canvas);
  pageWrap.appendChild(highlightLayer);
  pageWrap.appendChild(textLayer);
  container.appendChild(pageWrap);

  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  canvas.height = viewport.height;
  canvas.width = viewport.width;
  pageWrap.style.width = `${viewport.width}px`;
  pageWrap.style.height = `${viewport.height}px`;

  await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;

  const textContent = await page.getTextContent();
  const textItems = textContent.items;
  textLayer.style.width = `${viewport.width}px`;
  textLayer.style.height = `${viewport.height}px`;
  highlightLayer.style.width = `${viewport.width}px`;
  highlightLayer.style.height = `${viewport.height}px`;

  const normalizeForMatch = (value) =>
    (value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const normalizedItems = textItems.map((item) => (item.str || "").replace(/\s+/g, " ").trim());
  const normalizedItemsForMatch = normalizedItems.map((item) => normalizeForMatch(item));
  const matchedIndexes = new Set();
  const termRegex = queryTerms.length
    ? new RegExp(
        `(${queryTerms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
        "i"
      )
    : null;

  for (let i = 0; i < normalizedItemsForMatch.length; i += 1) {
    if (termRegex && termRegex.test(normalizedItemsForMatch[i])) {
      matchedIndexes.add(i);
    }
  }

  for (let idx = 0; idx < textItems.length; idx += 1) {
    const item = textItems[idx];
    const span = document.createElement("span");
    const tx = window.pdfjsLib.Util.transform(viewport.transform, item.transform);
    const fontHeight = Math.hypot(tx[2], tx[3]);
    span.style.left = `${tx[4]}px`;
    span.style.top = `${tx[5] - fontHeight}px`;
    span.style.fontSize = `${fontHeight}px`;
    span.textContent = item.str;
    textLayer.appendChild(span);

    if (matchedIndexes.has(idx)) {
      const rect = document.createElement("div");
      const width = item.width ? item.width * viewport.scale : span.getBoundingClientRect().width;
      rect.className = "highlight-rect";
      rect.style.left = `${tx[4]}px`;
      rect.style.top = `${tx[5] - fontHeight}px`;
      rect.style.height = `${fontHeight}px`;
      rect.style.width = `${width}px`;
      highlightLayer.appendChild(rect);
    }
  }

  pageRenderCache.set(cacheKey, {
    canvas: canvas.cloneNode(true),
    highlightLayer: highlightLayer.cloneNode(true),
    textLayer: textLayer.cloneNode(true),
  });
}

async function loadFilters() {
  const data = await apiFetch("/filters");
  fillSelect("filterYear", data.audit_year);
  fillSelect("filterDivision", data.division);
  fillSelect("filterType", data.audit_type);
  fillSelect("filterUnit", data.unit);
  fillSelect("filterManager", data.audit_manager);
}

function fillSelect(id, options) {
  const select = document.getElementById(id);
  const placeholder = select.options[0].textContent;
  select.innerHTML = `<option value="">${placeholder}</option>`;
  (options || []).forEach((value) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = value;
    select.appendChild(opt);
  });
}

function getFilters() {
  return {
    audit_year: document.getElementById("filterYear").value || null,
    division: document.getElementById("filterDivision").value || null,
    audit_type: document.getElementById("filterType").value || null,
    unit: document.getElementById("filterUnit").value || null,
    audit_manager: document.getElementById("filterManager").value || null,
  };
}

async function runSearch(loadMore = false) {
  const query = document.getElementById("searchInput").value.trim();
  const searchType = document.querySelector("[data-search].active").dataset.search;
  const minScore = 0.25;

  document.getElementById("searchType").textContent = searchType.charAt(0).toUpperCase() + searchType.slice(1);
  document.getElementById("minScore").textContent = minScore.toFixed(2);

  if (!query) {
    updateHeader("Enter a search query to begin.");
    setEmptyState(false);
    document.getElementById("resultsList").innerHTML = "";
    document.getElementById("footerStats").style.display = "none";
    return;
  }

  setLoading(true);
  setEmptyState(false);

  try {
    if (!loadMore) {
      currentOffset = 0;
      document.getElementById("resultsList").innerHTML = "";
    }

    const payload = {
      query,
      top_k: pageSize,
      offset: currentOffset,
      min_score: minScore,
      search_type: searchType,
      filters: getFilters(),
    };

    const data = await apiFetch("/search", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const list = document.getElementById("resultsList");
    const terms = extractHighlightTerms(query);
    const baseIndex = list.children.length;

    data.results.forEach((result, idx) => {
      list.appendChild(buildResultCard(result, baseIndex + idx, terms, query));
    });

    const warning = data.warning ? ` ${data.warning}` : "";
    updateHeader(
      data.total
        ? `Found ${data.total} relevant documents. Search type: ${searchType}. Min score: ${minScore}.${warning}`
        : "No results found."
    );

    setEmptyState(data.total === 0);
    updateFooterStats({
      total: data.total,
      avg: data.avg_score,
      time: data.search_time_ms,
      cache: data.cache_hit,
    });

    currentOffset += data.results.length;
    const loadMoreBtn = document.getElementById("loadMoreBtn");
    loadMoreBtn.style.display = currentOffset < data.total ? "inline-flex" : "none";
  } catch (err) {
    updateHeader("Error searching documents. Check backend connectivity.");
    console.error(err);
  } finally {
    setLoading(false);
  }
}

async function ingestDocuments() {
  const button = document.getElementById("ingestBtn");
  try {
    button.disabled = true;
    button.textContent = "Ingesting...";

    const preflight = await apiFetch("/ingest/preflight");
    if (!preflight.ok) {
      const issueText = (preflight.issues || []).join("\n- ");
      throw new Error(`Preflight failed:\n- ${issueText}`);
    }

    const queued = await apiFetch("/ingest", { method: "POST" });
    const jobId = queued.job_id;
    if (!jobId) {
      throw new Error("Ingestion job was not queued.");
    }

    const maxAttempts = 240; // 20 minutes with 5s polling
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const status = await apiFetch(`/ingest/status/${jobId}`);
      const state = status.status;

      if (state === "finished") {
        const result = status.result || {};
        const errors = result.errors || [];
        const errorPreview = errors.length
          ? `\nSample errors:\n${errors
              .slice(0, 3)
              .map((item) => `- ${item.file_path}: ${item.error}`)
              .join("\n")}`
          : "";
        alert(
          `Ingestion complete.\nTotal PDFs: ${result.total_pdfs || 0}\nDocuments: ${result.documents || 0}\nChunks: ${result.chunks || 0}\nSkipped: ${result.skipped || 0}\nFailed: ${result.failed || 0}${errorPreview}`
        );
        await refreshSidebarStats();
        return;
      }

      if (state === "failed") {
        throw new Error(status.error || "Ingestion job failed.");
      }
    }

    throw new Error("Timed out waiting for ingestion to finish.");
  } catch (err) {
    alert(`Ingestion failed. ${err.message || "Check logs."}`);
    console.error(err);
  } finally {
    button.disabled = false;
    button.textContent = "Ingest PDFs";
  }
}

function ensureAuth() {
  const token = getToken();
  if (!token) {
    window.location.href = "login.html";
    return;
  }
  const payload = decodeToken(token);
  if (payload && payload.username) {
    currentUsername = payload.username;
  }
  if (payload && payload.role === "admin") {
    document.getElementById("ingestBtn").style.display = "inline-block";
    document.getElementById("userManagementBtn").style.display = "inline-block";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  ensureAuth();

  document.getElementById("searchBtn").addEventListener("click", () => runSearch());
  document.getElementById("loadMoreBtn").addEventListener("click", () => runSearch(true));
  document.getElementById("logoutBtn").addEventListener("click", () => {
    clearToken();
    window.location.href = "login.html";
  });
  document.getElementById("ingestBtn").addEventListener("click", ingestDocuments);

  document.querySelectorAll("[data-search]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-search]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  try {
    await loadFilters();
    await refreshSidebarStats();
  } catch (err) {
    console.error(err);
  }
});
