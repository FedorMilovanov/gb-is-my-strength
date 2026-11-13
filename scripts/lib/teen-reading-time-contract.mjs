import ts from 'typescript';

// The series rail, publication metadata and progress bar are separate surfaces.
// Inspect the actual object literals rather than accepting matching numbers
// somewhere else in the file. Fail closed if the source shape changes.
export function checkTeenReadingTimes({ config, items, parts, frontmatterMinutes }) {
  const errors = [];
  const fail = (message) => errors.push(message);
  const source = ts.createSourceFile('teenSeriesConfig.ts', config, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (source.parseDiagnostics.length) return ['teen reading-time config is not valid TypeScript'];

  function declaration(name) {
    const found = [];
    for (const statement of source.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const decl of statement.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.name.text === name) found.push(decl.initializer);
      }
    }
    if (found.length !== 1 || !found[0]) {
      fail(`expected one ${name} declaration`);
      return undefined;
    }
    return found[0];
  }
  function field(object, name, context) {
    if (!object || !ts.isObjectLiteralExpression(object)) {
      fail(`${context}: expected object literal`);
      return undefined;
    }
    const found = object.properties.filter((p) => ts.isPropertyAssignment(p) && p.name &&
      (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text === name);
    if (found.length !== 1) {
      fail(`${context}: expected one ${name} property`);
      return undefined;
    }
    return found[0].initializer;
  }
  const number = (node) => node && ts.isNumericLiteral(node) ? Number(node.text) : NaN;
  const string = (node) => node && ts.isStringLiteral(node) ? node.text : undefined;
  const total = number(declaration('TOTAL_MIN'));
  const configDecl = declaration('TEEN_DOUBLE_LIFE_SERIES');
  if (!configDecl || !ts.isCallExpression(configDecl) || !ts.isIdentifier(configDecl.expression) ||
      configDecl.expression.text !== 'defineSeriesConfig' || configDecl.arguments.length !== 1 ||
      !ts.isObjectLiteralExpression(configDecl.arguments[0])) {
    fail('teen series config must be a defineSeriesConfig object');
    return errors;
  }
  const root = configDecl.arguments[0];
  const rail = field(root, 'items', 'series');
  const pages = field(root, 'pages', 'series');
  if (!rail || !ts.isArrayLiteralExpression(rail)) {
    fail('series: items must be an array literal');
    return errors;
  }
  if (rail.elements.length !== items.length) fail('series: rail item count mismatch');
  if (!Array.isArray(parts) || parts.length !== items.length) fail('series: metadata part count mismatch');
  let cumulative = 0;
  for (let i = 0; i < items.length; i++) {
    const [mark, pageId, slug] = items[i];
    const context = `${mark} (${slug})`;
    const row = parts?.[i];
    const minutes = row?.readingTime;
    if (!row || String(row.n) !== mark || row.slug !== slug || !Number.isSafeInteger(minutes) || minutes <= 0) {
      fail(`${context}: invalid or mismatched series metadata`);
      continue;
    }
    if (frontmatterMinutes[slug] !== String(minutes)) fail(`${context}: frontmatter readingTime differs from series metadata`);
    const railItem = rail.elements[i];
    if (string(field(railItem, 'id', `${context} rail`)) !== pageId) fail(`${context}: rail id/order mismatch`);
    if (string(field(railItem, 'href', `${context} rail`)) !== `/articles/${slug}/`) fail(`${context}: rail href mismatch`);
    if (string(field(railItem, 'readingTime', `${context} rail`)) !== `${minutes} мин`) fail(`${context}: rail readingTime differs from series metadata`);
    const page = field(pages, pageId, 'pages');
    if (number(field(page, 'readingProgressDoneMin', context)) !== cumulative) fail(`${context}: progress done must equal ${cumulative}`);
    if (number(field(page, 'readingProgressPartMin', context)) !== minutes) fail(`${context}: progress part must equal ${minutes}`);
    const totalField = field(page, 'readingProgressTotalMin', context);
    if (!totalField || !ts.isIdentifier(totalField) || totalField.text !== 'TOTAL_MIN') fail(`${context}: progress total must reference TOTAL_MIN`);
    cumulative += minutes;
  }
  if (!Number.isSafeInteger(total) || total !== cumulative) fail(`series: TOTAL_MIN must equal ${cumulative}`);
  return errors;
}
