#!/usr/bin/env bash
set -euo pipefail
ROOT=/tmp/genesis6-phaseC
EVIDENCE="$ROOT/evidence"
PACKAGE="$ROOT/package"
PRODUCT="$ROOT/tested-product"
MATRIX='migration/route-migration-matrix.json'
mkdir -p "$EVIDENCE" "$PACKAGE"
exec > >(tee "$EVIDENCE/runner.log") 2>&1

echo '== Verify exact carrier and capsule =='
test "$(git rev-parse HEAD)" = "$CARRIER_SHA"
mapfile -t chunks < <(find .tmp/genesis6-phaseC/capsule -maxdepth 1 -type f -name '*.part' -print | LC_ALL=C sort)
test "${#chunks[@]}" -eq "$CAPSULE_PART_COUNT"
cat "${chunks[@]}" > "$ROOT/package.tgz.b64"
test "$(sha256sum "$ROOT/package.tgz.b64" | cut -d' ' -f1)" = "$CAPSULE_B64_SHA256"
base64 --decode "$ROOT/package.tgz.b64" > "$ROOT/package.tgz"
test "$(sha256sum "$ROOT/package.tgz" | cut -d' ' -f1)" = "$CAPSULE_TGZ_SHA256"
python <<'PY_CAPSULE'
import hashlib,json,os,pathlib,subprocess,tarfile
root=pathlib.Path('/tmp/genesis6-phaseC'); pkg=root/'package'
with tarfile.open(root/'package.tgz','r:gz') as archive:
    members=archive.getmembers(); safe=[]
    for member in members:
        name=member.name.removeprefix('./'); path=pathlib.PurePosixPath(name)
        if name in ('','.') or member.isdir(): continue
        if member.name.startswith('/') or '..' in path.parts or not member.isfile(): raise SystemExit(f'unsafe capsule member: {member.name}')
        safe.append(name)
    if len(safe)!=len(set(safe)): raise SystemExit('duplicate capsule paths')
    archive.extractall(pkg,filter='data')
mb=(pkg/'manifest.json').read_bytes()
if hashlib.sha256(mb).hexdigest()!=os.environ['MANIFEST_SHA256']: raise SystemExit('manifest digest mismatch')
m=json.loads(mb)
if m.get('schemaVersion')!=3 or m.get('base')!=os.environ['BASE_SHA'] or m.get('publicationState')!='shadow-pilot-noindex': raise SystemExit('manifest authority mismatch')
files=m.get('files')
if not isinstance(files,list) or len(files)!=19: raise SystemExit('expected exactly 19 source-package files')
paths=[e['path'] for e in files]
if paths!=sorted(paths) or len(paths)!=len(set(paths)): raise SystemExit('manifest order/uniqueness mismatch')
if set(safe)!={'manifest.json',*paths}: raise SystemExit('capsule tree differs from manifest')
for e in files:
    data=(pkg/e['path']).read_bytes()
    if len(data)!=e['bytes'] or hashlib.sha256(data).hexdigest()!=e['sha256']: raise SystemExit(f"content mismatch: {e['path']}")
    if subprocess.check_output(['git','hash-object','--stdin'],input=data).decode().strip()!=e['gitBlobSha']: raise SystemExit(f"git blob mismatch: {e['path']}")
(root/'evidence'/'capsule.json').write_text(json.dumps({'base':m['base'],'sourceFileCount':19,'manifestSha256':hashlib.sha256(mb).hexdigest(),'capsuleBase64Sha256':os.environ['CAPSULE_B64_SHA256'],'capsuleTgzSha256':os.environ['CAPSULE_TGZ_SHA256']},indent=2)+'\n')
PY_CAPSULE

echo '== Checkout immutable target baseline =='
git fetch --no-tags origin "refs/heads/${TARGET_BRANCH}"
test "$(git rev-parse FETCH_HEAD)" = "$BASE_SHA"
git checkout --detach "$BASE_SHA"
BASE_MATRIX_SHA="$(git hash-object "$MATRIX")"
printf '%s\n' "$BASE_MATRIX_SHA" > "$EVIDENCE/base-matrix-git-blob.txt"

echo '== Materialize exact shadow-pilot/noindex package =='
python <<'PY_MATERIALIZE'
import json,pathlib,shutil
root=pathlib.Path('/tmp/genesis6-phaseC'); pkg=root/'package'; m=json.loads((pkg/'manifest.json').read_text())
for e in m['files']:
    source=pkg/e['path']; target=pathlib.Path(e['path']); target.parent.mkdir(parents=True,exist_ok=True); shutil.copyfile(source,target)
