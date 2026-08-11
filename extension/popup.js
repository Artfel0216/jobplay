import { searchSolides, dedupeJobs } from "./jobCore.js";

const storage = typeof browser !== "undefined" && browser.storage ? browser.storage.local : chrome.storage.local;

let jobs = [];
let preferredRoles = [];
let strictFiltering = false;
let locationRules = { home_state: "PE", outside_home_state_only_remote: true };

const EMPTY_PROFILE = {
  name: "", email: "", phone: "", city: "", state: "", linkedin: "", github: "",
  portfolio: "", desiredSalary: "", skills: "", languages: "", education: "", summary: "",
};
let profile = { ...EMPTY_PROFILE };
let favorites = [];

function setSummary(text) {
  if (summary) summary.textContent = text;
}

async function loadPreferredRoles() {
  try {
    const url = chrome.runtime.getURL('agent_preferences.json');
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    if (data?.preferred_job_roles && Array.isArray(data.preferred_job_roles)) {
      preferredRoles = data.preferred_job_roles.map((p) => p.toLowerCase());
    }
    strictFiltering = !!data?.strict_filtering;
    if (data?.location_rules) {
      locationRules = {
        home_state: (data.location_rules.home_state || "PE").toUpperCase(),
        outside_home_state_only_remote: !!data.location_rules.outside_home_state_only_remote,
      };
    }
  } catch {
    // ignore
  }
}

async function loadSettingsFromStorage() {
  return new Promise((resolve) => {
    try {
      storage.get(['agent_settings'], (result) => {
        const s = result.agent_settings || {};
        if (typeof s.boost === 'number') {
          const boostInput = document.getElementById('boostInput');
          if (boostInput) boostInput.value = String(s.boost);
        }
        if (typeof s.preferred_threshold === 'number') {
          const th = document.getElementById('thresholdInput');
          if (th) th.value = String(s.preferred_threshold);
        }
        if (typeof s.strict_filtering === 'boolean') {
          const cb = document.getElementById('strictFilterCheckbox');
          if (cb) cb.checked = s.strict_filtering;
        } else {
          const cb = document.getElementById('strictFilterCheckbox');
          if (cb) cb.checked = strictFiltering;
        }
        resolve(s);
      });
    } catch {
      resolve({});
    }
  });
}

function field(id) {
  return document.getElementById(id);
}

function buildPrefs() {
  const checkbox = field('strictFilterCheckbox');
  const userStrict = checkbox ? checkbox.checked : false;
  return {
    preferred_job_roles: preferredRoles,
    strict_filtering: userStrict || strictFiltering,
    location_rules: locationRules,
  };
}

async function loadRealJobs(keyword) {
  const query = (keyword || "").trim() || "estágio desenvolvimento";
  setSummary("Buscando vagas no Sólides...");
  const results = await searchSolides(buildPrefs(), query, { take: 10 });
  jobs = dedupeJobs(results);
  populateCities();
  renderJobs();
}

function populateCities() {
  const cities = [...new Set(jobs.map((job) => job.location))].sort();
  field("citySelect").innerHTML = '<option value="all">Todas as cidades</option>' + cities.map((city) => `<option value="${city}">${city}</option>`).join("");
}

function jobText(job) {
  return `${job.title} ${job.description || ""} ${job.level || ""}`.toLowerCase();
}

function getFilteredJobs() {
  const keyword = field("keywordInput").value.trim().toLowerCase();
  const city = field("citySelect").value;

  const filtered = jobs.filter((job) => {
    const text = jobText(job);
    const matchesKeyword = !keyword || text.includes(keyword);
    const matchesCity = city === "all" || job.location === city;
    return matchesKeyword && matchesCity;
  });

  if (preferredRoles.length === 0) return filtered;

  const checkbox = field('strictFilterCheckbox');
  const userStrict = checkbox && checkbox.checked;
  const effectiveStrict = userStrict || strictFiltering;

  const preferred = filtered.filter((job) => {
    return preferredRoles.some((pr) => jobText(job).includes(pr));
  });

  if (effectiveStrict) {
    return preferred;
  }

  const others = filtered.filter((job) => !preferred.includes(job));
  return [...preferred, ...others];
}

function renderBgStatus(config, status) {
  const el = field("bgStatus");
  if (!el) return;
  if (!status || !status.lastRun) {
    el.textContent = config.enabled
      ? "Ativo - busca a cada " + config.intervalMinutes + " min. Aguardando a primeira verificacao..."
      : "Inativo. Marque a opcao acima para procurar vagas automaticamente.";
    return;
  }
  const time = new Date(status.lastRun).toLocaleString("pt-BR");
  const lines = [
    config.enabled ? "Ativo (a cada " + config.intervalMinutes + " min)" : "Inativo",
    "Ultima verificacao: " + time,
    "Encontradas: " + status.found + " - Novas: " + status.newJobs,
  ];
  if (status.error) lines.push("Erro: " + status.error);
  el.textContent = lines.join("\n");
}

