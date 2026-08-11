export interface ExternalJobApiResult {
  title: string;
  company: string;
  location: string;
  source: string;
  url: string;
  description: string;
}

import { searchSolidesJobs } from "./solidesJobs";

export async function searchExternalJobs(query: string): Promise<ExternalJobApiResult[]> {
  return searchSolidesJobs(query, { take: 10 });
}
