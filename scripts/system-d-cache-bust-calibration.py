from pathlib import Path

p = Path('scripts/lib/cache-bust-workflow-policy.js')
s = p.read_text()
replacements = [
    (
        "    requireMatch(GLOSSARY_WORKFLOW, glossary, /name:\\s*Checkout pull request branch[\\s\\S]{0,180}?ref:\\s*\\$\\{\\{\\s*github\\.event\\.pull_request\\.head\\.ref\\s*\\}\\}/, 'writer must checkout the explicit pull-request head branch');",
        "    requireMatch(GLOSSARY_WORKFLOW, glossary, /name:\\s*Checkout pull request branch[\\s\\S]{0,180}?ref:\\s*\\$\\{\\{\\s*github\\.event\\.pull_request\\.head\\.sha\\s*\\}\\}/, 'writer must checkout the immutable queued pull-request head');",
    ),
    (
        "    requireMatch(GLOSSARY_WORKFLOW, glossary, /git push origin [\"']HEAD:\\$\\{HEAD_REF\\}[\"']/, 'writer must push only back to the requesting pull-request branch');",
        "    requireMatch(GLOSSARY_WORKFLOW, glossary, /git push --force-with-lease=\"refs\\/heads\\/\\$\\{HEAD_REF\\}:\\$\\{EXPECTED_HEAD\\}\" origin \"HEAD:\\$\\{HEAD_REF\\}\"/, 'writer must CAS-push only back to the requesting pull-request branch at the queued head');",
    ),
    (
        "      ['glossary writer pushes main', withWorkflow(baseline, GLOSSARY_WORKFLOW, glossary.replace('git push origin \"HEAD:${HEAD_REF}\"', 'git push origin HEAD:main'))],",
        "      ['glossary writer checks out mutable branch', withWorkflow(baseline, GLOSSARY_WORKFLOW, glossary.replace('github.event.pull_request.head.sha', 'github.event.pull_request.head.ref'))],\n      ['glossary writer pushes main', withWorkflow(baseline, GLOSSARY_WORKFLOW, glossary.replace('git push --force-with-lease=\"refs/heads/${HEAD_REF}:${EXPECTED_HEAD}\" origin \"HEAD:${HEAD_REF}\"', 'git push origin HEAD:main'))],",
    ),
]
for old, new in replacements:
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'cache-bust writer policy replacement expected 1 got {count}: {old[:100]!r}')
    s = s.replace(old, new, 1)
p.write_text(s)
Path('scripts/system-d-cache-bust-calibration.py').unlink()
