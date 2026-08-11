# Junior Tech Jobs Extension

Esta extensão adiciona um painel rápido para acompanhar oportunidades de estágio e vagas júnior de TI e preenche formulários de candidatura automaticamente com os dados do seu currículo.

## Recursos
- Busca por palavra-chave e cidade
- Salvamento de vagas favoritas
- Notificações básicas
- **Agente em 2º plano**: o service worker procura novas vagas automaticamente (Sólides + Google) em intervalos configuráveis (30 min a 4 h) usando `chrome.alarms`, filtra pelas suas preferências e regras de localização, evita notificar vagas repetidas e abre a vaga ao clicar na notificação.
- **Candidatura automática**: com a opção **"Candidatar automaticamente"** marcada, o agente abre as novas vagas do Sólides e preenche+envia o formulário sozinho usando seus dados salvos. Requer o navegador aberto com a extensão ativa, perfil salvo e currículo anexado. Só aplica em vagas com link de candidatura direto (Sólides); vagas do Google são apenas notificadas. O deduplicador (`appliedJobKeys`) evita reenviar a mesma vaga.
- **Autofill inteligente**: ao aplicar em uma vaga, o agente detecta os campos do formulário (Gupy, Sólides, LinkedIn, Indeed, GeekHunter, Programathor, etc.) e preenche com os dados do seu currículo — nome, e-mail, telefone, cidade/UF, LinkedIn, GitHub, portfólio, formação, experiência, habilidades, idiomas, resumo e pretensão salarial.
- Anexo automático do currículo quando o formulário pede upload de arquivo
- Consentimentos LGPD marcados automaticamente quando presentes
- Opção de enviar o formulário automaticamente após o preenchimento

## Como usar o agente em 2º plano
1. Abra o popup e, na seção **"Agente em 2º plano"**, marque **"Procurar novas vagas automaticamente"**.
2. Escolha o intervalo (30 min, 1 h, 2 h ou 4 h).
3. Clique em **"Verificar agora"** para uma checagem imediata.
4. Quando novas vagas forem encontradas, você recebe uma notificação; clique nela para abrir a vaga. As vagas encontradas aparecem no topo do popup em **"Vagas encontradas em 2º plano"**.
5. As preferências (cargos preferidos, filtro estrito e regras de localização) valem tanto para o agente em 2º plano quanto para o autofill.

## Como usar o autofill
1. Abra o popup da extensão e expanda **"Meu perfil (dados de candidatura)"**.
2. Preencha seus dados manualmente **ou** anexe seu currículo (.txt, .md ou .pdf) em "Anexar currículo" — os campos do perfil são preenchidos a partir dele.
3. Clique em **"Salvar perfil"**.
4. Na página da vaga, clique em **"Preencher formulário nesta aba"**, ou use o **"Ativar agente IA"** para percorrer as vagas abertas automaticamente.
5. Se marcar **"Enviar formulário automaticamente"**, o formulário é enviado ao final do preenchimento.

## Principais plataformas de empregos de programação
- [Gupy](https://portal.gupy.io/job-search/term=desenvolvedor) — ATS usado por grandes empresas CLT
- [Sólides Vagas](https://vagas.solides.com.br/) — ATS popular no Brasil
- [LinkedIn Jobs](https://www.linkedin.com/jobs/)
- [Indeed](https://br.indeed.com/)
- [Glassdoor](https://www.glassdoor.com/Job/jobs.htm)
- [GeekHunter](https://www.geekhunter.com.br/vagas) — mercado tech
- [Programathor](https://programathor.com.br/) — especializado em devs
- [Catho](https://www.catho.com.br/)
- [InfoJobs](https://www.infojobs.com.br/)
- [Vagas.com](https://www.vagas.com.br/)
- [Remotar](https://remotar.com.br/) — foco em home office
- [Revelo](https://www.revelo.com.br/vagas)

## Instalação
1. Ative o modo desenvolvedor no navegador.
2. Carregue a pasta extension como extensão sem compactação.

## Notas
- O preenchimento acontece **apenas no seu navegador**; nenhum dado é enviado para servidores.
- Campos já preenchidos não são sobrescritos.
- Campos sensíveis (CPF, data de nascimento, documento) nunca são preenchidos automaticamente — preencha manualmente quando o formulário pedir.
- **Atenção**: candidatura automática em massa pode ser detectada pelos sites e levar ao bloqueio da sua conta (LinkedIn, Gupy, Indeed e outros proíbem automação). Use com moderação e revise as candidaturas. Formulários com CAPTCHA ou etapas extras (testes, vídeo) não são preenchidos.
