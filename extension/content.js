const storage = typeof browser !== "undefined" && browser.storage ? browser.storage.local : chrome.storage.local;

function getStored(key, fallback) {
  return new Promise((resolve) => {
    try {
      storage.get([key], (result) => resolve(result && key in result ? result[key] : fallback));
    } catch {
      resolve(fallback);
    }
  });
}

function highlight(target, color) {
  if (!target || !target.style) return;
  const previous = target.style.outline;
  target.style.outline = `2px solid ${color}`;
  setTimeout(() => {
    target.style.outline = previous;
  }, 3500);
}

function buildReportMessage(report) {
  const labels = {
    name: "Nome",
    firstName: "Primeiro nome",
    lastName: "Sobrenome",
    email: "E-mail",
    phone: "Telefone",
    city: "Cidade",
    state: "Estado",
    country: "País",
    linkedin: "LinkedIn",
    github: "GitHub",
    portfolio: "Portfólio/site",
    education: "Formação",
    yearsOfExperience: "Experiência",
    skills: "Habilidades",
    languages: "Idiomas",
    summary: "Resumo/apresentação",
    desiredSalary: "Pretensão salarial",
  };
  const parts = Object.entries(report.filled || {})
    .map(([key]) => labels[key] || key)
    .filter(Boolean);
  if (report.consents > 0) parts.push("Consentimentos");
  if (report.resumeAttached) parts.push("Currículo anexado");
  return parts.length ? `Preenchidos: ${parts.join(", ")}.` : "Nenhum campo reconhecido neste formulário.";
}

async function runAutofill(job, options) {
  const profile = await getStored("profile", {});
  const cvText = job && job.cvText ? job.cvText : await getStored("cvText", "");
  const cvFile = await getStored("cvFile", null);
  const autoSubmit = await getStored("autoSubmit", false);

  const built = window.FormAutofill.buildProfile(profile, cvText);
  const report = window.FormAutofill.fillDocument(document, built, {
    submit: options && options.submit !== undefined ? options.submit : autoSubmit,
    resumeFile: cvFile,
  });

  const colored = document.querySelectorAll("input:not([type=file]), textarea, select");
  colored.forEach((el) => {
    if (String(el.value || "").trim()) highlight(el, "#10b981");
  });

  return {
    filled: report,
    message: buildReportMessage(report),
    jobTitle: job && job.jobTitle,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "autofill" || message.type === "fillForm") {
    runAutofill(message.job || message, { submit: message.submit }).then((result) => {
      sendResponse({ ok: true, ...result });
    });
    return true;
  }
});
