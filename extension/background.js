const storage = typeof browser !== "undefined" && browser.storage ? browser.storage.local : chrome.storage.local;

async function getAgentPreferences() {
  // Prefer overrides saved in chrome.storage.local (agent_settings)
  try {
    const stored = await new Promise((resolve) => storage.get(['agent_settings'], (res) => resolve(res.agent_settings || null)));
    if (stored) {
      return {
        preferred_job_roles: Array.isArray(stored.preferred_job_roles) ? stored.preferred_job_roles.map((p) => p.toLowerCase()) : [],
        strict_filtering: typeof stored.strict_filtering === 'boolean' ? stored.strict_filtering : false,
      };
    }
  } catch {
    // ignore and fall back to file
  }

  try {
    const url = chrome.runtime.getURL('agent_preferences.json');
    const res = await fetch(url);
    if (!res.ok) return { preferred_job_roles: [], strict_filtering: false };
    const data = await res.json();
    return {
      preferred_job_roles: Array.isArray(data?.preferred_job_roles) ? data.preferred_job_roles.map((p) => p.toLowerCase()) : [],
      strict_filtering: typeof data?.strict_filtering === 'boolean' ? data.strict_filtering : false,
    };
  } catch {
    return { preferred_job_roles: [], strict_filtering: false };
  }
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

chrome.runtime.onInstalled.addListener(() => {
  notify("Junior Tech Jobs ativada", "A extensão está pronta para ajudar nas suas candidaturas.");
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
