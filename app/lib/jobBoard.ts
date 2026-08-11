export interface JobPosting {
  id: string;
  title: string;
  company: string;
  location: string;
  level: string;
  source: string;
  postedAt: string;
  isNew: boolean;
  isReal: boolean;
  description: string;
  keywords: string[];
}

export interface JobSuggestion extends JobPosting {
  matchScore: number;
  matchedKeywords: string[];
}

export const juniorJobs: JobPosting[] = [
  {
    id: "linkedin-junior-frontend",
    title: "Desenvolvedor Frontend Júnior",
    company: "Nexxus Labs",
    location: "Remoto",
    level: "Júnior",
    source: "LinkedIn",
    postedAt: "2026-08-07",
    isNew: true,
    isReal: false,
    description: "Projeto web com React, TypeScript e integração com APIs REST.",
    keywords: ["react", "typescript", "frontend", "api", "html", "css"],
  },
  {
    id: "indeed-estagio-software",
    title: "Estágio em Desenvolvimento de Software",
    company: "BlueStone Tech",
    location: "São Paulo",
    level: "Estágio",
    source: "Indeed",
    postedAt: "2026-08-05",
    isNew: true,
    isReal: false,
    description: "Apoio em desenvolvimento web, testes e suporte a soluções internas.",
    keywords: ["javascript", "html", "css", "testing", "backend"],
  },
  {
    id: "glassdoor-junior-backend",
    title: "Software Developer Júnior",
    company: "Cobalt Systems",
    location: "Belo Horizonte",
    level: "Júnior",
    source: "Glassdoor",
    postedAt: "2026-08-02",
    isNew: true,
    isReal: false,
    description: "Desenvolvimento de APIs com Node.js, SQL e integração com serviços cloud.",
    keywords: ["node", "sql", "api", "backend", "docker"],
  },
  {
    id: "github-junior-fullstack",
    title: "Desenvolvedor Júnior Full Stack",
    company: "Asteria Digital",
    location: "Remoto",
    level: "Júnior",
    source: "GitHub Jobs",
    postedAt: "2026-07-28",
    isNew: false,
    isReal: false,
    description: "Atuação em frontend com React e backend com Node.js em produto SaaS.",
    keywords: ["react", "node", "fullstack", "typescript", "api"],
  },
  {
    id: "linkedin-junior-python",
    title: "Analista de Desenvolvimento Júnior",
    company: "Northwind AI",
    location: "Porto Alegre",
    level: "Júnior",
    source: "LinkedIn",
    postedAt: "2026-07-20",
    isNew: false,
    isReal: false,
    description: "Automação e desenvolvimento com Python e integrações com bancos de dados.",
    keywords: ["python", "sql", "automation", "backend"],
  },
  {
    id: "indeed-junior-java",
    title: "Programador Júnior Java",
    company: "Delta Core",
    location: "Campinas",
    level: "Júnior",
    source: "Indeed",
    postedAt: "2026-08-08",
    isNew: true,
    isReal: false,
    description: "Manutenção e implementação de serviços com Java, Spring e bancos relacionais.",
    keywords: ["java", "spring", "sql", "backend"],
  },
];

function normalize(text: string): string {
  return text.toLowerCase();
}

function buildUniqueKey(job: JobPosting): string {
  return `${job.company.toLowerCase()}|${job.title.toLowerCase()}|${job.location.toLowerCase()}`;
}

export function getJuniorJobSuggestions(cvText: string): JobSuggestion[] {
  const normalizedCv = normalize(cvText);

  const scored = juniorJobs
    .filter((job) => /junior|júnior|estágio|estagio|desenvolvedor|programador|developer|software/i.test(job.title + " " + job.description))
    .map((job) => {
      const matchedKeywords = job.keywords.filter((keyword) => normalizedCv.includes(keyword.toLowerCase()));
      const coverage = job.keywords.length === 0 ? 70 : Math.round((matchedKeywords.length / job.keywords.length) * 100);
      const levelBoost = /estágio|estagio/i.test(job.title) ? 80 : 75;
      const score = Math.max(40, Math.min(100, Math.round(coverage * 0.7 + levelBoost * 0.3)));

      return {
        ...job,
        matchScore: score,
        matchedKeywords,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  const deduped = new Map<string, JobSuggestion>();

  for (const job of scored) {
    const key = buildUniqueKey(job);
    if (!deduped.has(key)) {
      deduped.set(key, job);
    }
  }

  return Array.from(deduped.values());
}
