const DEFAULT_SYSTEM_PROMPT = "Ты лаконичный и вежливый ассистент. Отвечай на русском языке.";

const MODEL_OPTIONS = {
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }],
};

const template = document.createElement("template");
template.innerHTML = `
  <style>
    :host {
      display: block;
      color-scheme: dark;
      font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      color: #eaeaea;
    }

    * {
      box-sizing: border-box;
    }

    .chat-app {
      width: min(760px, 92vw);
      background: #1b1b1b;
      border: 1px solid #2d2d2d;
      border-radius: 16px;
      padding: 16px;
      display: grid;
      gap: 12px;
    }

    h1 {
      margin: 0;
      font-size: 1.35rem;
    }

    .hint {
      margin: 0;
      color: #a7a7a7;
    }

    .status {
      font-size: 0.95rem;
      color: #a9d3ff;
    }

    .hidden {
      display: none !important;
    }

    .model-status {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.95rem;
    }

    .availability {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 999px;
      border: 1px solid #3b3b3b;
      font-size: 0.82rem;
    }

    .availability.available {
      color: #8ff3b2;
      border-color: #2e7d48;
      background: #163222;
    }

    .availability.downloadable,
    .availability.downloading,
    .availability.checking {
      color: #ffd98a;
      border-color: #876116;
      background: #362b16;
    }

    .availability.unavailable,
    .availability.unsupported,
    .availability.error,
    .availability.unknown {
      color: #ffb0b0;
      border-color: #8a2c2c;
      background: #371b1b;
    }

    .download-panel {
      border: 1px solid #3a3a3a;
      border-radius: 12px;
      background: #171717;
      padding: 10px;
      display: grid;
      gap: 8px;
    }

    .download-hint {
      margin: 0;
      color: #d4d4d4;
      font-size: 0.92rem;
    }

    .download-progress {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .download-progress progress {
      width: 220px;
      height: 10px;
    }

    .download-progress span {
      font-size: 0.9rem;
      color: #c6e2ff;
    }

    .download-btn {
      width: fit-content;
    }

    .messages {
      height: 380px;
      overflow-y: auto;
      border: 1px solid #303030;
      border-radius: 12px;
      background: #101010;
      padding: 12px;
      display: grid;
      align-content: start;
      gap: 8px;
    }

    .message {
      max-width: 88%;
      padding: 10px 12px;
      border-radius: 12px;
      line-height: 1.35;
      white-space: pre-wrap;
    }

    .message.user {
      justify-self: end;
      background: #254870;
    }

    .message.model {
      justify-self: start;
      background: #2d2d2d;
      white-space: normal;
    }

    .message.model p {
      margin: 0.3rem 0;
    }

    .message.model pre {
      margin: 0.5rem 0;
      overflow-x: auto;
      padding: 8px;
      border-radius: 8px;
      background: #141414;
      border: 1px solid #3a3a3a;
    }

    .message.model code {
      font-family: Consolas, "Courier New", monospace;
    }

    .message.model a {
      color: #8ec8ff;
    }

    .chat-form {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
    }

    input,
    button {
      border-radius: 10px;
      border: 1px solid #3a3a3a;
      background: #161616;
      color: #f0f0f0;
      font-size: 1rem;
    }

    input {
      padding: 11px 12px;
    }

    button {
      padding: 11px 16px;
      cursor: pointer;
    }

    button:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      border: 0;
    }
  </style>

  <main class="chat-app">
    <h1 class="title">Чат с LLM в браузере</h1>
    <p class="hint">
      Используется встроенный AI Chrome (Prompt API). Работает только в поддерживаемых версиях Chrome.
    </p>

    <section class="model-status">
      <span>Статус модели:</span>
      <strong id="model-availability" class="availability unknown">проверка...</strong>
    </section>

    <section id="status" class="status">Проверка поддержки API...</section>
    <section id="download-panel" class="download-panel hidden">
      <p id="download-hint" class="download-hint"></p>
      <div id="download-progress-wrap" class="download-progress hidden">
        <progress id="download-progress" value="0" max="100"></progress>
        <span id="download-progress-text">0%</span>
      </div>
      <button id="download-btn" type="button" class="download-btn hidden">Скачать модель</button>
    </section>

    <section id="messages" class="messages" aria-live="polite"></section>

    <form id="chat-form" class="chat-form">
      <label for="prompt-input" class="sr-only">Ваше сообщение</label>
      <input id="prompt-input" type="text" placeholder="Напишите вопрос..." autocomplete="off" required />
      <button id="send-btn" type="submit" disabled>Отправить</button>
    </form>
  </main>
`;

