import { detectSkills, isPresent, normalizeText } from "./skills";

export interface ParsedCv {
  name: string;
  email: string;
  phone: string;
  location: string;
  yearsOfExperience: number;
  skills: string[];
  languages: string[];
  education: string[];
  summary: string;
}

const SECTION_HEADERS = [
  "curriculo",
  "resumo",
  "resumo profissional",
  "experiencia",
  "educacao",
  "formacao",
  "habilidades",
  "competencias",
  "contato",
  "objetivo",
  "idiomas",
  "endereco",
  "linkedin",
  "github",
  "cursos",
  "certificacoes",
];

const languageCatalog: { label: string; aliases: string[] }[] = [
  { label: "Inglês", aliases: ["ingles", "english", "ingles avancado", "ingles intermediario", "ingles basico", "fluent english"] },
  { label: "Espanhol", aliases: ["espanhol", "spanish"] },
  { label: "Francês", aliases: ["frances", "french"] },
  { label: "Alemão", aliases: ["alemao", "german"] },
  { label: "Italiano", aliases: ["italiano", "italian"] },
];

const educationAliases = [
  "bacharel",
  "bacharelado",
  "licenciatura",
  "tecnologo",
  "engenharia",
  "analise e desenvolvimento",
  "ciencia da computacao",
  "sistemas de informacao",
  "ciencia de dados",
  "pos-graduacao",
  "especializacao",
  "mestrado",
  "doutorado",
  "tecnico em informatica",
  "tecnico em ti",
  "curso superior",
];

function extractEmail(text: string): string {
  const match = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return match?.[0] ?? "";
}

function extractPhone(text: string): string {
  const match = text.match(/(?:\+55\s?)?(?:\(\d{2}\)\s?|\d{2}\s?)?\d{4,5}[-.\s]?\d{4}/);
  return match?.[0].trim() ?? "";
}

function extractName(text: string): string {
  const lines = text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);

  for (const line of lines) {
    const lower = normalizeText(line);
    const isContact = /@/.test(line) || /https?:\/\//i.test(line) || /^[0-9()+\s.-]+$/.test(line);
    const isHeader = SECTION_HEADERS.some((header) => lower.includes(header) && lower.length < 40);
    const hasUppercase = /\p{Lu}/u.test(line);
    const validLength = line.length >= 3 && line.length <= 60;

    if (!isContact && !isHeader && hasUppercase && validLength) {
      return line;
    }
  }

  return "";
}

function extractLocation(text: string): string {
  const normalized = text;
  const match = normalized.match(/([A-ZÀ-Ú][a-zà-ú]+(?:\s[A-ZÀ-Ú][a-zà-ú]+)*)\s*[-–—]\s*([A-Z]{2})/);
  return match?.[1] ?? "";
}

export function inferYearsOfExperience(text: string): number {
  const normalized = normalizeText(text);
  const patterns = [
    /(\d{1,2})\s*\+\s*(?:anos|years)(?:\s+de\s+(?:experiencia|experiencia))?/,
    /(\d{1,2})\s*(?:anos|years)\s+(?:de\s+)?(?:experiencia|experiencia|experience|trabalho)/,
    /(?:experiencia|experiencia|experience)\s+(?:de\s+|\(|\s)*(\d{1,2})\s*(?:anos|years)/,
    /(?:atuando|trabalhando)\s+(?:ha|a)\s*(\d{1,2})\s*(?:anos|years)/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) {
      return Math.max(0, Number(match[1]));
    }
  }

  return 0;
}

function extractEducation(text: string): string[] {
  const normalized = normalizeText(text);
  return educationAliases.filter((alias) => normalized.includes(alias));
}

function extractLanguages(text: string): string[] {
  const found = languageCatalog.filter((lang) => isPresent(text, lang.aliases)).map((lang) => lang.label);
  return Array.from(new Set(found));
}

function buildSummary(parsed: { yearsOfExperience: number; skills: string[] }): string {
  const parts: string[] = [];
  if (parsed.yearsOfExperience > 0) {
    parts.push(`${parsed.yearsOfExperience}+ anos de experiência`);
  }
  if (parsed.skills.length > 0) {
    parts.push(`domínio em ${parsed.skills.slice(0, 5).join(", ")}`);
  }
  return parts.length > 0 ? `${parts.join(". ")}.` : "";
}

export function parseCv(cvText: string): ParsedCv {
  const skills = detectSkills(cvText);
  const yearsOfExperience = inferYearsOfExperience(cvText);

  return {
    name: extractName(cvText),
    email: extractEmail(cvText),
    phone: extractPhone(cvText),
    location: extractLocation(cvText),
    yearsOfExperience,
    skills,
    languages: extractLanguages(cvText),
    education: extractEducation(cvText),
    summary: buildSummary({ yearsOfExperience, skills }),
  };
}
