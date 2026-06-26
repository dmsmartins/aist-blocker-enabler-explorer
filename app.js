// ============================================================
// AIST Blocker & Enabler Explorer
// Expects JSON at: data/aist_roadmap_data.json
// ============================================================

const DATA_URL = "aist_roadmap_data.json"

const state = {
  data: null,
  selectedBlockerId: null,
  showDependencies: true,
  viewMode: "blockers",
  filters: {
    search: "",
    phase: "",
    dimension: "",
    cluster: "",
    stakeholder: "",
    stageGateOnly: false
  }
};

const els = {
  status: document.getElementById("statusMessage"),
  grid: document.getElementById("roadmapGrid"),
  svg: document.getElementById("dependencySvg"),
  details: document.getElementById("detailsContent"),
  closeDetailsBtn: document.getElementById("closeDetailsBtn"),
  searchInput: document.getElementById("searchInput"),
  viewModeSelect: document.getElementById("viewModeSelect"),
  phaseFilter: document.getElementById("phaseFilter"),
  dimensionFilter: document.getElementById("dimensionFilter"),
  clusterFilter: document.getElementById("clusterFilter"),
  stakeholderFilter: document.getElementById("stakeholderFilter"),
  stageGateOnly: document.getElementById("stageGateOnly"),
  resetFiltersBtn: document.getElementById("resetFiltersBtn"),
  toggleDependenciesBtn: document.getElementById("toggleDependenciesBtn"),
  visibleCount: document.getElementById("visibleCount"),
  dependencyCount: document.getElementById("dependencyCount"),
  cardTemplate: document.getElementById("cardTemplate")
};

init();

async function init() {
  bindEvents();

  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
      throw new Error(`Could not load ${DATA_URL}. Status: ${response.status}`);
    }

    const data = await response.json();
    state.data = normaliseData(data);

    populateFilters();
    render();
    setStatus("");
  } catch (error) {
    console.error(error);
    setStatus(
      `Error loading data. Make sure ${DATA_URL} exists and that you are opening the page through a local server or GitHub Pages, not directly as a file.`,
      true
    );
  }
}

function normaliseData(data) {
  data.blockers = data.blockers || [];
  data.enablers = data.enablers || [];
  data.blocker_enabler_map = data.blocker_enabler_map || [];
  data.blocker_dependency_map = data.blocker_dependency_map || [];

  data.blockerById = new Map(data.blockers.map(b => [Number(b.blocker_id), b]));
  data.enablerById = new Map(data.enablers.map(e => [Number(e.enabler_id), e]));

  data.enablersByBlocker = new Map();
  for (const rel of data.blocker_enabler_map) {
    const blockerId = Number(rel.blocker_id);
    const enablerId = Number(rel.enabler_id);
    const enabler = data.enablerById.get(enablerId);

    if (!enabler) continue;

    if (!data.enablersByBlocker.has(blockerId)) {
      data.enablersByBlocker.set(blockerId, []);
    }

    data.enablersByBlocker.get(blockerId).push({
      ...enabler,
      relationship_type: rel.relationship_type || "",
      relationship_strength: rel.relationship_strength || "",
      relationship_confidence: rel.relationship_confidence || "",
      relationship_rationale: rel.rationale || ""
    });
  }

  data.dependenciesByBlocker = new Map();
  data.dependentsByBlocker = new Map();

  for (const dep of data.blocker_dependency_map) {
    const blockerId = Number(dep.blocker_id);
    const dependsOnId = Number(dep.depends_on_blocker_id ?? dep.Dependens_on_blocker_id);

    if (!data.dependenciesByBlocker.has(blockerId)) {
      data.dependenciesByBlocker.set(blockerId, []);
    }

    if (!data.dependentsByBlocker.has(dependsOnId)) {
      data.dependentsByBlocker.set(dependsOnId, []);
    }

    data.dependenciesByBlocker.get(blockerId).push({ ...dep, depends_on_blocker_id: dependsOnId });
    data.dependentsByBlocker.get(dependsOnId).push({ ...dep, depends_on_blocker_id: dependsOnId });
  }

  return data;
}

