const storage = typeof browser !== "undefined" && browser.storage ? browser.storage.local : chrome.storage.local;

const SOLIDES_BASE = "https://apigw.solides.com.br/jobs/v3/portal-vacancies-new";
const JINA_SEARCH = "https://r.jina.ai/http://www.google.com/search";
const BG_AGENT_ALARM = "bg-agent-check";
const DEFAULT_INTERVAL_MINUTES = 30;

const TECH_KEYWORDS = [
  "desenvolvedor", "programador", "software", "frontend", "backend", "fullstack",
  "full stack", "react", "node", "javascript", "typescript", "java", "python",
  "sql", "dados", "qa", "devops", "sistemas", "web", "api", "engenharia",
  "tecnologia", "ti", "suporte", "infra", "estágio", "estagio", "júnior", "junior",
  "trainee", "aprendiz",
];

function normalizeText(text) {
  return String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function getAgentPreferences() {
  const stored = await getStored("agent_settings", null);
  if (stored) {
    return {
      preferred_job_roles: Array.isArray(stored.preferred_job_roles) ? stored.preferred_job_roles.map((p) => p.toLowerCase()) : [],
      boost: typeof stored.boost === "number" ? stored.boost : 0,
      preferred_threshold: typeof stored.preferred_threshold === "number" ? stored.preferred_threshold : 0,
      strict_filtering: typeof stored.strict_filtering === "boolean" ? stored.strict_filtering : false,
      location_rules: {
        home_state: typeof stored.home_state === "string" ? stored.home_state.toUpperCase() : "PE",
        outside_home_state_only_remote: typeof stored.outside_home_state_only_remote === "boolean" ? stored.outside_home_state_only_remote : true,
      },
    };
  }

  try {
    const url = chrome.runtime.getURL('agent_preferences.json');
    const res = await fetch(url);
    if (!res.ok) return buildDefaultPreferences();
    const data = await res.json();
    return {
      preferred_job_roles: Array.isArray(data?.preferred_job_roles) ? data.preferred_job_roles.map((p) => p.toLowerCase()) : [],
      boost: typeof data?.boost === "number" ? data.boost : 0,
      preferred_threshold: typeof data?.preferred_threshold === "number" ? data.preferred_threshold : 0,
      strict_filtering: typeof data?.strict_filtering === "boolean" ? data.strict_filtering : false,
      location_rules: {
        home_state: typeof data?.location_rules?.home_state === "string" ? data.location_rules.home_state.toUpperCase() : "PE",
        outside_home_state_only_remote: typeof data?.location_rules?.outside_home_state_only_remote === "boolean" ? data.location_rules.outside_home_state_only_remote : true,
      },
    };
  } catch {
    return buildDefaultPreferences();
  }
}

function buildDefaultPreferences() {
  return {
    preferred_job_roles: [],
    boost: 0,
    preferred_threshold: 0,
    strict_filtering: false,
    location_rules: { home_state: "PE", outside_home_state_only_remote: true },
  };
}

function getStored(key, fallback) {
  return new Promise((resolve) => {
    try {
      storage.get([key], (result) => resolve(result && key in result ? result[key] : fallback));
    } catch {
      resolve(fallback);
    }
  });
}

function notify(title, message) {
  if (typeof chrome !== "undefined" && chrome.notifications) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon.png",
      title,
      message,
    });
  }
}

async function syncFavorites() {
  const favorites = await getStored("favorites", []);
  if (favorites.length > 0) {
    notify("Vagas favoritas", `${favorites.length} vaga(s) salva(s) na sua lista.`);
  }
}

