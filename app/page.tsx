"use client";

import { ChangeEvent, useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { getJuniorJobSuggestions, juniorJobs, type JobSuggestion } from "./lib/jobBoard";
import { APPLICATION_STATUSES, createApplicationRecord, exportApplicationsToCsv, getPipelineStats, isApplicationDuplicate, updateApplicationStatus, type ApplicationRecord, type ApplicationStatus } from "./lib/applicationWorkflow";
import { searchExternalJobs } from "./lib/jobApi";
import { searchSolidesJobs } from "./lib/solidesJobs";
import { realJobSources } from "./lib/realJobSources";
import { parseCv, type ParsedCv } from "./lib/cvParser";
import { evaluateJobMatch } from "./lib/jobMatch";
import { generateCoverLetter, type CoverLetterInput } from "./lib/coverLetter";
import { getAgentPreferences } from "./lib/agentPreferences";
import { analyzeCvForAts, optimizeCvForAts, type CvAnalysis, type CvOptimization } from "./lib/cvOptimizer";
import Reveal from "./components/Reveal";
import AnimatedNumber from "./components/AnimatedNumber";

interface AgentDecision {
  id: string;
  title: string;
  company: string;
  shouldApply: boolean;
  matchScore: number;
  reasons: string[];
  rejectReasons: string[];
  at: string;
}

const sampleCv = `
Tenho experiência com React, TypeScript, Node.js, SQL e desenvolvimento web. Já atuei em projetos com APIs, integração com bancos, testes e entrega de soluções em ambientes ágeis.
`;

const EMPTY_PROFILE = { name: "", email: "", phone: "", location: "", summary: "", technologies: "" };

const agentPreferences = getAgentPreferences();

function readStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const storedCache = new Map<string, unknown>();
const storedSubscribers = new Map<string, Set<() => void>>();

function readStoredCached<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }
  if (storedCache.has(key)) {
    return storedCache.get(key) as T;
  }
  const value = readStored(key, fallback);
  storedCache.set(key, value);
  return value;
}

function useStoredState<T>(key: string, fallback: T): [T, (value: T | ((current: T) => T)) => void] {
  const subscribe = useCallback(
    (callback: () => void) => {
      const set = storedSubscribers.get(key) ?? new Set<() => void>();
      set.add(callback);
      storedSubscribers.set(key, set);
      const onStorage = (event: StorageEvent) => {
        if (event.key === null || event.key === key) {
          storedCache.set(key, readStored(key, fallback));
          callback();
        }
      };
      window.addEventListener("storage", onStorage);
      return () => {
        set.delete(callback);
        window.removeEventListener("storage", onStorage);
      };
    },
    [key, fallback],
  );

  const value = useSyncExternalStore(subscribe, () => readStoredCached(key, fallback), () => fallback);

  const setValue = useCallback(
    (next: T | ((current: T) => T)) => {
      const resolved = typeof next === "function" ? (next as (current: T) => T)(readStoredCached(key, fallback)) : next;
      storedCache.set(key, resolved);
      window.localStorage.setItem(key, JSON.stringify(resolved));
      storedSubscribers.get(key)?.forEach((callback) => callback());
    },
    [key, fallback],
  );

  return [value, setValue];
}

