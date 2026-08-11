export interface JobSource {
  name: string;
  url: string;
  category:
    | "LinkedIn"
    | "Indeed"
    | "Glassdoor"
    | "Sólides"
    | "Gupy"
    | "GeekHunter"
    | "Programathor"
    | "Catho"
    | "InfoJobs"
    | "Vagas.com"
    | "Remotar"
    | "Revelo";
}

export const realJobSources: JobSource[] = [
  { name: "Gupy", url: "https://portal.gupy.io/job-search/term=desenvolvedor", category: "Gupy" },
  { name: "Sólides Vagas", url: "https://vagas.solides.com.br/", category: "Sólides" },
  { name: "LinkedIn Jobs", url: "https://www.linkedin.com/jobs/", category: "LinkedIn" },
  { name: "Indeed Jobs", url: "https://br.indeed.com/jobs?q=desenvolvedor", category: "Indeed" },
  { name: "Glassdoor Jobs", url: "https://www.glassdoor.com/Job/jobs.htm", category: "Glassdoor" },
  { name: "GeekHunter", url: "https://www.geekhunter.com.br/vagas", category: "GeekHunter" },
  { name: "Programathor", url: "https://programathor.com.br/", category: "Programathor" },
  { name: "Catho", url: "https://www.catho.com.br/vagas/tecnologia-da-informacao/", category: "Catho" },
  { name: "InfoJobs", url: "https://www.infojobs.com.br/", category: "InfoJobs" },
  { name: "Vagas.com", url: "https://www.vagas.com.br/", category: "Vagas.com" },
  { name: "Remotar", url: "https://remotar.com.br/", category: "Remotar" },
  { name: "Revelo", url: "https://www.revelo.com.br/vagas", category: "Revelo" },
];
