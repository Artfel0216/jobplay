export interface CoverLetterInput {
  jobTitle: string;
  company: string;
  location: string;
  jobDescription: string;
  cvText: string;
  profileName: string;
  profileEmail: string;
  profilePhone: string;
  matchedSkills: string[];
  skillGaps: string[];
  matchScore: number;
}

export function generateCoverLetter(input: CoverLetterInput): string {
  const {
    jobTitle,
    company,
    location,
    matchedSkills,
    skillGaps,
    matchScore,
    profileName,
    profileEmail,
    profilePhone,
  } = input;

  const skillsSentence = matchedSkills.length > 0
    ? `Minha experiência prática inclui ${matchedSkills.slice(0, 3).join(", ")}, que são justamente as tecnologias que a posição exige.`
    : "Tenho uma base sólida de fundamentos de desenvolvimento e grande disposição para aprender rapidamente as tecnologias da posição.";

  const gapSentence = skillGaps.length > 0
    ? ` Sei que ainda preciso avançar em ${skillGaps.slice(0, 2).join(" e ")}, e estou estudando ativamente essas áreas para chegar ainda mais pronto.`
    : "";

  const locationSentence = location && location !== "Remoto"
    ? ` Estou disponível para atuar em ${location}.`
    : " Estou disponível para atuar em modelo remoto.";

  const signature = [profileName, profileEmail, profilePhone].filter(Boolean).join(" | ");

  return [
    `Assunto: Candidatura - ${jobTitle}`,
    "",
    `Olá, equipe da ${company}!`,
    "",
    `Estou me candidatando para a vaga de ${jobTitle}. Minha pontuação de compatibilidade com a posição é de ${matchScore}%, e acredito que meu perfil combina bem com o que vocês estão buscando.`,
    "",
    skillsSentence + gapSentence + locationSentence,
    "",
    "Tenho um histórico de entregar resultados com foco em qualidade, colaboração e aprendizado contínuo, e ficarei muito feliz em contribuir desde o início com o time.",
    "",
    "Agradeço pela atenção e fico à disposição para uma conversa.",
    "",
    "Atenciosamente,",
    signature || "Candidato(a)",
  ].join("\n");
}