function bindEvents() {
  els.searchInput.addEventListener("input", e => {
    state.filters.search = e.target.value.toLowerCase().trim();
    render();
  });

  els.viewModeSelect.addEventListener("change", e => {
    state.viewMode = e.target.value;
    render();
  });

  els.phaseFilter.addEventListener("change", e => {
    state.filters.phase = e.target.value;
    render();
  });

  els.dimensionFilter.addEventListener("change", e => {
    state.filters.dimension = e.target.value;
    render();
  });

  els.clusterFilter.addEventListener("change", e => {
    state.filters.cluster = e.target.value;
    render();
  });

  els.stakeholderFilter.addEventListener("change", e => {
    state.filters.stakeholder = e.target.value;
    render();
  });

  els.stageGateOnly.addEventListener("change", e => {
    state.filters.stageGateOnly = e.target.checked;
    render();
  });

  els.resetFiltersBtn.addEventListener("click", resetFilters);

  els.toggleDependenciesBtn.addEventListener("click", () => {
    state.showDependencies = !state.showDependencies;
    els.toggleDependenciesBtn.textContent = state.showDependencies
      ? "Hide dependencies"
      : "Show dependencies";
    els.toggleDependenciesBtn.setAttribute("aria-pressed", String(state.showDependencies));
    renderDependencies(getVisibleBlockers());
  });

  els.closeDetailsBtn.addEventListener("click", () => {
    state.selectedBlockerId = null;
    renderDetails(null);
    markSelectedCard();
  });

  window.addEventListener("resize", debounce(() => {
    renderDependencies(getVisibleBlockers());
  }, 150));
}

function populateFilters() {
  const data = state.data;

  const phases = data.filters?.phases || unique(data.blockers.map(b => b.phase));
  const dimensions = data.filters?.dimensions || unique(data.blockers.map(b => b.dimension));
  const clusters = data.filters?.blocker_clusters || unique(data.blockers.map(b => b.cluster));
  const stakeholders = data.filters?.stakeholders || unique(data.blockers.flatMap(b => asArray(b.stakeholders)));

  fillSelect(els.phaseFilter, phases);
  fillSelect(els.dimensionFilter, dimensions);
  fillSelect(els.clusterFilter, clusters);
  fillSelect(els.stakeholderFilter, stakeholders);
}

