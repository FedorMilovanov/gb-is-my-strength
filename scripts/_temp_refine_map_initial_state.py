#!/usr/bin/env python3
from pathlib import Path

path=Path('karty/_engine/map-engine.js')
text=path.read_text(encoding='utf-8')


def replace_once(old,new,label):
    global text
    count=text.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    text=text.replace(old,new,1)

replace_once(
"""    const queryHas=query.has('story')||query.has('place');
    const hashHas=hash.has('story')||hash.has('place');
    const normalized=_normalizeMapStateCandidate(route,{
      story:query.get('story')||hash.get('story'),
      place:query.get('place')||hash.get('place')
    },_defaultStoryId(route));
    return {...normalized,hasExplicit:queryHas||hashHas,source:queryHas?'query':(hashHas?'hash':'default')};""",
"""    const queryHas=query.has('story')||query.has('place');
    const hashHas=hash.has('story')||hash.has('place');
    const sourceParams=queryHas?query:hash;
    const normalized=_normalizeMapStateCandidate(route,{
      story:sourceParams.get('story'),
      place:sourceParams.get('place')
    },_defaultStoryId(route));
    return {...normalized,hasExplicit:queryHas||hashHas,source:queryHas?'query':(hashHas?'hash':'default')};""",
'atomic URL source precedence')

replace_once(
"""    const initVp = initialState.viewport || [cfg.W0/2,cfg.H0/2,cfg.W0];
    const initW=clamp(Number(initVp[2])||cfg.W0,cfg.minW,cfg.maxW);
    const initH=initW*cfg.H0/cfg.W0;
    view={
      x:clamp((Number(initVp[0])||cfg.W0/2)-initW/2,-cfg.padX,cfg.W0+cfg.padX-initW),
      y:clamp((Number(initVp[1])||cfg.H0/2)-initH/2,-cfg.padY,cfg.H0+cfg.padY-initH),
      w:initW,h:initH
    };""",
"""    const initVp = initialState.viewport || [cfg.W0/2,cfg.H0/2,cfg.W0];
    const rawCx=Number(initVp[0]),rawCy=Number(initVp[1]),rawW=Number(initVp[2]);
    const initCx=Number.isFinite(rawCx)?rawCx:cfg.W0/2;
    const initCy=Number.isFinite(rawCy)?rawCy:cfg.H0/2;
    const initW=clamp(Number.isFinite(rawW)&&rawW>0?rawW:cfg.W0,cfg.minW,cfg.maxW);
    const initH=initW*cfg.H0/cfg.W0;
    view={
      x:clamp(initCx-initW/2,-cfg.padX,cfg.W0+cfg.padX-initW),
      y:clamp(initCy-initH/2,-cfg.padY,cfg.H0+cfg.padY-initH),
      w:initW,h:initH
    };""",
'finite initial viewport')

path.write_text(text,encoding='utf-8')
print('initial-state edge refinements applied')