class BndbyChatbot extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    this.session = null;
    this.downloadPercent = 0;
    this.progressTickerId = null;
    this.lastProgressAt = 0;

    this.marked = null;
    this.domPurify = null;

    this.onDownloadClick = this.onDownloadClick.bind(this);
    this.onChatSubmit = this.onChatSubmit.bind(this);
  }

  connectedCallback() {
    this.render();
    this.cacheElements();
    this.bindEvents();
    this.loadMarkdownDeps();
    this.init();
  }

  disconnectedCallback() {
    this.unbindEvents();
    this.stopProgressTicker();
  }

  get systemPrompt() {
    return this.getAttribute("system-prompt") || DEFAULT_SYSTEM_PROMPT;
  }

  get titleText() {
    return this.getAttribute("title") || "Чат с LLM в браузере";
  }

  render() {
    this.shadowRoot.innerHTML = "";
    this.shadowRoot.append(template.content.cloneNode(true));
  }

  cacheElements() {
    this.statusEl = this.shadowRoot.getElementById("status");
    this.messagesEl = this.shadowRoot.getElementById("messages");
    this.chatForm = this.shadowRoot.getElementById("chat-form");
    this.inputEl = this.shadowRoot.getElementById("prompt-input");
    this.sendBtn = this.shadowRoot.getElementById("send-btn");
    this.availabilityEl = this.shadowRoot.getElementById("model-availability");
    this.downloadPanelEl = this.shadowRoot.getElementById("download-panel");
    this.downloadHintEl = this.shadowRoot.getElementById("download-hint");
    this.downloadBtn = this.shadowRoot.getElementById("download-btn");
    this.downloadProgressWrapEl = this.shadowRoot.getElementById("download-progress-wrap");
    this.downloadProgressEl = this.shadowRoot.getElementById("download-progress");
    this.downloadProgressTextEl = this.shadowRoot.getElementById("download-progress-text");
    this.titleEl = this.shadowRoot.querySelector(".title");
    this.titleEl.textContent = this.titleText;
  }

  bindEvents() {
    this.downloadBtn.addEventListener("click", this.onDownloadClick);
    this.chatForm.addEventListener("submit", this.onChatSubmit);
  }

  unbindEvents() {
    this.downloadBtn.removeEventListener("click", this.onDownloadClick);
    this.chatForm.removeEventListener("submit", this.onChatSubmit);
  }

  async loadMarkdownDeps() {
    try {
      const [{ marked }, domPurifyModule] = await Promise.all([
        import("https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js"),
        import("https://cdn.jsdelivr.net/npm/dompurify/dist/purify.es.mjs"),
      ]);

      marked.setOptions({ gfm: true, breaks: true });
      this.marked = marked;

      const exported = domPurifyModule.default ?? domPurifyModule;
      this.domPurify =
        typeof exported === "function" ? exported(window) : exported;
    } catch (error) {
      this.marked = null;
      this.domPurify = null;
    }
  }

  escapeHtml(text) {
    return text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  renderModelMarkdown(text) {
    if (this.marked && this.domPurify) {
      try {
        const rawHtml = this.marked.parse(text);
        return this.domPurify.sanitize(rawHtml);
      } catch (error) {
        return this.domPurify.sanitize(this.escapeHtml(text));
      }
    }

    return this.escapeHtml(text).replaceAll("\n", "<br>");
  }

  setHidden(element, hidden) {
    element.classList.toggle("hidden", hidden);
  }

  setMessageContent(message, role, text) {
    if (role === "model") {
      message.innerHTML = this.renderModelMarkdown(text);
    } else {
      message.textContent = text;
    }
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  appendMessage(role, text) {
    const message = document.createElement("article");
    message.className = `message ${role}`;
    this.setMessageContent(message, role, text);
    this.messagesEl.append(message);
    return message;
  }

  setUiEnabled(enabled) {
    this.inputEl.disabled = !enabled;
    this.sendBtn.disabled = !enabled;
  }

  setAvailability(status, text) {
    this.availabilityEl.className = `availability ${status}`;
    this.availabilityEl.textContent = text;
  }

  updateProgressView() {
    const clamped = Math.max(0, Math.min(100, this.downloadPercent));
    const rounded = Math.floor(clamped);
    this.downloadProgressEl.value = rounded;

    if (!this.lastProgressAt) {
      this.downloadProgressTextEl.textContent = `${rounded}%`;
      return;
    }

    const secondsAgo = Math.floor((Date.now() - this.lastProgressAt) / 1000);
    this.downloadProgressTextEl.textContent = `${rounded}% · обновлено ${secondsAgo}с назад`;
  }

  startProgressTicker() {
    this.stopProgressTicker();
    this.progressTickerId = window.setInterval(() => this.updateProgressView(), 1000);
  }

  stopProgressTicker() {
    if (!this.progressTickerId) return;
    window.clearInterval(this.progressTickerId);
    this.progressTickerId = null;
  }

  normalizeProgressPercent(event) {
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

  normalizeStreamChunk(chunk) {
    if (typeof chunk === "string") return chunk;
    if (typeof chunk === "object" && chunk !== null) {
      if (typeof chunk.text === "string") return chunk.text;
      if (typeof chunk.content === "string") return chunk.content;
    }
    return String(chunk ?? "");
  }

  showDownloadGuidance(availability) {
    if (availability === "downloadable") {
      this.setHidden(this.downloadPanelEl, false);
      this.setHidden(this.downloadBtn, false);
      this.setHidden(this.downloadProgressWrapEl, true);
      this.downloadBtn.disabled = false;
      this.downloadBtn.textContent = "Скачать модель";
      this.downloadHintEl.textContent =
        "Модель еще не загружена. Нажмите «Скачать модель», чтобы запустить загрузку.";
      return;
    }

    if (availability === "downloading") {
      this.setHidden(this.downloadPanelEl, false);
      this.setHidden(this.downloadBtn, false);
      this.setHidden(this.downloadProgressWrapEl, false);
      this.downloadBtn.disabled = false;
      this.downloadBtn.textContent = "Отслеживать загрузку";
      this.downloadHintEl.textContent =
        "Модель уже скачивается. Нажмите кнопку, чтобы запустить инициализацию и увидеть прогресс в процентах.";
      this.updateProgressView();
      return;
    }

    this.setHidden(this.downloadPanelEl, true);
  }

  async checkAvailability() {
    if (
      !("LanguageModel" in window) ||
      typeof window.LanguageModel.availability !== "function"
    ) {
      this.setAvailability("unsupported", "не поддерживается");
      this.showDownloadGuidance("unsupported");
      return "unsupported";
    }

    try {
      this.setAvailability("checking", "проверка...");
      const availability = await window.LanguageModel.availability(MODEL_OPTIONS);

      const labels = {
        available: "доступна",
        downloadable: "нужно скачать",
        downloading: "загружается",
        unavailable: "недоступна",
      };

      this.setAvailability(availability, labels[availability] ?? availability);
      this.showDownloadGuidance(availability);
      return availability;
    } catch (error) {
      this.setAvailability("error", "ошибка проверки");
      this.showDownloadGuidance("error");
      throw error;
    }
  }

  async createModelSession({ withMonitor = false } = {}) {
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
      systemPrompt: this.systemPrompt,
    };

    if (withMonitor) {
      createOptions.monitor = (monitor) => {
        this.setHidden(this.downloadPanelEl, false);
        this.setHidden(this.downloadProgressWrapEl, false);
        this.setHidden(this.downloadBtn, true);
        this.downloadHintEl.textContent = "Идет загрузка модели...";
        this.startProgressTicker();

        monitor.addEventListener("downloadprogress", (event) => {
          const nextPercent = this.normalizeProgressPercent(event);
          this.downloadPercent = Math.max(this.downloadPercent, nextPercent);
          this.lastProgressAt = Date.now();
          this.updateProgressView();
          this.statusEl.textContent = `Загрузка модели: ${Math.floor(this.downloadPercent)}%`;
        });
      };
    }

    return window.LanguageModel.create(createOptions);
  }

  async startDownloadAndInit() {
    this.setUiEnabled(false);
    this.downloadBtn.disabled = true;
    this.downloadPercent = 0;
    this.lastProgressAt = Date.now();
    this.setHidden(this.downloadPanelEl, false);
    this.setHidden(this.downloadProgressWrapEl, false);
    this.downloadHintEl.textContent = "Подготовка загрузки модели...";
    this.updateProgressView();
    this.statusEl.textContent = "Запуск загрузки модели...";

    try {
      this.session = await this.createModelSession({ withMonitor: true });
      this.downloadPercent = 100;
      this.lastProgressAt = Date.now();
      this.updateProgressView();
      this.stopProgressTicker();

      this.setAvailability("available", "доступна");
      this.showDownloadGuidance("available");
      this.statusEl.textContent = "Готово. Можете писать сообщение.";
      this.setUiEnabled(true);
      this.inputEl.focus();
    } catch (error) {
      this.stopProgressTicker();
      const availability = await this.checkAvailability();
      this.showDownloadGuidance(availability);
      this.statusEl.textContent =
        error instanceof Error ? error.message : "Не удалось завершить загрузку модели.";
      this.downloadBtn.disabled = false;
    }
  }

  async init() {
    this.setUiEnabled(false);
    this.setHidden(this.downloadPanelEl, true);
    try {
      this.statusEl.textContent = "Проверка доступности модели...";
      const availability = await this.checkAvailability();

      if (availability === "downloadable") {
        this.statusEl.textContent =
          "Модель нужно скачать. Нажмите «Скачать модель», чтобы запустить загрузку.";
        return;
      }

      if (availability === "downloading") {
        this.statusEl.textContent =
          "Модель скачивается. Нажмите «Отслеживать загрузку», чтобы увидеть прогресс и завершить инициализацию.";
        return;
      }

      if (availability !== "available") {
        this.statusEl.textContent = `Модель недоступна (status: ${availability}).`;
        return;
      }

      this.statusEl.textContent = "Инициализация модели...";
      this.session = await this.createModelSession();
      this.statusEl.textContent = "Готово. Можете писать сообщение.";
      this.setUiEnabled(true);
      this.inputEl.focus();
    } catch (error) {
      this.statusEl.textContent = error instanceof Error ? error.message : String(error);
    }
  }

  onDownloadClick() {
    this.startDownloadAndInit();
  }

  async onChatSubmit(event) {
    event.preventDefault();

    const prompt = this.inputEl.value.trim();
    if (!prompt || !this.session) return;

    this.appendMessage("user", prompt);
    this.inputEl.value = "";
    this.setUiEnabled(false);
    this.statusEl.textContent = "Модель печатает...";
    const modelMessage = this.appendMessage("model", "");

    try {
      if (typeof this.session.promptStreaming === "function") {
        let streamedText = "";
        for await (const chunk of this.session.promptStreaming(prompt)) {
          streamedText += this.normalizeStreamChunk(chunk);
          this.setMessageContent(modelMessage, "model", streamedText);
        }
      } else {
        const result = await this.session.prompt(prompt);
        this.setMessageContent(modelMessage, "model", result);
      }

      this.statusEl.textContent = "Готово. Можете отправить новое сообщение.";
    } catch (error) {
      this.setMessageContent(
        modelMessage,
        "model",
        `Ошибка генерации: ${error instanceof Error ? error.message : String(error)}`
      );
      this.statusEl.textContent = "Произошла ошибка во время генерации.";
    } finally {
      this.setUiEnabled(true);
      this.inputEl.focus();
    }
  }
}

if (!customElements.get("bndby-chatbot")) {
  customElements.define("bndby-chatbot", BndbyChatbot);
}

