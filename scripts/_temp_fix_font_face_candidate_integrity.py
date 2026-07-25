#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIB = ROOT / 'scripts' / 'font-assets-lib.mjs'
TEST = ROOT / 'scripts' / 'font-assets-contract-test.mjs'
TEMP_WORKFLOW = ROOT / '.github' / 'workflows' / '_temp-fix-font-face-candidate-integrity.yml'
SELF = Path(__file__).resolve()


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, got {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


old_verify = '''    const declaredFonts = new Map(manifest.assets.map((asset) => [asset.path, asset]));
    const declaredSupportFonts = new Map(supportManifest.supportAssets.filter((asset) => asset.kind === 'sfnt').map((asset) => [asset.path, asset]));
    const declaredAllFonts = new Map([...declaredFonts, ...declaredSupportFonts]);
    const overrideFamilies = new Map(supportManifest.fontFaceOverrides.map((override) => [override.path, override.family]));
    const unknownOverrides = [...overrideFamilies.keys()].filter((fontPath) => !declaredFonts.has(fontPath));
    assert.deepEqual(unknownOverrides, [], `font face overrides target undeclared WOFF2 assets: ${unknownOverrides.join(', ')}`);

    const referenceMap = collectFontReferences(root);
    const unknownReferences = [...referenceMap.keys()].filter((fontPath) => !declaredAllFonts.has(fontPath));
    assert.deepEqual(unknownReferences, [], `font references are not declared in manifests: ${unknownReferences.join(', ')}`);
    const unreferenced = [...declaredAllFonts.keys()].filter((fontPath) => !referenceMap.has(fontPath));
    assert.deepEqual(unreferenced, [], `manifest fonts have no source reference: ${unreferenced.join(', ')}`);

    const faces = parseCssFontFaces(root);
    for (const [fontPath, asset] of declaredAllFonts) {
      const candidates = faces.get(fontPath) || [];
      const expectedFamily = overrideFamilies.get(fontPath) || asset.family;
      assert.ok(candidates.length > 0, `${fontPath}: matching @font-face block is missing`);
      assert.ok(candidates.some((face) => face.family === expectedFamily && face.weight === asset.weight && face.style === asset.style), `${fontPath}: @font-face metadata does not match manifest`);
    }
'''
new_verify = '''    const declaredFonts = new Map(manifest.assets.map((asset) => [asset.path, asset]));
    const declaredSupportFonts = new Map(supportManifest.supportAssets.filter((asset) => asset.kind === 'sfnt').map((asset) => [asset.path, asset]));
    const declaredAllFonts = new Map([...declaredFonts, ...declaredSupportFonts]);
    const overrideFamilies = new Map(supportManifest.fontFaceOverrides.map((override) => [override.path, override.family]));
    const unknownOverrides = [...overrideFamilies.keys()].filter((fontPath) => !declaredFonts.has(fontPath));
    assert.deepEqual(unknownOverrides, [], `font face overrides target undeclared WOFF2 assets: ${unknownOverrides.join(', ')}`);

    const referenceMap = collectFontReferences(root);
    const unknownReferences = [...referenceMap.keys()].filter((fontPath) => !declaredAllFonts.has(fontPath));
    assert.deepEqual(unknownReferences, [], `font references are not declared in manifests: ${unknownReferences.join(', ')}`);
    const unreferenced = [...declaredAllFonts.keys()].filter((fontPath) => !referenceMap.has(fontPath));
    assert.deepEqual(unreferenced, [], `manifest fonts have no source reference: ${unreferenced.join(', ')}`);

    const faces = parseCssFontFaces(root);
    const usedOverridePaths = new Set();
    for (const [fontPath, asset] of declaredAllFonts) {
      const candidates = faces.get(fontPath) || [];
      const overrideFamily = overrideFamilies.get(fontPath) || null;
      const allowedFamilies = new Set([asset.family, ...(overrideFamily ? [overrideFamily] : [])]);
      assert.ok(candidates.length > 0, `${fontPath}: matching @font-face block is missing`);
      const invalidCandidates = candidates.filter((face) => !allowedFamilies.has(face.family) || face.weight !== asset.weight || face.style !== asset.style);
      assert.deepEqual(
        invalidCandidates,
        [],
        `${fontPath}: @font-face metadata does not match manifest or declared override: ${invalidCandidates.map((face) => `${face.file}:${face.family}/${face.weight}/${face.style}`).join(', ')}`,
      );
      if (overrideFamily && candidates.some((face) => face.family === overrideFamily && face.weight === asset.weight && face.style === asset.style)) {
        usedOverridePaths.add(fontPath);
      }
    }
    const unusedOverrides = [...overrideFamilies.keys()].filter((fontPath) => !usedOverridePaths.has(fontPath));
    assert.deepEqual(unusedOverrides, [], `font face overrides are not used by source CSS: ${unusedOverrides.join(', ')}`);
'''
replace_once(LIB, old_verify, new_verify, 'all font-face candidate verification')

anchor = '''check('font-face family metadata drift fails', async () => withFixture(async (root) => {
  const bytes = makeWoff2(13);
  const { manifest, supportManifest } = writeFixture(root, [['fonts/Fixture/fixture-latin-400.woff2', bytes]]);
  fs.writeFileSync(path.join(root, 'css', 'fonts.css'), "@font-face{font-family:'Wrong Family';font-style:normal;font-weight:400;src:url('/fonts/Fixture/fixture-latin-400.woff2') format('woff2');}\\n");
  assert.throws(() => verifyFontAssets({ root, manifest, supportManifest }), /metadata does not match manifest/);
}));
'''
insert = anchor + '''
check('declared font-face family override passes and is used', async () => withFixture(async (root) => {
  const bytes = makeWoff2(131);
  const fontPath = 'fonts/Fixture/fixture-latin-400.woff2';
  const { manifest, supportManifest } = writeFixture(root, [[fontPath, bytes]]);
  supportManifest.fontFaceOverrides = [{ path: fontPath, family: 'Fixture Serif Alias' }];
  const registry = Buffer.from("@font-face{font-family:'Fixture Serif Alias';font-style:normal;font-weight:400;src:url('./Fixture/fixture-latin-400.woff2') format('woff2');}\\n");
  fs.writeFileSync(path.join(root, 'fonts', 'fonts.css'), registry);
  fs.writeFileSync(path.join(root, 'css', 'fonts.css'), registry);
  const registryRecord = supportManifest.supportAssets.find((asset) => asset.role === 'font-face-registry');
  registryRecord.bytes = registry.length;
  registryRecord.sha256 = sha256(registry);
  assert.equal(verifyFontAssets({ root, manifest, supportManifest }).result, 'PASS');
}));

check('unused font-face override fails closed', async () => withFixture(async (root) => {
  const bytes = makeWoff2(132);
  const fontPath = 'fonts/Fixture/fixture-latin-400.woff2';
  const { manifest, supportManifest } = writeFixture(root, [[fontPath, bytes]]);
  supportManifest.fontFaceOverrides = [{ path: fontPath, family: 'Unused Alias' }];
  assert.throws(() => verifyFontAssets({ root, manifest, supportManifest }), /font face overrides are not used/);
}));

check('duplicate font-face override path fails manifest validation', async () => {
  const bytes = Buffer.from('@font-face{}\\n');
  const supportManifest = supportManifestFor(bytes);
  supportManifest.fontFaceOverrides = [
    { path: 'fonts/Fixture/fixture-latin-400.woff2', family: 'Alias One' },
    { path: 'fonts/Fixture/fixture-latin-400.woff2', family: 'Alias Two' },
  ];
  assert.throws(() => validateSupportManifestObject(supportManifest), /duplicate font face override/);
});
'''
replace_once(TEST, anchor, insert, 'font-face override fixtures')

for temp in (TEMP_WORKFLOW, SELF):
    if temp.exists():
        temp.unlink()

print('FONT FACE CANDIDATE INTEGRITY PATCH: PASS')
