import { marked } from "./node_modules/marked/lib/marked.esm.js";
import DOMPurify from "./node_modules/dompurify/dist/purify.es.mjs";

const statusEl = document.getElementById("status");
const messagesEl = document.getElementById("messages");
const chatForm = document.getElementById("chat-form");
const inputEl = document.getElementById("prompt-input");
const sendBtn = document.getElementById("send-btn");
const availabilityEl = document.getElementById("model-availability");
const downloadPanelEl = document.getElementById("download-panel");
const downloadHintEl = document.getElementById("download-hint");
const downloadBtn = document.getElementById("download-btn");
const downloadProgressWrapEl = document.getElementById("download-progress-wrap");
const downloadProgressEl = document.getElementById("download-progress");
const downloadProgressTextEl = document.getElementById("download-progress-text");

let session = null;
let downloadPercent = 0;
let progressTickerId = null;
let lastProgressAt = 0;

const MODEL_OPTIONS = {
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }],
};

marked.setOptions({
  gfm: true,
  breaks: true,
});

function setHidden(element, hidden) {
  element.classList.toggle("hidden", hidden);
}

function renderModelMarkdown(text) {
  try {
    const rawHtml = marked.parse(text);
    return DOMPurify.sanitize(rawHtml);
  } catch (error) {
    return DOMPurify.sanitize(text);
  }
}

