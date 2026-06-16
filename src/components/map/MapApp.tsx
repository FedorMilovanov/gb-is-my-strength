import React, { useState, useEffect, useCallback } from 'react';

// -- types --
interface Place {
  id: string; name: string; he?: string; x: number; y: number;
  stage: number; type: string; id1?: string; id2?: string;
  ep1?: string; ep2?: string; kick?: string; side?: string;
  story?: string; bible?: string; arch?: string;
  he_deep?: string; bible_extra?: string; dispute?: string;
  photos?: Array<{src:string;thumb?:string;label?:string;credit?:string;type?:string;alt?:string}>;
}
interface RouteData {
  meta: { title: string; title_he?: string; subtitle?: string; stats?: any };
  stories: Array<{ id: string; label: string; description?: string; place_ids?: string[]; stage_ids?: number[]; viewport?: number[] }>;
  places: Place[];
  stages: Array<{ n: string; t: string; km?: string; r: string; age?: string }>;
  verified_waypoints?: Array<{ id: string; name: string; x: number; y: number; stage: number; type: string }>;
  scientific_variants?: Record<string, Array<{status:string;title:string;detail?:string}>>;
}
interface MapAppProps { routeUrl: string; baseGeoUrl?: string; }

const STAGE_COLORS = ['#e8c879','#e0813f','#4a9e6e','#cf5b6b','#8b6b4a','#4a80b4'];
const TAB_LABELS: Record<string,string> = {
  story:'Сюжет',bible:'Писание',arch:'Археология',he:'Иврит',
  dispute:'Дискуссия',photos:'Фото',extra:'Библ.контекст'
};