function loadBgAgent() {
  chrome.runtime.sendMessage({ type: "getBgStatus" }, (response) => {
    if (!response || !response.ok) {
      const el = field("bgStatus");
      if (el) el.textContent = "Agente em 2 plano indisponivel.";
      return;
    }
    field("bgEnabledCheckbox").checked = response.config.enabled;
    field("bgIntervalSelect").value = String(response.config.intervalMinutes);
    renderBgStatus(response.config, response.status);
  });
  storage.get(["bgAutoSubmit"], (result) => {
    field("bgAutoSubmitCheckbox").checked = result.bgAutoSubmit === true;
  });
}

function loadBgFoundJobs() {
  storage.get(["bgFoundJobs"], (result) => {
    const section = field("bgFoundList");
    if (!section) return;
    const found = result.bgFoundJobs || [];
    if (found.length === 0) {
      section.innerHTML = "";
      return;
    }
    section.innerHTML = '<h2 style="font-size:14px;margin:8px 0 4px;">Vagas encontradas em 2 plano</h2>' +
      found.map((job) => `
        <article class="job-card">
          <h2>${job.title}</h2>
          <p>${job.company} - ${job.location}</p>
          <div class="actions">
            <button data-action="open" data-url="${job.url}">Abrir vaga</button>
          </div>
        </article>
      `).join("");
  });
}

function renderJobs() {
  const visibleJobs = getFilteredJobs();
  setSummary(`${visibleJobs.length} vaga(s) encontrada(s)`);

  field("jobsList").innerHTML = visibleJobs.map((job) => {
    const isFavorite = favorites.includes(job.id);
    const isPreferred = preferredRoles.length > 0 && preferredRoles.some((pr) => jobText(job).includes(pr));
    return `
      <article class="job-card ${isPreferred ? "preferred" : ""}">
        ${isPreferred ? '<div style="position:absolute;right:12px;top:12px;color:#10b981;font-weight:600">PRIORIDADE</div>' : ''}
        <h2>${job.title}</h2>
        <p>${job.company} • ${job.location}</p>
        <p>${job.description}</p>
        <div class="job-tags">
          ${job.level ? `<span class="job-tag">${job.level}</span>` : ""}
          ${job.source ? `<span class="job-tag">${job.source}</span>` : ""}
        </div>
        <div class="actions">
          <button data-action="favorite" data-id="${job.id}">${isFavorite ? "★ Favorita" : "☆ Salvar"}</button>
          <button data-action="open" data-url="${job.url}">Abrir vaga</button>
        </div>
      </article>
    `;
  }).join("");
}

function saveFavorites() {
  storage.set({ favorites });
}

function fillProfileForm() {
  field("nameInput").value = profile.name || "";
  field("emailInput").value = profile.email || "";
  field("phoneInput").value = profile.phone || "";
  field("cityInput").value = profile.city || "";
  field("stateInput").value = profile.state || "";
  field("linkedinInput").value = profile.linkedin || "";
  field("githubInput").value = profile.github || "";
  field("portfolioInput").value = profile.portfolio || "";
  field("salaryInput").value = profile.desiredSalary || "";
  field("skillsInput").value = profile.skills || "";
  field("languagesInput").value = profile.languages || "";
  field("educationInput").value = profile.education || "";
  field("summaryInput").value = profile.summary || "";
}

function readProfileForm() {
  return {
    name: field("nameInput").value.trim(),
    email: field("emailInput").value.trim(),
    phone: field("phoneInput").value.trim(),
    city: field("cityInput").value.trim(),
    state: field("stateInput").value.trim().toUpperCase(),
    linkedin: field("linkedinInput").value.trim(),
    github: field("githubInput").value.trim(),
    portfolio: field("portfolioInput").value.trim(),
    desiredSalary: field("salaryInput").value.trim(),
    skills: field("skillsInput").value.trim(),
    languages: field("languagesInput").value.trim(),
    education: field("educationInput").value.trim(),
    summary: field("summaryInput").value.trim(),
  };
}

function storeCvFile(file) {
  if (!file) return Promise.resolve();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result).split(",")[1] || "";
      storage.set({ cvFile: { name: file.name, type: file.type || "application/octet-stream", size: file.size, base64 } }, resolve);
    };
    reader.onerror = () => resolve();
    reader.readAsDataURL(file);
  });
}

function storeCvText(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      storage.set({ cvText: String(reader.result || "") }, resolve);
    };
    reader.onerror = () => resolve();
    reader.readAsText(file);
  });
}

function handleCvFile(file) {
  if (!file) return;
  field("cvFileName").textContent = `Currículo: ${file.name}`;
  const isText = /\.(txt|md)$/i.test(file.name);
  if (isText) {
    storeCvText(file);
  }
  storeCvFile(file).then(() => setSummary(`Currículo "${file.name}" pronto para anexar nos formulários.`));
}