export default function Home() {
  const [cvText, setCvText] = useState(sampleCv);
  const [selectedFileName, setSelectedFileName] = useState("currículo-exemplo.txt");
  const [cityFilter, setCityFilter] = useState("all");
  const [technologyFilter, setTechnologyFilter] = useState("all");
  const [keywordFilter, setKeywordFilter] = useState("");
  const [favoriteIds, setFavoriteIds] = useStoredState<string[]>("favoriteJobIds", []);
  const [appliedJobs, setAppliedJobs] = useStoredState<ApplicationRecord[]>("appliedJobs", []);
  const [externalResults, setExternalResults] = useState<Array<{ title: string; company: string; location: string; source: string; url: string; description: string; postedAt?: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [agentStatus, setAgentStatus] = useState("Pronto para processar vagas novas.");
  const [profile, setProfile] = useStoredState("userProfile", EMPTY_PROFILE);
  const [agentLog, setAgentLog] = useStoredState<AgentDecision[]>("agentDecisionLog", []);
  const [openLetterId, setOpenLetterId] = useState<string | null>(null);
  const [parsedCv, setParsedCv] = useState<ParsedCv | null>(null);
  const [cvAnalysis, setCvAnalysis] = useState<CvAnalysis | null>(null);
  const [cvOptimization, setCvOptimization] = useState<CvOptimization | null>(null);
  const [lastAgentRun, setLastAgentRun] = useState<{ at: string; count: number; titles: string[] } | null>(null);

  const jobs = useMemo(() => getJuniorJobSuggestions(cvText), [cvText]);

  const cities = useMemo(() => Array.from(new Set(juniorJobs.map((job) => job.location))).sort(), []);
  const technologies = useMemo(() => Array.from(new Set(juniorJobs.flatMap((job) => job.keywords))).sort(), []);

  const jobEvaluations = useMemo(() => {
    const map = new Map<string, ReturnType<typeof evaluateJobMatch>>();
    for (const job of jobs) {
      map.set(job.id, evaluateJobMatch(`${job.title} ${job.description} ${job.keywords.join(" ")} ${job.level}`, cvText));
    }
    return map;
  }, [cvText, jobs]);

  const scoredJobs = useMemo(() => jobs.map((job) => ({
    ...job,
    matchScore: jobEvaluations.get(job.id)?.matchScore ?? job.matchScore,
  })), [jobEvaluations, jobs]);

  const filteredJobs = useMemo(() => {
    return scoredJobs
      .filter((job) => {
        const matchesCity = cityFilter === "all" || job.location.toLowerCase() === cityFilter.toLowerCase();
        const matchesTechnology = technologyFilter === "all"
          || job.keywords.some((keyword) => keyword.toLowerCase() === technologyFilter.toLowerCase())
          || job.title.toLowerCase().includes(technologyFilter.toLowerCase())
          || job.description.toLowerCase().includes(technologyFilter.toLowerCase());
        const matchesKeyword = keywordFilter.trim() === ""
          || `${job.title} ${job.description} ${job.keywords.join(" ")}`.toLowerCase().includes(keywordFilter.toLowerCase());

        return matchesCity && matchesTechnology && matchesKeyword;
      })
      .sort((a, b) => b.matchScore - a.matchScore);
  }, [cityFilter, scoredJobs, keywordFilter, technologyFilter]);

  const favoriteJobs = useMemo(() => filteredJobs.filter((job) => favoriteIds.includes(job.id)), [favoriteIds, filteredJobs]);
  const topMatches = useMemo(() => [...filteredJobs].slice(0, 3), [filteredJobs]);
  const profileSnapshot = useMemo(() => {
    const technologies = profile.technologies.split(",").map((item) => item.trim()).filter(Boolean).join(", ");
    return [profile.summary, technologies, profile.location].filter(Boolean).join(" | ");
  }, [profile.location, profile.summary, profile.technologies]);

  const pipelineStats = useMemo(() => getPipelineStats(appliedJobs), [appliedJobs]);

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setSelectedFileName(file.name);
    const text = await file.text();
    setCvText(text);
    setParsedCv(null);
  };

  const handleAutoFillProfile = () => {
    const parsed = parseCv(cvText);
    setParsedCv(parsed);
    setProfile((current) => ({
      name: current.name || parsed.name,
      email: current.email || parsed.email,
      phone: current.phone || parsed.phone,
      location: current.location || parsed.location,
      technologies: current.technologies || parsed.skills.join(", "),
      summary: current.summary || parsed.summary,
    }));
    setAgentStatus("Perfil preenchido automaticamente a partir do currículo.");
  };

  const cvKeywords = () => profile.technologies.split(",").map((item) => item.trim()).filter(Boolean);

  const handleAnalyzeCv = () => {
    const analysis = analyzeCvForAts(cvText, cvKeywords());
    setCvAnalysis(analysis);
    setAgentStatus(analysis.verdict === "pronto"
      ? `Currículo analisado: ${analysis.overallScore}% — pronto para robôs de triagem.`
      : `Currículo analisado: ${analysis.overallScore}% — ${analysis.improvements.length} melhoria(s) sugerida(s).`);
  };

  const handleOptimizeCv = () => {
    const analysis = analyzeCvForAts(cvText, cvKeywords());
    setCvAnalysis(analysis);
    setCvOptimization(optimizeCvForAts(cvText, cvKeywords()));
    setAgentStatus(`Currículo otimizado: ${analysis.overallScore}% para ${analysis.improvements.length > 0 ? `${analysis.improvements.length} melhoria(s) pendente(s)` : "robôs de triagem"}.`);
  };

  const handleStatusChange = (uniqueKey: string, status: ApplicationStatus) => {
    setAppliedJobs((current) => updateApplicationStatus(current, uniqueKey, status));
    setAgentStatus(`Status da candidatura atualizado para "${status}".`);
  };

  const buildCoverLetter = (job: JobSuggestion): string => {
    const evaluation = jobEvaluations.get(job.id);
    const input: CoverLetterInput = {
      jobTitle: job.title,
      company: job.company,
      location: job.location,
      jobDescription: job.description,
      cvText,
      profileName: profile.name,
      profileEmail: profile.email,
      profilePhone: profile.phone,
      matchedSkills: evaluation?.keySkillsMatched ?? job.matchedKeywords,
      skillGaps: evaluation?.skillGaps ?? [],
      matchScore: job.matchScore,
    };
    return generateCoverLetter(input);
  };

  const toggleCoverLetter = (jobId: string) => {
    setOpenLetterId((current) => current === jobId ? null : jobId);
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setAgentStatus("Texto copiado para a área de transferência.");
  };

  const downloadText = (filename: string, text: string) => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const recordAgentDecision = (job: JobSuggestion) => {
    const evaluation = evaluateJobMatch(`${job.title} ${job.description} ${job.keywords.join(" ")} ${job.level}`, cvText);
    setAgentLog((current) => [
      {
        id: job.id,
        title: job.title,
        company: job.company,
        shouldApply: evaluation.shouldApply,
        matchScore: evaluation.matchScore,
        reasons: evaluation.reasons,
        rejectReasons: evaluation.rejectReasons,
        at: new Date().toISOString(),
      },
      ...current,
    ].slice(0, 50));
  };

  const toggleFavorite = (jobId: string) => {
    setFavoriteIds((current) => current.includes(jobId) ? current.filter((id) => id !== jobId) : [...current, jobId]);
  };

  const markAsApplied = (job: (typeof jobs)[number]) => {
    const record = createApplicationRecord(job, profileSnapshot);
    setAppliedJobs((current) => current.some((item) => item.uniqueKey === record.uniqueKey || item.id === record.id) ? current : [...current, record]);
    recordAgentDecision(job);
    setAgentStatus(`Vaga enviada para o agente: ${job.title}`);
  };

  const sendAgentNotification = (count: number, titles: string[]) => {
    if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") {
      return;
    }
    try {
      new Notification("Agente de vagas · Junior Tech Jobs", {
        body: `${count} vaga(s) registrada(s): ${titles.slice(0, 3).join(", ")}${titles.length > 3 ? "…" : ""}`,
      });
    } catch {
      // notificações indisponíveis no ambiente
    }
  };

  const runAutonomousAgent = () => {
    const pendingJobs = filteredJobs
      .filter((job) => !isApplicationDuplicate(appliedJobs, job))
      .filter((job) => jobEvaluations.get(job.id)?.shouldApply !== false);

    const titles = pendingJobs.map((job) => job.title);
    setLastAgentRun({ at: new Date().toISOString(), count: pendingJobs.length, titles });

    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    if (pendingJobs.length === 0) {
      setAgentStatus("Nenhuma vaga nova compatível — todas as vagas já foram enviadas ou reprovadas pela avaliação.");
      return;
    }

    pendingJobs.forEach(recordAgentDecision);
    const records = pendingJobs.map((job) => createApplicationRecord(job, profileSnapshot));
    setAppliedJobs((current) => {
      const existingKeys = new Set(current.map((item) => item.uniqueKey));
      const newRecords = records.filter((record) => !existingKeys.has(record.uniqueKey));
      return [...current, ...newRecords];
    });
    sendAgentNotification(pendingJobs.length, titles);
    setAgentStatus(`${pendingJobs.length} vaga(s) nova(s) processada(s). Vagas já enviadas foram ignoradas automaticamente.`);
  };

  const exportCsv = () => {
    const blob = new Blob([exportApplicationsToCsv(appliedJobs)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "candidaturas.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const openJobSource = (job: (typeof jobs)[number]) => {
    const query = encodeURIComponent(`${job.title} ${job.company}`);
    const sourceUrl = job.source === "LinkedIn"
      ? `https://www.linkedin.com/jobs/search/?keywords=${query}`
      : job.source === "Indeed"
        ? `https://br.indeed.com/jobs?q=${query}`
        : job.source === "Glassdoor"
          ? `https://www.glassdoor.com/Job/jobs.htm?suggestCount=0&suggestChosen=false&clickSource=searchBtn&typedKeyword=${query}`
          : `https://jobs.github.com/positions?search=${query}`;

    if (typeof window !== "undefined") {
      window.location.assign(sourceUrl);
    }
  };

  const searchExternal = async () => {
    setIsSearching(true);
    const query = keywordFilter.trim() || "estágio desenvolvedor junior";
    const results = await searchExternalJobs(query);
    setExternalResults(results);
    setIsSearching(false);
  };

  const searchSolides = async () => {
    setIsSearching(true);
    const query = keywordFilter.trim() || "estágio";
    const results = await searchSolidesJobs(query);
    setExternalResults(results);
    setIsSearching(false);
  };

  return (
    <main className="relative min-h-screen px-6 py-10 text-zinc-100">
      <div className="aurora-layer" aria-hidden="true">
        <div className="aurora aurora-1" />
        <div className="aurora aurora-2" />
        <div className="aurora aurora-3" />
      </div>
      <div className="bg-grid" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-8">
        <Reveal>
          <header className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm uppercase tracking-[0.3em] text-zinc-400">
                <span className="text-gradient font-semibold">Junior Tech Jobs</span>
              </p>
              <span className="pill inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Agente online
              </span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Vagas de estágio e nível{" "}
              <span className="text-gradient">júnior em TI</span>
            </h1>
            <p className="max-w-3xl text-lg text-zinc-400">
              Anexe seu currículo, busque por palavras-chave, priorize estágios e vagas júnior, e acompanhe candidaturas com um dashboard simples.
            </p>
          </header>
        </Reveal>

        <Reveal delay={80}>
          <section className="glass card-hover shine-wrap rounded-2xl border border-white/10 p-6">
            <label className="flex flex-col gap-3">
              <span className="text-sm font-medium text-zinc-300">Anexar currículo</span>
              <div className="flex flex-wrap items-center gap-3">
                <label className="btn-ghost cursor-pointer rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2.5 text-sm font-medium text-sky-300 hover:bg-sky-500/20">
                  <input type="file" accept=".txt,.md,.pdf" onChange={handleFileUpload} className="hidden" />
                  Escolher arquivo
                </label>
                <span className="text-sm text-zinc-400">Arquivo selecionado: <span className="font-medium text-zinc-200">{selectedFileName}</span></span>
              </div>
            </label>

            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Resumo do currículo</h2>
                <button onClick={handleAutoFillProfile} className="btn-primary rounded-full px-4 py-1.5 text-sm font-medium text-white">
                  Preencher perfil automaticamente
                </button>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm leading-7 text-zinc-300">{cvText}</p>
            {parsedCv ? (
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
                {parsedCv.name ? <span className="pill rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sky-200">Nome: {parsedCv.name}</span> : null}
                {parsedCv.email ? <span className="pill rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sky-200">E-mail: {parsedCv.email}</span> : null}
                {parsedCv.phone ? <span className="pill rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sky-200">Telefone: {parsedCv.phone}</span> : null}
                {parsedCv.location ? <span className="pill rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sky-200">Cidade: {parsedCv.location}</span> : null}
                <span className="pill rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-200">Skills: {parsedCv.skills.length > 0 ? parsedCv.skills.join(", ") : "nenhuma detectada"}</span>
                <span className="pill rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-violet-200">Anos de experiência: {parsedCv.yearsOfExperience}</span>
                {parsedCv.languages.length > 0 ? <span className="pill rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-amber-200">Idiomas: {parsedCv.languages.join(", ")}</span> : null}
                {parsedCv.education.length > 0 ? <span className="pill rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-amber-200">Formação: {parsedCv.education.join(", ")}</span> : null}
              </div>
            ) : null}
          </div>
        </section>
        </Reveal>

        <Reveal delay={120}>
        <section className="glass card-hover shine-wrap rounded-2xl border border-white/10 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Análise de currículo para robôs (ATS)</h2>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleAnalyzeCv} className="btn-ghost rounded-full bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-300 hover:bg-sky-500/20">
                Analisar currículo
              </button>
              <button onClick={handleOptimizeCv} className="btn-ghost rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20">
                Otimizar currículo com IA
              </button>
            </div>
          </div>

          <p className="mt-2 text-sm text-zinc-400">
            O motor avalia se o currículo passa pelos robôs de triagem (Gupy, Indeed, LinkedIn), detecta pontos fracos e reescreve o texto com linguagem de impacto. Tudo local — nenhum dado sai do seu navegador.
          </p>

          {cvAnalysis ? (
            <div className="mt-4 space-y-4">
              <div className="pop-in flex flex-wrap items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                <div className={`flex h-20 w-20 items-center justify-center rounded-full border-4 ${cvAnalysis.verdict === "pronto" ? "border-emerald-500 text-emerald-300" : cvAnalysis.verdict === "ajustar" ? "border-amber-500 text-amber-300" : "border-red-500 text-red-300"}`}>
                  <AnimatedNumber value={cvAnalysis.overallScore} suffix="%" className="text-xl font-semibold" />
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${cvAnalysis.verdict === "pronto" ? "text-emerald-300" : cvAnalysis.verdict === "ajustar" ? "text-amber-300" : "text-red-300"}`}>
                    {cvAnalysis.verdictLabel}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">{cvAnalysis.wordCount} palavras</p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {cvAnalysis.checks.map((check) => (
                  <div key={check.id} className="card-hover flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm">
                    <span className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${check.passed ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>{check.passed ? "✓" : "✗"}</span>
                    <div>
                      <p className="text-zinc-200">{check.label}</p>
                      <p className="text-xs text-zinc-500">{check.detail}</p>
                    </div>
                  </div>
                ))}
              </div>

              {cvAnalysis.improvements.length > 0 ? (
                <div className="pop-in rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                  <h3 className="text-sm font-semibold text-amber-300">Melhorias recomendadas</h3>
                  <ul className="mt-2 space-y-1 text-sm text-zinc-300">
                    {cvAnalysis.improvements.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="text-amber-400">→</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {cvOptimization ? (
            <div className="pop-in mt-4 rounded-xl border border-emerald-500/30 bg-zinc-950/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-emerald-300">Currículo otimizado</h3>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => copyText(cvOptimization.text)} className="btn-ghost rounded-full bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700">
                    Copiar
                  </button>
                  <button onClick={() => downloadText("curriculo-otimizado.txt", cvOptimization.text)} className="btn-ghost rounded-full bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700">
                    Baixar .txt
                  </button>
                </div>
              </div>
              {cvOptimization.changes.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-zinc-400">
                  {cvOptimization.changes.map((change) => (
                    <li key={change} className="flex gap-2">
                      <span className="text-emerald-400">+</span>
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <pre className="mt-3 whitespace-pre-line font-sans text-sm leading-7 text-zinc-300">{cvOptimization.text}</pre>
            </div>
          ) : null}
        </section>
        </Reveal>

        <Reveal delay={140}>
        <section className="glass card-hover shine-wrap rounded-2xl border border-white/10 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Base de conhecimento do agente</h2>
            <button onClick={runAutonomousAgent} className="btn-primary rounded-full px-4 py-2 text-sm font-medium text-white">
              Executar agente automático
            </button>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm text-zinc-300">
              <span>Nome</span>
              <input value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} placeholder="Seu nome" className="input-glass px-3 py-2" />
            </label>
            <label className="flex flex-col gap-2 text-sm text-zinc-300">
              <span>E-mail</span>
              <input value={profile.email} onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))} placeholder="voce@email.com" className="input-glass px-3 py-2" />
            </label>
            <label className="flex flex-col gap-2 text-sm text-zinc-300">
              <span>Telefone</span>
              <input value={profile.phone} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} placeholder="+55 11 99999-9999" className="input-glass px-3 py-2" />
            </label>
            <label className="flex flex-col gap-2 text-sm text-zinc-300">
              <span>Cidade</span>
              <input value={profile.location} onChange={(event) => setProfile((current) => ({ ...current, location: event.target.value }))} placeholder="São Paulo" className="input-glass px-3 py-2" />
            </label>
          </div>

          <label className="mt-4 flex flex-col gap-2 text-sm text-zinc-300">
            <span>Resumo profissional</span>
            <textarea value={profile.summary} onChange={(event) => setProfile((current) => ({ ...current, summary: event.target.value }))} placeholder="Descreva seu objetivo, formação e experiências" className="input-glass min-h-24 px-3 py-2" />
          </label>

          <label className="mt-4 flex flex-col gap-2 text-sm text-zinc-300">
            <span>Tecnologias preferidas</span>
            <input value={profile.technologies} onChange={(event) => setProfile((current) => ({ ...current, technologies: event.target.value }))} placeholder="React, Node.js, SQL" className="input-glass px-3 py-2" />
          </label>

          <p key={agentStatus} className="pop-in mt-4 flex items-center gap-2 text-sm text-zinc-400">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
            <span>{agentStatus}</span>
          </p>
          {agentPreferences.strict_filtering ? (
            <span className="pill mt-2 inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
              Foco ativo: apenas vagas de TI para júnior, estágio, trainee e aprendiz
            </span>
          ) : null}

          {lastAgentRun ? (
            <div className="pop-in card-hover mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
                  <span className="pulse-dot h-2 w-2 rounded-full bg-emerald-400" />
                  Última execução do agente
                </h3>
                <span className="text-xs text-zinc-500">{new Date(lastAgentRun.at).toLocaleString("pt-BR")}</span>
              </div>
              <p className="mt-1 text-sm text-zinc-300">
                {lastAgentRun.count > 0
                  ? `${lastAgentRun.count} vaga(s) registrada(s) no dashboard.`
                  : "Nenhuma vaga nova: tudo que estava compatível já foi enviado anteriormente."}
              </p>
              {lastAgentRun.titles.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-zinc-400">
                  {lastAgentRun.titles.map((title) => (
                    <li key={title} className="flex gap-2">
                      <span className="text-emerald-400">✓</span>
                      <span>{title}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-3 text-xs text-zinc-500">
                As vagas foram registradas na seção Candidaturas enviadas (dados locais do navegador). Para receber aviso no navegador, aceite as notificações quando o Chrome pedir. Notificação por e-mail ainda não está configurada.
              </p>
            </div>
          ) : null}
        </section>
        </Reveal>

        <Reveal delay={160}>
        <section className="glass card-hover shine-wrap rounded-2xl border border-white/10 p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm text-zinc-300">
              <span>Palavra-chave</span>
              <input value={keywordFilter} onChange={(event) => setKeywordFilter(event.target.value)} placeholder="React, Java, estágio..." className="input-glass px-3 py-2" />
            </label>

            <label className="flex flex-col gap-2 text-sm text-zinc-300">
              <span>Cidade</span>
              <select value={cityFilter} onChange={(event) => setCityFilter(event.target.value)} className="input-glass px-3 py-2">
                <option value="all">Todas as cidades</option>
                {cities.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm text-zinc-300">
              <span>Tecnologia</span>
              <select value={technologyFilter} onChange={(event) => setTechnologyFilter(event.target.value)} className="input-glass px-3 py-2">
                <option value="all">Todas as tecnologias</option>
                {technologies.map((technology) => (
                  <option key={technology} value={technology}>{technology}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={searchExternal} className="btn-ghost rounded-full bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-300 hover:bg-sky-500/20">
              {isSearching ? (
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-sky-300 border-t-transparent" />
                  Buscando...
                </span>
              ) : "Buscar vagas externas"}
            </button>
            <button onClick={searchSolides} className="btn-ghost rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20">
              {isSearching ? (
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-300 border-t-transparent" />
                  Buscando...
                </span>
              ) : "Buscar na Sólides"}
            </button>
            <span className="self-center text-sm text-zinc-500">A busca na Sólides usa a API pública real do portal.</span>
          </div>
        </section>
        </Reveal>

        <Reveal delay={180}>
        <section className="glass card-hover shine-wrap rounded-2xl border border-white/10 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Fontes reais</h2>
            <div className="flex flex-wrap gap-2">
              {realJobSources.map((source) => (
                <a key={source.name} href={source.url} target="_blank" rel="noopener noreferrer" className="pill rounded-full border border-zinc-700 bg-zinc-950/70 px-3 py-1 text-sm text-zinc-300 hover:border-sky-500/40 hover:text-sky-300">
                  {source.name}
                </a>
              ))}
            </div>
          </div>
        </section>
        </Reveal>

        <Reveal delay={200}>
        <section className="glass card-hover shine-wrap rounded-2xl border border-white/10 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Dashboard de status</h2>
            <button onClick={exportCsv} className="btn-ghost rounded-full bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20">
              Exportar candidaturas CSV
            </button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="card-hover rounded-xl border border-sky-500/20 bg-gradient-to-br from-sky-500/10 to-transparent p-4">
              <p className="text-sm text-zinc-400">Candidaturas enviadas</p>
              <p className="mt-2 text-3xl font-bold text-sky-300"><AnimatedNumber value={appliedJobs.length} /></p>
            </div>
            <div className="card-hover rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-transparent p-4">
              <p className="text-sm text-zinc-400">Favoritas</p>
              <p className="mt-2 text-3xl font-bold text-amber-300"><AnimatedNumber value={favoriteJobs.length} /></p>
            </div>
            <div className="card-hover rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent p-4">
              <p className="text-sm text-zinc-400">Top compatibilidade</p>
              <p className="mt-2 text-3xl font-bold text-emerald-300"><AnimatedNumber value={topMatches[0]?.matchScore ?? 0} suffix="%" /></p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3 md:grid-cols-5">
            <div className="card-hover rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="text-xs text-zinc-500">Em análise</p>
              <p className="mt-1 text-xl font-semibold text-sky-300"><AnimatedNumber value={pipelineStats.review} /></p>
            </div>
            <div className="card-hover rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="text-xs text-zinc-500">Entrevista</p>
              <p className="mt-1 text-xl font-semibold text-violet-300"><AnimatedNumber value={pipelineStats.interview} /></p>
            </div>
            <div className="card-hover rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="text-xs text-zinc-500">Aprovadas</p>
              <p className="mt-1 text-xl font-semibold text-emerald-300"><AnimatedNumber value={pipelineStats.hired} /></p>
            </div>
            <div className="card-hover rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="text-xs text-zinc-500">Rejeitadas</p>
              <p className="mt-1 text-xl font-semibold text-red-300"><AnimatedNumber value={pipelineStats.rejected} /></p>
            </div>
            <div className="card-hover rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="text-xs text-zinc-500">Pendentes</p>
              <p className="mt-1 text-xl font-semibold text-amber-300"><AnimatedNumber value={pipelineStats.sent} /></p>
            </div>
          </div>
        </section>
        </Reveal>

        {appliedJobs.length > 0 ? (
          <Reveal as="section" className="space-y-4">
            <h2 className="text-xl font-semibold">Candidaturas enviadas</h2>
            {appliedJobs.map((job, index) => (
              <article key={job.id} className="card-hover glass shine-wrap rounded-2xl border border-white/10 p-5" style={{ animationDelay: `${index * 40}ms` }}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">{job.title}</h3>
                    <p className="mt-1 text-sm text-zinc-400">{job.company} • {job.location}</p>
                    <p className="mt-1 text-xs text-zinc-500">Enviada em {new Date(job.appliedAt).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="pill rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-300">{job.matchScore}%</span>
                    <select
                      value={job.status}
                      onChange={(event) => handleStatusChange(job.uniqueKey, event.target.value as ApplicationStatus)}
                      className="input-glass px-3 py-1.5 text-sm"
                    >
                      {APPLICATION_STATUSES.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </article>
            ))}
          </Reveal>
        ) : null}

        {agentLog.length > 0 ? (
          <Reveal as="section" className="space-y-4">
            <h2 className="text-xl font-semibold">Decisões do agente</h2>
            {agentLog.map((decision) => (
              <article key={`${decision.id}-${decision.at}`} className={`card-hover glass rounded-2xl border p-5 ${decision.shouldApply ? "border-emerald-500/40" : "border-red-500/40"}`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">{decision.title}</h3>
                    <p className="mt-1 text-sm text-zinc-400">{decision.company} • {new Date(decision.at).toLocaleString("pt-BR")}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`pill rounded-full px-3 py-1 text-sm font-medium ${decision.shouldApply ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border border-red-500/30 bg-red-500/10 text-red-300"}`}>
                      {decision.shouldApply ? "Aplicar" : "Não aplicar"}
                    </span>
                    <span className="pill rounded-full bg-zinc-800/80 px-3 py-1 text-sm text-zinc-300">{decision.matchScore}%</span>
                  </div>
                </div>
                <ul className="mt-3 space-y-1 text-sm text-zinc-300">
                  {decision.reasons.map((reason) => (
                    <li key={reason} className="flex gap-2">
                      <span className="text-emerald-400">+</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                  {decision.rejectReasons.map((reason) => (
                    <li key={reason} className="flex gap-2">
                      <span className="text-red-400">−</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </Reveal>
        ) : null}

        {favoriteJobs.length > 0 ? (
          <Reveal as="section" className="space-y-4">
            <h2 className="text-xl font-semibold">Vagas favoritas</h2>
            {favoriteJobs.map((job) => (
              <article key={job.id} className="card-hover glass shine-wrap rounded-2xl border border-amber-500/30 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">{job.title}</h3>
                    <p className="mt-1 text-sm text-zinc-400">{job.company} • {job.location}</p>
                  </div>
                  <button onClick={() => toggleFavorite(job.id)} className="btn-ghost rounded-full bg-amber-500/10 px-3 py-1 text-sm text-amber-300 hover:bg-amber-500/20">
                    Remover favorito
                  </button>
                </div>
              </article>
            ))}
          </Reveal>
        ) : null}

        {externalResults.length > 0 ? (
          <Reveal as="section" className="space-y-4">
            <h2 className="text-xl font-semibold">Resultados externos</h2>
            {externalResults.map((result, index) => (
              <article key={`${result.url}-${index}`} className="card-hover glass shine-wrap rounded-2xl border border-white/10 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">{result.title}</h3>
                    <p className="mt-1 text-sm text-zinc-400">{result.company} • {result.location}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="pill rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sm text-sky-300">{result.source}</span>
                    {"postedAt" in result && result.postedAt ? (
                      <span className="pill rounded-full bg-zinc-800/80 px-3 py-1 text-sm text-zinc-400">Publicada em {new Date(result.postedAt).toLocaleDateString("pt-BR")}</span>
                    ) : null}
                  </div>
                </div>
                <p className="mt-3 text-sm leading-7 text-zinc-300">{result.description}</p>
                <a href={result.url} target="_blank" rel="noopener noreferrer" className="btn-ghost mt-3 inline-block rounded-full bg-sky-500/10 px-4 py-2 text-sm text-sky-300 hover:bg-sky-500/20">
                  Abrir resultado
                </a>
              </article>
            ))}
          </Reveal>
        ) : null}

        <Reveal as="section" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Vagas sugeridas</h2>
            <span className="pill rounded-full bg-zinc-800/80 px-3 py-1 text-sm text-zinc-400">{filteredJobs.length} oportunidades únicas</span>
          </div>

          {filteredJobs.map((job, index) => {
            const isFavorite = favoriteIds.includes(job.id);
            const isTopMatch = topMatches.some((item) => item.id === job.id);
            return (
              <article key={job.id} className={`card-hover glass shine-wrap rounded-2xl border p-5 ${isTopMatch ? "border-amber-500/40" : "border-white/10"}`} style={{ animationDelay: `${index * 30}ms` }}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">{job.title}</h3>
                    <p className="mt-1 text-sm text-zinc-400">{job.company} • {job.location}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {job.isNew ? <span className="pill rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-300">Nova</span> : null}
                    {job.isReal ? <span className="pill rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sm font-medium text-sky-300">Vaga real</span> : null}
                    {isTopMatch ? <span className="pill rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-300">Alta compatibilidade</span> : null}
                  </div>
                </div>

                <p className="mt-3 text-sm leading-7 text-zinc-300">{job.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {job.matchedKeywords.map((keyword) => (
                    <span key={keyword} className="pill rounded-full border border-zinc-700 bg-zinc-950/70 px-3 py-1 text-sm text-zinc-300">
                      {keyword}
                    </span>
                  ))}
                </div>
                {jobEvaluations.get(job.id)?.skillGaps.length ? (
                  <p className="mt-3 text-xs text-amber-400/80">
                    Skills em falta para a vaga: {jobEvaluations.get(job.id)?.skillGaps.join(", ")}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-zinc-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                    Match: <strong className="font-semibold text-sky-300">{job.matchScore}%</strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                    Nível: {job.level}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Fonte: {job.source}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button onClick={() => toggleFavorite(job.id)} className={`btn-ghost rounded-full px-3 py-2 text-sm ${isFavorite ? "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25" : "bg-zinc-800/80 text-zinc-200 hover:bg-zinc-700/80"}`}>
                    {isFavorite ? "★ Favorita" : "☆ Salvar vaga"}
                  </button>
                  <button onClick={() => markAsApplied(job)} className="btn-primary rounded-full px-3 py-2 text-sm font-medium text-white">
                    Agente IA
                  </button>
                  <button onClick={() => openJobSource(job)} className="btn-ghost rounded-full bg-sky-500/10 px-3 py-2 text-sm text-sky-300 hover:bg-sky-500/20">
                    Abrir na fonte
                  </button>
                  <button onClick={() => toggleCoverLetter(job.id)} className="btn-ghost rounded-full bg-zinc-800/80 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700/80">
                    {openLetterId === job.id ? "Fechar carta" : "Carta de apresentação"}
                  </button>
                </div>

                {openLetterId === job.id ? (
                  <div className="pop-in mt-4 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold text-zinc-200">Carta de apresentação</h4>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => copyText(buildCoverLetter(job))} className="btn-ghost rounded-full bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700">
                          Copiar
                        </button>
                        <button onClick={() => downloadText(`carta-${job.company}.txt`, buildCoverLetter(job))} className="btn-ghost rounded-full bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700">
                          Baixar
                        </button>
                      </div>
                    </div>
                    <pre className="mt-3 whitespace-pre-line font-sans text-sm leading-7 text-zinc-300">{buildCoverLetter(job)}</pre>
                  </div>
                ) : null}
              </article>
            );
          })}
        </Reveal>
      </div>
    </main>
  );
}