function fillSelect(select, values) {
  const existingFirstOption = select.querySelector("option");
  select.innerHTML = "";
  select.appendChild(existingFirstOption);

  values
    .filter(v => v !== null && v !== undefined && String(v).trim() !== "")
    .sort((a, b) => String(a).localeCompare(String(b)))
    .forEach(value => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
}

function resetFilters() {
  state.filters = {
    search: "",
    phase: "",
    dimension: "",
    cluster: "",
    stakeholder: "",
    stageGateOnly: false
  };
  state.viewMode = "blockers";

  els.searchInput.value = "";
  els.viewModeSelect.value = "blockers";
  els.phaseFilter.value = "";
  els.dimensionFilter.value = "";
  els.clusterFilter.value = "";
  els.stakeholderFilter.value = "";
  els.stageGateOnly.checked = false;

  render();
}

function render() {
  if (!state.data) return;

  const blockers = getVisibleBlockers();

  els.grid.innerHTML = "";

  if (blockers.length === 0) {
    els.grid.innerHTML = `<p class="empty-details">No blockers match the current filters.</p>`;
    els.visibleCount.textContent = "0";
    els.dependencyCount.textContent = "0";
    els.svg.innerHTML = "";
    return;
  }

  const grouped = groupByPhase(blockers);

  for (const [phase, phaseBlockers] of grouped) {
    const section = document.createElement("div");
    section.className = "phase-section";
    section.innerHTML = `<h2 class="phase-title">${escapeHtml(phase || "To be defined")}</h2>`;
    els.grid.appendChild(section);

    for (const blocker of phaseBlockers) {
      const card = createCard(blocker);
      els.grid.appendChild(card);
    }
  }

  els.visibleCount.textContent = String(blockers.length);
  markSelectedCard();

  // Wait for layout before drawing dependency lines.
  requestAnimationFrame(() => renderDependencies(blockers));
}

function getVisibleBlockers() {
  const data = state.data;
  const f = state.filters;

  return [...data.blockers]
    .filter(b => {
      const enablers = data.enablersByBlocker.get(Number(b.blocker_id)) || [];
      const haystack = buildSearchText(b, enablers);

      if (f.search && !haystack.includes(f.search)) return false;
      if (f.phase && b.phase !== f.phase) return false;
      if (f.dimension && b.dimension !== f.dimension) return false;
      if (f.cluster && b.cluster !== f.cluster) return false;
      if (f.stakeholder && !asArray(b.stakeholders).includes(f.stakeholder)) return false;
      if (f.stageGateOnly && !toBool(b.is_stage_gate)) return false;

      return true;
    })
    .sort((a, b) => {
      const aOrder = Number(a.sort_order ?? a.blocker_id);
      const bOrder = Number(b.sort_order ?? b.blocker_id);
      return aOrder - bOrder;
    });
}

function buildSearchText(blocker, enablers) {
  const parts = [
    blocker.blocker_id,
    blocker.blocker_title,
    blocker.cluster,
    blocker.dimension,
    blocker.phase,
    blocker.blocker_statement,
    blocker.why_it_matters,
    blocker.consequence_if_not_addressed,
    asArray(blocker.stakeholders).join(" "),
    asArray(blocker.lifecycle_stage).join(" "),
    ...enablers.flatMap(e => [
      e.enabler_title,
      e.enabler_description,
      e.practical_actions,
      e.expected_outcome,
      e.cluster
    ])
  ];

  return parts.join(" ").toLowerCase();
}

function createCard(blocker) {
  const node = els.cardTemplate.content.firstElementChild.cloneNode(true);
  const blockerId = Number(blocker.blocker_id);
  const enablers = state.data.enablersByBlocker.get(blockerId) || [];

  node.dataset.blockerId = blockerId;
  node.id = `blocker-card-${blockerId}`;

  node.classList.add(dimensionClass(blocker.dimension));
  if (toBool(blocker.is_stage_gate)) node.classList.add("stage-gate-card");
  if (state.selectedBlockerId === blockerId) node.classList.add("selected");

  node.querySelector(".card-id").textContent = `B${blockerId}`;
  const badge = node.querySelector(".card-badge");
  badge.textContent = toBool(blocker.is_stage_gate) ? "Stage Gate" : blocker.phase || "";
  if (toBool(blocker.is_stage_gate)) badge.classList.add("stage");

  node.querySelector(".card-title").textContent = blocker.blocker_title || "Untitled blocker";
  node.querySelector(".card-cluster").textContent = blocker.cluster || "";

  const tags = node.querySelector(".card-tags");
  tags.innerHTML = "";
  [blocker.dimension, blocker.phase, ...(asArray(blocker.lifecycle_stage).slice(0, 2))]
    .filter(Boolean)
    .forEach(t => tags.appendChild(tag(t)));

  const summary = node.querySelector(".card-summary");

  if (state.viewMode === "enablers") {
    summary.innerHTML = enablers.length
      ? `<strong>Related enablers:</strong><br>${enablers.slice(0, 4).map(e => `• ${escapeHtml(e.enabler_title)}`).join("<br>")}${enablers.length > 4 ? "<br>…" : ""}`
      : "No related enablers mapped yet.";
  } else {
    summary.textContent = blocker.blocker_statement || "";
  }

  node.querySelector(".dependency-level").textContent = `Level ${blocker.dependency_level ?? 0}`;
  node.querySelector(".enabler-count").textContent = `${enablers.length} enabler${enablers.length === 1 ? "" : "s"}`;

  node.addEventListener("click", () => selectBlocker(blockerId));
  node.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectBlocker(blockerId);
    }
  });

  return node;
}

function selectBlocker(blockerId) {
  state.selectedBlockerId = blockerId;
  const blocker = state.data.blockerById.get(blockerId);
  renderDetails(blocker);
  markSelectedCard();
}

function markSelectedCard() {
  document.querySelectorAll(".card").forEach(card => {
    card.classList.toggle("selected", Number(card.dataset.blockerId) === state.selectedBlockerId);
  });
}

