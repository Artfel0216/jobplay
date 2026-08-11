import { detectSkills, normalizeText } from "./skills";
import { parseCv } from "./cvParser";

export interface CvCheck {
  id: string;
  label: string;
  score: number;
  passed: boolean;
  detail: string;
}

export type CvVerdict = "pronto" | "ajustar" | "critico";

export interface CvAnalysis {
  overallScore: number;
  verdict: CvVerdict;
  verdictLabel: string;
  wordCount: number;
  checks: CvCheck[];
  weakPhrases: string[];
  improvements: string[];
}

export interface CvOptimization {
  text: string;
  changes: string[];
}

const BR_CITIES = [
  "sao paulo",
  "rio de janeiro",
  "belo horizonte",
  "porto alegre",
  "curitiba",
  "campinas",
  "brasilia",
  "salvador",
  "recife",
  "fortaleza",
  "manaus",
  "florianopolis",
  "goiania",
  "belem",
  "natal",
  "joao pessoa",
  "sao luis",
  "aracaju",
  "campo grande",
  "cuiaba",
  "santos",
  "ribeirao preto",
  "sao jose dos campos",
  "osasco",
  "sorocaba",
  "jundiai",
];

const ACTION_VERBS = [
  "desenvolvi",
  "desenvolveu",
  "desenvolvo",
  "criei",
  "implementei",
  "implemento",
  "construi",
  "projetei",
  "liderei",
  "coordenei",
  "gerenciei",
  "organizei",
  "otimizei",
  "automatizei",
  "analisei",
  "desenhei",
  "arquitetei",
  "configurei",
  "refatorei",
  "entreguei",
  "contribui",
  "planejei",
  "testei",
  "documentei",
  "monitorei",
  "reduzi",
  "aumentei",
  "melhorei",
  "aprendi",
  "estudei",
  "atuei",
  "executei",
  "estruturei",
  "integre",
  "mantive",
  "escrevi",
  "prestei",
  "apoiei",
  "colaborei",
];

const STRONG_REWRITES: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\brespons[áa]vel por\b/i, replacement: "Atuei em" },
  { pattern: /\b(?:ajudava|auxiliava|auxiliando)\b/i, replacement: "Colaborei em" },
  { pattern: /\bparticipei de\b/i, replacement: "Atuei ativamente em" },
  { pattern: /\b(?:trabalhava|trabalhei|trabalho) com\b/i, replacement: "Desenvolvi projetos com" },
  { pattern: /\b(?:tenho|tinha) conhecimento\b/i, replacement: "Apliquei" },
  { pattern: /\b(?:era|sou) respons[áa]vel\b/i, replacement: "Liderei" },
  { pattern: /\b(?:dava|dar) suporte\b/i, replacement: "Prestei suporte a" },
  { pattern: /\bfazendo\b/i, replacement: "executando" },
];

const WEAK_LABELS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /respons[áa]vel por/, label: "responsável por" },
  { pattern: /ajudava|auxiliava|auxiliando/, label: "ajudava/auxiliava" },
  { pattern: /participei de/, label: "participei de" },
  { pattern: /trabalhava com|trabalhava na|trabalhei com/, label: "trabalhava com" },
  { pattern: /tenho conhecimento|tinha conhecimento/, label: "tenho conhecimento" },
  { pattern: /era respons[áa]vel|sou respons[áa]vel/, label: "sou responsável" },
  { pattern: /fazia|fazendo/, label: "fazia" },
  { pattern: /dava suporte|dar suporte/, label: "dar suporte" },
];

const BASE_KEYWORDS = [
  "react",
  "javascript",
  "typescript",
  "node.js",
  "sql",
  "html",
  "css",
  "git",
  "api",
  "testes",
  "agile",
  "scrum",
  "python",
  "java",
  "docker",
  "aws",
  "banco de dados",
];

const BULLET_RE = /^\s*[-*•·▪◦]|\s*\d+[.)]/;

function findWeakPhrases(normalized: string): string[] {
  return WEAK_LABELS.filter(({ pattern }) => pattern.test(normalized)).map(({ label }) => label);
}

function detectBullets(lines: string[]): string[] {
  return lines.filter((line) => BULLET_RE.test(line) || /^\s*[A-ZÀ-Ú]/.test(line) && line.length > 25);
}

