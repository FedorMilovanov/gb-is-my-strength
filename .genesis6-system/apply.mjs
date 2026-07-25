import fs from 'node:fs';
import crypto from 'node:crypto';

function replaceExact(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected exactly one migration anchor, found ${count}`);
  fs.writeFileSync(path, source.replace(before, after));
}

const guideBefore = `2. Уникальность серии = \`theme\`: положи \`css/series-<theme>.css\` (образец —
   \`series-samizdat.css\`: ТОЛЬКО переопределение токенов \`--gb-*\` и атмосферные
   слои под \`[data-series-theme="<theme>"]\`). Дизайн-геометрию движка тема НЕ
   меняет — только цвета/фактуры/акценты. Без \`theme\` серия выглядит как
   Гилл/Сердце (дефолт) — это нормально.`;
const guideAfter = `2. Уникальность серии = \`theme\`. Каждая тема обязана быть зарегистрирована в
   \`data/series-theme-registry.json\` с точным \`stylesheet\` и scoped-селектором
   \`[data-series-theme="<theme>"]\`. Предпочтительный путь —
   \`css/series-<theme>.css\` (образец: \`series-samizdat.css\`). Если лимит CSS-файлов
   из \`AGENTS.md\` уже исчерпан, допускается строго scoped-блок в существующем
   разрешённом stylesheet, но только через явную запись в registry. Тема меняет
   лишь токены, цвета, фактуры и акценты; геометрию, контроллер, ReaderState,
   доступность и навигацию общего движка она не форкает. Без \`theme\` серия
   использует дефолтный вид Гилла/Сердца — это нормально.`;
replaceExact('docs/SERIES-ENGINE-GUIDE.md', guideBefore, guideAfter);

const engineBefore = `// Каждая заявленная theme обязана иметь css/series-<theme>.css
const themes = [];
for (const f of cfgFiles.concat(['seriesConfig.ts'])) {
  const m = read(path.join(seriesDir, f)).match(/theme:\\s*'([a-z0-9-]+)'/g) || [];
  for (const t of m) themes.push(t.match(/'([a-z0-9-]+)'/)[1]);
}
const missingThemes = themes.filter((t) => !fs.existsSync(path.join(ROOT, \`css/series-\${t}.css\`)));
check('Серии: у каждой theme есть css/series-<theme>.css', missingThemes.length === 0,
  'нет файла темы: ' + missingThemes.join(', '));`;
const engineAfter = `// Каждая заявленная theme обязана быть зарегистрирована с реальным stylesheet
// и точным scoped-selector. По умолчанию тема живёт в css/series-<theme>.css,
// но AGENTS ограничивает число CSS-файлов: новые локальные темы могут быть
// размещены в существующем core stylesheet только через явный registry.
const themeRegistryPath = 'data/series-theme-registry.json';
let themeRegistry = null;
try {
  themeRegistry = JSON.parse(read(themeRegistryPath));
} catch (error) {
  check('Серии: theme registry читается', false, error.message);
}
check('Серии: theme registry schema version=1', themeRegistry?.version === 1 && themeRegistry?.themes && typeof themeRegistry.themes === 'object');
const themes = [];
for (const f of cfgFiles.concat(['seriesConfig.ts'])) {
  const m = read(path.join(seriesDir, f)).match(/theme:\\s*'([a-z0-9-]+)'/g) || [];
  for (const t of m) themes.push(t.match(/'([a-z0-9-]+)'/)[1]);
}
const themeErrors = [];
for (const [theme, entry] of Object.entries(themeRegistry?.themes || {})) {
  if (!entry || typeof entry.stylesheet !== 'string' || typeof entry.selector !== 'string') {
    themeErrors.push(\`\${theme}: нужен stylesheet + selector\`);
    continue;
  }
  if (!fs.existsSync(path.join(ROOT, entry.stylesheet))) {
    themeErrors.push(\`\${theme}: stylesheet отсутствует (\${entry.stylesheet})\`);
    continue;
  }
  if (!read(entry.stylesheet).includes(entry.selector)) {
    themeErrors.push(\`\${theme}: selector \${entry.selector} отсутствует в \${entry.stylesheet}\`);
  }
}
for (const theme of themes) {
  if (!themeRegistry?.themes?.[theme]) themeErrors.push(\`\${theme}: тема не зарегистрирована\`);
}
check('Серии: themes зарегистрированы и реально scoped', themeErrors.length === 0, themeErrors.join(' | '));`;
replaceExact('scripts/check-engine-contracts.js', engineBefore, engineAfter);

const cssPath = 'css/site.css';
const cssPayload = fs.readFileSync('.genesis6-system/manuscript.css');
const cssSha = crypto.createHash('sha256').update(cssPayload).digest('hex');
const expectedCssSha = '2bb54308de14ccabbcbcc5af3db4da6e9060a09011e7759d2d5daaa6ab1de468';
if (cssSha !== expectedCssSha) throw new Error(`manuscript CSS digest mismatch: ${cssSha}`);
const cssSource = fs.readFileSync(cssPath, 'utf8');
if (cssSource.includes('GENESIS 6 — contextual manuscript skin')) throw new Error('Genesis 6 manuscript skin already exists');
fs.writeFileSync(cssPath, `${cssSource.replace(/\s*$/, '')}\n${cssPayload.toString('utf8').replace(/^\s*/, '')}`);
