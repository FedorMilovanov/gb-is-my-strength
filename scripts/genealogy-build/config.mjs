/**
 * config.mjs — источники и константы пайплайна genealogy-build.
 *
 * Источники пинуются по SHA256: несовпадение = upstream изменился, пайплайн
 * останавливается, пин обновляется только осознанным коммитом (данные — контракт).
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const PATHS = {
  cache: path.join(HERE, '.cache'),
  repoRoot: path.resolve(HERE, '..', '..'),
  v1Skeleton: path.resolve(HERE, '..', '..', 'data', 'genealogy', 'genealogy.json'),
  outDir: path.resolve(HERE, '..', '..', 'data', 'genealogy', 'v2'),
};

export const SOURCES = {
  tipnr: {
    file: 'tipnr.txt',
    url: 'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Proper%20Nouns/TIPNR%20-%20Translators%20Individualised%20Proper%20Names%20with%20all%20References%20-%20STEPBible.org%20CC%20BY.txt',
    sha256: '1a3b7d7df5cfa1e96eefa07dec92900bea278370c6788fadb5d036f3223b637c',
    license: 'CC BY 4.0 — STEPBible.org / Tyndale House Cambridge',
    attribution: 'Данные персон: STEPBible.org (Tyndale House, Cambridge), CC BY 4.0, github.com/STEPBible',
  },
  synodal: {
    file: 'ru_synodal.json',
    url: 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/ru_synodal.json',
    sha256: 'ac900cd6675e524f728edcf965646bbd9cf791506a67e24e78bb8c7ff4d7c923',
    license: 'Синодальный перевод — public domain (1876); JSON-подача: github.com/thiagobodruk/bible',
    attribution: 'Русский текст: Синодальный перевод (public domain)',
  },
};

export const PIPELINE_VERSION = '0.1.0-phase1';

/** Жёсткие инварианты валидатора (провал = exit 1). */
export const HARD_INVARIANTS = {
  maxParentGraphCycles: 0,
  maxDuplicatePersonIds: 0,
  maxDanglingEdgeRefs: 0,
};