export function analyzeCvForAts(cvText: string, extraKeywords: string[] = []): CvAnalysis {
  const normalized = normalizeText(cvText);
  const lines = cvText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;

  const checks: CvCheck[] = [];

  const email = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(cvText);
  checks.push({ id: "email", label: "E-mail de contato", score: email ? 100 : 0, passed: email, detail: email ? "E-mail detectado" : "Nenhum e-mail encontrado" });

  const phone = /(?:\+55\s?)?(?:\(\d{2}\)\s?|\d{2}\s?)?\d{4,5}[-.\s]?\d{4}/.test(cvText);
  checks.push({ id: "phone", label: "Telefone com DDD", score: phone ? 100 : 0, passed: phone, detail: phone ? "Telefone detectado" : "Nenhum telefone encontrado" });

  const location = /remoto|presencial|hibrido|home office/.test(normalized) || BR_CITIES.some((city) => normalized.includes(city));
  checks.push({ id: "location", label: "Cidade ou modalidade", score: location ? 100 : 0, passed: location, detail: location ? "Localização detectada" : "Informe cidade/UF ou 'Remoto'" });

  const linkedin = /linkedin\.com\/in\//i.test(cvText);
  checks.push({ id: "linkedin", label: "LinkedIn informado", score: linkedin ? 100 : 0, passed: linkedin, detail: linkedin ? "Perfil LinkedIn detectado" : "Adicione linkedin.com/in/..." });

  const hasSummary = /resumo|objetivo|sobre|perfil profissional|summary/.test(normalized);
  checks.push({ id: "summary", label: "Seção de resumo/objetivo", score: hasSummary ? 100 : 0, passed: hasSummary, detail: hasSummary ? "Resumo encontrado" : "Falta um resumo profissional" });

  const hasExperience = /experiencia|historico|carreira|atuacao/.test(normalized);
  checks.push({ id: "experience", label: "Seção de experiência", score: hasExperience ? 100 : 0, passed: hasExperience, detail: hasExperience ? "Experiência encontrada" : "Falta a seção de experiência" });

  const hasEducation = /formacao|educacao|graduacao|escolaridade|faculdade|ensino/.test(normalized);
  checks.push({ id: "education", label: "Seção de formação", score: hasEducation ? 100 : 0, passed: hasEducation, detail: hasEducation ? "Formação encontrada" : "Falta a seção de formação" });

  const hasSkills = /habilidades|competencias|skills|tecnologias/.test(normalized) || detectSkills(cvText).length > 0;
  checks.push({ id: "skills", label: "Seção de habilidades", score: hasSkills ? 100 : 0, passed: hasSkills, detail: hasSkills ? "Habilidades encontradas" : "Adicione uma seção de habilidades" });

  const hasDateRange = /\b20\d{2}\b[\s\-–—a]*(?:-|–|—|a|ate)\s*(?:atual|presente|hoje|\b20\d{2}\b)/.test(normalized)
    || /\d{1,2}\/\d{4}\s*[-–—]\s*(?:atual|presente|\d{1,2}\/\d{4})/.test(normalized);
  checks.push({ id: "dates", label: "Períodos nas experiências", score: hasDateRange ? 100 : 0, passed: hasDateRange, detail: hasDateRange ? "Datas de período detectadas" : "Use períodos como '01/2023 – atual'" });

  const bullets = detectBullets(lines);
  const bulletsWithMetric = bullets.filter((line) => /\d|%/.test(line)).length;
  const quantifiedScore = bullets.length === 0 ? 50 : Math.round((bulletsWithMetric / bullets.length) * 100);
  checks.push({
    id: "quantified",
    label: "Realizações com números",
    score: quantifiedScore,
    passed: quantifiedScore >= 60,
    detail: bullets.length === 0
      ? "Nenhuma realização em formato de bullets"
      : `${bulletsWithMetric} de ${bullets.length} realizações com números/%`,
  });

  const bulletsWithVerb = bullets.filter((line) => {
    const firstWord = (normalizeText(line).replace(/^[\s\-*•·▪◦\d.)]+/, "").match(/[a-zà-ú]+/) ?? [""])[0];
    return ACTION_VERBS.some((verb) => firstWord.startsWith(verb) || firstWord === verb);
  }).length;
  const verbsScore = bullets.length === 0 ? 50 : Math.round((bulletsWithVerb / bullets.length) * 100);
  checks.push({
    id: "actionVerbs",
    label: "Verbos de ação no início",
    score: verbsScore,
    passed: verbsScore >= 60,
    detail: bullets.length === 0
      ? "Nenhuma realização em formato de bullets"
      : `${bulletsWithVerb} de ${bullets.length} realizações iniciam com verbo de ação`,
  });

  const weakPhrases = findWeakPhrases(normalized);
  const weakScore = Math.max(0, 100 - weakPhrases.length * 20);
  checks.push({ id: "weakLanguage", label: "Sem frases fracas", score: weakScore, passed: weakPhrases.length === 0, detail: weakPhrases.length === 0 ? "Linguagem forte" : `Frases fracas: ${weakPhrases.join(", ")}` });

  const targetKeywords = Array.from(new Set([...extraKeywords.map((keyword) => normalizeText(keyword)), ...BASE_KEYWORDS])).filter((keyword) => keyword.length >= 2);
  const matchedKeywords = targetKeywords.filter((keyword) => normalized.includes(keyword));
  const keywordsScore = targetKeywords.length === 0 ? 100 : Math.round((matchedKeywords.length / targetKeywords.length) * 100);
  checks.push({
    id: "keywords",
    label: "Palavras-chave de TI",
    score: keywordsScore,
    passed: keywordsScore >= 60,
    detail: `${matchedKeywords.length} de ${targetKeywords.length} palavras-chave encontradas (${matchedKeywords.join(", ") || "nenhuma"})`,
  });

  let lengthScore: number;
  if (wordCount === 0) {
    lengthScore = 0;
  } else if (wordCount >= 150 && wordCount <= 800) {
    lengthScore = 100;
  } else if (wordCount < 150) {
    lengthScore = Math.round((wordCount / 150) * 100);
  } else {
    lengthScore = 60;
  }
  checks.push({
    id: "length",
    label: "Tamanho (150–800 palavras)",
    score: lengthScore,
    passed: lengthScore >= 80,
    detail: `${wordCount} palavras — objetivo é ~1 página`,
  });

  const WEIGHTS: Record<string, number> = {
    email: 10,
    phone: 8,
    location: 5,
    linkedin: 6,
    summary: 8,
    experience: 10,
    education: 6,
    skills: 8,
    dates: 8,
    quantified: 9,
    actionVerbs: 9,
    weakLanguage: 6,
    keywords: 9,
    length: 4,
  };

  const totalWeight = checks.reduce((sum, check) => sum + (WEIGHTS[check.id] ?? 1), 0);
  const overallScore = wordCount === 0
    ? 0
    : Math.round(checks.reduce((sum, check) => sum + check.score * (WEIGHTS[check.id] ?? 1), 0) / totalWeight);

  const verdict: CvVerdict = overallScore >= 80 ? "pronto" : overallScore >= 60 ? "ajustar" : "critico";
  const verdictLabel = verdict === "pronto"
    ? "Robusto — pronto para robôs de triagem (Gupy, Indeed, LinkedIn)"
    : verdict === "ajustar"
      ? "Ajustável — otimize antes de aplicar para aumentar a taxa de resposta"
      : "Crítico — alto risco de reprovação automática pelos robôs";

  const improvements: string[] = [];
  const failed = checks.filter((check) => !check.passed);
  if (failed.some((check) => check.id === "email")) improvements.push("Adicione um e-mail profissional no topo do currículo.");
  if (failed.some((check) => check.id === "phone")) improvements.push("Adicione telefone com DDD, ex.: (11) 98765-4321.");
  if (failed.some((check) => check.id === "location")) improvements.push("Informe cidade/UF (ex.: São Paulo – SP) ou 'Remoto'.");
  if (failed.some((check) => check.id === "linkedin")) improvements.push("Adicione o link do perfil: linkedin.com/in/seu-nome.");
  if (failed.some((check) => check.id === "summary")) improvements.push("Escreva um resumo de 2–3 linhas citando suas tecnologias principais.");
  if (failed.some((check) => check.id === "experience")) improvements.push("Crie a seção 'Experiência' com cargos, empresas e períodos.");
  if (failed.some((check) => check.id === "education")) improvements.push("Crie a seção 'Formação' com curso, instituição e período.");
  if (failed.some((check) => check.id === "skills")) improvements.push("Adicione a seção 'Habilidades' listando suas tecnologias em uma única linha.");
  if (failed.some((check) => check.id === "dates")) improvements.push("Use períodos nos cargos, ex.: '01/2023 – atual'.");
  if (failed.some((check) => check.id === "quantified")) improvements.push("Quantifique resultados nas realizações: números, % e prazos.");
  if (failed.some((check) => check.id === "actionVerbs")) improvements.push("Comece cada realização com verbo de ação (desenvolvi, implementei, liderei...).");
  if (weakPhrases.length > 0) improvements.push(`Remova frases fracas (${weakPhrases.join(", ")}) e troque por ações com resultado.`);
  if (failed.some((check) => check.id === "keywords")) improvements.push("Reforce as palavras-chave da vaga no resumo e na seção de habilidades.");
  if (failed.some((check) => check.id === "length")) improvements.push("Ajuste o tamanho para ~1 página (150–800 palavras), sem abreviações perdidas.");

  return { overallScore, verdict, verdictLabel, wordCount, checks, weakPhrases, improvements };
}

