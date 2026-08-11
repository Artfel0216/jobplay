import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  dedupeJobs,
  isPreferred,
  isTechJob,
  jobKey,
  mapSolidesVacancy,
  matchesLocationRules,
  normalizeText,
  searchSolides,
} from '../extension/jobCore.js';

const prefs = {
  preferred_job_roles: ['estágio', 'júnior'],
  strict_filtering: false,
  location_rules: { home_state: 'PE', outside_home_state_only_remote: true },
};

const fakeVacancy = {
  id: 899836,
  title: "ESTAGIÁRIO(A) DESENVOLVIMENTO",
  description: "<p>Buscamos estagiário de <strong>React</strong> e Node.js.</p>",
  companyName: "ARENA IPANEMA HOTEL LTDA",
  state: { name: "Pernambuco", code: "PE" },
  city: { name: "Recife" },
  slug: "talentosarena",
  redirectLink: "https://talentosarena.solides.jobs/vacancies/899836?origem=portal",
  jobType: "presencial",
  homeOffice: false,
  salary: { type: "simple", initialRange: 0, finalRange: 1159.8, negotiable: false },
  seniority: [{ name: "Estagiário" }],
  createdAt: "2026-08-10",
  hardSkills: [{ name: "React" }],
  occupationAreas: [{ name: "Turismo" }],
};

function mockResponse(payload: unknown): void {
  globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => payload }) as Response);
}

describe('jobCore mapping and helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes accents', () => {
    expect(normalizeText("ESTÁGIO JÚNIOR")).toBe("estagio junior");
  });

  it('maps vacancy to a search result with real redirect link', () => {
    const result = mapSolidesVacancy(fakeVacancy);
    expect(result.title).toContain("DESENVOLVIMENTO");
    expect(result.company).toBe("ARENA IPANEMA HOTEL LTDA");
    expect(result.url).toBe("https://talentosarena.solides.jobs/vacancies/899836?origem=portal");
    expect(result.source).toBe("Sólides");
    expect(result.location).toBe("Recife - PE");
    expect(result.description).toContain("Salário: R$ 1.159,8");
    expect(result.description).not.toContain("<p>");
    expect(result.id).toBe("899836");
  });

  it('formats remote vacancies as Remoto', () => {
    const remote = { ...fakeVacancy, jobType: "remoto", homeOffice: true };
    expect(mapSolidesVacancy(remote).location).toBe("Remoto");
  });

  it('accepts any modality inside home state (PE)', () => {
    expect(matchesLocationRules({ ...fakeVacancy, jobType: "presencial" }, prefs)).toBe(true);
    expect(matchesLocationRules({ ...fakeVacancy, jobType: "hibrido" }, prefs)).toBe(true);
    expect(matchesLocationRules({ ...fakeVacancy, jobType: "remoto", homeOffice: true }, prefs)).toBe(true);
  });

  it('rejects non-remote vacancies outside home state', () => {
    const outside = { ...fakeVacancy, state: { name: "Rio de Janeiro", code: "RJ" } };
    expect(matchesLocationRules({ ...outside, jobType: "presencial" }, prefs)).toBe(false);
    expect(matchesLocationRules({ ...outside, jobType: "hibrido" }, prefs)).toBe(false);
    expect(matchesLocationRules({ ...outside, jobType: "remoto", homeOffice: true }, prefs)).toBe(true);
  });

  it('detects preferred and tech jobs', () => {
    const job = mapSolidesVacancy(fakeVacancy);
    expect(isPreferred(job, prefs)).toBe(true);
    expect(isTechJob(job)).toBe(true);
    expect(isPreferred({ ...job, title: "AUXILIAR ADMINISTRATIVO", description: "Rotinas administrativas." }, prefs)).toBe(false);
    expect(isTechJob({ ...job, title: "AUXILIAR ADMINISTRATIVO", description: "Rotinas administrativas." })).toBe(false);
  });

  it('builds stable job keys and dedupes', () => {
    const a = mapSolidesVacancy(fakeVacancy);
    const b = { ...a, url: "https://outra.url/vacancy" };
    expect(jobKey(a)).toBe(jobKey(mapSolidesVacancy({ ...fakeVacancy, id: 1 })));
    expect(jobKey(a)).not.toBe(jobKey(b));
    const deduped = dedupeJobs([a, a, b]);
    expect(deduped.length).toBe(2);
  });

  it('searches Sólides, mapping and filtering by prefs', async () => {
    mockResponse({
      success: true,
      data: {
        data: [
          fakeVacancy,
          { ...fakeVacancy, id: 2, title: "DESENVOLVEDOR PLENO", description: "<p>Vaga plena.</p>", seniority: [{ name: "Pleno" }] },
          { ...fakeVacancy, id: 3, title: "ESTAGIÁRIO(A) SUPORTE", description: "<p>Suporte presencial.</p>", state: { name: "São Paulo", code: "SP" }, city: { name: "São Paulo" }, jobType: "presencial" },
        ],
      },
    });

    const results = await searchSolides(prefs, "estágio");
    expect(results.length).toBe(1);
    expect(results[0].title).toContain("DESENVOLVIMENTO");
  });

  it('returns empty array on network failure', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error("network down"); });
    const results = await searchSolides(prefs, "react");
    expect(results).toEqual([]);
  });
});