PY_MATERIALIZE
# The candidate generated matrix is intentionally rejected: shadow-pilot routes are
# buildable Astro owners but are not production runtime matrix contracts.
git restore --source=HEAD --worktree -- "$MATRIX"
test "$(git hash-object "$MATRIX")" = "$BASE_MATRIX_SHA"
python <<'PY_SCOPE'
import json,subprocess
m=json.load(open('/tmp/genesis6-phaseC/package/manifest.json'))
expected=[e['path'] for e in m['files'] if e['path']!='migration/route-migration-matrix.json']
actual=sorted(subprocess.check_output(['git','ls-files','--modified','--others','--exclude-standard']).decode().splitlines())
if len(expected)!=18 or actual!=expected: raise SystemExit(f'diff mismatch\nexpected={expected}\nactual={actual}')
forbidden=[p for p in actual if p.startswith('.github/') or p.startswith('src/content/articles/') or p.startswith('css/') or p in {'feed.xml','sitemap.xml'}]
if forbidden: raise SystemExit(f'forbidden product paths: {forbidden}')
PY_SCOPE
for file in \
  src/content/articles/enoh-prorochestvoval-iuda-14-15-4q204.mdx \
  src/content/articles/angely-pod-mrakom-iuda-6-7-2-petra-2.mdx \
  src/content/articles/duhi-v-temnice-noi-kreshchenie-pobeda.mdx \
  src/content/articles/blagovestie-mertvym-1-petra-4-5-6.mdx
do
  grep -qx 'draft: true' "$file"
  grep -qx 'noindex: true' "$file"
done
python <<'PY_STATUS'
import json,pathlib
profiles=[
'hard-texts-angely-pod-mrakom-iuda-6-7-2-petra-2.json','hard-texts-blagovestie-mertvym-1-petra-4-5-6.json',
'hard-texts-duhi-v-temnice-noi-kreshchenie-pobeda.json','hard-texts-enoh-prorochestvoval-iuda-14-15-4q204.json','hard-texts-genesis-6.json']
own=json.load(open('migration/page-ownership.json'))['routes']
for name in profiles:
 d=json.load(open(pathlib.Path('data/route-profiles')/name)); r=d['route']
 if d.get('currentStatus')!='shadow-pilot' or d.get('seo',{}).get('indexable') is not False: raise SystemExit(f'profile staging boundary mismatch: {r}')
 if own[r].get('owner')!='astro' or own[r].get('status')!='shadow-pilot': raise SystemExit(f'ownership staging boundary mismatch: {r}')
PY_STATUS

echo '== Validate canonical registries and public exclusion =='
node scripts/sync-route-migration-matrix.js --check
node scripts/check-route-migration-matrix.js --strict
node scripts/check-route-profiles.js --strict
node scripts/public-surface-registry-audit.js
node scripts/series-reader-facade-regression-test.js
node scripts/sitemap-route-contract-test.js
node scripts/seo-route-contract-test.js
node scripts/search-index-policy-contract-test.js
node scripts/rss-route-contract-test.js

echo '== Install dependencies and validate source =='
npm ci
npm run astro:check
npm run engine:contracts
npm run workflows:check
npm run validate:static-publication

echo '== Build production-like shadow-pilot routes =='
npm run strangler:build:production-like
npm run page-ownership:dist:production-like
for route in \
  hard-texts/genesis-6 \
  hard-texts/enoh-prorochestvoval-iuda-14-15-4q204 \
  hard-texts/angely-pod-mrakom-iuda-6-7-2-petra-2 \
  hard-texts/duhi-v-temnice-noi-kreshchenie-pobeda \
  hard-texts/blagovestie-mertvym-1-petra-4-5-6
do
  test -s "dist/${route}/index.html"
  grep -qi 'noindex' "dist/${route}/index.html"
done

echo '== Remove generated audit outputs and seal exact tested product =='
git restore --source=HEAD --worktree -- reports 2>/dev/null || true
git clean -fd -- reports >/dev/null
python <<'PY_SEAL'
import hashlib,json,os,pathlib,shutil,subprocess
root=pathlib.Path('/tmp/genesis6-phaseC'); source=json.load(open(root/'package'/'manifest.json'))
paths=[e['path'] for e in source['files'] if e['path']!='migration/route-migration-matrix.json']
actual=sorted(subprocess.check_output(['git','ls-files','--modified','--others','--exclude-standard']).decode().splitlines())
if len(paths)!=18 or actual!=paths: raise SystemExit(f'tested product scope mismatch: {actual}')
product=root/'tested-product'; product.mkdir(parents=True,exist_ok=True); files=[]
for path in paths:
    src=pathlib.Path(path); dst=product/path; dst.parent.mkdir(parents=True,exist_ok=True); shutil.copyfile(src,dst)
    data=src.read_bytes(); files.append({'path':path,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'gitBlobSha':subprocess.check_output(['git','hash-object','--stdin'],input=data).decode().strip()})
final={'schemaVersion':4,'base':source['base'],'carrier':os.environ['CARRIER_SHA'],'publicationState':'shadow-pilot-noindex','unchangedContracts':['migration/route-migration-matrix.json'],'files':files}
mb=(json.dumps(final,ensure_ascii=False,indent=2)+'\n').encode(); (root/'evidence'/'tested-product-manifest.json').write_bytes(mb); (root/'evidence'/'tested-product-manifest.sha256').write_text(hashlib.sha256(mb).hexdigest()+'\n')
PY_SEAL
tar --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner -czf "$ROOT/tested-product.tgz" -C "$PRODUCT" .
sha256sum "$ROOT/tested-product.tgz" > "$EVIDENCE/tested-product.tgz.sha256"
echo '== Phase C shadow-pilot acceptance complete =='