function renderDetails(blocker) {
  if (!blocker) {
    els.details.innerHTML = `<p class="empty-details">Select a blocker card to see details.</p>`;
    return;
  }

  const blockerId = Number(blocker.blocker_id);
  const enablers = state.data.enablersByBlocker.get(blockerId) || [];
  const dependencies = state.data.dependenciesByBlocker.get(blockerId) || [];
  const dependents = state.data.dependentsByBlocker.get(blockerId) || [];

  els.details.innerHTML = `
    <h2>${escapeHtml(blocker.blocker_title || "Untitled blocker")}</h2>

    <div class="detail-meta">
      ${tagHtml(`B${blockerId}`)}
      ${tagHtml(blocker.dimension)}
      ${tagHtml(blocker.phase)}
      ${toBool(blocker.is_stage_gate) ? tagHtml("Stage Gate candidate") : ""}
    </div>

    ${detailSection("Cluster", blocker.cluster)}
    ${detailSection("Blocker statement", blocker.blocker_statement)}
    ${detailSection("Why it matters", blocker.why_it_matters)}
    ${detailSection("Consequence if not addressed", blocker.consequence_if_not_addressed)}

    <section class="detail-section">
      <h3>Stakeholders</h3>
      <p>${asArray(blocker.stakeholders).map(escapeHtml).join("; ") || "Not specified"}</p>
    </section>

    <section class="detail-section">
      <h3>Lifecycle stage</h3>
      <p>${asArray(blocker.lifecycle_stage).map(escapeHtml).join("; ") || "Not specified"}</p>
    </section>

    <section class="detail-section">
      <h3>Related enablers</h3>
      <div class="enabler-list">
        ${
          enablers.length
            ? enablers.map(renderEnablerItem).join("")
            : `<p>No enablers mapped yet.</p>`
        }
      </div>
    </section>

    <section class="detail-section">
      <h3>Dependencies</h3>
      ${renderDependencyList("Depends on", dependencies, true)}
      ${renderDependencyList("Used by / affects", dependents, false)}
    </section>

    <section class="detail-section">
      <h3>Discussion</h3>
      <p><strong>Needed:</strong> ${escapeHtml(blocker.discussion_needed || "not specified")}</p>
      <p><strong>Attribute:</strong> ${escapeHtml(blocker.discussion_attribute || "not specified")}</p>
      <p><strong>Reason:</strong> ${escapeHtml(blocker.discussion_reason || "")}</p>
      <p><strong>Comments:</strong> ${escapeHtml(blocker.comments || "")}</p>
    </section>
  `;
}

function renderEnablerItem(enabler) {
  return `
    <article class="enabler-item">
      <h4>E${escapeHtml(enabler.enabler_id)} — ${escapeHtml(enabler.enabler_title || "Untitled enabler")}</h4>
      <div class="enabler-meta">
        ${tagHtml(enabler.relationship_type || "relationship not specified")}
        ${tagHtml(enabler.relationship_strength || "strength not specified")}
        ${tagHtml(enabler.relationship_confidence || "confidence not specified")}
      </div>
      <p>${escapeHtml(enabler.enabler_description || "")}</p>
      ${enabler.practical_actions ? `<p><strong>Actions:</strong> ${escapeHtml(enabler.practical_actions)}</p>` : ""}
      ${enabler.expected_outcome ? `<p><strong>Expected outcome:</strong> ${escapeHtml(enabler.expected_outcome)}</p>` : ""}
      ${enabler.relationship_rationale ? `<p><strong>Rationale:</strong> ${escapeHtml(enabler.relationship_rationale)}</p>` : ""}
    </article>
  `;
}

function renderDependencyList(title, deps, isDependsOn) {
  if (!deps.length) {
    return `<p><strong>${escapeHtml(title)}:</strong> none mapped.</p>`;
  }

  const items = deps.map(dep => {
    const targetId = isDependsOn
      ? Number(dep.depends_on_blocker_id)
      : Number(dep.blocker_id);

    const target = state.data.blockerById.get(targetId);
    const titleText = target ? target.blocker_title : "Missing blocker";

    return `<li>
      <button class="link-button" onclick="selectBlocker(${targetId})">B${targetId}</button>
      — ${escapeHtml(titleText)}
      ${tagHtml(dep.relationship_strength || "")}
    </li>`;
  }).join("");

  return `<p><strong>${escapeHtml(title)}:</strong></p><ul>${items}</ul>`;
}

