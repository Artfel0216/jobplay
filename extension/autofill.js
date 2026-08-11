/**
 * Junior Tech Jobs — Motor de autofill para formulários de candidatura.
 *
 * Analisa o currículo (texto ou perfil estruturado), identifica os campos de um
 * formulário de candidatura em qualquer portal (Gupy, Sólides, LinkedIn, Indeed,
 * GeekHunter, Programathor, etc.) e preenche de acordo com os dados do currículo.
 *
 * Roda como script de conteúdo da extensão e também é testável em Node (Node
 * expõe `module.exports` quando disponível).
 */
(function (global) {
  "use strict";

  // ---------------------------------------------------------------------------
  // Utilitários de texto
  // ---------------------------------------------------------------------------

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function regexFromAlias(alias) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i");
  }

  // Catálogo de habilidades (mesmo catálogo do app web).
  const SKILL_CATALOG = [
    ["TypeScript", ["typescript", "ts"]],
    ["JavaScript", ["javascript", "js", "ecmascript", "es6", "es8"]],
    ["React", ["react"]],
    ["React Native", ["react native"]],
    ["Next.js", ["next.js", "nextjs", "next js"]],
    ["Vue.js", ["vue", "vue.js", "vuejs", "nuxt"]],
    ["Angular", ["angular"]],
    ["Node.js", ["node.js", "nodejs", "node"]],
    ["SQL", ["sql", "postgres", "postgresql", "mysql", "sqlite", "banco de dados", "bancos relacionais", "relational databases"]],
    ["MongoDB", ["mongodb", "mongo"]],
    ["Redis", ["redis"]],
    ["Docker", ["docker"]],
    ["Kubernetes", ["kubernetes", "k8s"]],
    ["AWS", ["aws", "amazon web services"]],
    ["Azure", ["azure"]],
    ["Google Cloud", ["gcp", "google cloud"]],
    ["Python", ["python"]],
    ["Java", ["java"]],
    ["Spring", ["spring", "spring boot"]],
    ["C#", ["c#", "csharp"]],
    [".NET", [".net", "asp.net", "aspnet"]],
    ["C++", ["c++", "cpp"]],
    ["Go", ["golang", "go lang"]],
    ["Ruby", ["ruby", "rails", "ruby on rails"]],
    ["PHP", ["php", "laravel"]],
    ["HTML", ["html", "html5"]],
    ["CSS", ["css", "css3", "scss", "sass", "styled components"]],
    ["Tailwind CSS", ["tailwind", "tailwindcss"]],
    ["GraphQL", ["graphql"]],
    ["REST APIs", ["rest", "restful", "apis rest", "api rest", "integracao com apis"]],
    ["Git", ["git", "github", "gitlab", "bitbucket"]],
    ["CI/CD", ["ci/cd", "cicd", "continuous integration", "pipelines"]],
    ["Testing", ["testing", "testes", "jest", "vitest", "cypress", "testes unitarios", "tdd"]],
    ["Linux", ["linux", "unix"]],
    ["Microservices", ["microservices", "microsservicos"]],
    ["Automation", ["automation", "automacao", "rpa"]],
    ["Agile", ["agile", "scrum", "kanban", "metodologias ageis"]],
  ];

  const LANGUAGE_CATALOG = [
    ["Inglês", ["ingles", "english", "ingles avancado", "ingles intermediario", "ingles basico", "fluent english"]],
    ["Espanhol", ["espanhol", "spanish"]],
    ["Francês", ["frances", "french"]],
    ["Alemão", ["alemao", "german"]],
    ["Italiano", ["italiano", "italian"]],
  ];

  const EDUCATION_ALIASES = [
    "bacharel", "bacharelado", "licenciatura", "tecnologo", "engenharia",
    "analise e desenvolvimento", "ciencia da computacao", "sistemas de informacao",
    "ciencia de dados", "pos-graduacao", "especializacao", "mestrado", "doutorado",
    "tecnico em informatica", "tecnico em ti", "curso superior",
  ];

  const SECTION_HEADERS = [
    "curriculo", "resumo", "resumo profissional", "experiencia", "educacao",
    "formacao", "habilidades", "competencias", "contato", "objetivo", "idiomas",
    "endereco", "linkedin", "github", "cursos", "certificacoes",
  ];

  // ---------------------------------------------------------------------------
  // Parser de currículo (porta fiel do parser do app web)
  // ---------------------------------------------------------------------------

  function detectSkills(text) {
    const normalized = normalize(text);
    const found = [];
    for (const [label, aliases] of SKILL_CATALOG) {
      if (aliases.some((alias) => regexFromAlias(alias).test(normalized))) {
        found.push(label);
      }
    }
    return found;
  }

  function detectLanguages(text) {
    const found = LANGUAGE_CATALOG
      .filter(([, aliases]) => aliases.some((alias) => regexFromAlias(alias).test(normalize(text))))
      .map(([label]) => label);
    return Array.from(new Set(found));
  }

  function detectEducation(text) {
    const normalized = normalize(text);
    return EDUCATION_ALIASES.filter((alias) => normalized.includes(alias));
  }

  function inferYearsOfExperience(text) {
    const normalized = normalize(text);
    const patterns = [
      /(\d{1,2})\s*\+\s*(?:anos|years)(?:\s+de\s+(?:experiencia))?/,
      /(\d{1,2})\s*(?:anos|years)\s+(?:de\s+)?(?:experiencia|experience|trabalho)/,
      /(?:experiencia|experience)\s+(?:de\s+|\(|\s)*(\d{1,2})\s*(?:anos|years)/,
      /(?:atuando|trabalhando)\s+(?:ha|a)\s*(\d{1,2})\s*(?:anos|years)/,
    ];
    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      if (match && match[1]) {
        return Math.max(0, Number(match[1]));
      }
    }
    return 0;
  }

  function extractEmail(text) {
    const match = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
    return match ? match[0] : "";
  }

  function extractPhone(text) {
    const match = text.match(/(?:\+55\s?)?(?:\(\d{2}\)\s?|\d{2}\s?)?\d{4,5}[-.\s]?\d{4}/);
    return match ? match[0].trim() : "";
  }

  function extractName(text) {
    const lines = text
      .split(/\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 12);

    for (const line of lines) {
      const lower = normalize(line);
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

  function extractLocation(text) {
    const match = text.match(/([A-ZÀ-Ú][a-zà-ú]+(?:\s[A-ZÀ-Ú][a-zà-ú]+)*)\s*[-–—]\s*([A-Z]{2})/);
    if (match) {
      return { city: match[1], state: match[2] };
    }
    // Alguns currículos só citam a cidade sem o estado.
    const cityMatch = text.match(/^([A-ZÀ-Ú][a-zà-ú]+(?:\s[A-ZÀ-Ú][a-zà-ú]+)*)$/m);
    return cityMatch ? { city: cityMatch[1], state: "" } : { city: "", state: "" };
  }

  function extractUrl(text, pattern) {
    const match = text.match(pattern);
    return match ? match[0] : "";
  }

  function buildSummary(parsed) {
    const parts = [];
    if (parsed.yearsOfExperience > 0) {
      parts.push(`${parsed.yearsOfExperience}+ anos de experiência`);
    }
    if (parsed.skills.length > 0) {
      parts.push(`domínio em ${parsed.skills.slice(0, 5).join(", ")}`);
    }
    return parts.length > 0 ? `${parts.join(". ")}.` : "";
  }

  /**
   * Converte o texto de um currículo em dados estruturados.
   * Puro e testável.
   */
  function parseCvText(cvText) {
    const text = String(cvText || "");
    const skills = detectSkills(text);
    const yearsOfExperience = inferYearsOfExperience(text);
    const location = extractLocation(text);

    return {
      name: extractName(text),
      email: extractEmail(text),
      phone: extractPhone(text),
      city: location.city,
      state: location.state,
      linkedin: extractUrl(text, /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-z0-9-]+/i),
      github: extractUrl(text, /(?:https?:\/\/)?(?:www\.)?github\.com\/[a-z0-9-]+/i),
      portfolio: "",
      education: detectEducation(text),
      languages: detectLanguages(text),
      yearsOfExperience,
      skills,
      summary: buildSummary({ yearsOfExperience, skills }),
    };
  }

  // ---------------------------------------------------------------------------
  // Mapeamento de campos de formulário
  // ---------------------------------------------------------------------------

  const DEFAULT_PROFILE = {
    name: "",
    email: "",
    phone: "",
    city: "",
    state: "",
    country: "Brasil",
    linkedin: "",
    github: "",
    portfolio: "",
    education: [],
    yearsOfExperience: 0,
    skills: [],
    languages: [],
    summary: "",
    desiredSalary: "",
    cvText: "",
  };

  /**
   * Reúne o perfil salvo com os dados extraídos do currículo.
   * Campos preenchidos no perfil manual têm prioridade sobre o currículo.
   */
  function buildProfile(profile, cvText) {
    const parsed = parseCvText(cvText);
    const base = Object.assign({}, DEFAULT_PROFILE, profile || {});
    const join = (...parts) => parts.filter(Boolean).join(" ");

    return {
      ...base,
      name: base.name || parsed.name,
      firstName: base.firstName || (base.name || parsed.name).trim().split(/\s+/)[0] || "",
      lastName: base.lastName || (base.name || parsed.name).trim().split(/\s+/).slice(1).join(" ") || "",
      email: base.email || parsed.email,
      phone: base.phone || parsed.phone,
      city: base.city || parsed.city,
      state: (base.state || parsed.state).toUpperCase(),
      linkedin: base.linkedin || parsed.linkedin || "",
      github: base.github || parsed.github || "",
      portfolio: base.portfolio || parsed.portfolio || "",
      education: base.education && base.education.length ? base.education : parsed.education,
      yearsOfExperience: base.yearsOfExperience || parsed.yearsOfExperience,
      skills: base.skills && base.skills.length ? base.skills : parsed.skills,
      languages: base.languages && base.languages.length ? base.languages : parsed.languages,
      summary: base.summary || parsed.summary || join("Desenvolvedor(a)", base.name || parsed.name || "").trim(),
      fullProfile: join(base.name || parsed.name, base.city || parsed.city, (base.state || parsed.state).toUpperCase()).trim(),
    };
  }

  /**
   * Dado o "haystack" de um controle (label + placeholder + aria-label + name +
   * id + class + tipo), resolve para qual dado do perfil ele corresponde.
   * Puro e testável. Retorna "" quando não reconhecido.
   */
  function resolveFieldKey(haystack) {
    const h = normalize(haystack);
    if (!h) return "";

    const has = (...terms) => terms.some((term) => h.includes(normalize(term)));
    const word = (pattern) => pattern.test(h);

    // Sensíveis: nunca devem ser preenchidos a partir do currículo
    if (has("data de nascimento", "data nascimento", "birth date", "nascimento", "aniversario", "birthday")) return "";
    if (has("cpf", "documento", "passaporte")) return "";
    if (word(/\brg\b/i)) return "";
    if (has("genero", "sexo", "gender")) return "";
    if (has("pcd", "deficiencia", "deficiency")) return "";

    // Nome: sobrenome e primeiro nome antes do nome completo
    if (has("sobrenome", "ultimo nome", "last name", "surname", "apellido")) return "lastName";
    if (has("primeiro nome", "first name", "nombre", "given name")) return "firstName";
    if (has("nome completo", "full name", "fullname", "nome", "name")) return "name";

    // E-mail/telefone por tipo e atributo
    if (word(/e-?mail|correo|email/i) || h === "e-mail" || h === "email") return "email";
    if (has("whatsapp", "celular", "telefone", "phone", "telefono", "mobile", "contact", "contato")) return "phone";

    if (has("pretensao salarial", "salario desejado", "salary", "pretensao", "faixa salarial", "salario")) return "desiredSalary";

    if (has("linkedin")) return "linkedin";
    if (has("github")) return "github";
    if (has("portfolio", "portifolio", "website", "site pessoal", "url do perfil", "link do curriculo")) return "portfolio";

    if (has("escolaridade", "grau de instrucao", "nivel de escolaridade", "formacao academica", "formacao", "education", "grau")) return "education";
    if (has("anos de experiencia", "anos de experiência", "tempo de experiencia", "years of experience", "experiencia profissional", "experiencia")) return "yearsOfExperience";

    if (has("idiomas", "languages", "linguas", "nivel de ingles")) return "languages";
    if (has("habilidades", "competencias", "skills", "tecnologias", "stack", "conhecimentos")) return "skills";

    if (has("estado civil")) return "";
    if (has("estado", "uf")) return "state";
    if (has("cidade", "municipio", "city", "cidade natal")) return "city";
    if (has("pais", "país", "country", "nacionalidade")) return "country";

    if (has("carta de apresentacao", "cover letter", "mensagem", "apresentacao", "sobre voce", "sobre mim", "about", "resumo")) return "summary";

    return "";
  }

  // ---------------------------------------------------------------------------
  // Operações no DOM (somente navegador)
  // ---------------------------------------------------------------------------

  function isFillable(control) {
    const tag = control.tagName;
    const type = String(control.type || "").toLowerCase();
    if (control.disabled || control.readOnly) return false;
    if (type === "hidden" || control.offsetParent === null) return false;
    if (type === "password" || type === "search" || type === "submit" || type === "button" || type === "reset" || type === "file") return false;
    void tag;
    return true;
  }

  function gatherControlInfo(control, doc) {
    const own = [];
    const type = String(control.type || "").toLowerCase();

    if (control.name) own.push(control.name);
    if (control.id) own.push(control.id);
    if (control.placeholder) own.push(control.placeholder);
    if (control.getAttribute) {
      own.push(control.getAttribute("aria-label") || "");
      own.push(control.getAttribute("title") || "");
      own.push(control.getAttribute("data-testid") || "");
      own.push(control.getAttribute("data-test") || "");
      own.push(control.getAttribute("autocomplete") || "");
      own.push(control.getAttribute("class") || "");
      own.push(control.getAttribute("data-qa") || "");
    }
    own.push(type);

    const ownText = normalize(own.join(" "));

    // Rótulo associado por id ou label ancestral ajuda quando não há atributos próprios
    const extras = [];
    if (control.id && doc) {
      const label = doc.querySelector(`label[for="${CSS.escape(control.id)}"]`);
      if (label) extras.push(label.textContent);
    }
    if (control.closest && control.closest("label")) extras.push(control.closest("label").textContent);
    const ancestor = control.closest && control.closest("section, fieldset, form, div");
    if (ancestor && ancestor.textContent) {
      extras.push(ancestor.textContent.slice(0, 400));
    }

    return { own: ownText, full: ownText ? `${ownText} ${normalize(extras.join(" "))}`.trim() : normalize(extras.join(" ")) };
  }

  function setNativeValue(element, value) {
    const proto = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }
  }

  function fireInput(element) {
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function fillTextControl(control, value) {
    if (!value) return false;
    if (String(control.value || "").trim()) return false; // não sobrescrever dados já preenchidos
    setNativeValue(control, value);
    fireInput(control);
    return true;
  }

  function fillSelectControl(control, value) {
    if (!value) return false;
    if (String(control.value || "").trim()) return false;
    const options = Array.from(control.options || []);
    const opts = options.filter((opt) => opt.value || opt.textContent);
    if (opts.length === 0) return false;

    const target = (() => {
      const val = String(value).trim().toLowerCase();
      const norm = (text) => normalize(text).trim();

      // match exato por valor/estado
      const exact = opts.find((opt) => norm(opt.value) === val || norm(opt.textContent) === val);
      if (exact) return exact;

      // estados (ex.: "PE" vs "Pernambuco")
      const stateMap = {
        ac: "acre", al: "alagoas", ap: "amapa", am: "amazonas", ba: "bahia",
        ce: "ceara", df: "distrito federal", es: "espirito santo", go: "goias",
        ma: "maranhao", mt: "mato grosso", ms: "mato grosso do sul", mg: "minas gerais",
        pa: "para", pb: "paraiba", pr: "parana", pe: "pernambuco", pi: "piaui",
        rj: "rio de janeiro", rn: "rio grande do norte", rs: "rio grande do sul",
        ro: "rondonia", rr: "roraima", sc: "santa catarina", sp: "sao paulo",
        se: "sergipe", to: "tocantins",
      };
      const ufMatch = value.match(/\b([a-z]{2})\b/i);
      if (ufMatch) {
        const uf = ufMatch[1].toLowerCase();
        const stateName = stateMap[uf];
        if (stateName) {
          const byName = opts.find((opt) => norm(opt.textContent).includes(stateName));
          if (byName) return byName;
          const byVal = opts.find((opt) => norm(opt.value) === uf || norm(opt.value).includes(stateName));
          if (byVal) return byVal;
        }
      }

      // educação: superior, graduação, tecnólogo etc.
      if (/superior|graduacao|tecnologo|bacharel|licenciatura|engenharia/.test(normalize(value))) {
        const edu = opts.find((opt) => /superior|graduacao|tecnologo|bacharel|licenciatura|engenharia/.test(normalize(opt.textContent)));
        if (edu) return edu;
      }

      return null;
    })();

    if (!target) return false;
    setNativeValue(control, target.value);
    fireInput(control);
    return true;
  }

  function fillConsent(control) {
    const type = String(control.type || "").toLowerCase();
    if (type === "checkbox") {
      if (!control.checked) {
        control.click();
      }
      return true;
    }
    if (type === "radio") {
      const info = normalize(control.closest && control.closest("label")
        ? control.closest("label").textContent + " " + (control.getAttribute("aria-label") || "")
        : control.getAttribute("aria-label") || "");
      const negative = /(nao aceito|nao concordo|recuso|discordo|declino|opto por nao|no thanks|opt out)/i.test(info);
      const positive = /(sim|aceito|concordo|autorizo|ok|yes)/i.test(info);
      if (positive && !negative && !control.checked) {
        control.click();
      }
      return positive && !negative;
    }
    return false;
  }

  function isConsentControl(control) {
    const info = gatherControlInfo(control, null).full;
    return /(li e aceito|aceito os termos|termos de uso|politica de privacidade|lgpd|consentimento|autorizo a|declaro que|concordo|ciencia|estou ciente)/i.test(info);
  }

  function fillControl(control, doc, profile) {
    const tag = control.tagName;
    const type = String(control.type || "").toLowerCase();

    // consentimento primeiro (checkbox/radio)
    if ((tag === "INPUT" && (type === "checkbox" || type === "radio")) || tag === "BUTTON") {
      if (isConsentControl(control)) {
        return fillConsent(control) ? "consent" : "";
      }
      if (tag === "BUTTON") return "";
    }

    if (!isFillable(control)) return "";

    const info = gatherControlInfo(control, doc);
    let key = resolveFieldKey(info.own);
    if (!key && info.full !== info.own) {
      key = resolveFieldKey(info.full);
    }
    if (!key) return "";

    let value = profile[key] ?? "";

    if (Array.isArray(value)) {
      value = value.join(", ");
    }
    if (typeof value === "number") {
      value = value > 0 ? String(value) : "";
    }
    if (key === "state") {
      value = String(value).toUpperCase();
    }

    if (tag === "SELECT") {
      return fillSelectControl(control, value) ? key : "";
    }

    if (tag === "TEXTAREA" || tag === "INPUT") {
      if (type === "email") value = profile.email;
      if (type === "tel") value = profile.phone;
      if (type === "url") value = profile.portfolio || profile.linkedin || profile.github;
      return fillTextControl(control, String(value)) ? key : "";
    }

    return "";
  }

  /**
   * Localiza o input de anexo de currículo e tenta anexar o arquivo.
   * `file` deve ser um objeto { name, type, base64? | bytes? }.
   */
  function attachResume(doc, file) {
    if (!file || typeof doc === "undefined") return false;

    let bytes = file.bytes;
    if (file.base64 && !bytes) {
      const binary = atob(file.base64);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
    }
    if (!bytes) return false;

    const inputs = Array.from(doc.querySelectorAll('input[type="file"]'));
    const input = inputs.find((el) => {
      const info = gatherControlInfo(el, doc);
      return /curriculo|resume|cv|anexo|anexar|attachment|upload/i.test(info);
    }) || inputs[0];

    if (!input) return false;

    try {
      const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      const blob = new Blob([data], { type: file.type || "application/pdf" });
      const f = new File([blob], file.name || "curriculo.pdf", { type: file.type || "application/pdf" });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(f);
      input.files = dataTransfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Tenta clicar no botão de envio/continuação.
   */
  function trySubmit(doc) {
    const buttons = Array.from(doc.querySelectorAll("button, input[type='submit'], input[type='button']"));
    const candidate = buttons.find((button) => {
      const text = normalize(button.textContent || button.value || button.getAttribute("aria-label") || "");
      return /(enviar candidatura|enviar|submeter|candidatar|submit|apply|continuar|continue|next|avancar|proximo)/.test(text);
    });
    if (candidate) {
      candidate.click();
      return true;
    }
    return false;
  }

  /**
   * Preenche todos os campos mapeáveis do documento.
   * Retorna relatório { filled: {key: count}, consents, skipped, resumeAttached }.
   */
  function fillDocument(doc, profile, options) {
    const opts = options || {};
    const controls = Array.from((doc || document).querySelectorAll("input, textarea, select, button"));
    const filled = {};
    let consents = 0;
    let resumeAttached = false;

    for (const control of controls) {
      try {
        const key = fillControl(control, doc, profile);
        if (key === "consent") {
          consents += 1;
        } else if (key) {
          filled[key] = (filled[key] || 0) + 1;
        }
      } catch {
        // campos com comportamento atípico não devem quebrar o fluxo
      }
    }

    if (opts.resumeFile) {
      resumeAttached = attachResume(doc, opts.resumeFile);
    }

    if (opts.submit) {
      trySubmit(doc);
    }

    return { filled, consents, resumeAttached, total: Object.keys(filled).length + consents };
  }

  // ---------------------------------------------------------------------------
  // Exposição
  // ---------------------------------------------------------------------------

  const FormAutofill = {
    normalize,
    parseCvText,
    buildProfile,
    resolveFieldKey,
    fillDocument,
    attachResume,
    trySubmit,
    DEFAULT_PROFILE,
  };

  global.FormAutofill = FormAutofill;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = FormAutofill;
  }
})(typeof window !== "undefined" ? window : globalThis);
