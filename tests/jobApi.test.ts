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

import { searchExternalJobs } from '../app/lib/jobApi';

describe('searchExternalJobs respects preferences', () => {
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

  it('returns preferred results first when present', async () => {
    const fakeText = `Some header\nhttps://example.com/job1?title=estágio\nhttps://example.com/job2?title=senior`;
    globalThis.fetch = vi.fn(async () => ({ ok: true, text: async () => fakeText }) as Response);

    const results = await searchExternalJobs('estágio');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].url).toContain('estágio');
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

    const fakeText = `https://example.com/job1?title=estágio\nhttps://example.com/job2?title=senior`;
    globalThis.fetch = vi.fn(async () => ({ ok: true, text: async () => fakeText }) as Response);

    const results = await searchExternalJobs('dev');
    expect(results.every(r => r.url.includes('estágio'))).toBe(true);
  });
});
