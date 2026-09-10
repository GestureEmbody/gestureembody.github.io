"use strict";
(() => {
  const data = JSON.parse(document.getElementById("motion-data").textContent);
  const byId = new Map(data.tasks.map(task => [task.id, task]));
  const groups = data.categories;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const video = $("#demo-video");
  const hero = $("#hero-video");
  const state = {category: "locomotion", task: "10_walk", mode: "dynamics"};
  const highlight = {task: "03_jump", mode: "dynamics"};
  const loadState = new WeakMap();
  const formatTime = seconds => `${Math.floor(Math.ceil(seconds) / 60)}:${String(Math.ceil(seconds) % 60).padStart(2, "0")}`;
  const safePlay = element => element.play().catch(error => {
    if (error.name !== "AbortError" && error.name !== "NotAllowedError") {
      $(element === hero ? "#hero-error" : "#demo-error").hidden = false;
    }
  });

  // Only load the selected MP4. Preserve the timeline when switching paired views.
  function setVideo(element, task, mode, preserveTime = false, play = false) {
    const previous = loadState.get(element);
    const resumeAt = preserveTime ? (previous?.pending ? previous.time : element.currentTime || 0) : 0;
    const variant = task.variants[mode];
    const requested = {time: resumeAt, pending: true, play};
    loadState.set(element, requested);
    element.pause();
    element.poster = variant.displayPoster || variant.poster;
    const overlay = $(element === hero ? "#hero-play" : "#demo-play");
    overlay.querySelector("img").src = element.poster;
    overlay.hidden = preserveTime || play;
    element.setAttribute("aria-label", `${task.title}, ${mode === "reference" ? "kinematic" : "dynamics"} demonstration`);
    $(element === hero ? "#hero-error" : "#demo-error").hidden = true;
    element.onloadedmetadata = () => {
      if (loadState.get(element) !== requested) return;
      requested.pending = false;
      if (requested.time > 0) element.currentTime = Math.min(requested.time, Math.max(0, element.duration - 0.1));
      if (requested.play) safePlay(element);
    };
    element.preload = preserveTime || play ? "metadata" : "none";
    element.src = variant.file;
    // Explicit load() overrides preload=none in some browsers. Updating src is
    // enough when showing a poster; request metadata only after interaction.
    if (preserveTime || play) element.load();
    if (play) safePlay(element);
  }

  function currentTasks() { return data.tasks.filter(task => task.category === state.category); }
  function renderTasks() {
    const list = $("#task-list");
    list.replaceChildren();
    for (const task of currentTasks()) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.task = task.id;
      button.setAttribute("aria-pressed", String(task.id === state.task));
      const title = document.createElement("span");
      title.textContent = task.title;
      const arrow = document.createElement("span");
      arrow.textContent = "↗";
      arrow.setAttribute("aria-hidden", "true");
      button.append(title, arrow);
      button.addEventListener("click", () => selectTask(task.id));
      list.append(button);
    }
    list.setAttribute("aria-label", `${groups[state.category].title} tasks`);
  }

  function saveUrl() {
    const url = new URL(location.href);
    url.searchParams.set("task", state.task);
    url.searchParams.set("view", state.mode);
    // file:// implementations can reject history updates; playback must still work.
    try { history.replaceState(null, "", url); } catch (_) { /* local-file fallback */ }
  }

  function renderDemo({preserveTime = false, play = false, updateUrl = true} = {}) {
    const task = byId.get(state.task);
    const tasks = currentTasks();
    const group = groups[state.category];
    $$("[data-category]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.category === state.category)));
    $$("[data-mode]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.mode === state.mode)));
    $$("[data-task]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.task === state.task)));
    $("#category-label").textContent = group.title.toUpperCase();
    $("#active-task-title").textContent = task.title;
    $("#task-number").textContent = `${String(tasks.findIndex(t => t.id === task.id) + 1).padStart(2, "0")} / ${String(tasks.length).padStart(2, "0")}`;
    $("#active-robots").textContent = group.robots.join(" · ");
    $("#active-duration").textContent = formatTime(task.variants[state.mode].duration);
    $("#task-description").textContent = task.description;
    $("#view-note").textContent = state.mode === "reference" ? group.kinematicNote : group.dynamicsNote;
    $("#download-video").href = task.variants[state.mode].file;
    $("#copy-status").textContent = "";
    setVideo(video, task, state.mode, preserveTime, play);
    if (updateUrl) saveUrl();
  }

  function selectTask(id) {
    const task = byId.get(id);
    if (!task) return;
    const changedCategory = state.category !== task.category;
    state.task = id;
    state.category = task.category;
    if (changedCategory) renderTasks();
    renderDemo();
  }

  function selectCategory(category) {
    const first = data.tasks.find(task => task.category === category);
    if (first) selectTask(first.id);
  }

  function renderHero(preserveTime = false) {
    const task = byId.get(highlight.task);
    const playing = !hero.paused;
    $("#hero-title").textContent = task.title;
    $("#hero-download").href = task.variants[highlight.mode].file;
    $$("[data-highlight]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.highlight === highlight.task)));
    $$("[data-hero-mode]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.heroMode === highlight.mode)));
    setVideo(hero, task, highlight.mode, preserveTime, playing);
  }

  $$("[data-category]").forEach(button => button.addEventListener("click", () => selectCategory(button.dataset.category)));
  $$("[data-open-category]").forEach(link => link.addEventListener("click", () => selectCategory(link.dataset.openCategory)));
  $$("[data-mode]").forEach(button => button.addEventListener("click", () => {
    if (button.dataset.mode === state.mode) return;
    state.mode = button.dataset.mode;
    renderDemo({preserveTime: true, play: !video.paused});
  }));
  $$("[data-highlight]").forEach(button => button.addEventListener("click", () => {
    if (highlight.task === button.dataset.highlight) return;
    highlight.task = button.dataset.highlight;
    renderHero();
  }));
  $$("[data-hero-mode]").forEach(button => button.addEventListener("click", () => {
    if (highlight.mode === button.dataset.heroMode) return;
    highlight.mode = button.dataset.heroMode;
    renderHero(true);
  }));
  $("#watch-highlight").addEventListener("click", () => {
    $("#highlight").scrollIntoView({block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
    safePlay(hero);
  });
  $("#hero-play").addEventListener("click", () => safePlay(hero));
  $("#demo-play").addEventListener("click", () => safePlay(video));
  for (const [selector, offset] of [["#previous-task", -1], ["#next-task", 1]]) {
    $(selector).addEventListener("click", () => {
      const tasks = currentTasks();
      const i = tasks.findIndex(task => task.id === state.task);
      selectTask(tasks[(i + offset + tasks.length) % tasks.length].id);
    });
  }
  $("#copy-link").addEventListener("click", async () => {
    const url = new URL(location.href);
    url.searchParams.set("task", state.task);
    url.searchParams.set("view", state.mode);
    url.hash = "demonstrations";
    if (url.protocol === "file:") {
      $("#copy-status").textContent = "Local preview. Task links can be shared after the site is published.";
      return;
    }
    try {
      await navigator.clipboard.writeText(url.href);
      $("#copy-status").textContent = "Task link copied.";
    } catch (_) {
      $("#copy-status").textContent = `Task link: ${url.href}`;
    }
  });
  [video, hero].forEach(element => {
    element.addEventListener("play", () => { $(element === hero ? "#hero-play" : "#demo-play").hidden = true; });
    element.addEventListener("play", () => [video, hero].filter(other => other !== element).forEach(other => {
      const pending = loadState.get(other);
      if (pending) pending.play = false;
      other.pause();
    }));
    element.addEventListener("error", () => { $(element === hero ? "#hero-error" : "#demo-error").hidden = false; });
  });
  function restoreUrl() {
    const params = new URLSearchParams(location.search);
    const task = byId.get(params.get("task"));
    if (task) { state.task = task.id; state.category = task.category; }
    const mode = params.get("view");
    if (mode === "reference" || mode === "dynamics") state.mode = mode;
    renderTasks();
    renderDemo({updateUrl: false});
  }
  addEventListener("popstate", restoreUrl);
  restoreUrl();
})();
