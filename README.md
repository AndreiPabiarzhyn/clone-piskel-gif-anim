# Pixel Motion

Небольшой автономный редактор пиксельной анимации в духе Piskel. Работает без runtime-зависимостей и экспортирует анимацию в GIF прямо в браузере.

Создатель: **Andrei Pabiarzhyn**

## Запуск

```bash
npm start
```

Откройте [http://127.0.0.1:8080](http://127.0.0.1:8080).

## Структура проекта

```text
public/
  index.html              # разметка приложения
src/
  challenges/             # challenge catalog, runner and validation
  editor/                 # drawing, frames, layers, selection and viewport
  projects/               # import, persistence and backups
  ui/                     # DOM, pointer and keyboard events
  app.js                  # состояние и интерфейс редактора
  styles/
    main.css              # точка входа и порядок CSS-модулей
    foundation.css        # базовые переменные и общие компоненты
    theme.css             # визуальная тема
    editor.css            # холст, инструменты, кадры и инспектор
    challenges.css        # испытания и награды
    responsive.css        # адаптивная компоновка
    features.css          # проекты, восстановление и финальные улучшения
  modules/
    i18n.js               # переводы интерфейса и текста испытаний
    editor-tools.js       # чистые операции рисования
    project-store.js      # проекты, резервные копии и localStorage
    challenges.js         # задания, проверка и награды
    selection-utils.js    # масштабирование и поворот выделения
    gif.js                # GIF-кодировщик
    frame-utils.js        # операции с кадрами
    project-format.js     # защищённый формат .pxm
tests/                    # автоматические тесты
scripts/
  server.js               # локальный HTTP-сервер
docs/
  THIRD_PARTY_NOTICES.md  # лицензии сторонних ресурсов
```

## Возможности

- новый проект с холстом от 8×8 до 128×128;
- карандаш, ластик, заливка и пипетка;
- линия, прямоугольник, эллипс, выделение и перенос пикселей;
- размер кисти 1–4 пикселя;
- создание, дублирование и удаление кадров;
- перетаскивание кадров с сохранением синхронизации слоёв;
- копирование и вставка целых кадров;
- onion skin для соседних кадров;
- анимированный предпросмотр 1–24 FPS;
- отмена последних изменений;
- экспорт прозрачного анимированного GIF;
- интерфейс на русском, английском, польском, испанском, турецком, португальском и индонезийском языках;
- автосохранение и история недавних проектов;
- экспорт и открытие переносимых файлов `.pxm`;
- импорт PNG и GIF;
- экспорт PNG и горизонтального спрайтшита;
- копирование, поворот и отражение выделения;
- слои с видимостью, переименованием и изменением порядка;
- горячие клавиши `P`, `E`, `F`, `I`, `Ctrl+Z`, `Delete`;
- `Ctrl+Shift+C` и `Ctrl+Shift+V` для копирования и вставки кадра.

## Проверка

```bash
npm test
```

## GitHub Pages

Собрать статическую версию:

```bash
npm run build:pages
```

Готовый сайт появится в `dist/`. Workflow
`.github/workflows/pages.yml` автоматически запускает тесты, собирает этот каталог и
публикует его при push в ветку `main` или `master`.

В настройках GitHub-репозитория выберите:

```text
Settings → Pages → Build and deployment → Source → GitHub Actions
```

Сайт проекта будет доступен по адресу:

```text
https://<username>.github.io/<repository>/
```

Проекты сохраняются в `localStorage` браузера. Для переноса между устройствами
используйте экспорт файла `.pxm`.

## Проверка качества

```bash
npm run lint
npm test
npm run test:browser
npm run build:pages
```

- ESLint проверяет JavaScript, Stylelint — CSS.
- Браузерный тест проверяет рисование, кадры, выделение, экспорт GIF/PNG, повреждённые файлы, адаптивность и базовую доступность.
- Чек-лист релиза: [`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md).
- Отчёт по доступности: [`docs/ACCESSIBILITY.md`](docs/ACCESSIBILITY.md).
