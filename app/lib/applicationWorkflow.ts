export type ApplicationStatus = "Enviada" | "Em análise" | "Entrevista" | "Aprovada" | "Rejeitada";

export const APPLICATION_STATUSES: ApplicationStatus[] = ["Enviada", "Em análise", "Entrevista", "Aprovada", "Rejeitada"];

export interface PipelineStats {
  sent: number;
  review: number;
  interview: number;
  hired: number;
  rejected: number;
}

export function getPipelineStats(records: ApplicationRecord[]): PipelineStats {
  const count = (status: ApplicationStatus) => records.filter((record) => record.status === status).length;
  return {
    sent: count("Enviada"),
    review: count("Em análise"),
    interview: count("Entrevista"),
    hired: count("Aprovada"),
    rejected: count("Rejeitada"),
  };
}

export function updateApplicationStatus(records: ApplicationRecord[], uniqueKey: string, status: ApplicationStatus): ApplicationRecord[] {
  return records.map((record) => record.uniqueKey === uniqueKey ? { ...record, status } : record);
}

export interface ApplicationRecord {
  id: string;
  uniqueKey: string;
  title: string;
  company: string;
  location: string;
  status: ApplicationStatus;
  appliedAt: string;
  matchScore: number;
  profileSnapshot?: string;
}

export function buildApplicationKey(job: { id: string; title: string; company: string; location: string; source: string; url?: string }): string {
  return [job.source, job.title, job.company, job.location, job.url ?? job.id].join("|").toLowerCase();
}

export function createApplicationRecord(job: { id: string; title: string; company: string; location: string; matchScore: number; source: string; url?: string }, profileSnapshot?: string): ApplicationRecord {
  return {
    id: job.id,
    uniqueKey: buildApplicationKey(job),
    title: job.title,
    company: job.company,
    location: job.location,
    status: "Enviada",
    appliedAt: new Date().toISOString(),
    matchScore: job.matchScore,
    profileSnapshot,
  };
}

export function isApplicationDuplicate(records: ApplicationRecord[], job: { id: string; title: string; company: string; location: string; source: string; url?: string }): boolean {
  const key = buildApplicationKey(job);
  return records.some((record) => record.uniqueKey === key || record.id === job.id);
}

export function exportApplicationsToCsv(records: ApplicationRecord[]): string {
  const header = ["title", "company", "location", "status", "appliedAt", "matchScore"].join(",");
  const rows = records.map((record) => [record.title, record.company, record.location, record.status, record.appliedAt, record.matchScore].join(","));
  return [header, ...rows].join("\n");
}
