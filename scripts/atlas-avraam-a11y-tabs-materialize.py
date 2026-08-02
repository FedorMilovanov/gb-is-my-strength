from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "karty/_engine/map-engine.js"
WITNESS = ROOT / "scripts/audit-browser-runtime-wave.mjs"
SELF = ROOT / "scripts/atlas-avraam-a11y-tabs-materialize.py"
WORKFLOW = ROOT / ".github/workflows/atlas-avraam-a11y-tabs-materialize.yml"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


engine = ENGINE.read_text(encoding="utf-8")
engine = replace_once(
    engine,
    '          <h1 class="me-intro__title">${esc(route.meta?.title || \'\')}</h1>',
    '          <h2 class="me-intro__title">${esc(route.meta?.title || \'\')}</h2>',
    "intro heading owner",
)

engine = replace_once(
    engine,
    """      const tabsEl=panel.querySelector('.me-tabs');
      const content=panel.querySelector('.me-content');
      const nav=panel.querySelector('.me-nav');""",
    """      const tabsEl=panel.querySelector('.me-tabs');
      const content=panel.querySelector('.me-content');
      const nav=panel.querySelector('.me-nav');
      tabsEl.setAttribute('role','tablist');
      tabsEl.setAttribute('aria-label','Разделы о месте');
      tabsEl.setAttribute('aria-orientation','horizontal');
      content.id=`me-tabpanel-${mapInstanceToken}`;
      content.setAttribute('role','tabpanel');
      content.setAttribute('tabindex','0');""",
    "tabpanel ownership",
)

old_tabs = """      // Tabs
      tabsEl.innerHTML=availTabs.map(k=>`<button class="me-tab${k===activeTab?' me-tab--active':''}" data-tab="${k}">${TAB_LABELS[k]||k}</button>`).join('');
      tabsEl.querySelectorAll('.me-tab').forEach(btn=>{
        btn.addEventListener('click',()=>{
          tabsEl.querySelectorAll('.me-tab').forEach(b=>b.classList.remove('me-tab--active'));
          btn.classList.add('me-tab--active');
          btn.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
          renderTabContent(btn.dataset.tab||'story',place);
        });
      });

      requestAnimationFrame(()=>tabsEl.querySelector('.me-tab--active')?.scrollIntoView({block:'nearest',inline:'start'}));
"""
new_tabs = """      // Tabs — one ARIA tab widget with roving focus and local keyboard ownership.
      tabsEl.innerHTML=availTabs.map(k=>{
        const selected=k===activeTab;
        return `<button class="me-tab${selected?' me-tab--active':''}" id="me-tab-${mapInstanceToken}-${k}" data-tab="${k}" role="tab" aria-selected="${selected?'true':'false'}" aria-controls="${content.id}" tabindex="${selected?'0':'-1'}">${TAB_LABELS[k]||k}</button>`;
      }).join('');
      const tabButtons=[...tabsEl.querySelectorAll('.me-tab')];
      const activateTabButton=(btn,{focus=false}={})=>{
        tabButtons.forEach(candidate=>{
          const selected=candidate===btn;
          candidate.classList.toggle('me-tab--active',selected);
          candidate.setAttribute('aria-selected',selected?'true':'false');
          candidate.tabIndex=selected?0:-1;
        });
        content.setAttribute('aria-labelledby',btn.id);
        btn.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
        renderTabContent(btn.dataset.tab||'story',place);
        if(focus)btn.focus();
      };
      tabButtons.forEach((btn,index)=>{
        btn.addEventListener('click',()=>activateTabButton(btn));
        btn.addEventListener('keydown',event=>{
          const key=event.key;
          if(key===' '||key==='Spacebar'||key==='Enter'){
            event.preventDefault();event.stopPropagation();
            activateTabButton(btn,{focus:true});
            return;
          }
          let nextIndex=null;
          if(key==='ArrowRight'||key==='ArrowDown')nextIndex=(index+1)%tabButtons.length;
          else if(key==='ArrowLeft'||key==='ArrowUp')nextIndex=(index-1+tabButtons.length)%tabButtons.length;
          else if(key==='Home')nextIndex=0;
          else if(key==='End')nextIndex=tabButtons.length-1;
          if(nextIndex!==null){
            event.preventDefault();event.stopPropagation();
            activateTabButton(tabButtons[nextIndex],{focus:true});
          }
        });
      });
      const initialTab=tabButtons.find(btn=>btn.classList.contains('me-tab--active'))||tabButtons[0];
      if(initialTab)content.setAttribute('aria-labelledby',initialTab.id);

      requestAnimationFrame(()=>initialTab?.scrollIntoView({block:'nearest',inline:'start'}));
"""
engine = replace_once(engine, old_tabs, new_tabs, "panel tab contract")

if engine.count('<h1 class="me-intro__title">') != 0:
    raise SystemExit("intro h1 still present")
if engine.count('<h2 class="me-intro__title">') != 1:
    raise SystemExit("intro h2 count drift")
if engine.count("tabsEl.setAttribute('role','tablist')") != 1:
    raise SystemExit("tablist role count drift")
if engine.count("role=\"tab\"") != 1:
    raise SystemExit("tab role template count drift")
if engine.count("event.stopPropagation();") < 2:
    raise SystemExit("local tab keyboard isolation missing")
ENGINE.write_text(engine, encoding="utf-8")

witness = WITNESS.read_text(encoding="utf-8")
witness = replace_once(
    witness,
    "const nativeButtons = structure.length > 0 && structure.every((tab) => tab.tagName === 'BUTTON' && tab.tabIndexProperty >= 0);",
    "const nativeButtons = structure.length > 0 && structure.every((tab) => tab.tagName === 'BUTTON');\n    const rovingTabindex = structure.length > 0\n      && structure.filter((tab) => tab.tabIndexProperty === 0).length === 1\n      && structure.filter((tab) => tab.tabIndexProperty === -1).length === structure.length - 1;",
    "witness native/roving distinction",
)
witness = replace_once(
    witness,
    "      nativeButtons,\n      historicalDivClaimReproduced:",
    "      nativeButtons,\n      rovingTabindex,\n      historicalDivClaimReproduced:",
    "witness roving evidence",
)
witness = replace_once(
    witness,
    "      residual: !ariaTabPattern || !spaceWorks || !arrowNavigationWorks\n        ? 'Native buttons replaced divs and Enter/numeric activation work, but the ARIA tablist/tab/aria-selected/roving-tabindex contract is absent; Space or arrow handling is not isolated as a tab widget.'\n        : null,",
    "      residual: !ariaTabPattern || !rovingTabindex || !spaceWorks || !arrowNavigationWorks\n        ? 'The panel tabs still lack one or more required tab-widget contracts: ARIA ownership, roving tabindex, Space activation or isolated arrow navigation.'\n        : null,",
    "witness residual contract",
)
WITNESS.write_text(witness, encoding="utf-8")

SELF.unlink()
WORKFLOW.unlink()
