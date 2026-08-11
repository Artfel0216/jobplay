export interface SkillDefinition {
  label: string;
  aliases: string[];
}

export const skillCatalog: SkillDefinition[] = [
  { label: "TypeScript", aliases: ["typescript", "ts"] },
  { label: "JavaScript", aliases: ["javascript", "js", "ecmascript", "es6", "es8"] },
  { label: "React", aliases: ["react"] },
  { label: "React Native", aliases: ["react native"] },
  { label: "Next.js", aliases: ["next.js", "nextjs", "next js"] },
  { label: "Vue.js", aliases: ["vue", "vue.js", "vuejs", "nuxt"] },
  { label: "Angular", aliases: ["angular"] },
  { label: "Node.js", aliases: ["node.js", "nodejs", "node"] },
  { label: "SQL", aliases: ["sql", "postgres", "postgresql", "mysql", "sqlite", "relational databases", "bancos relacionais", "banco de dados", "bancos"] },
  { label: "MongoDB", aliases: ["mongodb", "mongo"] },
  { label: "Redis", aliases: ["redis"] },
  { label: "Docker", aliases: ["docker"] },
  { label: "Kubernetes", aliases: ["kubernetes", "k8s"] },
  { label: "AWS", aliases: ["aws", "amazon web services", "amazon aws"] },
  { label: "Azure", aliases: ["azure"] },
  { label: "Google Cloud", aliases: ["gcp", "google cloud"] },
  { label: "Python", aliases: ["python"] },
  { label: "Java", aliases: ["java"] },
  { label: "Spring", aliases: ["spring", "spring boot"] },
  { label: "C#", aliases: ["c#", "csharp"] },
  { label: ".NET", aliases: [".net", "asp.net", "aspnet"] },
  { label: "C++", aliases: ["c++", "cpp"] },
  { label: "Go", aliases: ["golang", "go lang"] },
  { label: "Ruby", aliases: ["ruby", "rails", "ruby on rails"] },
  { label: "PHP", aliases: ["php", "laravel"] },
  { label: "HTML", aliases: ["html", "html5"] },
  { label: "CSS", aliases: ["css", "css3", "scss", "sass", "styled components"] },
  { label: "Tailwind CSS", aliases: ["tailwind", "tailwindcss"] },
  { label: "GraphQL", aliases: ["graphql"] },
  { label: "REST APIs", aliases: ["rest", "restful", "apis rest", "api rest", "integracao com apis"] },
  { label: "Git", aliases: ["git", "github", "gitlab", "bitbucket"] },
  { label: "CI/CD", aliases: ["ci/cd", "cicd", "continuous integration", "continuous delivery", "pipelines"] },
  { label: "Testing", aliases: ["testing", "testes", "jest", "vitest", "cypress", "unit tests", "testes unitarios", "tdd"] },
  { label: "Linux", aliases: ["linux", "unix"] },
  { label: "Microservices", aliases: ["microservices", "microsservicos"] },
  { label: "Automation", aliases: ["automation", "automacao", "automacao de processos", "rpa"] },
  { label: "Agile", aliases: ["agile", "scrum", "kanban", "metodologias ageis", "ambientes ageis"] },
];

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function aliasRegex(alias: string): RegExp {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i");
}

export function detectSkills(text: string): string[] {
  const normalized = normalizeText(text);
  const found: string[] = [];
  for (const skill of skillCatalog) {
    if (skill.aliases.some((alias) => aliasRegex(alias).test(normalized))) {
      found.push(skill.label);
    }
  }
  return found;
}

export function isPresent(text: string, aliases: string[]): boolean {
  const normalized = normalizeText(text);
  return aliases.some((alias) => aliasRegex(alias).test(normalized));
}