// -- PlacePanel with ALL tabs --
function PlacePanel({ place, route, onClose, onPrev, onNext, hasPrev, hasNext }: {
  place: Place; route: RouteData; onClose: () => void;
  onPrev: () => void; onNext: () => void; hasPrev: boolean; hasNext: boolean;
}) {
  const [tab, setTab] = useState('story');
  const tabs = ['story','bible','arch','he','dispute','photos','extra'].filter(k => {
    if (k === 'bible') return !!place.bible;
    if (k === 'arch') return !!place.arch;
    if (k === 'he') return !!place.he_deep;
    if (k === 'dispute') return !!place.dispute;
    if (k === 'photos') return !!(place.photos?.length);
    if (k === 'extra') return !!place.bible_extra;
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 sm:p-5 border-b border-white/10 shrink-0 relative">
        <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-gb-txt-dim hover:text-white transition-colors text-lg">✕</button>
        <div className="text-gb-gold text-[10px] tracking-[0.2em] uppercase mb-2">
          Этап {place.stage + 1} · {place.id2 || ''}
        </div>
        <h2 className="font-serif text-xl sm:text-2xl text-white mb-1 pr-8">{place.name}</h2>
        {place.he && <div className="text-gb-gold font-serif text-base" dir="rtl">{place.he}</div>}
        {place.kick && <div className="text-gb-txt-dim text-xs mt-1 font-bold">{place.kick}</div>}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {place.id1 && <span className="text-[10px] text-gb-txt-dim/70 px-2 py-0.5 border border-white/10 rounded">{place.id1}</span>}
          {place.ep1 && <span className="text-[10px] text-gb-txt-dim/70 px-2 py-0.5 border border-white/10 rounded">{place.ep1}</span>}
        </div>
      </div>

      <div className="flex gap-0.5 px-3 pt-2 border-b border-white/5 shrink-0 overflow-x-auto">
        {tabs.map(k => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 py-2 text-xs rounded-t-lg transition-colors whitespace-nowrap ${tab === k ? 'text-gb-gold bg-gb-gold/10 border-b-2 border-gb-gold' : 'text-gb-txt-dim hover:text-gb-txt'}`}>
            {TAB_LABELS[k] || k}
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-5 overflow-y-auto flex-1 text-sm text-gb-txt-dim leading-relaxed space-y-3 custom-scrollbar">
        {tab === 'story' && place.story && (
          <div dangerouslySetInnerHTML={{ __html: place.story }} className="text-gb-txt [&_p]:mb-2 [&_.hw]:text-gb-gold [&_.hw]:text-lg [&_.verse]:italic [&_.verse]:border-l-2 [&_.verse]:border-gb-gold/50 [&_.verse]:pl-3 [&_.verse]:my-2 [&_.verse]:text-gb-txt-dim [&_.verse_span]:block [&_.verse_span]:text-[10px] [&_.verse_span]:text-gb-gold [&_.verse_span]:mt-1 [&_.note]:bg-white/5 [&_.note]:p-3 [&_.note]:rounded-lg [&_.note]:text-xs" />
        )}
        {tab === 'bible' && place.bible && (
          <div dangerouslySetInnerHTML={{ __html: place.bible }} className="[&_.verse]:italic [&_.verse]:border-l-2 [&_.verse]:border-gb-gold/50 [&_.verse]:pl-3 [&_.verse]:my-3 [&_.verse]:text-gb-txt [&_.verse_span]:block [&_.verse_span]:text-[10px] [&_.verse_span]:text-gb-gold [&_.verse_span]:mt-1" />
        )}
        {tab === 'arch' && place.arch && (
          <div>
            <h4 className="text-xs uppercase tracking-[0.1em] text-gb-gold mb-2 flex items-center gap-2"><span className="w-4 h-[1px] bg-gb-gold/50"></span>Археология</h4>
            <div dangerouslySetInnerHTML={{ __html: place.arch }} className="[&_p]:mb-2 [&_.note]:bg-white/5 [&_.note]:p-3 [&_.note]:rounded-lg [&_.note]:text-xs" />
          </div>
        )}
        {tab === 'he' && place.he_deep && (
          <div dangerouslySetInnerHTML={{ __html: place.he_deep }} className="[&_.he-block]:bg-white/5 [&_.he-block]:p-4 [&_.he-block]:rounded-xl [&_.he-word]:mb-2 [&_.hw]:text-gb-gold [&_.hw]:text-xl [&_.he-tr]:text-gb-txt-dim [&_.he-tr]:ml-2 [&_.he-etym]:text-xs [&_.he-refs]:text-[10px] [&_.he-refs]:text-gb-txt-dim/60 [&_.he-refs]:mt-2" />
        )}
        {tab === 'dispute' && place.dispute && (
          <div dangerouslySetInnerHTML={{ __html: place.dispute }} className="[&_.dispute-block]:bg-white/5 [&_.dispute-block]:p-4 [&_.dispute-block]:rounded-xl [&_.dispute-title]:text-gb-gold [&_.dispute-title]:font-bold [&_.dispute-title]:mb-2 [&_.dispute-pos]:pl-3 [&_.dispute-pos]:my-2 [&_.dispute-pos]:border-l-2 [&_.dispute-pos]:border-white/10 [&_.dispute-note]:text-[10px] [&_.dispute-note]:text-gb-txt-dim/60 [&_.dispute-note]:italic [&_.dispute-note]:mt-2 [&_.conf-hi]:text-green-400 [&_.conf-med]:text-yellow-400 [&_.conf-lo]:text-red-400" />
        )}
        {tab === 'photos' && place.photos && (
          <div className="space-y-3">
            {place.photos.map((ph,i) => (
              <div key={i}>
                <img src={ph.thumb || ph.src} alt={ph.alt || ph.label || ''} loading="lazy" className="w-full rounded-lg" />
                <div className="text-[10px] text-gb-txt-dim/60 mt-1">{ph.label} · {ph.credit}</div>
              </div>
            ))}
          </div>
        )}
        {tab === 'extra' && place.bible_extra && (
          <div dangerouslySetInnerHTML={{ __html: place.bible_extra }} className="[&_.bib-note]:bg-white/5 [&_.bib-note]:p-3 [&_.bib-note]:rounded-lg [&_.bib-note]:text-xs [&_.bib-note_b]:text-gb-gold" />
        )}
      </div>

      <div className="p-3 border-t border-white/10 shrink-0 flex items-center bg-black/30 sm:rounded-b-2xl">
        <button onClick={onPrev} disabled={!hasPrev} className="px-3 py-1.5 text-xs rounded-lg text-gb-txt-dim hover:text-white transition-colors disabled:opacity-30">← Назад</button>
        <div className="flex-1 flex justify-center gap-1">
          {route.places.map(p => <div key={p.id} className={`w-1.5 h-1.5 rounded-full ${p.id===place.id?'bg-gb-gold scale-125':'bg-white/20'}`} />)}
        </div>
        <button onClick={onNext} disabled={!hasNext} className="px-3 py-1.5 text-xs rounded-lg bg-gb-gold/10 text-gb-gold border border-gb-gold/30 hover:bg-gb-gold/20 transition-colors disabled:opacity-30">Далее →</button>
      </div>
    </div>
  );
}

// -- Main MapApp --
export default function MapApp({ routeUrl, baseGeoUrl }: MapAppProps) {
  const [route, setRoute] = useState<RouteData | null>(null);
  const [activePlace, setActivePlace] = useState<Place | null>(null);
  const [activeStory, setActiveStory] = useState('main');
  const [viewBox, setViewBox] = useState({ x: 0, y: 600, w: 1900, h: 830 });
  const [drag, setDrag] = useState<{sx:number;sy:number;vx:number;vy:number} | null>(null);

  useEffect(() => { fetch(routeUrl).then(r => r.json()).then(setRoute); }, [routeUrl]);

  const storyFiltered = useCallback(() => {
    if (!route) return [];
    const story = route.stories.find(s => s.id === activeStory);
    if (!story?.place_ids) return route.places;
    const ids = new Set(story.place_ids);
    return route.places.filter(p => ids.has(p.id));
  }, [route, activeStory]);

  const placeIndex = useCallback(() => {
    if (!activePlace) return -1;
    return storyFiltered().findIndex(p => p.id === activePlace.id);
  }, [activePlace, storyFiltered]);

  const navTo = (dir: 1 | -1) => {
    const vis = storyFiltered();
    if (!vis.length) return;
    setActivePlace(vis[(placeIndex() + dir + vis.length) % vis.length]);
  };

  const panStart = (e: React.PointerEvent) => {
    if ((e.target as Element).closest('button,a')) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDrag({ sx: e.clientX, sy: e.clientY, vx: viewBox.x, vy: viewBox.y });
  };
  const panMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const scale = rect.width / viewBox.w;
    setViewBox(v => ({ ...v, x: drag.vx - (e.clientX - drag.sx)/scale, y: drag.vy - (e.clientY - drag.sy)/scale }));
  };
  const panEnd = () => setDrag(null);
  const zoom = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const sc = rect.width / viewBox.w;
    const mx = viewBox.x + (e.clientX - rect.left)/sc;
    const my = viewBox.y + (e.clientY - rect.top)/sc;
    const nw = Math.max(300, Math.min(2600, viewBox.w * Math.exp(e.deltaY * 0.0014)));
    const k = nw / viewBox.w;
    setViewBox(v => ({ x: mx - (mx - v.x)*k, y: my - (my - v.y)*k, w: nw, h: nw * 1430/1900 }));
  };

  if (!route) return <div className="min-h-screen bg-[#070a10] flex items-center justify-center text-gb-txt-dim text-sm">Загрузка карты…</div>;

  const vis = storyFiltered();
  const waypoints = route.verified_waypoints || [];
  const stages = route.stages || [];

  return (
    <div className="relative w-full h-screen bg-[#070a10] overflow-hidden text-gb-txt font-sans select-none">
      <div className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onPointerDown={panStart} onPointerMove={panMove} onPointerUp={panEnd} onPointerCancel={panEnd} onWheel={zoom}>
        <svg viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`} className="w-full h-full">
          <rect x="-400" y="-400" width="2700" height="2230" fill="#0d1d2e" opacity="0.4" />
          {stages.map((_, i) => {
            const sp = route.places.filter(p => p.stage === i).sort((a,b) => a.stage - b.stage);
            if (sp.length < 2) return null;
            const d = sp.map((p,j) => `${j===0?'M':'L'}${p.x},${p.y}`).join(' ');
            return <path key={i} d={d} fill="none" stroke={STAGE_COLORS[i]} strokeWidth="3" strokeLinecap="round" opacity="0.6" />;
          })}
          <path d={route.places.map((p,i) => `${i===0?'M':'L'}${p.x},${p.y}`).join(' ')} fill="none" stroke="#e8c879" strokeWidth="3" strokeDasharray="10 10" opacity="0.4" />
          {waypoints.map(wp => (
            <g key={wp.id} transform={`translate(${wp.x},${wp.y})`} opacity="0.5">
              <circle r="3" fill="#e8c879" /><text x="8" y="3" fill="#9aa2ae" fontSize="8">{wp.name}</text>
            </g>
          ))}
          {route.places.map(place => {
            const inStory = vis.some(p => p.id === place.id);
            const active = activePlace?.id === place.id;
            return (
              <g key={place.id} transform={`translate(${place.x},${place.y})`}
                onClick={() => inStory && setActivePlace(place)}
                className={`cursor-pointer ${inStory ? 'opacity-100' : 'opacity-20 pointer-events-none'}`}>
                <circle r="14" fill="transparent" />
                <circle r={active ? 8 : 5} fill={active ? '#fff' : STAGE_COLORS[place.stage]} stroke={active ? STAGE_COLORS[place.stage] : '#0b0f16'} strokeWidth="2" />
                <text x={place.side === 'l' ? -14 : 14} y="4" textAnchor={place.side === 'l' ? 'end' : 'start'}
                  fill={inStory ? '#f4eedd' : '#555'} fontSize="12" className="pointer-events-none drop-shadow-md">{place.name}</text>
              </g>
            );
          })}
        </svg>
      </div>

      <header className="absolute top-0 left-0 right-0 p-3 sm:p-5 pointer-events-none flex flex-col sm:flex-row justify-between items-start gap-3 z-10">
        <div>
          <a href="/karty/" className="pointer-events-auto inline-flex items-center gap-1.5 text-gb-txt-dim hover:text-gb-gold transition-colors text-[10px] tracking-[0.15em] uppercase mb-3 bg-black/50 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md">← Все карты</a>
          <h1 className="font-serif text-2xl sm:text-3xl text-white drop-shadow-lg leading-tight">{route.meta.title}</h1>
          {route.meta.title_he && <p className="text-gb-gold tracking-[0.2em] text-base mt-0.5 drop-shadow-md" dir="rtl">{route.meta.title_he}</p>}
          {route.meta.subtitle && <p className="text-gb-txt-dim text-xs mt-1">{route.meta.subtitle}</p>}
        </div>
        <div className="pointer-events-auto flex gap-1.5 flex-wrap">
          {route.stories.map(story => (
            <button key={story.id} onClick={() => { setActiveStory(story.id); setActivePlace(null); }}
              className={`px-3 py-1.5 rounded-full text-xs transition-all backdrop-blur-md border ${activeStory === story.id ? 'bg-gb-gold/20 text-gb-gold border-gb-gold/40' : 'bg-black/50 text-gb-txt-dim border-white/10 hover:border-white/20 hover:text-gb-txt'}`}>
              {story.label}
            </button>
          ))}
        </div>
      </header>

      {stages.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 sm:left-auto sm:right-4 sm:bottom-4 z-10 flex justify-center sm:justify-end pointer-events-none">
          <div className="pointer-events-auto flex gap-1.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5 overflow-x-auto max-w-full">
            {stages.map((st, i) => (
              <div key={i} className="flex items-center gap-1 text-[10px] text-gb-txt-dim/70 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: STAGE_COLORS[i]}}></span>{st.n}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={`absolute bottom-0 left-0 right-0 sm:left-4 sm:bottom-4 sm:right-auto sm:w-[420px] bg-[#0d111a]/95 backdrop-blur-xl border border-gb-gold/20 sm:rounded-2xl transition-transform duration-400 ease-out flex flex-col shadow-2xl z-20 ${activePlace ? 'translate-y-0 h-[60vh] sm:h-[70vh] max-h-[85vh]' : 'translate-y-[120%] h-0'}`}>
        {activePlace && (
          <PlacePanel place={activePlace} route={route} onClose={() => setActivePlace(null)}
            onPrev={() => navTo(-1)} onNext={() => navTo(1)}
            hasPrev={placeIndex() > 0} hasNext={placeIndex() < vis.length - 1} />
        )}
      </div>
    </div>
  );
}