function renderDependencies(visibleBlockers) {
  if (!state.data || !state.showDependencies) {
    els.svg.innerHTML = "";
    els.dependencyCount.textContent = "0";
    return;
  }

  const visibleIds = new Set(visibleBlockers.map(b => Number(b.blocker_id)));
  const wrapper = document.querySelector(".roadmap-wrapper");
  const wrapperRect = wrapper.getBoundingClientRect();

  const lines = [];

  for (const dep of state.data.blocker_dependency_map) {
    const fromId = Number(dep.depends_on_blocker_id ?? dep.Dependens_on_blocker_id);
    const toId = Number(dep.blocker_id);

    if (!visibleIds.has(fromId) || !visibleIds.has(toId)) continue;

    const fromEl = document.getElementById(`blocker-card-${fromId}`);
    const toEl = document.getElementById(`blocker-card-${toId}`);
    if (!fromEl || !toEl) continue;

    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();

    const x1 = fromRect.left + fromRect.width / 2 - wrapperRect.left + wrapper.scrollLeft;
    const y1 = fromRect.bottom - wrapperRect.top + wrapper.scrollTop;
    const x2 = toRect.left + toRect.width / 2 - wrapperRect.left + wrapper.scrollLeft;
    const y2 = toRect.top - wrapperRect.top + wrapper.scrollTop;

    const midY = (y1 + y2) / 2;
    const strength = String(dep.relationship_strength || "").toLowerCase();

    lines.push(`
      <path
        class="dependency-line ${escapeHtml(strength)}"
        d="M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}"
        marker-end="url(#arrowhead)"
      />
    `);
  }

  const width = Math.max(wrapper.scrollWidth, wrapper.clientWidth);
  const height = Math.max(wrapper.scrollHeight, wrapper.clientHeight);

  els.svg.setAttribute("width", width);
  els.svg.setAttribute("height", height);
  els.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  els.svg.innerHTML = `
    <defs>
      <marker id="arrowhead" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
        <path d="M 0 0 L 10 4 L 0 8 z" fill="rgba(37, 99, 235, 0.55)"></path>
      </marker>
    </defs>
    ${lines.join("")}
  `;

  els.dependencyCount.textContent = String(lines.length);
}

function groupByPhase(blockers) {
  const order = {
    "P0 - Foundation": 1,
    "P1 - Scaling readiness": 2,
    "P2 - Optimisation": 3,
    "To be defined": 9
  };

  const sorted = [...blockers].sort((a, b) => {
    const phaseA = order[a.phase] ?? 9;
    const phaseB = order[b.phase] ?? 9;
    if (phaseA !== phaseB) return phaseA - phaseB;
    return Number(a.sort_order ?? a.blocker_id) - Number(b.sort_order ?? b.blocker_id);
  });

  const groups = new Map();
  for (const blocker of sorted) {
    const phase = blocker.phase || "To be defined";
    if (!groups.has(phase)) groups.set(phase, []);
    groups.get(phase).push(blocker);
  }

  return groups;
}

function dimensionClass(dimension) {
  const d = String(dimension || "").toLowerCase();
  if (d.includes("technical")) return "dimension-technical";
  if (d.includes("organisational")) return "dimension-organisational";
  if (d.includes("cross")) return "dimension-cross-cutting";
  return "";
}

function detailSection(title, value) {
  return `
    <section class="detail-section">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(value || "Not specified")}</p>
    </section>
  `;
}

function tag(text) {
  const span = document.createElement("span");
  span.className = "tag";
  span.textContent = text;
  return span;
}

function tagHtml(text) {
  if (!text) return "";
  return `<span class="tag">${escapeHtml(text)}</span>`;
}

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value === null || value === undefined || value === "") return [];
  return String(value).split(";").map(v => v.trim()).filter(Boolean);
}

function unique(values) {
  return [...new Set(values.flatMap(v => asArray(v)).filter(Boolean))];
}

function toBool(value) {
  if (typeof value === "boolean") return value;
  const v = String(value || "").trim().toLowerCase();
  return v === "true" || v === "yes" || v === "1";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setStatus(message, isError = false) {
  if (!message) {
    els.status.style.display = "none";
    return;
  }

  els.status.style.display = "block";
  els.status.textContent = message;
  els.status.classList.toggle("error", isError);
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
