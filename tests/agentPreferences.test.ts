import { describe, it, expect } from 'vitest';
import { getAgentPreferences } from '../app/lib/agentPreferences';

describe('getAgentPreferences', () => {
  it('reads preferences from agent_preferences.json', () => {
    const prefs = getAgentPreferences();

    expect(prefs.boost).toBeGreaterThan(0);
    expect(prefs.preferred_threshold).toBeGreaterThan(0);
    expect(Array.isArray(prefs.preferred_job_roles)).toBe(true);
    expect(prefs.preferred_job_roles.some((role) => role.includes('junior') || role.includes('estagio'))).toBe(true);
  });
});