function loadFavorites() {
  storage.get(["favorites", "profile", "cvText", "cvFile", "autoSubmit"], (result) => {
    favorites = result.favorites || [];
    profile = { ...EMPTY_PROFILE, ...(result.profile || {}) };
    fillProfileForm();
    if (result.cvFile) {
      field("cvFileName").textContent = `Currículo: ${result.cvFile.name}`;
    }
    if (typeof result.autoSubmit === "boolean") {
      field("autoSubmitCheckbox").checked = result.autoSubmit;
    }
    loadPreferredRoles().then(() => loadSettingsFromStorage()).then(() => loadRealJobs(""));
    loadBgAgent();
    loadBgFoundJobs();
  });
}

field("saveSettingsButton").addEventListener('click', () => {
  const boostInput = field('boostInput');
  const thresholdInput = field('thresholdInput');
  const strictCb = field('strictFilterCheckbox');
  const settings = {
    boost: boostInput && boostInput.value ? Number(boostInput.value) : undefined,
    preferred_threshold: thresholdInput && thresholdInput.value ? Number(thresholdInput.value) : undefined,
    strict_filtering: strictCb ? Boolean(strictCb.checked) : undefined,
  };
  storage.set({ agent_settings: settings }, () => {
    setSummary('Configurações salvas.');
    loadSettingsFromStorage().then(renderJobs);
  });
});

field("resetSettingsButton").addEventListener('click', () => {
  storage.remove(['agent_settings'], () => {
    setSummary('Configurações restauradas para padrão.');
    loadPreferredRoles().then(() => loadSettingsFromStorage()).then(() => loadRealJobs(""));
  });
});
field("searchButton").addEventListener("click", () => loadRealJobs(field("keywordInput").value));

field("saveProfileButton").addEventListener("click", () => {
  profile = readProfileForm();
  storage.set({ profile });
  setSummary("Perfil salvo para o agente de candidatura.");
});

field("bgEnabledCheckbox").addEventListener("change", () => {
  chrome.runtime.sendMessage({
    type: "setBgAgent",
    enabled: field("bgEnabledCheckbox").checked,
    intervalMinutes: Number(field("bgIntervalSelect").value),
  }, (response) => {
    if (response && response.ok) loadBgAgent();
  });
});

field("bgIntervalSelect").addEventListener("change", () => {
  chrome.runtime.sendMessage({
    type: "setBgAgent",
    enabled: field("bgEnabledCheckbox").checked,
    intervalMinutes: Number(field("bgIntervalSelect").value),
  });
});

field("bgRunNowButton").addEventListener("click", () => {
  const button = field("bgRunNowButton");
  button.disabled = true;
  setSummary("Verificando novas vagas...");
  chrome.runtime.sendMessage({ type: "runBgNow" }, (response) => {
    button.disabled = false;
    loadBgAgent();
    loadBgFoundJobs();
    if (response && response.status && response.status.found !== undefined) {
      setSummary(`Verificação concluída: ${response.status.found} vaga(s), ${response.status.newJobs} nova(s).`);
    }
  });
});

field("bgAutoSubmitCheckbox").addEventListener("change", () => {
  storage.set({ bgAutoSubmit: field("bgAutoSubmitCheckbox").checked });
  setSummary(field("bgAutoSubmitCheckbox").checked
    ? "Auto-candidatura ativada: o agente enviará currículos sozinho nas vagas do Sólides."
    : "Auto-candidatura desativada.");
});

field("fillCurrentTabButton").addEventListener("click", () => {
  profile = readProfileForm();
  storage.set({ profile }, () => {
    chrome.runtime.sendMessage({ type: "fillForm", job: {}, submit: field("autoSubmitCheckbox").checked }, (response) => {
      if (response && response.message) {
        setSummary(response.message);
      }
    });
  });
});

field("autoSubmitCheckbox").addEventListener("change", (event) => {
  storage.set({ autoSubmit: event.target.checked });
});

field("cvFileInput").addEventListener("change", (event) => {
  handleCvFile(event.target.files && event.target.files[0]);
});

field("agentButton").addEventListener("click", () => {
  const queue = getFilteredJobs();
  if (queue.length === 0) {
    setSummary("Nenhuma vaga para o agente processar.");
    return;
  }

  profile = readProfileForm();
  storage.set({ profile }, () => {
    storage.get(["cvText"], (result) => {
      setSummary(`Agente IA ativado para ${queue.length} vaga(s).`);
      chrome.runtime.sendMessage({
        type: "launchAgent",
        jobs: queue,
        profile,
        cvText: result.cvText || "",
        autoSubmit: field("autoSubmitCheckbox").checked,
      });
    });
  });
});

field("keywordInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loadRealJobs(field("keywordInput").value);
  }
});

field("jobsList").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const action = button.dataset.action;
  const id = button.dataset.id;
  const url = button.dataset.url;

  if (action === "favorite") {
    favorites = favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id];
    saveFavorites();
    renderJobs();
  }

  if (action === "open") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
});

field("bgFoundList").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action='open']");
  if (button && button.dataset.url) {
    window.open(button.dataset.url, "_blank", "noopener,noreferrer");
  }
});

field("strictFilterCheckbox").addEventListener("change", renderJobs);
field("citySelect").addEventListener("change", renderJobs);
loadFavorites();
