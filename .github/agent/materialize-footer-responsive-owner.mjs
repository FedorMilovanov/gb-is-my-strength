#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const target = 'scripts/home-responsive-evidence-contract.mjs';
assert.equal(process.argv.includes('--write'), true, 'explicit --write is required');
let source = fs.readFileSync(target, 'utf8');

function gitBlobSha(text) {
  const body = Buffer.from(text, 'utf8');
  return crypto.createHash('sha1').update(Buffer.concat([
    Buffer.from(`blob ${body.length}\0`, 'utf8'),
    body,
  ])).digest('hex');
}

assert.equal(
  gitBlobSha(source),
  '1917635d6cf2b8f3b3b3491e032d24f8422234fb',
  'responsive evidence contract changed before materialization',
);

function replaceOnce(before, after, label) {
  const first = source.indexOf(before);
  assert.notEqual(first, -1, `missing ${label}`);
  assert.equal(source.indexOf(before, first + before.length), -1, `${label} is not unique`);
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

const footerDeclarations = `    const endBlock = document.querySelector('.article-end-sdg-wrap');
    const footer = document.querySelector('.h-footer');
    const endBeforeFooter = Boolean(endBlock && footer
      && (endBlock.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING));
`;
replaceOnce(
  footerDeclarations,
  `    const endBlock = document.querySelector('.article-end-sdg-wrap');
    const footer = document.querySelector('.h-footer');
    const footerCopy = footer?.querySelector('.h-footer-copy');
    const footerLink = footer?.querySelector('a');
    const footerRect = rect(footer);
    const footerCopyRect = rect(footerCopy);
    const footerLinkRect = rect(footerLink);
    const endBeforeFooter = Boolean(endBlock && footer
      && (endBlock.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING));
`,
  'footer declaration block',
);

const footerState = `      ornamentDisplays: ornaments.map((node) => getComputedStyle(node).display),
      footer: rect(footer),
`;
replaceOnce(
  footerState,
  `      ornamentDisplays: ornaments.map((node) => getComputedStyle(node).display),
      footer: footerRect,
      footerStructureComplete: Boolean(footer && footerCopy && footerLink),
      footerJustify: footer ? getComputedStyle(footer).justifyContent : null,
      footerLeftGap: footerRect ? footerRect.left : null,
      footerRightGap: footerRect ? innerWidth - footerRect.right : null,
      footerGroupCenterOffset: footerRect && footerCopyRect && footerLinkRect
        ? Math.abs(
          ((Math.min(footerCopyRect.left, footerLinkRect.left) + Math.max(footerCopyRect.right, footerLinkRect.right)) / 2)
          - ((footerRect.left + footerRect.right) / 2)
        )
        : null,
`,
  'footer state block',
);

const afterEndAssertion = `  assert.equal(state.endBeforeFooter, true, \`${'${width}'}px: terminal SDG signature must precede the footer\`);
`;
replaceOnce(
  afterEndAssertion,
  `${afterEndAssertion}  assert.equal(state.footerStructureComplete, true, \`${'${width}'}px: footer structure is incomplete\`);
  assert.ok(
    state.footer
      && Number.isFinite(state.footerLeftGap)
      && Number.isFinite(state.footerRightGap)
      && state.footerLeftGap >= 17
      && state.footerRightGap >= 17,
    \`${'${width}'}px: footer safe inset failed (left=${'${state.footerLeftGap}'}, right=${'${state.footerRightGap}'})\`,
  );
  if (width > 760) {
    assert.equal(state.footerJustify, 'center', \`${'${width}'}px: desktop footer reverted to edge distribution\`);
    assert.ok(
      Number.isFinite(state.footerGroupCenterOffset) && state.footerGroupCenterOffset <= 2,
      \`${'${width}'}px: desktop footer group is off-centre by ${'${state.footerGroupCenterOffset}'}px\`,
    );
  }
`,
  'footer assertion anchor',
);

const mobileFooterAssertion = `    assert.ok(state.footer && state.footer.left >= 17 && width - state.footer.right >= 17, \`${'${width}'}px: footer touches a viewport edge\`);
`;
replaceOnce(mobileFooterAssertion, '', 'retired mobile-only footer assertion');

for (const token of [
  'footerStructureComplete: Boolean(footer && footerCopy && footerLink)',
  'footerLeftGap: footerRect ? footerRect.left : null',
  'footerRightGap: footerRect ? innerWidth - footerRect.right : null',
  'footerGroupCenterOffset: footerRect && footerCopyRect && footerLinkRect',
  'footer safe inset failed (left=${state.footerLeftGap}, right=${state.footerRightGap})',
  "assert.equal(state.footerJustify, 'center'",
]) assert.equal(source.includes(token), true, `materialized source missing ${token}`);
assert.equal(source.includes('footer touches a viewport edge'), false, 'retired generic footer assertion remains');

fs.writeFileSync(target, source, 'utf8');
console.log(`Materialized ${target} (${gitBlobSha(source)}).`);
