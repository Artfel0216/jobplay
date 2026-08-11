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

import { evaluateJobMatch } from '../app/lib/jobMatch';

describe('evaluateJobMatch with agent preferences', () => {
  beforeEach(() => {
    currentPrefs = {
      preferred_job_roles: ['desenvolvedor júnior', 'vagas de estágio'],
      boost: 20,
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

  it('applies boost and lowers threshold for preferred roles', () => {
    const jobDescription = 'Vaga: Desenvolvedor Júnior React';
    const cvText = 'React, JavaScript, 1 year experience';

    const res = evaluateJobMatch(jobDescription, cvText);
    expect(res.matchScore).toBeGreaterThanOrEqual(50);
    expect(res.shouldApply).toBe(true);
  });

  it('respects strict_filtering when enabled (non-preferred rejected)', () => {
    currentPrefs = {
      preferred_job_roles: ['estágio'],
      boost: 20,
      preferred_threshold: 50,
      strict_filtering: true,
      location_rules: {
        home_state: 'PE',
        outside_home_state_only_remote: true,
      },
    };

    const jobDescription = 'Vaga: Desenvolvedor Pleno Node.js';
    const cvText = 'Node.js, SQL, 5 years experience';

    const res = evaluateJobMatch(jobDescription, cvText);
    expect(res.shouldApply).toBe(false);
  });
});