async function registerApplication(job) {
  const key = [job.title, job.company, job.location || "", job.url || ""].join("|").toLowerCase();
  const appliedJobKeys = await getStored("appliedJobKeys", []);

  if (appliedJobKeys.includes(key)) {
    return false;
  }

  await storage.set({ appliedJobKeys: [...appliedJobKeys, key] });
  return true;
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function formatSolidesLocation(vacancy) {
  if (vacancy.jobType === "remoto" || vacancy.homeOffice) {
    return "Remoto";
  }
  const city = vacancy.city && vacancy.city.name ? vacancy.city.name : "";
  const state = vacancy.state && vacancy.state.code ? vacancy.state.code : "";
  return [city, state].filter(Boolean).join(" - ") || "Brasil";
}

function mapSolidesVacancy(vacancy) {
  const salary = vacancy.salary && vacancy.salary.finalRange
    ? `\nSalário: R$ ${vacancy.salary.finalRange.toLocaleString("pt-BR")}`
    : "";
  const seniority = Array.isArray(vacancy.seniority) ? vacancy.seniority.map((item) => item.name).join(", ") : "";
  const modality = vacancy.jobType === "presencial" ? "Presencial" : vacancy.jobType === "hibrido" ? "Híbrido" : vacancy.jobType === "remoto" ? "Remoto" : "";
  const tags = [modality, seniority].filter(Boolean).join(" · ");

  return {
    id: String(vacancy.id),
    title: (vacancy.title || "").trim(),
    company: vacancy.companyName || "",
    location: formatSolidesLocation(vacancy),
    source: "Sólides",
    url: vacancy.redirectLink || "",
    description: [stripHtml(vacancy.description), tags, salary].filter(Boolean).join("\n"),
    postedAt: vacancy.createdAt || "",
    level: Array.isArray(vacancy.seniority) ? vacancy.seniority.map((s) => s.name).join(", ") : "",
  };
}

function isRemote(vacancy) {
  return vacancy.jobType === "remoto" || vacancy.homeOffice;
}

function matchesLocationRules(vacancy, prefs) {
  const rules = prefs.location_rules || {};
  if (!rules.outside_home_state_only_remote) {
    return true;
  }
  const stateCode = vacancy.state && vacancy.state.code ? vacancy.state.code.toUpperCase() : "";
  const inHomeState = stateCode === (rules.home_state || "").toUpperCase();
  return inHomeState || isRemote(vacancy);
}

function stemMatches(text, role) {
  const strippedRole = normalizeText(role).replace(/[()]/g, "");
  if (strippedRole.length === 0) {
    return false;
  }
  if (text.includes(strippedRole)) {
    return true;
  }
  const stem = strippedRole.slice(0, Math.min(6, strippedRole.length));
  return String(text).split(/[^a-z0-9]+/).some((word) => word.startsWith(stem));
}

function isPreferred(job, prefs) {
  const preferredRoles = prefs.preferred_job_roles || [];
  if (preferredRoles.length === 0) {
    return true;
  }
  const text = normalizeText(`${job.title} ${job.location} ${job.description}`);
  return preferredRoles.some((role) => stemMatches(text, role));
}

function isTechJob(job) {
  const text = normalizeText(`${job.title} ${job.description} ${job.level || ""}`);
  return TECH_KEYWORDS.some((keyword) => text.includes(keyword));
}

async function searchSolides(prefs, query) {
  try {
    const params = new URLSearchParams({ title: query, take: "10", page: "1" });
    const response = await fetch(`${SOLIDES_BASE}?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return [];
    }
    const payload = await response.json();
    const vacancies = (payload && payload.data && payload.data.data) || [];
    const mapped = vacancies
      .filter((vacancy) => matchesLocationRules(vacancy, prefs))
      .map(mapSolidesVacancy)
      .filter((job) => isTechJob(job) && isPreferred(job, prefs));
    return prefs.strict_filtering ? mapped : mapped;
  } catch {
    return [];
  }
}

async function searchGoogle(prefs, query) {
  const searchQuery = encodeURIComponent(query);
  try {
    const response = await fetch(`${JINA_SEARCH}?q=${searchQuery}`, {
      headers: { Accept: "text/plain" },
    });
    if (!response.ok) {
      return [];
    }
    const text = await response.text();
    const lines = text
      .split(/\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 10);

    const mapped = lines
      .filter((line) => /https?:\/\//i.test(line))
      .map((line, index) => ({
        id: `google-${index}`,
        title: `Vaga ${index + 1}`,
        company: "Google Search",
        location: "Brasil",
        source: "Google Search",
        url: line,
        description: `Resultado encontrado para: ${query}`,
        level: "",
        postedAt: "",
      }))
      .filter((job) => isPreferred(job, prefs) && isTechJob(job));

    return mapped;
  } catch {
    return [];
  }
}

function jobKey(job) {
  return [job.title, job.company, job.location, job.url].join("|").toLowerCase();
}

function dedupeJobs(jobs) {
  const seen = new Set();
  const result = [];
  for (const job of jobs) {
    const key = jobKey(job);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(job);
  }
  return result;
}

async function getBgAgentConfig() {
  const stored = await getStored("bgAgentConfig", {});
  return {
    enabled: stored.enabled === true,
    intervalMinutes: typeof stored.intervalMinutes === "number" && stored.intervalMinutes >= 5
      ? stored.intervalMinutes
      : DEFAULT_INTERVAL_MINUTES,
  };
}

async function setBgAgentConfig(config) {
  const current = await getBgAgentConfig();
  const next = {
    enabled: config.enabled === true ? true : current.enabled,
    intervalMinutes: typeof config.intervalMinutes === "number" && config.intervalMinutes >= 5
      ? config.intervalMinutes
      : current.intervalMinutes,
  };
  await storage.set({ bgAgentConfig: next });
  scheduleBgAgent();
  return next;
}

function scheduleBgAgent() {
  chrome.alarms.clear(BG_AGENT_ALARM);
  getBgAgentConfig().then((config) => {
    if (config.enabled) {
      chrome.alarms.create(BG_AGENT_ALARM, {
        delayInMinutes: 1,
        periodInMinutes: config.intervalMinutes,
      });
    }
  });
}

async function persistBgStatus(status) {
  const previous = await getStored("bgLastStatus", null);
  await storage.set({ bgLastStatus: { ...previous, ...status } });
}

function openAndApply(job, cvText, autoSubmit) {
  chrome.tabs.create({ url: job.url }, (tab) => {
    if (chrome.runtime.lastError || !tab || tab.id === undefined) {
      return;
    }
    setTimeout(() => {
      chrome.tabs.sendMessage(tab.id, {
        type: "autofill",
        job: { jobTitle: job.title, cvText },
        submit: autoSubmit,
      }, (response) => {
        if (chrome.runtime.lastError) {
          return;
        }
        if (response && response.message) {
          notify(`Candidatura: ${job.title}`, response.message);
        }
      });
    }, 1500);
  });
}

async function autoApplyToJobs(jobs, cvText) {
  const pending = [];
  for (const job of jobs) {
    if (await registerApplication(job)) {
      pending.push(job);
    }
  }
  pending.forEach((job, index) => {
    setTimeout(() => openAndApply(job, cvText, true), index * 3000);
  });
  return pending.length;
}

async function runBackgroundAgent() {
  const config = await getBgAgentConfig();
  if (!config.enabled) {
    return { skipped: true };
  }

  const prefs = await getAgentPreferences();
  const queries = prefs.preferred_job_roles.length > 0
    ? ["estágio desenvolvimento", "desenvolvedor júnior", "programador júnior"]
    : ["estágio desenvolvimento", "desenvolvedor júnior"];

  let found = [];
  for (const query of queries) {
    const [solides, google] = await Promise.all([
      searchSolides(prefs, query),
      searchGoogle(prefs, query),
    ]);
    found = found.concat(solides, google);
  }
  found = dedupeJobs(found);

  const seenKeys = await getStored("seenJobKeys", []);
  const newJobs = [];
  const nowKeys = [];

  for (const job of found) {
    const key = jobKey(job);
    nowKeys.push(key);
    if (!seenKeys.includes(key)) {
      newJobs.push(job);
    }
  }

  const updatedSeen = Array.from(new Set(seenKeys.concat(nowKeys))).slice(-500);
  await storage.set({ seenJobKeys: updatedSeen });
  await storage.set({ bgFoundJobs: found.slice(0, 50) });

  const toNotify = newJobs.slice(0, 5);
  toNotify.forEach((job, index) => {
    setTimeout(() => {
      const notificationId = `bg-job-${index}`;
      chrome.notifications.create(notificationId, {
        type: "basic",
        iconUrl: "icon.png",
        title: `Vaga encontrada: ${job.title}`,
        message: `${job.company} • ${job.location}`,
        isClickable: true,
      });
      storage.set({ [`notif:${notificationId}`]: job.url });
    }, index * 600);
  });

  const status = {
    lastRun: new Date().toISOString(),
    found: found.length,
    newJobs: newJobs.length,
    error: null,
  };
  await persistBgStatus(status);

  if (newJobs.length > 0) {
    notify("Agente em 2º plano", `${newJobs.length} nova(s) vaga(s) encontrada(s) para revisar.`);
  }

  const bgAutoSubmit = await getStored("bgAutoSubmit", false);
  if (bgAutoSubmit) {
    const profile = await getStored("profile", null);
    const cvText = await getStored("cvText", "");
    const applyable = newJobs.filter((job) => job.source === "Sólides" && job.url);
    if (!profile || !cvText) {
      notify("Agente em 2º plano", "Para candidatar automaticamente, salve seu perfil e anexe o currículo no popup.");
    } else if (applyable.length > 0) {
      const appliedCount = await autoApplyToJobs(applyable, cvText);
      if (appliedCount > 0) {
        notify("Agente em 2º plano", `Candidatando automaticamente a ${appliedCount} vaga(s) do Sólides.`);
      }
    }
  }

  return status;
}

chrome.notifications.onClicked.addListener((notificationId) => {
  storage.get([`notif:${notificationId}`], (result) => {
    const url = result && result[`notif:${notificationId}`];
    if (url) {
      chrome.tabs.create({ url });
    }
  });
});

chrome.runtime.onInstalled.addListener(() => {
  notify("Junior Tech Jobs ativada", "A extensão está pronta para ajudar nas suas candidaturas.");
  scheduleBgAgent();
});

chrome.runtime.onStartup.addListener(() => {
  scheduleBgAgent();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === BG_AGENT_ALARM) {
    runBackgroundAgent();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "syncFavorites") {
    syncFavorites();
    sendResponse({ ok: true });
  }

  if (message.type === "fillForm") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || tab.id === undefined) {
        sendResponse({ ok: false, message: "Nenhuma aba ativa encontrada." });
        return;
      }
      chrome.tabs.sendMessage(tab.id, { type: "fillForm", job: message.job || {}, submit: message.submit === true }, (response) => {
        if (chrome.runtime.lastError) {
          notify("Formulário de candidatura", "Recarregue a página da vaga antes de preencher.");
          sendResponse({ ok: false, message: chrome.runtime.lastError.message });
          return;
        }
        if (response && response.message) {
          notify("Formulário de candidatura", response.message);
        }
        sendResponse({ ok: true, ...response });
      });
    });
    return true;
  }

  if (message.type === "setBgAgent") {
    setBgAgentConfig(message).then((config) => {
      sendResponse({ ok: true, config });
    });
    return true;
  }

  if (message.type === "getBgStatus") {
    Promise.all([getBgAgentConfig(), getStored("bgLastStatus", null)]).then(([config, status]) => {
      sendResponse({ ok: true, config, status });
    });
    return true;
  }

  if (message.type === "runBgNow") {
    runBackgroundAgent().then((status) => {
      sendResponse({ ok: true, status });
    });
    return true;
  }

  if (message.type === "launchAgent") {
    (async () => {
      const jobs = message.jobs || [];
      const cvText = message.cvText || "";
      const autoSubmit = message.autoSubmit === true;

      const prefs = await getAgentPreferences();
      const preferredRoles = prefs.preferred_job_roles || [];
      const strictFiltering = prefs.strict_filtering || false;

      let ordered = jobs;
      if (preferredRoles.length > 0) {
        ordered = [...jobs].sort((a, b) => {
          const aText = `${a.title} ${a.description || ""} ${a.level || ""}`.toLowerCase();
          const bText = `${b.title} ${b.description || ""} ${b.level || ""}`.toLowerCase();
          const aPref = preferredRoles.some((pr) => aText.includes(pr));
          const bPref = preferredRoles.some((pr) => bText.includes(pr));
          if (aPref === bPref) return 0;
          return aPref ? -1 : 1;
        });
      }

      if (strictFiltering && preferredRoles.length > 0) {
        ordered = ordered.filter((job) => {
          const text = `${job.title} ${job.description || ""} ${job.level || ""}`.toLowerCase();
          return preferredRoles.some((pr) => text.includes(pr));
        });
      }

      const pending = [];
      for (const job of ordered) {
        if (await registerApplication(job)) {
          pending.push(job);
        }
      }

      pending.forEach((job, index) => {
        chrome.tabs.create({ url: job.url }, (tab) => {
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, { type: "autofill", job: { jobTitle: job.title, cvText }, submit: autoSubmit }, (response) => {
              if (chrome.runtime.lastError) {
                return;
              }
              if (response && response.message) {
                notify(`Candidatura: ${job.title}`, response.message);
              }
            });
          }, 1200 + index * 800);
        });
      });

      notify("Agente IA ativado", `${pending.length} vaga(s) foram abertas para candidatura automatizada.`);
      sendResponse({ ok: true });
    })();
    return true;
  }
});
