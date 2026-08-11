export interface ExternalJobApiResult {
  title: string;
  company: string;
  location: string;
  source: string;
  url: string;
  description: string;
}

import { getAgentPreferences } from "./agentPreferences";
import { normalizeText } from "./skills";

export async function searchExternalJobs(query: string): Promise<ExternalJobApiResult[]> {
  const searchQuery = encodeURIComponent(query);
  const endpoint = `https://r.jina.ai/http://www.google.com/search?q=${searchQuery}`;

  try {
    const response = await fetch(endpoint, {
      headers: {
        Accept: "text/plain",
      },
    });

    if (!response.ok) {
      throw new Error("Unable to fetch external jobs");
    }

    const text = await response.text();
    const lines = text
      .split(/\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 10);

    const mapped = lines
      .filter((line) => /https?:\/\//i.test(line))
      .map((line, index) => ({
        title: `Resultado ${index + 1}`,
        company: "Fonte pública",
        location: "Brasil",
        source: "Google Search",
        url: line,
        description: `Resultado encontrado para: ${query}`,
      }));

    const prefs = getAgentPreferences();
    const preferredRoles = prefs.preferred_job_roles || [];
    if (preferredRoles.length === 0) {
      return mapped.slice(0, 5);
    }

    const preferred = mapped.filter((r) =>
      preferredRoles.some((pr) => (
        normalizeText(r.title).includes(pr) ||
        normalizeText(r.description).includes(pr) ||
        normalizeText(r.url).includes(pr)
      ))
    );

    if (prefs.strict_filtering) {
      return preferred.slice(0, 5);
    }

    const others = mapped.filter((r) => !preferred.includes(r));
    return [...preferred, ...others].slice(0, 5);
  } catch {
    return [];
  }
}
