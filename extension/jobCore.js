export const SOLIDES_BASE = "https://apigw.solides.com.br/jobs/v3/portal-vacancies-new";

export const TECH_KEYWORDS = [
  "desenvolvedor", "desenvolvimento", "programador", "software", "frontend", "backend",
  "fullstack", "full stack", "react", "node", "javascript", "typescript", "java",
  "python", "sql", "dados", "qa", "devops", "sistemas", "web", "api", "engenharia",
  "tecnologia", "ti", "suporte", "infra", "analista de sistemas",
];

export function normalizeText(text) {
  return String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function formatSolidesLocation(vacancy) {
  if (vacancy.jobType === "remoto" || vacancy.homeOffice) {
    return "Remoto";
  }
  const city = vacancy.city && vacancy.city.name ? vacancy.city.name : "";
  const state = vacancy.state && vacancy.state.code ? vacancy.state.code : "";
  return [city, state].filter(Boolean).join(" - ") || "Brasil";
}

export function mapSolidesVacancy(vacancy) {
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
    level: seniority,
  };
}

export function isRemote(vacancy) {
  return vacancy.jobType === "remoto" || vacancy.homeOffice;
}

export function matchesLocationRules(vacancy, prefs) {
  const rules = (prefs && prefs.location_rules) || {};
  if (!rules.outside_home_state_only_remote) {
    return true;
  }
  const stateCode = vacancy.state && vacancy.state.code ? vacancy.state.code.toUpperCase() : "";
  const inHomeState = stateCode === (rules.home_state || "").toUpperCase();
  return inHomeState || isRemote(vacancy);
}

export function stemMatches(text, role) {
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

export function isPreferred(job, prefs) {
  const preferredRoles = (prefs && prefs.preferred_job_roles) || [];
  if (preferredRoles.length === 0) {
    return true;
  }
  const text = normalizeText(`${job.title} ${job.location} ${job.description}`);
  return preferredRoles.some((role) => stemMatches(text, role));
}

export function isTechJob(job) {
  const text = normalizeText(`${job.title} ${job.description} ${job.level || ""}`);
  return TECH_KEYWORDS.some((keyword) => {
    const normalized = normalizeText(keyword);
    if (normalized.includes(" ")) {
      return text.includes(normalized);
    }
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(text);
  });
}

export async function searchSolides(prefs, query, options = {}) {
  const take = Math.min(10, Math.max(1, options.take || 10));
  try {
    const params = new URLSearchParams({ title: query, take: String(take), page: String(options.page || 1) });
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
    return mapped;
  } catch {
    return [];
  }
}

export function jobKey(job) {
  return [job.title, job.company, job.location, job.url].join("|").toLowerCase();
}

export function dedupeJobs(jobs) {
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
