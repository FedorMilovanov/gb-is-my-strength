import React, { useState, useEffect } from 'react';

interface RouteData {
  meta: {
    title: string;
    title_he: string;
    subtitle: string;
  };
  stories: Array<{
    id: string;
    label: string;
    description: string;
  }>;
  places: Array<{
    id: string;
    name: string;
    he: string;
    x: number;
    y: number;
    stage: number;
    id2: string;
    story: string;
    bible?: string;
    arch?: string;
  }>;
}

interface MapAppProps {
  routeUrl: string;
  baseGeoUrl?: string;
}

export default function MapApp({ routeUrl, baseGeoUrl }: MapAppProps) {
  const [route, setRoute] = useState<RouteData | null>(null);
  const [activePlace, setActivePlace] = useState<any>(null);
  const [activeStory, setActiveStory] = useState('main');

  useEffect(() => {
    fetch(routeUrl).then(res => res.json()).then(data => {
      setRoute(data);
    });
  }, [routeUrl]);

  if (!route) {
    return <div className="min-h-screen bg-gb-bg flex items-center justify-center text-gb-txt-dim">Загрузка данных карты...</div>;
  }

  const handleMarkerClick = (place: any) => {
    setActivePlace(place);
  };

  return (
    <div className="relative w-full h-screen bg-[#070a10] overflow-hidden text-gb-txt font-sans select-none">
      
      {/* MAP VIEWPORT (Simplified for pilot) */}
      <div className="absolute inset-0 cursor-grab">
        <svg viewBox="0 0 1900 1430" className="w-full h-full object-cover opacity-60">
          <rect width="1900" height="1430" fill="#0d1d2e" opacity="0.3" />
          
          <path 
            d={`M ${route.places.map(p => `${p.x},${p.y}`).join(' L ')}`} 
            fill="none" stroke="#e8c879" strokeWidth="3" strokeDasharray="10 10" className="opacity-50" 
          />

          {route.places.map((place) => (
            <g key={place.id} transform={`translate(${place.x}, ${place.y})`} onClick={() => handleMarkerClick(place)} className="cursor-pointer group">
              <circle r="12" fill="transparent" />
              <circle r="5" fill={activePlace?.id === place.id ? '#fff' : '#e8c879'} stroke="#0b0f16" strokeWidth="2" className="transition-colors" />
              <text y="-12" textAnchor="middle" fill="#f4eedd" fontSize="16" className="pointer-events-none opacity-80 group-hover:opacity-100 drop-shadow-md">
                {place.name}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* TOP HEADER */}
      <header className="absolute top-0 left-0 right-0 p-4 sm:p-6 pointer-events-none flex justify-between items-start z-10">
        <div>
          <a href="/karty/" className="pointer-events-auto inline-flex items-center gap-2 text-gb-txt-dim hover:text-gb-gold transition-colors text-xs tracking-[0.15em] uppercase mb-4 bg-black/40 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
            ← Все карты
          </a>
          <h1 className="font-serif text-3xl sm:text-4xl text-white drop-shadow-lg leading-tight">
            {route.meta.title}
          </h1>
          <p className="text-gb-gold tracking-[0.2em] text-lg mt-1 drop-shadow-md" dir="rtl">{route.meta.title_he}</p>
        </div>
        
        {/* STORY SELECTOR */}
        <div className="pointer-events-auto bg-black/60 backdrop-blur-md border border-white/10 rounded-xl p-2 hidden sm:flex flex-col gap-1">
          {route.stories.map(story => (
            <button 
              key={story.id} 
              onClick={() => { setActiveStory(story.id); setActivePlace(null); }}
              className={`text-left px-4 py-2 rounded-lg text-sm transition-colors ${activeStory === story.id ? 'bg-gb-gold/20 text-gb-gold border border-gb-gold/30' : 'text-gb-txt-dim hover:text-gb-txt hover:bg-white/5'}`}
            >
              <div className="font-bold">{story.label}</div>
              <div className="text-[10px] opacity-70">{story.description}</div>
            </button>
          ))}
        </div>
      </header>

      {/* BOTTOM PANEL */}
      <div className={`absolute bottom-0 left-0 right-0 sm:left-6 sm:bottom-6 sm:right-auto sm:w-[400px] bg-[#0d111a]/90 backdrop-blur-xl border border-gb-gold/20 sm:rounded-2xl transition-transform duration-500 ease-out flex flex-col max-h-[85vh] z-20 shadow-2xl ${activePlace ? 'translate-y-0' : 'translate-y-[120%]'}`}>
        
        {activePlace && (
          <>
            <div className="p-5 border-b border-white/10 shrink-0 relative">
              <button onClick={() => setActivePlace(null)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-gb-txt-dim hover:text-white transition-colors">
                ✕
              </button>
              <div className="text-gb-gold text-[10px] tracking-[0.2em] uppercase mb-2">
                Этап {activePlace.stage + 1} · {activePlace.id2}
              </div>
              <h2 className="font-serif text-2xl text-white mb-1">{activePlace.name}</h2>
              <div className="text-gb-gold font-serif text-lg" dir="rtl">{activePlace.he}</div>
            </div>

            <div className="p-5 overflow-y-auto overflow-x-hidden flex-1 text-sm text-gb-txt-dim leading-relaxed space-y-4 custom-scrollbar">
              <div dangerouslySetInnerHTML={{ __html: activePlace.story }} className="text-gb-txt" />
              
              {activePlace.bible && (
                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                  <div dangerouslySetInnerHTML={{ __html: activePlace.bible }} className="italic" />
                </div>
              )}
              
              {activePlace.arch && (
                <div>
                  <h4 className="text-xs uppercase tracking-[0.1em] text-gb-gold mb-2 flex items-center gap-2">
                    <span className="w-4 h-[1px] bg-gb-gold/50"></span>
                    Археология
                  </h4>
                  <div dangerouslySetInnerHTML={{ __html: activePlace.arch }} />
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-white/10 shrink-0 flex justify-between items-center bg-black/20 sm:rounded-b-2xl">
              <button className="px-4 py-2 rounded-lg text-xs tracking-wider uppercase text-gb-txt-dim hover:text-white transition-colors">
                ← Назад
              </button>
              <div className="flex gap-1">
                {route.places.map((p) => (
                  <div key={p.id} className={`w-1.5 h-1.5 rounded-full ${p.id === activePlace.id ? 'bg-gb-gold' : 'bg-white/20'}`} />
                ))}
              </div>
              <button className="px-4 py-2 rounded-lg text-xs tracking-wider uppercase bg-gb-gold/10 text-gb-gold border border-gb-gold/30 hover:bg-gb-gold/20 transition-colors">
                Далее →
              </button>
            </div>
          </>
        )}
      </div>

    </div>
  );
}