function appendMessage(role, text) {
  const message = document.createElement("article");
  message.className = `message ${role}`;
  if (role === "model") {
    message.innerHTML = renderModelMarkdown(text);
  } else {
    message.textContent = text;
  }
  messagesEl.append(message);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setUiEnabled(enabled) {
  inputEl.disabled = !enabled;
  sendBtn.disabled = !enabled;
}

function setAvailability(status, text) {
  availabilityEl.className = `availability ${status}`;
  availabilityEl.textContent = text;
}

function updateProgressView() {
  const clamped = Math.max(0, Math.min(100, downloadPercent));
  const rounded = Math.floor(clamped);
  downloadProgressEl.value = rounded;

  if (!lastProgressAt) {
    downloadProgressTextEl.textContent = `${rounded}%`;
    return;
  }

  const secondsAgo = Math.floor((Date.now() - lastProgressAt) / 1000);
  downloadProgressTextEl.textContent = `${rounded}% · обновлено ${secondsAgo}с назад`;
}

function startProgressTicker() {
  stopProgressTicker();
  progressTickerId = window.setInterval(updateProgressView, 1000);
}

function stopProgressTicker() {
  if (!progressTickerId) return;
  window.clearInterval(progressTickerId);
  progressTickerId = null;
}

function normalizeProgressPercent(event) {
  if (typeof event.total === "number" && event.total > 0) {
    return (event.loaded / event.total) * 100;
  }
  if (typeof event.loaded === "number" && event.loaded <= 1) {
    return event.loaded * 100;
  }
  if (typeof event.loaded === "number") {
    return event.loaded;
  }
  return 0;
}

function showDownloadGuidance(availability) {
  if (availability === "downloadable") {
    setHidden(downloadPanelEl, false);
    setHidden(downloadBtn, false);
    setHidden(downloadProgressWrapEl, true);
    downloadBtn.disabled = false;
    downloadBtn.textContent = "Скачать модель";
    downloadHintEl.textContent =
      "Модель еще не загружена. Нажмите «Скачать модель», чтобы запустить загрузку.";
    return;
  }

  if (availability === "downloading") {
    setHidden(downloadPanelEl, false);
    setHidden(downloadBtn, false);
    setHidden(downloadProgressWrapEl, false);
    downloadBtn.disabled = false;
    downloadBtn.textContent = "Отслеживать загрузку";
    downloadHintEl.textContent =
      "Модель уже скачивается. Нажмите кнопку, чтобы запустить инициализацию и увидеть прогресс в процентах.";
    updateProgressView();
    return;
  }

  setHidden(downloadPanelEl, true);
}

async function checkAvailability() {
  if (!("LanguageModel" in window) || typeof window.LanguageModel.availability !== "function") {
    setAvailability("unsupported", "не поддерживается");
    showDownloadGuidance("unsupported");
    return "unsupported";
  }

  try {
    setAvailability("checking", "проверка...");
    const availability = await window.LanguageModel.availability(MODEL_OPTIONS);

    const labels = {
      available: "доступна",
      downloadable: "нужно скачать",
      downloading: "загружается",
      unavailable: "недоступна",
    };

    setAvailability(availability, labels[availability] ?? availability);
    showDownloadGuidance(availability);
    return availability;
  } catch (error) {
    setAvailability("error", "ошибка проверки");
    showDownloadGuidance("error");
    throw error;
  }
}

async function createModelSession({ withMonitor = false } = {}) {
  // Prompt API currently uses window.LanguageModel in Chrome built-in AI.
  if (!("LanguageModel" in window) || typeof window.LanguageModel.create !== "function") {
    throw new Error(
      "В этом браузере нет Prompt API. Откройте страницу в актуальном Chrome с включенным Built-in AI."
    );
  }

  const availability = await window.LanguageModel.availability(MODEL_OPTIONS);
  if (availability === "unavailable" || availability === "unsupported") {
    throw new Error(
      `Модель сейчас недоступна (status: ${availability}). Проверьте настройки Built-in AI в Chrome.`
    );
  }

  const createOptions = {
    ...MODEL_OPTIONS,
    systemPrompt:
      "Ты лаконичный и вежливый ассистент. Отвечай на русском языке.",
  };

  if (withMonitor) {
    createOptions.monitor = (monitor) => {
      setHidden(downloadPanelEl, false);
      setHidden(downloadProgressWrapEl, false);
      setHidden(downloadBtn, true);
      downloadHintEl.textContent = "Идет загрузка модели...";
      startProgressTicker();

      monitor.addEventListener("downloadprogress", (event) => {
        const nextPercent = normalizeProgressPercent(event);
        downloadPercent = Math.max(downloadPercent, nextPercent);
        lastProgressAt = Date.now();
        updateProgressView();
        statusEl.textContent = `Загрузка модели: ${Math.floor(downloadPercent)}%`;
      });
    };
  }

  return window.LanguageModel.create(createOptions);
}

async function startDownloadAndInit() {
  setUiEnabled(false);
  downloadBtn.disabled = true;
  downloadPercent = 0;
  lastProgressAt = Date.now();
  setHidden(downloadPanelEl, false);
  setHidden(downloadProgressWrapEl, false);
  downloadHintEl.textContent = "Подготовка загрузки модели...";
  updateProgressView();
  statusEl.textContent = "Запуск загрузки модели...";

  try {
    session = await createModelSession({ withMonitor: true });
    downloadPercent = 100;
    lastProgressAt = Date.now();
    updateProgressView();
    stopProgressTicker();

    setAvailability("available", "доступна");
    showDownloadGuidance("available");
    statusEl.textContent = "Готово. Можете писать сообщение.";
    setUiEnabled(true);
    inputEl.focus();
  } catch (error) {
    stopProgressTicker();
    const availability = await checkAvailability();
    showDownloadGuidance(availability);
    statusEl.textContent =
      error instanceof Error ? error.message : "Не удалось завершить загрузку модели.";
    downloadBtn.disabled = false;
  }
}

async function init() {
  setUiEnabled(false);
  setHidden(downloadPanelEl, true);
  try {
    statusEl.textContent = "Проверка доступности модели...";
    const availability = await checkAvailability();

    if (availability === "downloadable") {
      statusEl.textContent =
        "Модель нужно скачать. Нажмите «Скачать модель», чтобы запустить загрузку.";
      return;
    }

    if (availability === "downloading") {
      statusEl.textContent =
        "Модель скачивается. Нажмите «Отслеживать загрузку», чтобы увидеть прогресс и завершить инициализацию.";
      return;
    }

    if (availability !== "available") {
      statusEl.textContent = `Модель недоступна (status: ${availability}).`;
      return;
    }

    statusEl.textContent = "Инициализация модели...";
    session = await createModelSession();
    statusEl.textContent = "Готово. Можете писать сообщение.";
    setUiEnabled(true);
    inputEl.focus();
  } catch (error) {
    statusEl.textContent = error instanceof Error ? error.message : String(error);
  }
}

downloadBtn.addEventListener("click", () => {
  startDownloadAndInit();
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const prompt = inputEl.value.trim();
  if (!prompt || !session) return;

  appendMessage("user", prompt);
  inputEl.value = "";
  setUiEnabled(false);
  statusEl.textContent = "Модель печатает...";

  try {
    const result = await session.prompt(prompt);
    appendMessage("model", result);
    statusEl.textContent = "Готово. Можете отправить новое сообщение.";
  } catch (error) {
    appendMessage(
      "model",
      `Ошибка генерации: ${error instanceof Error ? error.message : String(error)}`
    );
    statusEl.textContent = "Произошла ошибка во время генерации.";
  } finally {
    setUiEnabled(true);
    inputEl.focus();
  }
});

init();
