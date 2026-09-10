"use strict";
(() => {
  const data = JSON.parse(document.getElementById("motion-data").textContent);
  const byId = new Map(data.tasks.map(task => [task.id, task]));
  const groups = data.categories;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const video = $("#demo-video");
  const firstTask = data.tasks.find(task => task.category === "locomotion");
  const state = {category: firstTask.category, task: firstTask.id};
  const safePlay = () => video.play().catch(error => {
    if (error.name !== "AbortError" && error.name !== "NotAllowedError") {
      $("#demo-error").hidden = false;
    }
  });

  // Only the selected simulation clip is exposed. Keep archived pairs intact.
  function setVideo(task) {
    const variant = task.variants.dynamics;
    video.pause();
    video.poster = variant.displayPoster || variant.poster;
    const overlay = $("#demo-play");
    overlay.querySelector("img").src = video.poster;
    overlay.hidden = false;
    video.setAttribute("aria-label", `${task.title} demonstration`);
    $("#demo-error").hidden = true;
    video.preload = "none";
    video.src = variant.file;
    video.querySelector("a").href = variant.file;
    // Setting src without load() preserves lazy loading until the user plays.
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
      button.textContent = task.title;
      button.addEventListener("click", () => selectTask(task.id));
      list.append(button);
    }
    list.setAttribute("aria-label", `${groups[state.category].title} tasks`);
  }

  function taskUrl() {
    const url = new URL(location.href);
    url.searchParams.set("task", state.task);
    // Old paired-view links still resolve to their task, using the sole view.
    url.searchParams.delete("view");
    return url;
  }

  function renderDemo() {
    const task = byId.get(state.task);
    $$("[data-category]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.category === state.category)));
    $$("[data-task]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.task === state.task)));
    $("#active-task-title").textContent = task.title;
    $("#download-video").href = task.variants.dynamics.file;
    $("#copy-status").textContent = "";
    setVideo(task);
    // Some file:// browsers reject history updates; playback must still work.
    try { history.replaceState(null, "", taskUrl()); } catch (_) { /* local-file fallback */ }
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
  $("#demo-play").addEventListener("click", safePlay);
  for (const [selector, offset] of [["#previous-task", -1], ["#next-task", 1]]) {
    $(selector).addEventListener("click", () => {
      const tasks = currentTasks();
      const i = tasks.findIndex(task => task.id === state.task);
      selectTask(tasks[(i + offset + tasks.length) % tasks.length].id);
    });
  }
  $("#copy-link").addEventListener("click", async () => {
    const url = taskUrl();
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
    const task = byId.get(params.get("task")) || firstTask;
    state.task = task.id;
    state.category = task.category;
    renderTasks();
    renderDemo();
  }
  addEventListener("popstate", restoreUrl);
  restoreUrl();
})();
