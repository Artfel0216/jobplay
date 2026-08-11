const jobs = [
  {
    id: "ext-frontend",
    title: "Desenvolvedor Frontend Júnior",
    company: "Nexxus Labs",
    location: "Remoto",
    level: "Júnior",
    source: "LinkedIn",
    url: "https://www.linkedin.com/jobs/",
    description: "Projeto web com React, TypeScript e APIs REST.",
    tags: ["React", "TypeScript", "Frontend"],
  },
  {
    id: "ext-estagio",
    title: "Estágio em Desenvolvimento de Software",
    company: "BlueStone Tech",
    location: "São Paulo",
    level: "Estágio",
    source: "Indeed",
    url: "https://br.indeed.com/jobs",
    description: "Apoio em desenvolvimento web, testes e suporte interno.",
    tags: ["JavaScript", "HTML", "CSS"],
  },
  {
    id: "ext-backend",
    title: "Software Developer Júnior",
    company: "Cobalt Systems",
    location: "Belo Horizonte",
    level: "Júnior",
    source: "Glassdoor",
    url: "https://www.glassdoor.com/Job/jobs.htm",
    description: "Desenvolvimento de APIs com Node.js e SQL.",
    tags: ["Node.js", "SQL", "Backend"],
  },
  {
    id: "ext-java",
    title: "Programador Júnior Java",
    company: "Delta Core",
    location: "Campinas",
    level: "Júnior",
    source: "Indeed",
    url: "https://br.indeed.com/jobs",
    description: "Manutenção e implementação de serviços com Java e Spring.",
    tags: ["Java", "Spring", "Backend"],
  },
];

const storage = typeof browser !== "undefined" && browser.storage ? browser.storage.local : chrome.storage.local;

let preferredRoles = [];
let strictFiltering = false;

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

function populateCities() {
  const cities = [...new Set(jobs.map((job) => job.location))].sort();
  field("citySelect").innerHTML = '<option value="all">Todas as cidades</option>' + cities.map((city) => `<option value="${city}">${city}</option>`).join("");
}

function getFilteredJobs() {
  const keyword = field("keywordInput").value.trim().toLowerCase();
  const city = field("citySelect").value;

  const filtered = jobs.filter((job) => {
    const text = `${job.title} ${job.description} ${job.tags.join(" ")} ${job.level || ""}`.toLowerCase();
    const matchesKeyword = !keyword || text.includes(keyword);
    const matchesCity = city === "all" || job.location === city;
    return matchesKeyword && matchesCity;
  });

  if (preferredRoles.length === 0) return filtered;

  const checkbox = field('strictFilterCheckbox');
  const userStrict = checkbox && checkbox.checked;
  const effectiveStrict = userStrict || strictFiltering;

  const preferred = filtered.filter((job) => {
    const text = `${job.title} ${job.description} ${job.tags.join(" ")} ${job.level || ""}`.toLowerCase();
    return preferredRoles.some((pr) => text.includes(pr));
  });

  if (effectiveStrict) {
    return preferred;
  }

  const others = filtered.filter((job) => !preferred.includes(job));
  return [...preferred, ...others];
}

function renderJobs() {
  const visibleJobs = getFilteredJobs();
  setSummary(`${visibleJobs.length} vagas encontradas`);

  field("jobsList").innerHTML = visibleJobs.map((job) => {
    const isFavorite = favorites.includes(job.id);
    const text = `${job.title} ${job.description} ${job.tags.join(" ")} ${job.level || ""}`.toLowerCase();
    const isPreferred = preferredRoles.length > 0 && preferredRoles.some((pr) => text.includes(pr));
    return `
      <article class="job-card ${isPreferred ? "preferred" : ""}">
        ${isPreferred ? '<div style="position:absolute;right:12px;top:12px;color:#10b981;font-weight:600">PRIORIDADE</div>' : ''}
        <h2>${job.title}</h2>
        <p>${job.company} • ${job.location}</p>
        <p>${job.description}</p>
        <div class="job-tags">
          ${job.tags.map((tag) => `<span class="job-tag">${tag}</span>`).join("")}
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
    loadPreferredRoles().then(() => loadSettingsFromStorage()).then(renderJobs);
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
    loadPreferredRoles().then(() => loadSettingsFromStorage()).then(renderJobs);
  });
});

field("searchButton").addEventListener("click", renderJobs);
field("saveProfileButton").addEventListener("click", () => {
  profile = readProfileForm();
  storage.set({ profile });
  setSummary("Perfil salvo para o agente de candidatura.");
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
    renderJobs();
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

field("citySelect").addEventListener("change", renderJobs);
populateCities();
loadFavorites();
renderJobs();
