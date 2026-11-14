# «Русский баптизм — 3D»: источник и релиз

## Два самостоятельных слоя

- `konfessii/russkij-baptizm/index.html` и Astro `Baptizm3DBody.astro` — родная оболочка сайта: SEO, метаданные, навигация, CSP, лоадер и адаптивный iframe.
- `konfessii/russkij-baptizm/_app/index.html` — публикуемый **самодостаточный React/Vite/Three.js singlefile**. Он не редактируется вручную.

**Актуальный собираемый исходник** находится в `_build-tools/konfessii-baptizm/reconciled-app/`. Исторический ZIP в Google Drive содержит более раннюю версию и **не должен** заново развёртываться поверх нового исходника. Восстановленные ранние промежуточные компоненты остаются в `source-snapshot/` лишь как свидетельства происхождения, но не участвуют в сборке.

## Как собрать и сравнить

```powershell
cd _build-tools/konfessii-baptizm/reconciled-app
npm.cmd ci --no-audit --no-fund
npm.cmd run build
cd ../../..
node scripts/konfessii-3d-source-repro-contract.cjs
```

`npm ci` запускает `postinstall` с точечно проверяемой модификацией **3d-force-graph 1.80.0**: вызываемый самой библиотекой до `onNodeDrag` `d3AlphaTarget(0.30)` заменяется на выпущенное значение **0.16**. Без патча callback приложения `d3AlphaTarget(0.10)` не гарантирует прежнюю физику. Скрипт `scripts/patch-3d-force-graph-drag.mjs` останавливается при смене версии зависимости или реализации, а `npm run build` проверяет наличие патча. Это явная воспроизводимая vendor-поправка, **не редактирование собранного HTML**.

Базовая физика 3D сохраняет `d3AlphaDecay=0.0165`, `d3VelocityDecay=0.24`, `warmupTicks=150`, `cooldownTicks=220`, `cooldownTime=7000`, множитель силы якорей `1.28`. Прежние горизонтальные анимации входа заменены вертикальными в `ParallelTimelines`, `Archives`, `ResearchFindings` и `QuizHub`. Общие `overflow-x:hidden/clip` в React `html/body` **не возвращать**: они маскируют дефект, а не исправляют его.

Контракт `scripts/konfessii-3d-source-repro-contract.cjs` сравнивает **SHA-256 чистой сборки и публикуемого singlefile**, контролирует физику и запрещает дрейф CSS, CSP, `noindex`, внешних Google Fonts, версии Reader Preferences. Дополнительная GitHub Action `konfessii-3d-repro.yml` повторяет сборку на Linux с нуля и проверяет настоящий iframe.

## Живой браузерный аудит

```powershell
$env:KONFESSII_AUDIT_REQUIRE_BROWSER = '1'
$env:KONFESSII_AUDIT_REQUIRE_DIST = '0'
$env:GB_PLAYWRIGHT_CHROMIUM_EXECUTABLE = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
npm.cmd run konfessii:audit
```

Для релизного кандидата после production-like сборки установить также `KONFESSII_AUDIT_REQUIRE_DIST='1'`. Проверка `I16` измеряет **реальный React-документ внутри iframe**, а не только ширину внешней Astro-оболочки. Также проверяются WebGL, переключатели, данные, source и security-инварианты. Пустой `SKIP` браузерных проверок не означает успешную приёмку.

## Сравнение с прежним бандлом

Проведена отдельная проверка предыдущего `main` и пересобранного кандидата: 17 разделов, 90 кнопок, 2 ссылки, весь видимый текст и раскрытые записи временной шкалы 1869/1884 совпадают. Проверено 30 браузерных конфигураций (Chromium/Firefox/WebKit × 320–1440 px × reduced/normal motion): ноль переполнения, ни одной JS-ошибки. На Windows подтверждена **побайтово воспроизводимая** сборка из свежего `npm ci`. Для закрытия релиза обязательна независимая Linux CI и проверка самой опубликованной сборки.

Не изменять архивные подписи, исторические факсимиле и редакционные источники ради исправлений дизайна. Новые содержательные исторические правки проводить отдельно с проверкой первоисточников.
