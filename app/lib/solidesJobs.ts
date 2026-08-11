import { getAgentPreferences } from "./agentPreferences";
import { normalizeText } from "./skills";

export interface SolidesVacancy {
  id: number;
  title: string;
  description: string;
  companyName: string;
  state: { name: string; code: string } | null;
  city: { name: string } | null;
  slug: string;
  redirectLink: string;
  jobType: string;
  homeOffice: boolean;
  salary: { type: string; initialRange: number; finalRange: number; negotiable: boolean } | null;
  seniority: Array<{ name: string }>;
  createdAt: string;
  hardSkills: Array<{ name: string }>;
  occupationAreas: Array<{ name: string }>;
}

export interface SolidesSearchResult {
  title: string;
  company: string;
  location: string;
  source: string;
  url: string;
  description: string;
  postedAt: string;
}

const API_BASE = "https://apigw.solides.com.br/jobs/v3/portal-vacancies-new";
const MAX_TAKE = 10;

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function formatLocation(vacancy: SolidesVacancy): string {
  if (vacancy.jobType === "remoto" || vacancy.homeOffice) {
    return "Remoto";
  }
  const city = vacancy.city?.name ?? "";
  const state = vacancy.state?.code ?? "";
  return [city, state].filter(Boolean).join(" - ") || "Brasil";
}

export function mapSolidesVacancy(vacancy: SolidesVacancy): SolidesSearchResult {
  const salary = vacancy.salary?.finalRange
    ? `\nSalário: R$ ${vacancy.salary.finalRange.toLocaleString("pt-BR")}`
    : "";
  const seniority = vacancy.seniority?.map((item) => item.name).join(", ");
  const modality = vacancy.jobType === "presencial" ? "Presencial" : vacancy.jobType === "hibrido" ? "Híbrido" : vacancy.jobType === "remoto" ? "Remoto" : "";
  const tags = [modality, seniority].filter(Boolean).join(" · ");

  return {
    title: vacancy.title.trim(),
    company: vacancy.companyName,
    location: formatLocation(vacancy),
    source: "Sólides",
    url: vacancy.redirectLink,
    description: [stripHtml(vacancy.description), tags, salary].filter(Boolean).join("\n"),
    postedAt: vacancy.createdAt,
  };
}

function stemMatches(text: string, role: string): boolean {
  const strippedRole = normalizeText(role).replace(/[()]/g, "");
  if (strippedRole.length === 0) {
    return false;
  }
  if (text.includes(strippedRole)) {
    return true;
  }
  const stem = strippedRole.slice(0, Math.min(6, strippedRole.length));
  return text.split(/[^a-z0-9]+/).some((word) => word.startsWith(stem));
}

export function isRemote(vacancy: SolidesVacancy): boolean {
  return vacancy.jobType === "remoto" || vacancy.homeOffice;
}

export function matchesLocationRules(vacancy: SolidesVacancy): boolean {
  const prefs = getAgentPreferences();
  const rules = prefs.location_rules;
  if (!rules.outside_home_state_only_remote) {
    return true;
  }
  const stateCode = vacancy.state?.code?.toUpperCase() ?? "";
  const inHomeState = stateCode === rules.home_state.toUpperCase();
  return inHomeState || isRemote(vacancy);
}

function isPreferred(result: SolidesSearchResult): boolean {
  const prefs = getAgentPreferences();
  const preferredRoles = prefs.preferred_job_roles || [];
  if (preferredRoles.length === 0) {
    return true;
  }
  const text = normalizeText(`${result.title} ${result.location} ${result.description}`);
  return preferredRoles.some((role) => stemMatches(text, role));
}

export async function searchSolidesJobs(query: string, options: { take?: number; page?: number } = {}): Promise<SolidesSearchResult[]> {
  const take = Math.min(MAX_TAKE, Math.max(1, options.take ?? MAX_TAKE));
  const page = options.page ?? 1;

  try {
    const params = new URLSearchParams({ title: query, take: String(take), page: String(page) });
    const response = await fetch(`${API_BASE}?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error("Unable to fetch Sólides vacancies");
    }

    const payload = (await response.json()) as { success: boolean; data?: { data?: SolidesVacancy[] } };
    const vacancies = (payload.data?.data ?? []).filter(matchesLocationRules);
    const mapped = vacancies.map(mapSolidesVacancy);

    const prefs = getAgentPreferences();
    const preferred = mapped.filter(isPreferred);
    if (prefs.strict_filtering) {
      return preferred;
    }
    const others = mapped.filter((result) => !preferred.includes(result));
    return [...preferred, ...others];
  } catch {
    return [];
  }
}
