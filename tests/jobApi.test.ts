import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { AgentPreferences } from '../app/lib/agentPreferences';
import type { SolidesVacancy } from '../app/lib/solidesJobs';

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

import { searchExternalJobs } from '../app/lib/jobApi';

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

describe('searchExternalJobs (via Sólides)', () => {
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

  it('returns mapped vacancies from the Sólides API', async () => {
    mockResponse({
      success: true,
      data: { data: [fakeVacancy] },
    });

    const results = await searchExternalJobs('estágio desenvolvimento');
    expect(results.length).toBe(1);
    expect(results[0].company).toBe("ARENA IPANEMA HOTEL LTDA");
    expect(results[0].source).toBe("Sólides");
    expect(results[0].url).toContain("talentosarena.solides.jobs");
  });

  it('filters strictly when strict_filtering is set', async () => {
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
          { ...fakeVacancy, id: 2, title: "DESENVOLVEDOR PLENO", description: "<p>Vaga plena.</p>", seniority: [{ name: "Pleno" }] },
        ],
      },
    });

    const results = await searchExternalJobs('dev');
    expect(results.every(r => r.title.includes("DESENVOLVIMENTO"))).toBe(true);
  });

  it('returns empty array on network failure', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error("network down"); });
    const results = await searchExternalJobs('react');
    expect(results).toEqual([]);
  });
});
