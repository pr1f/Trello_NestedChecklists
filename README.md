# Trello Nested Checklist Power-Up

Приватний Trello Power-Up для особистого використання. Додає до картки Trello окремий блок **Nested Checklist** з вкладеними пунктами.

> Важливо: це не змінює стандартний checklist Trello. Trello не має нативної вкладеності `checkitem -> checkitem`, тому Power-Up зберігає власну структуру у `pluginData` картки.

## Що вміє

- кнопка **Nested Checklist** у картці;
- окремий редактор у модальному вікні;
- вкладені пункти будь-якої глибини;
- checkbox для кожного пункту;
- згортання / розгортання гілок;
- переміщення пунктів вгору / вниз у межах одного рівня;
- видалення пунктів разом із підпунктами;
- блок-превʼю на картці;
- badge з прогресом на картці;
- експорт / імпорт JSON.

## Обмеження

Trello `pluginData` має ліміт близько 4096 символів на `card/shared`. Тому цей Power-Up підходить для невеликих особистих вкладених списків. Якщо список дуже великий, краще експортувати JSON або робити версію з окремим сервером / базою даних.

## Структура файлів

```text
index.html                  # iframe connector для Trello
nested.html                 # модальне вікно редактора
section.html                # превʼю в картці
assets/checklist.svg        # іконка
css/nested.css              # стилі редактора
css/section.css             # стилі превʼю
js/client.js                # capabilities Power-Up-а
js/nested.js                # логіка редактора
js/section.js               # логіка превʼю
```

## Як встановити через GitHub Pages

1. Створи новий публічний або приватний репозиторій на GitHub.
2. Завантаж усі файли з цієї папки в корінь репозиторію.
3. У GitHub відкрий **Settings → Pages**.
4. Увімкни деплой з гілки `main` / root.
5. Після деплою GitHub дасть URL приблизно такого виду:

```text
https://твій-логін.github.io/trello-nested-checklist-powerup/
```

6. Для Trello використовуй connector URL:

```text
https://твій-логін.github.io/trello-nested-checklist-powerup/index.html
```

## Як підключити в Trello

1. Відкрий Trello Power-Up Admin: `https://trello.com/power-ups/admin`.
2. Обери Workspace, де ти адмін.
3. Створи новий Power-Up.
4. У полі **Iframe connector URL** встав URL до `index.html` з GitHub Pages.
5. Увімкни capabilities:
   - `card-buttons`
   - `card-back-section`
   - `card-badges`
   - `card-detail-badges`
6. Збережи Power-Up.
7. Відкрий потрібну дошку Trello.
8. В меню Power-Ups знайди його у вкладці **Custom** і додай на дошку.
9. Відкрий будь-яку картку — має зʼявитися кнопка **Nested Checklist** і секція **Nested Checklist**.

## Локальна перевірка

Для Trello потрібен HTTPS URL, тому локальна HTML-сторінка напряму не запрацює як Power-Up. Але для перегляду файлів можна запустити простий сервер:

```bash
npm install
npm run serve
```

Для реального тесту в Trello використовуй GitHub Pages або інший HTTPS-хостинг.

## Що можна доробити потім

- синхронізацію основного прогресу зі стандартним Trello checklist;
- drag-and-drop переміщення пунктів;
- окреме поле дедлайну для підпунктів;
- призначення відповідальних;
- серверне збереження без ліміту 4096 символів.

## v3 changes

- Drag & drop reorder via the ☰ handle.
- In the editor: Enter creates a new sibling, Tab or Ctrl+Enter creates a child item, Shift+Tab moves an item one level up.
- The card preview supports expand/collapse, checking parent items with all children, and adding child items using the + button.
- Optional auto-collapse for completed branches.
- Parent items display branch progress.


## v5

- Додано окремий badge з відсотком виконання на лицьовій стороні картки.
- Додано detail badge «Прогрес» всередині картки.
