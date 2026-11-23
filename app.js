/* Nexus Dev Lab — aplicação demonstrativa sem servidor.
   O conteúdo é criado dinamicamente e os dados editados são salvos no navegador. */
(() => {
  "use strict";

  const STORAGE_KEY = "nexus-dev-lab:workspace:v2";
  const THEME_KEY = "nexus-dev-lab:theme";
  const MAX_PROJECTS = 200;
  const STATUS_LABELS = { ideia: "Ideia", andamento: "Em andamento", concluido: "Concluído" };
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const today = () => new Date().toISOString();

  function readStorage(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function writeStorage(key, value) {
    try { localStorage.setItem(key, value); return true; } catch { return false; }
  }
  function normalizeText(value, max) {
    return typeof value === "string" ? value.trim().slice(0, max) : "";
  }
  function colorValue(value) {
    return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : "#b6f675";
  }
  function safeUrl(value) {
    if (!value) return "";
    try {
      const parsed = new URL(String(value));
      return ["https:", "http:"].includes(parsed.protocol) ? parsed.toString() : "";
    } catch { return ""; }
  }
  function normalizeProject(raw, fallbackDate) {
    if (!raw || typeof raw !== "object") return null;
    const name = normalizeText(raw.name, 60);
    const description = normalizeText(raw.description, 350);
    const category = normalizeText(raw.category, 40);
    if (name.length < 2 || description.length < 8 || category.length < 2) return null;
    const date = typeof raw.updatedAt === "string" && Number.isFinite(Date.parse(raw.updatedAt))
      ? raw.updatedAt : fallbackDate;
    return {
      id: normalizeText(raw.id, 100) || newId(),
      name, description, category,
      status: Object.hasOwn(STATUS_LABELS, raw.status) ? raw.status : "ideia",
      color: colorValue(raw.color),
      url: safeUrl(raw.url),
      favorite: raw.favorite === true,
      createdAt: typeof raw.createdAt === "string" && Number.isFinite(Date.parse(raw.createdAt)) ? raw.createdAt : date,
      updatedAt: date
    };
  }
  function newId() {
    if (globalThis.crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return "projeto-" + Date.now() + "-" + Math.random().toString(36).slice(2, 11);
  }
  function seededProjects() {
    const stamp = today();
    const samples = Array.isArray(window.NEXUS_DEFAULT_PROJECTS) ? window.NEXUS_DEFAULT_PROJECTS : [];
    return samples.map(item => normalizeProject(item, stamp)).filter(Boolean);
  }
  function validateImport(raw) {
    const source = Array.isArray(raw) ? { projects: raw, notes: "" } : raw;
    if (!source || !Array.isArray(source.projects) || source.projects.length > MAX_PROJECTS ||
        (source.notes !== undefined && typeof source.notes !== "string")) {
      throw new Error("O arquivo não contém uma lista válida de projetos.");
    }
    const stamp = today();
    const projects = source.projects.map(item => normalizeProject(item, stamp));
    if (projects.some(item => !item)) throw new Error("Existem projetos com nome, categoria ou descrição inválidos.");
    const ids = new Set();
    for (const project of projects) {
      if (ids.has(project.id)) project.id = newId();
      ids.add(project.id);
    }
    return { projects, notes: (source.notes || "").slice(0, 2000), lastEdited: today() };
  }
  function loadState() {
    const saved = readStorage(STORAGE_KEY);
    if (saved !== null) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.version === 2) {
          const clean = validateImport(parsed);
          return {
            projects: clean.projects,
            notes: clean.notes,
            lastEdited: typeof parsed.lastEdited === "string" ? parsed.lastEdited : null
          };
        }
      } catch { /* Volta à demonstração se os dados estiverem danificados. */ }
    }
    return { projects: seededProjects(), notes: "", lastEdited: null };
  }

  const state = {
    ...loadState(),
    filter: "todos",
    query: "",
    sort: "recent",
    detailId: null,
    activeTab: "overview"
  };
  let toastTimer;
  let noteTimer;
  let storageWarningShown = false;

  function notify(message) {
    const el = $("#toast");
    el.textContent = message;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-visible"), 3400);
  }
  function persist() {
    state.lastEdited = today();
    const ok = writeStorage(STORAGE_KEY, JSON.stringify({
      version: 2, projects: state.projects, notes: state.notes, lastEdited: state.lastEdited
    }));
    $("#saveState").lastChild.textContent = ok ? " Dados locais salvos" : " Sem armazenamento";
    if (!ok && !storageWarningShown) {
      storageWarningShown = true;
      notify("O navegador não permitiu salvar os dados. Exporte um backup para não perdê-los.");
    }
  }
  function fmtDate(value) {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(value));
  }
  function normalizeSearch(value) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  }
  function getCounts() {
    const counts = { todos: state.projects.length, ideia: 0, andamento: 0, concluido: 0, favoritos: 0 };
    for (const project of state.projects) {
      counts[project.status] += 1;
      if (project.favorite) counts.favoritos += 1;
    }
    return counts;
  }
  function updateDashboard() {
    const counts = getCounts();
    const pct = counts.todos ? Math.round(counts.concluido / counts.todos * 100) : 0;
    $("#heroTotal").textContent = String(counts.todos).padStart(2, "0");
    $("#heroFavorites").textContent = String(counts.favoritos).padStart(2, "0");
    $("#heroUpdated").textContent = state.lastEdited ? fmtDate(state.lastEdited) : "Demo";
    $("#dashboardTotal").textContent = counts.todos;
    $("#dashboardProgress").textContent = counts.andamento;
    $("#dashboardDone").textContent = counts.concluido;
    $("#completionPercent").textContent = pct + "%";
    $("#completionFill").style.width = pct + "%";
    $("#completionTrack").setAttribute("aria-valuenow", String(pct));
    $("#legendIdea").textContent = counts.ideia;
    $("#legendProgress").textContent = counts.andamento;
    $("#legendDone").textContent = counts.concluido;
    $("#dashboardHint").textContent = state.lastEdited ? "Painel atualizado após sua última alteração." : "Edite um projeto e veja os indicadores mudarem.";
    const ids = { todos: "#countAll", ideia: "#countIdea", andamento: "#countProgress", concluido: "#countDone", favoritos: "#countFavorites" };
    for (const [key, selector] of Object.entries(ids)) $(selector).textContent = counts[key];
  }

  function filteredProjects() {
    const query = normalizeSearch(state.query);
    return state.projects.filter(project => {
      if (state.filter === "favoritos" && !project.favorite) return false;
      if (state.filter !== "todos" && state.filter !== "favoritos" && state.filter !== project.status) return false;
      if (!query) return true;
      return normalizeSearch(project.name + " " + project.description + " " + project.category).includes(query);
    }).sort((a, b) => {
      if (state.sort === "name") return a.name.localeCompare(b.name, "pt-BR");
      if (state.sort === "favorites") return Number(b.favorite) - Number(a.favorite) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
      if (state.sort === "oldest") return Date.parse(a.createdAt) - Date.parse(b.createdAt);
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    });
  }
  function node(tag, className, content) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (content !== undefined) el.textContent = content;
    return el;
  }
  function projectCard(project) {
    const card = node("article", "project-card");
    const art = node("div", "project-art");
    art.style.setProperty("--project-color", project.color);
    const symbol = node("div", "art-shape", project.name.slice(0, 1).toLocaleUpperCase("pt-BR"));
    const artLabel = node("span", "art-label", STATUS_LABELS[project.status]);
    const favorite = node("button", "favorite-button", project.favorite ? "★" : "☆");
    favorite.type = "button";
    favorite.dataset.action = "favorite";
    favorite.dataset.id = project.id;
    favorite.title = project.favorite ? "Remover dos favoritos" : "Marcar como favorito";
    favorite.setAttribute("aria-label", favorite.title + ": " + project.name);
    favorite.setAttribute("aria-pressed", String(project.favorite));
    art.append(symbol, artLabel, favorite);
    const info = node("div", "project-info");
    const category = node("span", "project-category", project.category);
    const title = node("h3");
    const titleButton = node("button", "", project.name);
    titleButton.type = "button";
    titleButton.dataset.action = "details";
    titleButton.dataset.id = project.id;
    titleButton.setAttribute("aria-label", "Abrir detalhes de " + project.name);
    title.append(titleButton);
    const description = node("p", "", project.description);
    const meta = node("div", "project-meta");
    const badge = node("span", "status-pill " + project.status, STATUS_LABELS[project.status]);
    const date = node("time", "", "Atualizado " + fmtDate(project.updatedAt));
    date.dateTime = project.updatedAt;
    meta.append(badge, date);
    info.append(category, title, description, meta);
    card.append(art, info);
    return card;
  }
  function renderProjects() {
    const projects = filteredProjects();
    const fragment = document.createDocumentFragment();
    for (const project of projects) fragment.append(projectCard(project));
    $("#projectGrid").replaceChildren(fragment);
    $("#emptyState").hidden = projects.length > 0;
    const count = projects.length;
    $("#resultsLabel").textContent = count + (count === 1 ? " projeto encontrado" : " projetos encontrados");
    $("#clearFilters").hidden = state.filter === "todos" && !state.query;
  }
  function render() { updateDashboard(); renderProjects(); }

  function openDialog(dialog) { if (!dialog.open) dialog.showModal(); }
  function closeDialog(dialog) { if (dialog.open) dialog.close(); }
  function getProject(id) { return state.projects.find(project => project.id === id); }
  function openForm(project) {
    const dialog = $("#projectDialog");
    $("#projectForm").reset();
    $("#projectId").value = project?.id || "";
    $("#formMode").textContent = project ? "Editar projeto" : "Novo projeto";
    $("#projectDialogTitle").textContent = project ? "Atualize sua ideia." : "Dê vida à sua ideia.";
    $("#projectName").value = project?.name || "";
    $("#projectDescription").value = project?.description || "";
    $("#projectCategory").value = project?.category || "";
    $("#projectStatus").value = project?.status || "ideia";
    $("#projectColor").value = project?.color || "#b6f675";
    $("#colorValue").textContent = $("#projectColor").value;
    $("#projectLink").value = project?.url || "";
    $("#submitProject").textContent = project ? "Salvar alterações" : "Criar projeto";
    closeDialog($("#detailDialog"));
    openDialog(dialog);
    $("#projectName").focus();
  }
  function showDetails(project) {
    if (!project) return;
    state.detailId = project.id;
    $("#detailCategory").textContent = project.category;
    $("#detailTitle").textContent = project.name;
    $("#detailDescription").textContent = project.description;
    $("#detailArt").style.setProperty("--project-color", project.color);
    $("#detailArt span").textContent = project.name.slice(0, 1).toLocaleUpperCase("pt-BR");
    $("#detailStatus").textContent = "Etapa: " + STATUS_LABELS[project.status];
    $("#detailUpdated").textContent = "Atualizado em " + fmtDate(project.updatedAt);
    $("#detailFavorite").textContent = project.favorite ? "★ Remover favorito" : "☆ Favoritar";
    $("#detailFavorite").setAttribute("aria-pressed", String(project.favorite));
    $("#detailLink").hidden = !project.url;
    if (project.url) $("#detailLink").href = project.url;
    else $("#detailLink").removeAttribute("href");
    openDialog($("#detailDialog"));
  }
  function favoriteProject(id) {
    const project = getProject(id);
    if (!project) return;
    project.favorite = !project.favorite;
    project.updatedAt = today();
    persist();
    render();
    if ($("#detailDialog").open) showDetails(project);
    notify(project.favorite ? "Projeto adicionado aos favoritos." : "Projeto removido dos favoritos.");
  }
  function saveProject(event) {
    event.preventDefault();
    const name = $("#projectName").value.trim();
    const description = $("#projectDescription").value.trim();
    const category = $("#projectCategory").value.trim();
    if (name.length < 2 || description.length < 8 || category.length < 2) {
      notify("Preencha nome, categoria e descrição corretamente.");
      return;
    }
    const id = $("#projectId").value;
    const existing = id ? getProject(id) : null;
    if (!existing && state.projects.length >= MAX_PROJECTS) {
      notify("Limite de 200 projetos. Exporte seus dados antes de continuar.");
      return;
    }
    const project = normalizeProject({
      id: existing?.id || newId(),
      name, description, category,
      status: $("#projectStatus").value,
      color: $("#projectColor").value,
      url: $("#projectLink").value,
      favorite: existing?.favorite || false,
      createdAt: existing?.createdAt || today(),
      updatedAt: today()
    }, today());
    if (!project) { notify("Não foi possível validar o projeto."); return; }
    if (existing) Object.assign(existing, project);
    else state.projects.unshift(project);
    persist();
    closeDialog($("#projectDialog"));
    state.filter = "todos";
    state.query = "";
    $("#projectSearch").value = "";
    updateFilterButtons();
    render();
    notify(existing ? "Projeto atualizado com sucesso." : "Projeto criado com sucesso.");
  }
  function deleteProject() {
    const project = getProject(state.detailId);
    if (!project) return;
    if (!window.confirm("Excluir \"" + project.name + "\" deste navegador? Esta ação não pode ser desfeita. Exporte um backup se quiser preservá-lo.")) return;
    state.projects = state.projects.filter(item => item.id !== project.id);
    persist();
    closeDialog($("#detailDialog"));
    state.detailId = null;
    render();
    notify("Projeto excluído.");
  }
  function updateFilterButtons() {
    $$(".filter").forEach(button => {
      const active = button.dataset.filter === state.filter;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }
  function setTheme(theme) {
    const next = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    $("#themeToggle").textContent = next === "dark" ? "☼" : "☾";
    $("#themeToggle").setAttribute("aria-label", next === "dark" ? "Ativar tema claro" : "Ativar tema escuro");
    writeStorage(THEME_KEY, next);
  }
  function activateTab(name) {
    if (!["overview", "notes", "console"].includes(name)) return;
    state.activeTab = name;
    $$(".tab").forEach(tab => {
      const active = tab.dataset.tab === name;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    $$(".tab-panel").forEach(panel => { panel.hidden = panel.id !== "panel-" + name; });
    if (name === "console") $("#terminalInput").focus();
  }
  function terminalWrite(text, isCommand = false) {
    const output = $("#terminalOutput");
    const line = node("div", isCommand ? "command-line" : "", text);
    output.append(line);
    output.scrollTop = output.scrollHeight;
  }
  function executeCommand(command) {
    const raw = command.trim();
    if (!raw) return;
    terminalWrite("➜ " + raw, true);
    const [verb = "", ...args] = raw.split(/\s+/);
    const arg = args.join(" ");
    switch (normalizeSearch(verb)) {
      case "ajuda":
      case "help":
        terminalWrite("Comandos disponíveis: ajuda, projetos, status, favoritos, tema claro, tema escuro, buscar <texto>, novo, exportar, limpar.");
        break;
      case "projetos":
        terminalWrite(state.projects.length ? state.projects.map(p => "• " + p.name + " [" + STATUS_LABELS[p.status] + "]").join("\n") : "Nenhum projeto cadastrado.");
        break;
      case "status": {
        const n = getCounts();
        terminalWrite(n.todos + " projeto(s), " + n.andamento + " em andamento, " + n.concluido + " concluído(s), " + n.favoritos + " favorito(s).");
        break;
      }
      case "favoritos":
        terminalWrite(state.projects.filter(p => p.favorite).map(p => "★ " + p.name).join("\n") || "Ainda não há favoritos.");
        break;
      case "tema":
        if (normalizeSearch(arg) === "claro") { setTheme("light"); terminalWrite("Tema claro ativado."); }
        else if (normalizeSearch(arg) === "escuro") { setTheme("dark"); terminalWrite("Tema escuro ativado."); }
        else terminalWrite("Use: tema claro ou tema escuro");
        break;
      case "buscar":
        state.query = arg.slice(0, 120);
        $("#projectSearch").value = state.query;
        renderProjects();
        terminalWrite("Busca aplicada: " + (arg || "todos os projetos") + ". Role até a galeria.");
        break;
      case "novo":
        openForm();
        terminalWrite("Formulário de novo projeto aberto.");
        break;
      case "exportar":
        exportData();
        terminalWrite("Download do backup iniciado.");
        break;
      case "limpar":
        $("#terminalOutput").replaceChildren();
        terminalWrite("Console limpa. Digite ajuda para ver os comandos.");
        break;
      default:
        terminalWrite("Comando desconhecido. Digite ajuda para ver as opções.");
    }
  }
  function exportData() {
    const payload = JSON.stringify({
      app: "Nexus Dev Lab", version: 2, exportedAt: today(),
      projects: state.projects, notes: state.notes
    }, null, 2);
    const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "nexus-lab-backup-" + today().slice(0, 10) + ".json";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(href), 60000);
    notify("Backup JSON preparado para download.");
  }
  async function importData(file) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { notify("Arquivo muito grande. O limite é 2 MB."); return; }
    let imported;
    try {
      imported = validateImport(JSON.parse(await file.text()));
    } catch (error) {
      notify("Importação recusada: " + (error?.message || "JSON inválido."));
      return;
    }
    if (!window.confirm("Importar " + imported.projects.length + " projeto(s)? Isso substituirá os projetos e as notas salvos neste navegador.")) return;
    state.projects = imported.projects;
    state.notes = imported.notes;
    $("#quickNotes").value = imported.notes;
    updateNotesCount();
    state.filter = "todos";
    state.query = "";
    $("#projectSearch").value = "";
    updateFilterButtons();
    persist();
    render();
    closeDialog($("#dataDialog"));
    notify("Backup importado com sucesso.");
  }
  function resetData() {
    if (!window.confirm("Restaurar os exemplos iniciais e apagar todos os projetos e notas deste navegador? Esta ação não pode ser desfeita.")) return;
    state.projects = seededProjects();
    state.notes = "";
    state.filter = "todos";
    state.query = "";
    $("#quickNotes").value = "";
    $("#projectSearch").value = "";
    updateNotesCount();
    updateFilterButtons();
    persist();
    render();
    closeDialog($("#dataDialog"));
    notify("Demonstração restaurada.");
  }
  function updateNotesCount() {
    $("#notesCount").textContent = state.notes.length + " / 2000 caracteres";
  }
  function openTools() { openDialog($("#dataDialog")); }
  function setupEvents() {
    $("#themeToggle").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
    $("#menuToggle").addEventListener("click", () => {
      const opened = $("#navigation").classList.toggle("is-open");
      $("#menuToggle").setAttribute("aria-expanded", String(opened));
      $("#menuToggle").textContent = opened ? "×" : "☰";
    });
    $$("#navigation a").forEach(a => a.addEventListener("click", () => {
      $("#navigation").classList.remove("is-open");
      $("#menuToggle").setAttribute("aria-expanded", "false");
      $("#menuToggle").textContent = "☰";
    }));
    $$(".tab").forEach(tab => tab.addEventListener("click", () => activateTab(tab.dataset.tab)));
    const create = () => openForm();
    for (const id of ["newProjectHero", "featureCreate", "addProject", "emptyAdd", "ctaCreate"]) $("#" + id).addEventListener("click", create);
    for (const id of ["openTools", "footerTools"]) $("#" + id).addEventListener("click", openTools);
    for (const id of ["featureExport", "exportData"]) $("#" + id).addEventListener("click", exportData);
    $("#importData").addEventListener("click", () => $("#importFile").click());
    $("#importFile").addEventListener("change", async event => {
      await importData(event.target.files[0]);
      event.target.value = "";
    });
    $("#resetData").addEventListener("click", resetData);
    $("#projectForm").addEventListener("submit", saveProject);
    $("#projectColor").addEventListener("input", event => { $("#colorValue").textContent = event.target.value; });
    $$(".modal-close, [data-close]").forEach(button => button.addEventListener("click", () => closeDialog(document.getElementById(button.dataset.close))));
    $$(".modal").forEach(dialog => dialog.addEventListener("click", event => {
      if (event.target === dialog) closeDialog(dialog);
    }));
    $("#projectGrid").addEventListener("click", event => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const project = getProject(button.dataset.id);
      if (!project) return;
      if (button.dataset.action === "favorite") favoriteProject(project.id);
      else if (button.dataset.action === "details") showDetails(project);
    });
    $("#detailFavorite").addEventListener("click", () => favoriteProject(state.detailId));
    $("#detailEdit").addEventListener("click", () => openForm(getProject(state.detailId)));
    $("#detailDelete").addEventListener("click", deleteProject);
    $("#projectSearch").addEventListener("input", event => {
      state.query = event.target.value;
      renderProjects();
    });
    $("#sortProjects").addEventListener("change", event => {
      state.sort = event.target.value;
      renderProjects();
    });
    $$(".filter").forEach(button => button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      updateFilterButtons();
      renderProjects();
    }));
    $("#clearFilters").addEventListener("click", () => {
      state.filter = "todos";
      state.query = "";
      $("#projectSearch").value = "";
      updateFilterButtons();
      renderProjects();
    });
    $("#quickNotes").addEventListener("input", event => {
      state.notes = event.target.value;
      updateNotesCount();
      clearTimeout(noteTimer);
      noteTimer = setTimeout(() => { persist(); updateDashboard(); }, 400);
    });
    $("#clearNotes").addEventListener("click", () => {
      if (!state.notes) return;
      if (!window.confirm("Apagar todas as notas deste navegador?")) return;
      clearTimeout(noteTimer);
      state.notes = "";
      $("#quickNotes").value = "";
      updateNotesCount();
      persist();
      updateDashboard();
      notify("Notas apagadas.");
    });
    $("#terminalForm").addEventListener("submit", event => {
      event.preventDefault();
      executeCommand($("#terminalInput").value);
      $("#terminalInput").value = "";
    });
    document.addEventListener("keydown", event => {
      if ($$(".modal[open]").length) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        $("#projectSearch").focus();
      }
      const target = event.target;
      if (event.key === "/" && !(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement) && !(target instanceof HTMLSelectElement)) {
        event.preventDefault();
        $("#projectSearch").focus();
      }
    });
  }
  function tick() {
    $("#clock").textContent = new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo"
    }).format(new Date()) + " BRT";
  }
  function init() {
    setTheme(readStorage(THEME_KEY) || "dark");
    $("#quickNotes").value = state.notes;
    updateNotesCount();
    setupEvents();
    tick();
    setInterval(tick, 30000);
    terminalWrite("Nexus Dev Lab — console de demonstração");
    terminalWrite("Digite ajuda para descobrir os comandos disponíveis.");
    render();
  }
  init();
})();
