# test-llm-browser

Простой браузерный чат-бот на встроенном AI API Chrome (Prompt API / `LanguageModel`).

## Что умеет

- Проверяет доступность встроенной модели (`available`, `downloadable`, `downloading`, `unavailable`).
- Показывает подсказку для скачивания модели, если она еще не загружена.
- Отображает процент загрузки модели и периодически обновляет индикатор.
- Отправляет сообщения в модель и выводит ответы в чате.
- Рендерит ответы модели как Markdown (с безопасной санитизацией HTML).

## Стек

- HTML, CSS, JavaScript (без фреймворков)
- `http-server` для локального запуска
- `marked` + `dompurify` для рендеринга Markdown

## Требования

- Node.js и npm
- Актуальный Google Chrome с поддержкой Built-in AI
- Доступность Prompt API (`window.LanguageModel`)

> Важно: Built-in AI и доступность модели зависят от версии Chrome, платформы и настроек/флагов.

## Установка

```bash
npm install
```

## Запуск

```bash
npm start
```

После запуска открой:

- `http://localhost:8000`

## Как пользоваться

1. Открой страницу в Chrome.
2. Дождись проверки статуса модели.
3. Если статус `downloadable` — нажми **«Скачать модель»**.
4. Когда статус станет `available`, вводи запросы в поле и отправляй.

## Структура проекта

- `index.html` — интерфейс чата
- `style.css` — стили
- `app.js` — логика проверки доступности, загрузки и общения с моделью

## Полезные ссылки

- [Chrome Built-in AI Overview](https://developer.chrome.com/docs/ai/built-in/overview)
- [Prompt API](https://developer.chrome.com/docs/extensions/ai/prompt-api)