function applyStrongRewrites(line: string): { text: string; changed: boolean } {
  let text = line;
  let changed = false;
  for (const { pattern, replacement } of STRONG_REWRITES) {
    if (pattern.test(text)) {
      text = text.replace(pattern, replacement);
      changed = true;
    }
  }
  text = text.replace(/^(\s*(?:[-*•·▪◦]|\d+[.)])\s*)([a-zà-ú])/, (full, marker: string, first: string) => `${marker}${first.toUpperCase()}`);
  return { text, changed };
}

export function optimizeCvForAts(cvText: string, extraKeywords: string[] = []): CvOptimization {
  const changes: string[] = [];

  if (cvText.trim().length === 0) {
    return { text: "", changes: ["Currículo vazio — cole seu currículo para otimizar."] };
  }

  const normalized = normalizeText(cvText);
  const parsed = parseCv(cvText);
  const detectedSkills = detectSkills(cvText);
  const extraPresent = extraKeywords.filter((keyword) => normalizeText(keyword).length >= 2 && normalized.includes(normalizeText(keyword)));
  const skillsLine = Array.from(new Set([...detectedSkills, ...extraPresent])).join(", ");

  const hasResumo = /resumo|objetivo|perfil profissional|sobre/.test(normalized);
  if (!hasResumo) {
    changes.push("Seção 'RESUMO' adicionada com base no perfil detectado.");
  }

  const hasHabilidades = /habilidades|competencias|skills|tecnologias/.test(normalized);
  if (!hasHabilidades) {
    changes.push("Seção 'HABILIDADES' adicionada com as tecnologias detectadas no texto.");
  }

  const outputLines: string[] = [];

  if (!hasResumo) {
    outputLines.push("RESUMO");
    const summaryParts: string[] = [];
    if (parsed.yearsOfExperience > 0) {
      summaryParts.push(`${parsed.yearsOfExperience}+ anos de experiência em desenvolvimento de software`);
    }
    if (detectedSkills.length > 0) {
      summaryParts.push(`domínio em ${detectedSkills.slice(0, 6).join(", ")}`);
    }
    summaryParts.push("em busca de oportunidade de estágio ou nível júnior");
    outputLines.push(summaryParts.join(", ").replace(/^([a-zà-ú])/, (m) => m.toUpperCase()) + ".");
    outputLines.push("");
  }

  let weakRewritten = 0;
  const lines = cvText.replace(/\r\n/g, "\n").split("\n").map((line) => line.trimEnd());

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const rewritten = applyStrongRewrites(line);
    if (rewritten.changed) {
      weakRewritten += 1;
    }
    outputLines.push(rewritten.text);
  }

  if (weakRewritten > 0) {
    changes.push(`${weakRewritten} frase(s) fraca(s) reescrita(s) com verbos de ação.`);
  }

  const wordCount = normalizeText(cvText).split(/\s+/).filter(Boolean).length;
  if (wordCount < 150) {
    changes.push("Currículo curto: expanda as realizações e adicione projetos para chegar a ~150 palavras.");
  }
  if (wordCount > 800) {
    changes.push("Currículo longo: corte para ~1 página, mantendo as palavras-chave mais relevantes.");
  }

  const normalizedBullets = outputLines.filter((line) => BULLET_RE.test(line));
  if (normalizedBullets.length > 0 && !normalizedBullets.some((line) => /\d|%/.test(line))) {
    changes.push("Dica: adicione números às realizações (ex.: 'reduzi o tempo de carregamento em 40%').");
  }

  if (!hasHabilidades && skillsLine.length > 0) {
    if (outputLines[outputLines.length - 1]?.trim() !== "") {
      outputLines.push("");
    }
    outputLines.push("HABILIDADES");
    outputLines.push(skillsLine);
    outputLines.push("");
  }

  const deduped: string[] = [];
  for (const line of outputLines) {
    if (line.trim() === "" && (deduped.length === 0 || deduped[deduped.length - 1].trim() === "")) {
      continue;
    }
    deduped.push(line);
  }

  return { text: deduped.join("\n").trimEnd() + "\n", changes };
}
