import agentPreferences from "../../agent_preferences.json";
import { normalizeText } from "./skills";

export interface LocationRules {
  home_state: string;
  outside_home_state_only_remote: boolean;
}

export interface AgentPreferences {
  preferred_job_roles: string[];
  boost: number;
  preferred_threshold: number;
  strict_filtering: boolean;
  location_rules: LocationRules;
}

export const DEFAULT_PREFERENCES: AgentPreferences = {
  preferred_job_roles: [],
  boost: 15,
  preferred_threshold: 50,
  strict_filtering: false,
  location_rules: {
    home_state: "PE",
    outside_home_state_only_remote: true,
  },
};

export function getAgentPreferences(): AgentPreferences {
  return {
    preferred_job_roles: Array.isArray(agentPreferences?.preferred_job_roles)
      ? agentPreferences.preferred_job_roles.map((role: string) => normalizeText(role))
      : DEFAULT_PREFERENCES.preferred_job_roles,
    boost: typeof agentPreferences?.boost === "number" ? agentPreferences.boost : DEFAULT_PREFERENCES.boost,
    preferred_threshold: typeof agentPreferences?.preferred_threshold === "number" ? agentPreferences.preferred_threshold : DEFAULT_PREFERENCES.preferred_threshold,
    strict_filtering: typeof agentPreferences?.strict_filtering === "boolean" ? agentPreferences.strict_filtering : DEFAULT_PREFERENCES.strict_filtering,
    location_rules: {
      home_state: typeof agentPreferences?.location_rules?.home_state === "string"
        ? agentPreferences.location_rules.home_state.toUpperCase()
        : DEFAULT_PREFERENCES.location_rules.home_state,
      outside_home_state_only_remote: typeof agentPreferences?.location_rules?.outside_home_state_only_remote === "boolean"
        ? agentPreferences.location_rules.outside_home_state_only_remote
        : DEFAULT_PREFERENCES.location_rules.outside_home_state_only_remote,
    },
  };
}
