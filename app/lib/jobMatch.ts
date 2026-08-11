import { detectSkills, normalizeText } from "./skills";
import { inferYearsOfExperience } from "./cvParser";
import { generateCoverLetter } from "./coverLetter";
import { getAgentPreferences } from "./agentPreferences";

export interface JobMatchEvaluation {
  shouldApply: boolean;
  matchScore: number;
  coverLetter: string;
  keySkillsMatched: string[];
  skillGaps: string[];
  reasons: string[];
  rejectReasons: string[];
  isPreferred: boolean;
  formAnswers: {
    yearsOfExperience: number;
    expectedSalary: string;
  };
}

function normalize(text: string): string {
  return normalizeText(text);
}

function inferSeniorityMatch(jobDescription: string, yearsOfExperience: number): { score: number; label: string } {
  if (/senior|staff|tech lead|principal/i.test(jobDescription)) {
    return yearsOfExperience >= 7
      ? { score: 100, label: "Senioridade sênior compatível" }
      : yearsOfExperience >= 5
        ? { score: 80, label: "Experiência próxima ao exigido" }
        : { score: 40, label: "Vaga sênior para perfil com pouca experiência" };
  }

  if (/mid|pleno/i.test(jobDescription)) {
    return yearsOfExperience >= 4
      ? { score: 100, label: "Senioridade pleno compatível" }
      : yearsOfExperience >= 3
        ? { score: 80, label: "Experiência próxima ao exigido" }
        : { score: 55, label: "Vaga pleno para perfil com pouca experiência" };
  }

  if (/junior|júnior|estágio|estagio|trainee/i.test(jobDescription)) {
    return yearsOfExperience <= 2
      ? { score: 95, label: "Nível júnior/estágio alinhado ao perfil" }
      : { score: 70, label: "Nível júnior/estágio compatível" };
  }

  return { score: 70, label: "Nível de senioridade compatível" };
}

function inferLanguageMatch(jobDescription: string, cvText: string): { score: number; label: string } {
  const needsEnglish = /english|inglês|idioma|fluente/i.test(jobDescription);
  if (!needsEnglish) {
    return { score: 100, label: "Sem exigência de idioma estrangeiro" };
  }

  const hasEnglish = /english|inglês|idioma/i.test(cvText);
  return hasEnglish
    ? { score: 100, label: "Idioma exigido presente no currículo" }
    : { score: 0, label: "Idioma obrigatório não encontrado no currículo" };
}

export function evaluateJobMatch(jobDescription: string, cvText: string): JobMatchEvaluation {
  const reasons: string[] = [];
  const rejectReasons: string[] = [];

  const jobText = normalize(jobDescription);
  const requiredSkills = detectSkills(jobText);
  const cvSkills = detectSkills(cvText);
  const matchedSkills = requiredSkills.filter((skill) => cvSkills.includes(skill));
  const skillGaps = requiredSkills.filter((skill) => !cvSkills.includes(skill));

  const techCoverage = requiredSkills.length === 0
    ? 70
    : Math.round((matchedSkills.length / requiredSkills.length) * 100);

  reasons.push(`Match técnico: ${matchedSkills.length} de ${requiredSkills.length} skills exigidas atendidas (${matchedSkills.join(", ") || "nenhuma"})`);

  const yearsOfExperience = inferYearsOfExperience(cvText);
  const seniority = inferSeniorityMatch(jobDescription, yearsOfExperience);
  reasons.push(seniority.label);

  const language = inferLanguageMatch(jobDescription, cvText);
  reasons.push(language.label);

  const rawScore = Math.round((techCoverage * 0.6) + (seniority.score * 0.25) + (language.score * 0.15));
  let matchScore = Math.max(0, Math.min(100, rawScore));

  const mandatoryIncompatibility = /fluente|native|mandatory|obrigatorio/i.test(jobText) && language.score === 0;
  if (mandatoryIncompatibility) {
    rejectReasons.push("Exigência de idioma fluente/nativo não atendida");
  }

  const prefs = getAgentPreferences();
  const preferredRoles = prefs.preferred_job_roles;
  const isPreferred = preferredRoles.length > 0 && preferredRoles.some((r) => jobText.includes(r));

  const boost = prefs.boost;
  const preferredThreshold = prefs.preferred_threshold;
  const strictFiltering = prefs.strict_filtering;

  if (isPreferred) {
    matchScore = Math.min(100, matchScore + boost);
    reasons.push(`Vaga preferida detectada - bônus de ${boost} pontos`);
  }

  const threshold = isPreferred ? preferredThreshold : 60;
  let shouldApply = !mandatoryIncompatibility && matchScore >= threshold;

  if (!shouldApply) {
    rejectReasons.push(`Pontuação ${matchScore}% abaixo do limiar de ${threshold}%`);
  }

  if (strictFiltering && preferredRoles.length > 0 && !isPreferred) {
    shouldApply = false;
    rejectReasons.push("Filtro estrito ativo: apenas vagas preferidas são processadas");
  }

  const coverLetter = generateCoverLetter({
    jobTitle: jobDescription.split("\n")[0].slice(0, 60),
    company: "a empresa",
    location: "",
    jobDescription,
    cvText,
    profileName: "",
    profileEmail: "",
    profilePhone: "",
    matchedSkills,
    skillGaps,
    matchScore,
  });

  return {
    shouldApply,
    matchScore,
    coverLetter,
    keySkillsMatched: matchedSkills,
    skillGaps,
    reasons,
    rejectReasons,
    isPreferred,
    formAnswers: {
      yearsOfExperience,
      expectedSalary: yearsOfExperience >= 7 ? "R$ 18.000 - R$ 25.000" : yearsOfExperience >= 4 ? "R$ 12.000 - R$ 18.000" : "R$ 8.000 - R$ 12.000",
    },
  };
}
