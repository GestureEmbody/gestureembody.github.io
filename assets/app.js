"use strict";
(() => {
  const data = JSON.parse(document.getElementById("motion-data").textContent);
  const byId = new Map(data.tasks.map(task => [task.id, task]));
  const groups = data.categories;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const video = $("#demo-video");
  const firstTask = data.tasks.find(task => task.category === "locomotion");
  const state = {category: firstTask.category, task: firstTask.id, mode: "dynamics"};
  const loadState = new WeakMap();
  const safePlay = element => element.play().catch(error => {
    if (error.name !== "AbortError" && error.name !== "NotAllowedError") {
      $("#demo-error").hidden = false;
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
    const overlay = $("#demo-play");
    overlay.querySelector("img").src = element.poster;
    overlay.hidden = preserveTime || play;
    element.setAttribute("aria-label", `${task.title}, ${mode === "reference" ? "kinematic" : "dynamics"} demonstration`);
    $("#demo-error").hidden = true;
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
      button.append(title);
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
    $$("[data-category]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.category === state.category)));
    $$("[data-mode]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.mode === state.mode)));
    $$("[data-task]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.task === state.task)));
    $("#active-task-title").textContent = task.title;
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

  $$("[data-category]").forEach(button => button.addEventListener("click", () => selectCategory(button.dataset.category)));
  $$("[data-mode]").forEach(button => button.addEventListener("click", () => {
    if (button.dataset.mode === state.mode) return;
    state.mode = button.dataset.mode;
    renderDemo({preserveTime: true, play: !video.paused});
  }));
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
  video.addEventListener("play", () => { $("#demo-play").hidden = true; });
  video.addEventListener("error", () => { $("#demo-error").hidden = false; });
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
