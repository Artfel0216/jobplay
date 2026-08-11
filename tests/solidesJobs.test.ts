import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { AgentPreferences } from '../app/lib/agentPreferences';

let currentPrefs: AgentPreferences = {
  preferred_job_roles: [],
  boost: 15,
  preferred_threshold: 50,
  strict_filtering: false,
  location_rules: {
    home_state: 'PE',
    outside_home_state_only_remote: true,
  },
};

vi.mock('../app/lib/agentPreferences', () => ({
  getAgentPreferences: () => currentPrefs,
}));

import { formatLocation, mapSolidesVacancy, matchesLocationRules, searchSolidesJobs, type SolidesVacancy } from '../app/lib/solidesJobs';

const fakeVacancy: SolidesVacancy = {
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

describe('solidesJobs mapping', () => {
  beforeEach(() => {
    currentPrefs = {
      preferred_job_roles: ['estágio'],
      boost: 15,
      preferred_threshold: 50,
      strict_filtering: false,
      location_rules: {
        home_state: 'PE',
        outside_home_state_only_remote: true,
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps vacancy to search result with real redirect link', () => {
    const result = mapSolidesVacancy(fakeVacancy);
    expect(result.title).toContain("DESENVOLVIMENTO");
    expect(result.company).toBe("ARENA IPANEMA HOTEL LTDA");
    expect(result.url).toBe("https://talentosarena.solides.jobs/vacancies/899836?origem=portal");
    expect(result.source).toBe("Sólides");
    expect(result.location).toBe("Recife - PE");
    expect(result.description).toContain("Salário: R$ 1.159,8");
    expect(result.description).not.toContain("<p>");
  });

  it('formats remote vacancies as Remoto', () => {
    const remote: SolidesVacancy = { ...fakeVacancy, jobType: "remoto", homeOffice: true };
    expect(formatLocation(remote)).toBe("Remoto");
  });

  it('accepts any modality inside home state (PE)', () => {
    expect(matchesLocationRules({ ...fakeVacancy, jobType: "presencial" })).toBe(true);
    expect(matchesLocationRules({ ...fakeVacancy, jobType: "hibrido" })).toBe(true);
    expect(matchesLocationRules({ ...fakeVacancy, jobType: "remoto", homeOffice: true })).toBe(true);
  });

  it('rejects non-remote vacancies outside home state', () => {
    const outside = { ...fakeVacancy, state: { name: "Rio de Janeiro", code: "RJ" } };
    expect(matchesLocationRules({ ...outside, jobType: "presencial" })).toBe(false);
    expect(matchesLocationRules({ ...outside, jobType: "hibrido" })).toBe(false);
    expect(matchesLocationRules({ ...outside, jobType: "remoto", homeOffice: true })).toBe(true);
  });

  it('filters strictly to preferred roles when strict_filtering is set', async () => {
    currentPrefs = {
      preferred_job_roles: ['estágio'],
      boost: 15,
      preferred_threshold: 50,
      strict_filtering: true,
      location_rules: {
        home_state: 'PE',
        outside_home_state_only_remote: true,
      },
    };
    mockResponse({
      success: true,
      data: {
        data: [
          fakeVacancy,
          { ...fakeVacancy, id: 2, title: "DESENVOLVEDOR PLENO", description: "<p>Vaga plena com React.</p>", seniority: [{ name: "Pleno" }] },
        ],
      },
    });

    const results = await searchSolidesJobs("estágio");
    expect(results.length).toBe(1);
    expect(results[0].title).toContain("DESENVOLVIMENTO");
  });

  it('includes non-preferred results when strict filtering is off', async () => {
    currentPrefs = {
      preferred_job_roles: ['estágio'],
      boost: 15,
      preferred_threshold: 50,
      strict_filtering: false,
      location_rules: {
        home_state: 'PE',
        outside_home_state_only_remote: true,
      },
    };
    mockResponse({
      success: true,
      data: {
        data: [
          fakeVacancy,
          { ...fakeVacancy, id: 2, title: "DESENVOLVEDOR PLENO", description: "<p>Vaga plena com React.</p>", seniority: [{ name: "Pleno" }] },
        ],
      },
    });

    const results = await searchSolidesJobs("dev");
    expect(results.length).toBe(2);
    expect(results[0].title).toContain("DESENVOLVIMENTO");
  });

  it('returns empty array on network failure', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error("network down"); });
    const results = await searchSolidesJobs("react");
    expect(results).toEqual([]);
  });

  it('excludes presencial vacancies outside home state from search', async () => {
    mockResponse({
      success: true,
      data: {
        data: [
          fakeVacancy,
          { ...fakeVacancy, id: 3, title: "ESTAGIÁRIO(A) SUPORTE", description: "<p>Suporte presencial.</p>", state: { name: "São Paulo", code: "SP" }, city: { name: "São Paulo" }, jobType: "presencial", homeOffice: false },
          { ...fakeVacancy, id: 4, title: "ESTAGIÁRIO(A) QA REMOTO", description: "<p>QA remoto.</p>", state: { name: "São Paulo", code: "SP" }, city: { name: "São Paulo" }, jobType: "remoto", homeOffice: true },
        ],
      },
    });

    const results = await searchSolidesJobs("estágio");
    expect(results.some((result) => result.title.includes("SUPORTE"))).toBe(false);
    expect(results.some((result) => result.title.includes("QA REMOTO"))).toBe(true);
    expect(results.some((result) => result.title.includes("DESENVOLVIMENTO"))).toBe(true);
  });
});
