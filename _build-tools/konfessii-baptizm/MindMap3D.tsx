import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, WheelEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, BookOpen, ChevronDown, ChevronLeft, ChevronRight, Eye, EyeOff, Focus, Maximize2, Minimize2, MapPin, PanelLeftClose, Pin, PinOff, RotateCcw, Sparkles, X, HelpCircle } from 'lucide-react';
import { geoMercator, geoPath } from 'd3-geo';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import SpriteText from 'three-spritetext';
import { feature } from 'topojson-client';
import worldAtlas from 'world-atlas/countries-110m.json';
import { getMapPlaceRecord } from '../data/history/mapPlaces';
import { personProfiles } from '../data/history/persons';
import { biographyDisputes } from '../data/history/biographyDisputes';
import { useTheme } from './ThemeContext';
import { createGlowMaterial, createPremiumMaterial } from './mindmap3d/materials';
import { resolveKind } from './mindmap3d/nodeKind';
import type { LinkData, MapSelection, NodeData, RoutePreset } from './mindmap3d/types';
import { timelineEvents, categoryColors, categoryLabels } from '../data/timeline';
import { ANCHORS, CITY_MARKERS, COUNTRY_FOCUS, GROUP_COLORS, GROUP_LABELS, LINKS, MAP_AREAS, NODES, ROUTE_PRESETS } from './mindmap3d/data';

let mindMapOverlaySequence = 0;

const NIGHT_MAP_DATA_URL: string | null = (() => {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const size = 1024;
  canvas.width = size * 2; canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#040408';
  ctx.fillRect(0, 0, size * 2, size);
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * size * 2; const y = Math.random() * size; const r = Math.random() * 1.2;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200,200,255,${0.1 + Math.random() * 0.3})`; ctx.fill();
  }
  ctx.fillStyle = 'rgba(30,40,60,0.25)';
  ctx.beginPath(); ctx.moveTo(size * 0.25, size * 0.22);
  ctx.quadraticCurveTo(size * 0.3, size * 0.15, size * 0.38, size * 0.18);
  ctx.quadraticCurveTo(size * 0.42, size * 0.2, size * 0.4, size * 0.32);
  ctx.quadraticCurveTo(size * 0.35, size * 0.38, size * 0.28, size * 0.35);
  ctx.quadraticCurveTo(size * 0.22, size * 0.3, size * 0.25, size * 0.22); ctx.fill();
  ctx.beginPath(); ctx.moveTo(size * 0.38, size * 0.18);
  ctx.quadraticCurveTo(size * 0.5, size * 0.14, size * 0.7, size * 0.18);
  ctx.quadraticCurveTo(size * 0.85, size * 0.22, size * 0.9, size * 0.3);
  ctx.quadraticCurveTo(size * 0.82, size * 0.38, size * 0.7, size * 0.35);
  ctx.quadraticCurveTo(size * 0.55, size * 0.32, size * 0.4, size * 0.32); ctx.fill();
  ctx.beginPath(); ctx.moveTo(size * 0.28, size * 0.35);
  ctx.quadraticCurveTo(size * 0.32, size * 0.42, size * 0.35, size * 0.45);
  ctx.quadraticCurveTo(size * 0.3, size * 0.5, size * 0.25, size * 0.42);
  ctx.quadraticCurveTo(size * 0.22, size * 0.38, size * 0.28, size * 0.35); ctx.fill();
  ctx.beginPath(); ctx.moveTo(size * 0.55, size * 0.32);
  ctx.quadraticCurveTo(size * 0.6, size * 0.38, size * 0.58, size * 0.48);
  ctx.quadraticCurveTo(size * 0.52, size * 0.42, size * 0.55, size * 0.32); ctx.fill();
  ctx.beginPath(); ctx.moveTo(size * 0.7, size * 0.35);
  ctx.quadraticCurveTo(size * 0.75, size * 0.42, size * 0.72, size * 0.5);
  ctx.quadraticCurveTo(size * 0.68, size * 0.45, size * 0.7, size * 0.35); ctx.fill();
  const cityClusters = [
    { x: 0.28, y: 0.32, r: 25, b: 0.9 }, { x: 0.25, y: 0.3, r: 20, b: 0.7 },
    { x: 0.35, y: 0.35, r: 18, b: 0.6 }, { x: 0.55, y: 0.35, r: 22, b: 0.7 },
    { x: 0.6, y: 0.4, r: 15, b: 0.5 }, { x: 0.7, y: 0.38, r: 18, b: 0.6 },
    { x: 0.22, y: 0.38, r: 15, b: 0.5 }, { x: 0.3, y: 0.4, r: 12, b: 0.4 },
    { x: 0.45, y: 0.35, r: 14, b: 0.4 }, { x: 0.52, y: 0.42, r: 16, b: 0.5 },
    { x: 0.75, y: 0.45, r: 12, b: 0.4 }, { x: 0.15, y: 0.28, r: 18, b: 0.5 },
    { x: 0.12, y: 0.32, r: 20, b: 0.6 }, { x: 0.18, y: 0.4, r: 14, b: 0.4 },
    { x: 0.65, y: 0.42, r: 10, b: 0.3 }, { x: 0.27, y: 0.36, r: 12, b: 0.35 },
    { x: 0.32, y: 0.33, r: 10, b: 0.3 }, { x: 0.5, y: 0.28, r: 8, b: 0.25 },
  ];
  cityClusters.forEach((c) => {
    const cx = c.x * size * 2; const cy = c.y * size;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, c.r);
    g.addColorStop(0, `rgba(255,200,120,${c.b * 0.5})`);
    g.addColorStop(0.5, `rgba(255,180,80,${c.b * 0.15})`);
    g.addColorStop(1, 'rgba(255,160,60,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - c.r, cy - c.r, c.r * 2, c.r * 2);
    ctx.beginPath(); ctx.arc(cx, cy, 2 + c.b * 2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,240,200,${0.6 + c.b * 0.4})`; ctx.fill();
  });
  for (let i = 0; i < 800; i++) {
    const x = 0.15 + Math.random() * 0.7; const y = 0.2 + Math.random() * 0.3;
    const b = Math.random();
    if (b > 0.7) {
      ctx.beginPath(); ctx.arc(x * size * 2, y * size, 0.5 + Math.random() * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,210,130,${b * 0.25})`; ctx.fill();
    }
  }
  return canvas.toDataURL();
})();

const glowTextureCache = new Map<string, THREE.CanvasTexture>();
function getGlowSprite(hex: string): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  if (glowTextureCache.has(hex)) return glowTextureCache.get(hex)!;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0.0, `rgba(${r},${g},${b},1.0)`);
  grad.addColorStop(0.1, `rgba(${r},${g},${b},0.85)`);
  grad.addColorStop(0.25, `rgba(${r},${g},${b},0.5)`);
  grad.addColorStop(0.45, `rgba(${r},${g},${b},0.2)`);
  grad.addColorStop(0.7, `rgba(${r},${g},${b},0.06)`);
  grad.addColorStop(1.0, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  glowTextureCache.set(hex, tex);
  return tex;
}

let cosmosBuilt = false;
function buildCosmos(scene: THREE.Scene, isLight: boolean) {
  if (cosmosBuilt || isLight) return;
  cosmosBuilt = true;
  const layers = [
    { count: 900, dist: 900, size: 1.6, op: 0.55, tint: '#cdd6f5' },
    { count: 600, dist: 1500, size: 2.4, op: 0.42, tint: '#e8c879' },
    { count: 350, dist: 2000, size: 3.4, op: 0.30, tint: '#9ab0ff' },
  ];
  layers.forEach((L) => {
    const positions = new Float32Array(L.count * 3);
    for (let i = 0; i < L.count; i++) {
      const u = Math.random(), v = Math.random();
      const theta = 2 * Math.PI * u, phi = Math.acos(2 * v - 1);
      const r = L.dist * (0.7 + Math.random() * 0.3);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: new THREE.Color(L.tint), size: L.size, sizeAttenuation: true,
      transparent: true, opacity: L.op, depthWrite: false, blending: THREE.AdditiveBlending,
      map: getGlowSprite('#ffffff') || undefined,
    });
    const pts = new THREE.Points(geo, mat);
    pts.userData = { cosmos: true, twinkle: L.op };
    pts.renderOrder = -10;
    scene.add(pts);
  });
  const nebDefs = [
    { hex: '#c4a67e', x: -620, y: 360, z: -700, scale: 1200, op: 0.10 },
    { hex: '#6a4a8a', x: 680, y: -300, z: -820, scale: 1400, op: 0.09 },
    { hex: '#2a5a8a', x: 120, y: 520, z: -1000, scale: 1100, op: 0.07 },
  ];
  nebDefs.forEach((n) => {
    const tex = getGlowSprite(n.hex);
    if (!tex) return;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: n.op, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
    const spr = new THREE.Sprite(mat);
    spr.position.set(n.x, n.y, n.z);
    spr.scale.set(n.scale, n.scale, 1);
    spr.userData = { cosmos: true, nebula: true };
    spr.renderOrder = -11;
    scene.add(spr);
  });
}

function makeInitialTube(radius: number) { const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0,0,0), new THREE.Vector3(0,8,0), new THREE.Vector3(0,16,0)); return new THREE.TubeGeometry(c, 12, radius, 6, false); }
function makeLinkCurve(start: THREE.Vector3, end: THREE.Vector3) { const d = start.distanceTo(end); const m = start.clone().add(end).multiplyScalar(0.5); const t = end.clone().sub(start).normalize(); const b = Math.abs(t.dot(new THREE.Vector3(0,1,0))) > 0.82 ? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,1,0); const n = b.sub(t.clone().multiplyScalar(b.dot(t))).normalize(); const lift = Math.min(Math.max(d * 0.16, 8), 32); return new THREE.QuadraticBezierCurve3(start, m.add(n.multiplyScalar(lift)), end); }
function resolveNode(input: string | NodeData) { return typeof input === 'object' ? input : NODES.find((n) => n.id === input); }

function haptic(ms = 6) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms);
}

function PanelButton({ children, onClick, active, danger, title, className = '' }: { children: ReactNode; onClick: () => void; active?: boolean; danger?: boolean; title?: string; className?: string }) {
  return (
    <button
      onClick={(event) => { event.stopPropagation(); haptic(danger ? 10 : 5); onClick(); }}
      aria-label={title}
      className={`grid h-8 w-8 place-items-center rounded-full border transition-all hover:scale-105 active:scale-95 ${className}`}
      style={{
        background: active ? 'rgba(196,166,126,0.16)' : danger ? 'rgba(255,75,110,0.1)' : 'rgba(255,255,255,0.06)',
        color: active ? '#c4a67e' : danger ? 'rgba(255,75,110,0.78)' : 'rgba(255,255,255,0.52)',
        borderColor: active ? 'rgba(196,166,126,0.42)' : danger ? 'rgba(255,75,110,0.18)' : 'rgba(255,255,255,0.08)',
      }}
    >
      {children}
    </button>
  );
}

function SceneControls({ mapMode, zenMode, hasFocus, cameraNavEnabled, onToggleMap, onToggleZen, onToggleCameraNav, onReset, onOverview, onFocusReturn, onToggleLegend }: any) {
  return (
    <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, ease: 'easeOut' }} className="absolute right-4 top-4 z-30 flex flex-col items-end gap-2">
      <button onClick={() => { haptic(5); onToggleMap(); }} className="group flex items-center gap-2 rounded-full border px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.14em] backdrop-blur-2xl transition-all active:scale-95" style={{ background: mapMode ? 'rgba(196,166,126,0.14)' : 'rgba(5,5,12,0.62)', borderColor: mapMode ? 'rgba(196,166,126,0.42)' : 'rgba(255,255,255,0.10)', color: mapMode ? '#c4a67e' : 'rgba(255,255,255,0.78)', boxShadow: mapMode ? '0 4px 18px rgba(196,166,126,0.20)' : '0 4px 16px rgba(0,0,0,0.32)' }} aria-label={mapMode ? 'Режим карты — клик по странам/городам' : 'Режим графа — клик по узлам'}>
        <span className="h-1.5 w-1.5 rounded-full transition-colors" style={{ background: mapMode ? '#c4a67e' : 'rgba(255,255,255,0.45)', boxShadow: mapMode ? '0 0 6px #c4a67e' : 'none' }} />
        {mapMode ? 'Карта' : 'Граф'}
      </button>
      <div className="flex flex-col gap-1.5 rounded-2xl border border-white/[0.08] bg-black/45 p-1.5 backdrop-blur-2xl" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.32)' }}>
        <PanelButton onClick={onToggleLegend} title="Легенда карты" className="h-8 w-8 border-transparent bg-transparent"><HelpCircle size={14} /></PanelButton>
        <PanelButton active={zenMode} onClick={onToggleZen} title={zenMode ? 'Показать интерфейс' : 'Чистый вид'} className="h-8 w-8 border-transparent bg-transparent">{zenMode ? <Eye size={14} /> : <EyeOff size={14} />}</PanelButton>
        <PanelButton active={cameraNavEnabled} onClick={onToggleCameraNav} title={cameraNavEnabled ? 'Скрыть стрелки камеры' : 'Показать стрелки камеры'} className="h-8 w-8 border-transparent bg-transparent"><span className="font-mono text-[9px] font-black tracking-[-0.02em]">NAV</span></PanelButton>
        <PanelButton onClick={onReset} title="Сбросить вид" className="h-8 w-8 border-transparent bg-transparent"><RotateCcw size={14} /></PanelButton>
        <PanelButton onClick={onOverview} title="Общий план (обзор всей карты)" className="h-8 w-8 border-transparent bg-transparent"><Focus size={14} /></PanelButton>
        {hasFocus && onFocusReturn && (
          <PanelButton onClick={onFocusReturn} title="Вернуться к выбранному узлу" className="h-8 w-8 border-transparent bg-transparent"><MapPin size={13} /></PanelButton>
        )}
      </div>
      {hasFocus && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="pointer-events-none h-1.5 w-1.5 rounded-full" style={{ background: '#c4a67e', boxShadow: '0 0 8px #c4a67e' }} />}
    </motion.div>
  );
}

type CameraMoveDirection = 'up' | 'down' | 'left' | 'right' | 'forward' | 'back';
function CameraNavPad({ onMove, onToggle }: { onMove: (direction: CameraMoveDirection) => void; onToggle: () => void }) {
  const buttonClass = 'grid h-9 w-9 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] text-brand-gold/75 transition hover:border-brand-gold/35 hover:bg-brand-gold/10 hover:text-brand-gold active:scale-95';
  return (
    <motion.div initial={{ opacity: 0, x: -10, scale: 0.96 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -10, scale: 0.96 }} transition={{ duration: 0.18 }} className="absolute bottom-[7.25rem] left-4 z-40 hidden rounded-[1.35rem] border border-white/[0.08] bg-black/50 p-2.5 backdrop-blur-2xl sm:block" style={{ boxShadow: '0 14px 42px rgba(0,0,0,0.42), 0 0 0 1px rgba(196,166,126,0.06)' }} aria-label="Навигация камеры">
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/28">Камера</span>
        <button onClick={onToggle} className="rounded-full px-1.5 py-0.5 text-[9px] text-white/35 transition hover:bg-white/10 hover:text-white/70" aria-label="Скрыть стрелки камеры">Скрыть</button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <span /><button className={buttonClass} onClick={() => onMove('up')} aria-label="Сдвиг вверх"><ChevronDown size={15} className="rotate-180" /></button><button className={buttonClass} onClick={() => onMove('forward')} aria-label="Подъехать ближе"><span className="font-mono text-sm font-black">+</span></button>
        <button className={buttonClass} onClick={() => onMove('left')} aria-label="Сдвиг влево"><ChevronLeft size={15} /></button><button className={buttonClass} onClick={() => onMove('back')} aria-label="Отъехать назад"><span className="font-mono text-sm font-black">-</span></button><button className={buttonClass} onClick={() => onMove('right')} aria-label="Сдвиг вправо"><ChevronRight size={15} /></button>
        <span /><button className={buttonClass} onClick={() => onMove('down')} aria-label="Сдвиг вниз"><ChevronDown size={15} /></button><span />
      </div>
      <p className="mt-2 max-w-[140px] text-center text-[9px] leading-3 text-white/28">Не влияет на маршрутные стрелки</p>
    </motion.div>
  );
}

function ContextStatusBar({ activeRoute, routeStep, mapSelection, focusLabel }: any) {
  if (!activeRoute && !mapSelection) return null;
  const accentColor = activeRoute?.color ?? mapSelection?.color ?? '#c4a67e';
  return (
    <motion.div initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.96 }} transition={{ duration: 0.18 }} className="pointer-events-none absolute left-1/2 top-20 z-30 max-w-[min(640px,calc(100%-3rem))] -translate-x-1/2 rounded-2xl border backdrop-blur-2xl" style={{ background: 'rgba(5,5,12,0.72)', borderColor: `${accentColor}30`, boxShadow: `0 8px 32px rgba(0,0,0,0.42), 0 0 0 1px ${accentColor}12, 0 0 24px ${accentColor}18`, padding: '8px 16px' }}>
      <div className="flex items-center gap-2.5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accentColor, boxShadow: `0 0 8px ${accentColor}` }} />
        {activeRoute ? (
          <span className="text-[11px] text-white/65 sm:text-[12px]"><span className="font-bold" style={{ color: accentColor }}>{activeRoute.label}</span><span className="mx-2 text-white/30">·</span><span className="font-mono text-white/85">{routeStep + 1}/{activeRoute.nodes.length}</span>{focusLabel && (<><span className="mx-2 text-white/30">·</span><span className="text-white/78">сейчас: {focusLabel}</span></>)}<span className="mx-2 text-white/30">·</span><span className="text-white/50">←/→ этапы, ↑/↓ камера</span></span>
        ) : mapSelection ? (
          <span className="text-[11px] text-white/65 sm:text-[12px]"><span className="font-bold" style={{ color: accentColor }}>{mapSelection.label}</span><span className="mx-2 text-white/30">·</span><span className="text-white/85">{mapSelection.nodes.length} узлов</span>{focusLabel && (<><span className="mx-2 text-white/30">·</span><span className="text-white/50">фокус: {focusLabel}</span></>)}</span>
        ) : null}
      </div>
    </motion.div>
  );
}

type ArticlePreview = { url: string; title: string; kicker: string; desc: string; cover: string };
const ARTICLE_PREVIEWS: Record<string, ArticlePreview> = {
  overview: { url: '/baptisty-rossii/', title: 'Баптисты России', kicker: 'Серия · 10 частей', desc: 'Вся исследовательская серия: истоки, союзы, гонения, Совет Церквей и подпольная печать.', cover: '../../../images/baptisty-rossii/cover-landing.svg' },
  kura: { url: '/baptisty-rossii/noch-na-kure/', title: 'Ночь на Куре', kicker: 'Часть 1', desc: 'Воронин, Кальвейт, Деляков и первая русская баптистская община.', cover: '../../../images/baptisty-rossii/cover-01-kura.svg' },
  shtunda: { url: '/baptisty-rossii/yuzhnaya-shtunda/', title: 'Южная штунда', kicker: 'Часть 2', desc: 'Унгер, Цимбал, Рябошапка, Ратушный, Прицкау, Онкен и Вилер.', cover: '../../../images/baptisty-rossii/cover-02-shtunda.svg' },
  congress1884: { url: '/baptisty-rossii/dva-sezda-1884/', title: '1884: два съезда', kicker: 'Часть 3', desc: 'Петербургское совещание и Ново-Васильевский съезд — две разные развилки.', cover: '../../../images/baptisty-rossii/cover-03-1884.svg' },
  petersburg: { url: '/baptisty-rossii/peterburgskaya-liniya/', title: 'Петербургская линия', kicker: 'Часть 4', desc: 'Редсток, Пашков, Корф, Каргель и Проханов.', cover: '../../../images/baptisty-rossii/cover-04-peterburg.svg' },
  conscience: { url: '/baptisty-rossii/goneniya-i-sovest/', title: 'Гонения и совесть', kicker: 'Часть 5', desc: 'Военный вопрос, право совести и давление государства.', cover: '../../../images/baptisty-rossii/cover-05-conscience.svg' },
  sovietNight: { url: '/baptisty-rossii/sovetskaya-noch/', title: 'Советская ночь', kicker: 'Часть 6', desc: 'Закон 1929, Инструкция НКВД, закрытия и репрессии.', cover: '../../../images/baptisty-rossii/cover-06-soviet-night.svg' },
  union1944: { url: '/baptisty-rossii/vsehib-1944/', title: '1944: один союз', kicker: 'Часть 7', desc: 'ВСЕХиБ, Братский Вестник, ХВЕ и Прибалтика.', cover: '../../../images/baptisty-rossii/cover-07-vsehib.svg' },
  initiative: { url: '/baptisty-rossii/iniciativnaya-gruppa/', title: 'Инициативная группа', kicker: 'Часть 8', desc: '1960–1966: Положение, письмо, Оргкомитет и Совет Церквей.', cover: '../../../images/baptisty-rossii/cover-08-initiative.svg' },
  samizdat: { url: '/baptisty-rossii/podpolnaya-pechat/', title: 'Подпольная печать', kicker: 'Часть 9', desc: 'Вестник спасения, Вестник истины, Совет родственников, Христианин.', cover: '../../../images/baptisty-rossii/cover-09-samizdat.svg' },
  reference: { url: '/baptisty-rossii/spravochnik/', title: 'Справочник', kicker: 'Часть 10', desc: 'Люди, даты, документы, спорные факты и источниковая оценка.', cover: '../../../images/baptisty-rossii/cover-10-reference.svg' },
};
const NODE_ARTICLE: Record<string, keyof typeof ARTICLE_PREVIEWS> = {
  root: 'overview', trans: 'kura', voronin: 'kura', kalweit: 'kura', pavlov: 'kura',
  ukr: 'shtunda', weiler: 'shtunda', tsymbal: 'shtunda', mazaev: 'shtunda', vsb: 'congress1884',
  spb: 'petersburg', redstock: 'petersburg', pashkov: 'petersburg', prokhanov: 'petersburg', kargel: 'petersburg',
  vseh: 'conscience', vsehb: 'union1944', zhidkov: 'union1944', karev: 'union1944',
  sc: 'initiative', kryuchkov: 'initiative', vins: 'initiative', rsehb: 'reference',
};
function articleForNode(nodeId?: string | null): ArticlePreview | null {
  const key = nodeId ? NODE_ARTICLE[nodeId] : undefined;
  return key ? ARTICLE_PREVIEWS[key] : null;
}
type TimelineTarget = { match: RegExp; nodeId: string; routeId?: string; mapId?: string; article?: keyof typeof ARTICLE_PREVIEWS };
const TIMELINE_TARGETS: TimelineTarget[] = [
  { match: /Воронин|Кура|20\.08\.1867/i, nodeId: 'voronin', routeId: 'route-tiflis', mapId: 'city-Тифлис (Тбилиси)', article: 'kura' },
  { match: /Кальвейт/i, nodeId: 'kalweit', routeId: 'route-tiflis', mapId: 'city-Тифлис (Тбилиси)', article: 'kura' },
  { match: /Павлов/i, nodeId: 'pavlov', routeId: 'route-tiflis', mapId: 'city-Тифлис (Тбилиси)', article: 'kura' },
  { match: /Ц[иы]мбал/i, nodeId: 'tsymbal', routeId: 'route-ukraine', mapId: 'city-Ново-Васильевка', article: 'shtunda' },
  { match: /Вилер|Ново-?Васильев|Союз баптистов/i, nodeId: 'vsb', routeId: 'route-ukraine', mapId: 'city-Ново-Васильевка', article: 'congress1884' },
  { match: /Редсток/i, nodeId: 'redstock', routeId: 'route-petersburg', mapId: 'city-Санкт-Петербург', article: 'petersburg' },
  { match: /Пашков/i, nodeId: 'pashkov', routeId: 'route-petersburg', mapId: 'city-Санкт-Петербург', article: 'petersburg' },
  { match: /Каргель/i, nodeId: 'kargel', routeId: 'route-petersburg', mapId: 'country-643', article: 'petersburg' },
  { match: /Проханов|ВСЕХ(?!Б)/i, nodeId: 'vseh', routeId: 'route-petersburg', mapId: 'city-Санкт-Петербург', article: 'petersburg' },
  { match: /воинск|совест|04\.01\.1919|1919/i, nodeId: 'vseh', routeId: 'route-petersburg', mapId: 'city-Москва', article: 'conscience' },
  { match: /ОГПУ|Голос с Востока|XXV|1923|1926/i, nodeId: 'vseh', routeId: 'route-petersburg', mapId: 'city-Москва', article: 'conscience' },
  { match: /Слесарев|Сиблаг|Темир-Тау|1935|1938/i, nodeId: 'vsehb', routeId: 'route-soviet', mapId: 'city-Москва', article: 'sovietNight' },
  { match: /Шилов|Соловки|Карлаг|1937/i, nodeId: 'vseh', routeId: 'route-petersburg', mapId: 'city-Москва', article: 'conscience' },
  { match: /Хмара|Барнаул|1964/i, nodeId: 'sc', routeId: 'route-soviet', mapId: 'city-Москва', article: 'initiative' },
  { match: /Братский Вестник|1945|послевоенная линия/i, nodeId: 'vsehb', routeId: 'route-soviet', mapId: 'city-Москва', article: 'union1944' },
  { match: /ВСЕХБ|Жидков|Карев|26-29\.10\.1944|1944/i, nodeId: 'vsehb', routeId: 'route-soviet', mapId: 'city-Москва', article: 'union1944' },
  { match: /Устав ВСЕХБ 1963|съезд ВСЕХБ 1963|15–17 октября 1963|1963/i, nodeId: 'vsehb', routeId: 'route-soviet', mapId: 'city-Москва', article: 'union1944' },
  { match: /майск|ЦК КПСС|Винс|Хорев|1966/i, nodeId: 'vins', routeId: 'route-soviet', mapId: 'city-Москва', article: 'initiative' },
  { match: /Совет родственников|Бюллетень|Козорезова|1970/i, nodeId: 'vins', routeId: 'route-soviet', mapId: 'city-Москва', article: 'samizdat' },
  { match: /Христианин|Косыгин|1971/i, nodeId: 'sc', routeId: 'route-soviet', mapId: 'city-Москва', article: 'samizdat' },
  { match: /Вестник истины|1976/i, nodeId: 'sc', routeId: 'route-soviet', mapId: 'city-Москва', article: 'samizdat' },
  { match: /Иван Моисеев|Моисеев|1972|военная часть|Керч/i, nodeId: 'vins', routeId: 'route-soviet', mapId: 'city-Москва', article: 'conscience' },
  { match: /Левен|Кооп|Зайцев|Ивангород|1977/i, nodeId: 'sc', routeId: 'route-soviet', mapId: 'city-Москва', article: 'samizdat' },
  { match: /Донченко|Олимпиад|психбольниц|отобрание детей|1980/i, nodeId: 'sc', routeId: 'route-soviet', mapId: 'city-Москва', article: 'samizdat' },

  { match: /СЦ ЕХБ|Совет Церквей|Крючков|Винс|1961|1965/i, nodeId: 'sc', routeId: 'route-soviet', mapId: 'city-Москва', article: 'initiative' },
  { match: /РС ЕХБ|1992|Современный/i, nodeId: 'rsehb', routeId: 'route-soviet', mapId: 'city-Москва', article: 'reference' },
  { match: /Украин|Штунд/i, nodeId: 'ukr', routeId: 'route-ukraine', mapId: 'country-804', article: 'shtunda' },
  { match: /Петербург/i, nodeId: 'spb', routeId: 'route-petersburg', mapId: 'city-Санкт-Петербург', article: 'petersburg' },
  { match: /Закавказ|Тифлис/i, nodeId: 'trans', routeId: 'route-tiflis', mapId: 'country-268', article: 'kura' },
];

function findMapSelectionForNode(nodeId: string, preferredId?: string): MapSelection | null {
  const entries = [...Object.values(COUNTRY_FOCUS), ...MAP_AREAS, ...CITY_MARKERS] as Array<MapSelection & { id: string }>;
  const direct = preferredId ? entries.find((entry) => entry.id === preferredId) : undefined;
  const city = CITY_MARKERS.find((entry) => entry.nodes.includes(nodeId));
  const country = Object.values(COUNTRY_FOCUS).find((entry) => entry.nodes.includes(nodeId));
  const fallback = MAP_AREAS.find((entry) => entry.nodes.includes(nodeId));
  const entry = direct ?? city ?? country ?? fallback;
  return entry ? { id: entry.id, label: entry.label, color: entry.color, nodes: entry.nodes } : null;
}

function LearningCoach({ visible, onOpenRoutes, onOpenMap }: { visible: boolean; onOpenRoutes: () => void; onOpenMap: () => void }) {
  if (!visible) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.22, ease: 'easeOut' }} className="pointer-events-auto absolute right-4 bottom-[6.6rem] z-30 hidden w-[min(330px,calc(100vw-2rem))] rounded-3xl border border-white/10 bg-black/50 p-4 backdrop-blur-2xl lg:block" style={{ boxShadow: '0 18px 60px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
      <div className="mb-2 flex items-center gap-2 text-brand-gold">
        <Sparkles size={13} />
        <span className="text-[9px] font-black uppercase tracking-[0.18em]">Как читать карту</span>
      </div>
      <p className="text-[11.5px] leading-5 text-white/62">Читайте карту слоями: сначала выберите маршрут, затем год на Timeline, потом откройте досье. Красные/янтарные события — гонения и совесть, A/B/C — уровень источника.</p>
      <div className="mt-3 grid grid-cols-3 gap-1.5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-1.5" aria-label="Исторические фото-подсказки карты">
        {[
          { src: '/images/konfessii/russkij-baptizm/photos/old-tbilisi-kura-xix.jpg', label: 'Кура / Тифлис' },
          { src: '/images/konfessii/russkij-baptizm/photos/tiflis-bazar-baron-de-baye-1900.jpg', label: 'Тифлис' },
          { src: '/images/konfessii/russkij-baptizm/photos/saint-petersburg-nevsky-1800s.jpg', label: 'Петербург' },
        ].map((photo) => (
          <div key={photo.src} className="relative h-14 overflow-hidden rounded-xl border border-white/[0.08] bg-black/40">
            <img src={photo.src} alt="" className="h-full w-full object-cover opacity-75 saturate-[0.75] sepia-[0.18]" loading="lazy" decoding="async" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1 pt-3 text-[7.5px] font-bold uppercase tracking-[0.12em] text-white/68">{photo.label}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-1.5 text-[10.5px] text-white/45">
        <div><span className="font-mono text-brand-gold">1</span> · Маршрут = сюжет: истоки, союзы, советская ночь, самиздат.</div>
        <div><span className="font-mono text-brand-gold">2</span> · Timeline = дата и ближайшее событие, с бейджем источника.</div>
        <div><span className="font-mono text-brand-gold">3</span> · Досье = человек/город/документ + ссылка на статью серии.</div>
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={onOpenRoutes} className="flex-1 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.12em] text-brand-gold transition hover:bg-brand-gold/16 active:scale-95">Маршруты</button>
        <button onClick={onOpenMap} className="flex-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.12em] text-white/58 transition hover:bg-white/[0.08] hover:text-white/80 active:scale-95">Карта</button>
      </div>
    </motion.div>
  );
}

function BottomBar({ left, hidden, expanded, activeRoute, routeStep = 0, mapSelection, onToggle, onRouteSelect, onRouteStepTo, onMapSelect }: any) {
  const activeLabel = activeRoute?.label ?? mapSelection?.label ?? 'Маршруты и города';
  const activeColor = activeRoute?.color ?? mapSelection?.color ?? '#c4a67e';
  const activeRouteNodes = activeRoute ? activeRoute.nodes.map((id: string) => NODES.find((n) => n.id === id)).filter(Boolean) as NodeData[] : [];
  const currentRouteNode = activeRouteNodes[routeStep] ?? null;
  const nextRouteNode = activeRouteNodes[routeStep + 1] ?? null;
  const transitionLink = currentRouteNode && nextRouteNode ? LINKS.find((link) => {
    const sid = typeof link.source === 'object' ? link.source.id : link.source;
    const tid = typeof link.target === 'object' ? link.target.id : link.target;
    return (sid === currentRouteNode.id && tid === nextRouteNode.id) || (sid === nextRouteNode.id && tid === currentRouteNode.id);
  }) : null;
  return (
    <div className={`absolute bottom-0 z-30 flex flex-col items-center gap-2 px-4 pb-4 pt-3 transition-[left,opacity] duration-300 ${hidden ? 'pointer-events-none opacity-0' : 'opacity-100'}`} style={{ left, right: 16, background: 'linear-gradient(to top, rgba(3,3,7,0.88) 0%, rgba(3,3,7,0.55) 42%, transparent 100%)' }}>
      <button onClick={onToggle} className="inline-flex min-h-[42px] items-center gap-2 rounded-full border bg-black/60 px-5 py-2 text-[11px] font-bold uppercase tracking-[0.12em] backdrop-blur-2xl transition hover:bg-black/75 active:scale-95" style={{ borderColor: `${activeColor}44`, color: activeColor, boxShadow: expanded ? `0 0 24px ${activeColor}24` : undefined }} aria-expanded={expanded} aria-label={activeRoute ? `${activeLabel}: ${activeRoute.summary}` : 'Открыть маршруты, города и исторические точки'}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: activeColor, boxShadow: `0 0 8px ${activeColor}` }} />
        {activeLabel}
        {activeRoute && <span className="rounded-full bg-white/10 px-1.5 py-0.5 font-mono text-[8px] text-white/45">{routeStep + 1}/{activeRoute.nodes.length}</span>}
        <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div key="bottom-bar-expanded" initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} transition={{ duration: 0.18 }} className="flex max-w-[min(940px,calc(100vw-2rem))] flex-col gap-2 rounded-3xl border border-white/10 bg-black/55 px-4 py-3 backdrop-blur-2xl">
            {activeRoute && (
              <div className="rounded-2xl border px-3 py-2" style={{ borderColor: `${activeRoute.color}34`, background: `${activeRoute.color}0d` }}>
                <div className="mb-1 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: activeRoute.color, boxShadow: `0 0 8px ${activeRoute.color}` }} />
                  <span className="text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: activeRoute.color }}>Активный маршрут</span>
                  <span className="ml-auto font-mono text-[9px] text-white/40">{routeStep + 1}/{activeRoute.nodes.length}</span>
                </div>
                <p className="text-[11px] leading-5 text-white/62">{activeRoute.summary}</p>
                {currentRouteNode && (
                  <div className="mt-2 rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2">
                    <div className="flex items-baseline gap-2"><span className="text-[8px] font-bold uppercase tracking-[0.16em] text-white/28">Сейчас в маршруте</span>{currentRouteNode.year && <span className="font-mono text-[9px]" style={{ color: activeRoute.color }}>{currentRouteNode.year}</span>}</div>
                    <p className="mt-0.5 truncate text-[11px] font-bold text-white/78">{currentRouteNode.label}</p>
                    <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-white/42">{currentRouteNode.desc}</p>
                    {nextRouteNode && <p className="mt-1.5 text-[9.5px] leading-4 text-white/35">Далее: <span className="text-white/58">{nextRouteNode.label}</span>{transitionLink?.label ? <span> · {transitionLink.label}</span> : null}</p>}
                  </div>
                )}
                <p className="mt-1.5 text-[9px] text-white/30">Нажмите этап, чтобы перелететь к соответствующему узлу.</p>
                <div className="mt-2 flex max-w-full gap-1 overflow-hidden">
                  {activeRouteNodes.slice(0, 7).map((node, idx) => (
                    <button key={node.id} type="button" onClick={() => onRouteStepTo?.(idx)} className="truncate rounded-full border px-2 py-0.5 text-left text-[9px] transition hover:scale-[1.04] active:scale-95" style={{ borderColor: idx === routeStep ? `${activeRoute.color}aa` : 'rgba(255,255,255,0.10)', color: idx === routeStep ? activeRoute.color : 'rgba(255,255,255,0.45)', background: idx === routeStep ? `${activeRoute.color}14` : 'rgba(255,255,255,0.03)' }} aria-label={`Этап ${idx + 1}: ${node.label}${node.year ? ` · ${node.year}` : ''}. ${node.desc}`}>{idx + 1}. {node.label}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-1.5"><span className="mr-1 self-center text-[8px] font-bold uppercase tracking-[0.2em] text-white/30">Маршруты:</span>{ROUTE_PRESETS.map((route) => (<button key={route.id} onClick={() => onRouteSelect(route)} aria-label={`Маршрут: ${route.label}. ${route.summary}`} className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full border bg-black/50 px-3.5 py-2 text-[10px] font-semibold backdrop-blur-sm transition hover:bg-black/70 active:scale-95" style={{ borderColor: activeRoute?.id === route.id ? `${route.color}cc` : `${route.color}40`, color: route.color, boxShadow: activeRoute?.id === route.id ? `0 0 22px ${route.color}30` : undefined, background: activeRoute?.id === route.id ? `color-mix(in srgb, ${route.color} 12%, black)` : undefined }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: route.color }} /><span>{route.label}</span><span className="rounded-full bg-white/10 px-1.5 py-0.5 font-mono text-[8px] text-white/45">{route.nodes.length}</span></button>))}</div>
            <div className="flex flex-wrap justify-center gap-1.5"><span className="mr-1 self-center text-[8px] font-bold uppercase tracking-[0.2em] text-white/30">Города:</span>{CITY_MARKERS.map((city) => (<button key={city.id} onClick={() => onMapSelect({ id: city.id, label: city.label, color: city.color, nodes: city.nodes })} className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border bg-black/40 px-3 py-1.5 text-[9px] backdrop-blur-sm transition hover:bg-black/60 active:scale-95" style={{ borderColor: mapSelection?.id === city.id ? `${city.color}95` : `${city.color}35`, color: city.color, boxShadow: mapSelection?.id === city.id ? `0 0 18px ${city.color}22` : undefined }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: city.color }} />{city.label}</button>))}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

let earthTextureInstance: THREE.CanvasTexture | null = null;
function getEarthTexture(): THREE.CanvasTexture | null {
  if (earthTextureInstance) return earthTextureInstance;
  if (typeof document === 'undefined') return null;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size * 2; canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const rand = (seed: number) => { let x = Math.sin(seed) * 10000; return x - Math.floor(x); };
  ctx.fillStyle = '#0a0e1a';
  ctx.fillRect(0, 0, size * 2, size);
  const continents = [
    { cx: 280, cy: 180, rx: 85, ry: 110 }, { cx: 400, cy: 160, rx: 120, ry: 130 },
    { cx: 560, cy: 220, rx: 55, ry: 40 }, { cx: 130, cy: 200, rx: 70, ry: 90 },
    { cx: 700, cy: 350, rx: 50, ry: 30 }, { cx: 350, cy: 100, rx: 90, ry: 45 }, { cx: 180, cy: 300, rx: 40, ry: 60 },
  ];
  continents.forEach((c) => {
    for (let i = 0; i < 200; i++) {
      const angle = rand(i * 7 + c.cx) * Math.PI * 2;
      const dist = rand(i * 13 + c.cy) * 0.9;
      const x = c.cx + Math.cos(angle) * c.rx * dist;
      const y = c.cy + Math.sin(angle) * c.ry * dist;
      const r = 3 + rand(i * 19) * 14;
      const alpha = 0.15 + rand(i * 23) * 0.35;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180,160,120,${alpha})`; ctx.fill();
    }
  });
  for (let i = 0; i < 350; i++) {
    const x = rand(i * 31) * size * 2; const y = rand(i * 37) * size; const b = rand(i * 41);
    if (continents.some((c) => Math.hypot(x - c.cx, y - c.cy) < Math.max(c.rx, c.ry) * 1.1) && b > 0.4) {
      ctx.beginPath(); ctx.arc(x, y, 0.5 + b * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,220,150,${0.4 + b * 0.6})`; ctx.fill();
    }
  }
  earthTextureInstance = new THREE.CanvasTexture(canvas);
  earthTextureInstance.colorSpace = THREE.SRGBColorSpace;
  earthTextureInstance.wrapS = THREE.RepeatWrapping;
  earthTextureInstance.wrapT = THREE.ClampToEdgeWrapping;
  return earthTextureInstance;
}


function TimelineOverlay({ timelineYearRef, bottomBarExpanded, onEventSelect, getArticleForEvent }: { timelineYearRef: React.MutableRefObject<number | null>, bottomBarExpanded: boolean, onEventSelect?: (event: any, year: number) => void, getArticleForEvent?: (event: any) => ArticlePreview | null }) {
  const [year, setYear] = useState<number | null>(null);
  const [hoveredTick, setHoveredTick] = useState<{ year: number; event: (typeof timelineEvents)[number]; count: number } | null>(null);
  
  useEffect(() => {
    const handleReset = () => {
        setYear(null);
        timelineYearRef.current = null;
    };
    window.addEventListener('reset-timeline', handleReset);
    return () => window.removeEventListener('reset-timeline', handleReset);
  }, [timelineYearRef]);

  const handleChange = (e: any) => {
    const val = parseInt(e.target.value, 10);
    setYear(val);
    timelineYearRef.current = val;
  };

  const handleClear = () => {
    setYear(null);
    timelineYearRef.current = null;
  };

  const displayYear = year ?? 2026;
  const recentEvent = useMemo(() => {
    const activeEvents = timelineEvents.filter((e) => {
      const match = e.year.match(/\d{4}/);
      const y = match ? parseInt(match[0], 10) : 0;
      return y > 0 && y <= displayYear;
    });
    return activeEvents[activeEvents.length - 1] ?? null;
  }, [displayYear]);
  const timelineTicks = useMemo(() => {
    const byYear = new Map<number, typeof timelineEvents>();
    timelineEvents.forEach((event) => {
      const match = event.year.match(/\d{4}/);
      const y = match ? parseInt(match[0], 10) : 0;
      if (!y || y < 1860 || y > 2026) return;
      const list = byYear.get(y) ?? [];
      list.push(event);
      byYear.set(y, list as typeof timelineEvents);
    });
    const majorYears = new Set([1860, 1864, 1867, 1869, 1874, 1884, 1905, 1909, 1929, 1937, 1944, 1961, 1965, 1992, 2000]);
    return [...byYear.entries()].map(([year, events]) => {
      const event = events.find((e) => e.title.includes('★')) ?? events[0];
      return { year, event, count: events.length, major: majorYears.has(year) || event.title.includes('★') };
    }).sort((a, b) => a.year - b.year);
  }, []);
  const visibleTimelineTicks = useMemo(() => timelineTicks.filter((tick) => tick.major), [timelineTicks]);
  const displayEvent = hoveredTick?.event ?? recentEvent;
  const displayCount = hoveredTick?.count ?? 1;
  const displayArticle = displayEvent ? getArticleForEvent?.(displayEvent) ?? null : null;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, bottom: bottomBarExpanded ? '17rem' : '4.5rem' }} transition={{ duration: 0.3, ease: 'easeOut' }} className="absolute left-1/2 z-40 hidden w-full max-w-[800px] -translate-x-1/2 flex-col px-4 sm:flex pointer-events-none">
      <div className="pointer-events-auto">
      {displayEvent && !bottomBarExpanded && (
          <div className="mx-auto mb-3 flex max-w-md items-center gap-3 rounded-2xl border border-white/10 bg-black/60 px-4 py-2.5 backdrop-blur-xl" style={{ boxShadow: `0 12px 42px rgba(0,0,0,0.38), 0 0 24px ${categoryColors[displayEvent.category]}18` }}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: `${categoryColors[displayEvent.category]}22`, color: categoryColors[displayEvent.category] }}>
              <Sparkles size={14} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/50"><span>Хронология событий · {displayEvent.year} • {categoryLabels[displayEvent.category]}{displayCount > 1 ? ` · ${displayCount} события` : ''}</span>{displayEvent.sourceLevel && <span className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[8px] text-white/42">{displayEvent.sourceLevel}</span>}</div>
              <div className="truncate text-[13px] font-bold text-white">{displayEvent.title}</div>
              <div className="line-clamp-1 text-[10.5px] leading-4 text-white/45">{displayEvent.description}</div>
              {displayArticle && (
                <a href={displayArticle.url} target="_top" className="mt-2 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] p-1.5 transition hover:bg-white/[0.07]" aria-label={`Открыть статью: ${displayArticle.title}`}>
                  <img src={displayArticle.cover} alt="" width={46} height={24} className="h-6 w-[46px] rounded-md object-cover" loading="lazy" decoding="async" />
                  <span className="min-w-0 text-left"><span className="block text-[8px] font-bold uppercase tracking-[0.14em] text-white/32">{displayArticle.kicker}</span><span className="block truncate text-[10.5px] font-bold text-white/70">{displayArticle.title}</span></span>
                  <span className="ml-auto text-[13px] text-white/32">→</span>
                </a>
              )}
            </div>
          </div>
      )}
      
      <div className="relative flex w-full items-center gap-4 rounded-full border border-white/10 bg-black/45 px-6 py-2.5 backdrop-blur-2xl">
        <span className="text-[10px] font-bold text-[#c4a67e]">1860</span>
        <div className="relative flex h-6 flex-1 items-center">
          <div className="absolute inset-x-0 h-1 rounded-full bg-white/10" />
          {visibleTimelineTicks.map((tick) => {
            const percent = ((tick.year - 1860) / (2026 - 1860)) * 100;
            const isActive = Math.abs(tick.year - displayYear) <= 2;
            return <button key={tick.year} type="button" onMouseEnter={() => setHoveredTick(tick)} onFocus={() => setHoveredTick(tick)} onMouseLeave={() => setHoveredTick(null)} onBlur={() => setHoveredTick(null)} onClick={() => { setYear(tick.year); timelineYearRef.current = tick.year; onEventSelect?.(tick.event, tick.year); }} className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border transition hover:scale-125 ${tick.major ? 'h-3 w-3' : 'h-1.5 w-1.5'}`} style={{ left: `${percent}%`, top: '50%', borderColor: isActive ? categoryColors[tick.event.category] : tick.major ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.14)', background: isActive ? categoryColors[tick.event.category] : tick.major ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.10)', boxShadow: isActive ? `0 0 12px ${categoryColors[tick.event.category]}80` : 'none', opacity: tick.major || isActive ? 1 : 0.42 }} aria-label={`Перейти к событию ${tick.event.year}: ${tick.event.title}${tick.count > 1 ? ` (и ещё ${tick.count - 1})` : ''}`} />;
          })}
          <input type="range" min="1860" max="2026" value={displayYear} onChange={handleChange} className="absolute inset-x-0 z-10 h-6 w-full cursor-pointer appearance-none bg-transparent opacity-0" />
          <div className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black bg-[#c4a67e] shadow-[0_0_12px_#c4a67e]" style={{ left: `${((displayYear) - 1860) / (2026 - 1860) * 100}%` }} />
        </div>
        <span className="text-[10px] font-bold text-[#c4a67e]">2026</span>
        <div className="flex items-center w-12 shrink-0">
          {year !== null && year < 2026 && (
            <button onClick={handleClear} className="ml-3 rounded-full border border-[#c4a67e]/30 bg-black px-2 py-1 text-[9px] font-bold text-[#c4a67e] hover:bg-[#c4a67e]/10 transition-colors">СБРОС</button>
          )}
        </div>
      </div>
      </div>
    </motion.div>
  );
}

export default function MindMap3D() {
  const fgRef = useRef<any>(null);
  const lightingRef = useRef<THREE.Group | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hoveredNodeIdRef = useRef<string | null>(null);
  const nodeObjectsRef = useRef<Map<string, THREE.Group>>(new Map());
  const { theme } = useTheme();
  const isLight = theme === 'light';

  type InspectorMode = 'closed' | 'rail' | 'peek' | 'full';
  const [focusNode, setFocusNode] = useState<NodeData | null>(null);
  const [mapMode, setMapMode] = useState(false);
  const [mapSelection, setMapSelection] = useState<MapSelection | null>(null);
  const [activeRoute, setActiveRoute] = useState<RoutePreset | null>(null);
  const [routeStep, setRouteStep] = useState<number>(0);
  const [contentExpanded, setContentExpanded] = useState(false);
  const [inspectorMode, setInspectorMode] = useState<InspectorMode>('closed');
  const [inspectorPinned, setInspectorPinned] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [dims, setDims] = useState({ w: 800, h: 620 });
  const isFullscreen = true;
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [isLandscape, setIsLandscape] = useState(false);
  const [showRotatePrompt, setShowRotatePrompt] = useState(false);
  const [bottomBarExpanded, setBottomBarExpanded] = useState(false);
  const [cameraNavEnabled, setCameraNavEnabled] = useState(true);
  const timelineYearRef = useRef<number | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [showLegend, setShowLegend] = useState(false);
  const [fullscreenOverlayOwner] = useState(() => `special:mindmap3d:fullscreen:${++mindMapOverlaySequence}`);

  const nightMapUrl = NIGHT_MAP_DATA_URL;

  useEffect(() => {
    const checkOrientation = () => {
      const isLand = window.innerWidth > window.innerHeight;
      setIsLandscape(isLand);
      setShowRotatePrompt(!isLand && window.innerWidth < 768 && focusNode !== null);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, [focusNode]);

  useEffect(() => {
    if (!isFullscreen || typeof window === 'undefined') return;
    const siteUtils = (window as any).SiteUtils;
    const runtime = (window as any).OverlayRuntime || siteUtils?.OverlayRuntime;
    if (runtime?.lockScroll && runtime?.unlockScroll) {
      runtime.lockScroll(fullscreenOverlayOwner);
      return () => runtime.unlockScroll(fullscreenOverlayOwner);
    }
    siteUtils?.lockScroll?.(fullscreenOverlayOwner);
    return () => siteUtils?.unlockScroll?.(fullscreenOverlayOwner);
  }, [isFullscreen, fullscreenOverlayOwner]);

  const projection = useMemo(() => geoMercator().center([42, 52]).scale(580).translate([600, 340]), []);
  const geoPathGenerator = useMemo(() => geoPath(projection), [projection]);
  const countries = useMemo(() => { const atlas = worldAtlas as unknown as { objects: { countries: unknown } }; return (feature(worldAtlas as any, atlas.objects.countries as any) as any).features as Array<{ id: string | number; properties?: Record<string, unknown> }>; }, []);

  const overviewCamera = useMemo(() => {
    const xs = NODES.map((n) => n.x ?? 0);
    const ys = NODES.map((n) => n.y ?? 0);
    const zs = NODES.map((n) => n.z ?? 0);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;
    const spanX = maxX - minX;
    const spanY = maxY - minY;
    const spanZ = maxZ - minZ;
    const span = Math.max(spanX, spanY, spanZ);
    return {
      camera: { x: cx, y: cy + Math.max(24, spanY * 0.14), z: Math.max(280, span * 1.9) },
      target: { x: cx, y: cy, z: cz },
    };
  }, []);

  useEffect(() => { const update = () => { if (containerRef.current) { setDims({ w: containerRef.current.clientWidth, h: containerRef.current.clientHeight || window.innerHeight }); } }; update(); window.addEventListener('resize', update); return () => window.removeEventListener('resize', update); }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      fgRef.current?.cameraPosition(overviewCamera.camera, overviewCamera.target, 900);
      fgRef.current?.d3ReheatSimulation?.();
    }, 450);
    const reheatTimer = setTimeout(() => {
      fgRef.current?.d3ReheatSimulation?.();
    }, 1500);
    return () => { clearTimeout(timer); clearTimeout(reheatTimer); };
  }, [overviewCamera]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const renderer = fgRef.current?.renderer?.() as THREE.WebGLRenderer | undefined;
      const scene = fgRef.current?.scene?.() as THREE.Scene | undefined;
      const camera = fgRef.current?.camera?.() as THREE.PerspectiveCamera | undefined;

      if (renderer) {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = isLight ? 1.05 : 1.22;
        renderer.shadowMap.enabled = false;
      }

      if (scene) {
        scene.fog = new THREE.FogExp2(isLight ? '#f5f0eb' : '#030308', isLight ? 0.0009 : 0.0018);
        buildCosmos(scene, isLight);
      }

      if (camera) {
        camera.fov = 44;
        camera.near = 0.1;
        camera.far = 2200;
        camera.updateProjectionMatrix();
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [isLight]);

  useEffect(() => {
    let cleanupControls: (() => void) | undefined;
    const timer = window.setTimeout(() => {
      const controls = fgRef.current?.controls?.();
      if (!controls) return;
      controls.enableDamping = true;
      controls.dampingFactor = 0.072;
      controls.rotateSpeed = 0.65;
      controls.zoomSpeed = 0.95;
      controls.panSpeed = 0;
      controls.enablePan = false;
      controls.enableRotate = true;
      controls.enableZoom = true;
      controls.screenSpacePanning = false;
      controls.minDistance = 28;
      controls.maxDistance = 860;
      controls.zoomToCursor = false;
      controls.minPolarAngle = Math.PI * 0.08;
      controls.maxPolarAngle = Math.PI * 0.92;
      controls.mouseButtons = { LEFT: (THREE as any).MOUSE?.ROTATE, MIDDLE: (THREE as any).MOUSE?.DOLLY, RIGHT: undefined };
      controls.touches = { ONE: (THREE as any).TOUCH?.ROTATE, TWO: (THREE as any).TOUCH?.DOLLY_ROTATE ?? (THREE as any).TOUCH?.DOLLY_PAN };
      let endTimer = 0;
      const onStart = () => { clearTimeout(endTimer); setIsNavigating(true); };
      const onEnd = () => { endTimer = window.setTimeout(() => setIsNavigating(false), 300); };
      controls.addEventListener('start', onStart);
      controls.addEventListener('end', onEnd);
      cleanupControls = () => {
        controls.removeEventListener('start', onStart);
        controls.removeEventListener('end', onEnd);
        clearTimeout(endTimer);
      };
    }, 900);
    return () => { clearTimeout(timer); cleanupControls?.(); };
  }, []);

  useEffect(() => {
    const controls = fgRef.current?.controls?.();
    if (!controls) return;
    if (mapMode) {
      controls.enablePan = true;
      controls.panSpeed = 1.1;
      controls.rotateSpeed = 0.45;
      controls.zoomToCursor = true;
      controls.screenSpacePanning = true;
      controls.mouseButtons = { LEFT: (THREE as any).MOUSE?.PAN, MIDDLE: (THREE as any).MOUSE?.DOLLY, RIGHT: (THREE as any).MOUSE?.ROTATE };
      controls.touches = { ONE: (THREE as any).TOUCH?.PAN, TWO: (THREE as any).TOUCH?.DOLLY_PAN };
    } else {
      controls.enablePan = false;
      controls.panSpeed = 0;
      controls.rotateSpeed = 0.65;
      controls.zoomToCursor = false;
      controls.screenSpacePanning = false;
      controls.mouseButtons = { LEFT: (THREE as any).MOUSE?.ROTATE, MIDDLE: (THREE as any).MOUSE?.DOLLY, RIGHT: undefined };
      controls.touches = { ONE: (THREE as any).TOUCH?.ROTATE, TWO: (THREE as any).TOUCH?.DOLLY_ROTATE ?? (THREE as any).TOUCH?.DOLLY_PAN };
    }
  }, [mapMode]);

  useEffect(() => {
    const scene = fgRef.current?.scene?.() as THREE.Scene | undefined;
    if (!scene) return;
    if (lightingRef.current) scene.remove(lightingRef.current);
    const lights = new THREE.Group();
    const ambient = new THREE.AmbientLight(isLight ? 0xffffff : 0xeae6ff, isLight ? 0.95 : 0.38);
    const key = new THREE.DirectionalLight(0xfff8ee, isLight ? 1.1 : 1.45); key.position.set(-90, 110, 140);
    const gold = new THREE.PointLight(0xd4a857, isLight ? 16 : 28, 350, 1.6); gold.position.set(20, -20, 120);
    const rimTeal = new THREE.PointLight(0x2fd3c7, isLight ? 8 : 18, 300, 1.8); rimTeal.position.set(120, -10, 65);
    const pink = new THREE.PointLight(0xff64b4, isLight ? 8 : 18, 280, 1.75); pink.position.set(-90, 60, 90);
    const violet = new THREE.PointLight(0x8b4dff, isLight ? 7 : 18, 310, 1.8); violet.position.set(90, 65, 60);
    const fill = new THREE.PointLight(0x3030a8, isLight ? 3 : 9, 220, 1.9); fill.position.set(0, -160, 30);
    const red = new THREE.PointLight(0xff4b6e, isLight ? 4 : 12, 200, 1.9); red.position.set(-60, -100, 20);
    lights.add(ambient, key, gold, rimTeal, pink, violet, fill, red);
    scene.add(lights); lightingRef.current = lights;
    return () => { scene.remove(lights); };
  }, [isLight]);

  useEffect(() => {
    if (!fgRef.current) return;
    const charge = fgRef.current.d3Force('charge');
    if (charge) charge.strength(-360);
    const link = fgRef.current.d3Force('link');
    if (link) { link.distance((edge: any) => { const sid = typeof edge.source === 'object' ? edge.source.id : edge.source; const tid = typeof edge.target === 'object' ? edge.target.id : edge.target; if (sid === 'root' || tid === 'root') return 150; if (sid === 'vsehb' || tid === 'vsehb') return 118; return 92; }); link.strength(0.24); }
    const center = fgRef.current.d3Force('center');
    if (center) center.strength(0.04);
    fgRef.current.d3Force('composition', (alpha: number) => { NODES.forEach((node) => { const anchor = ANCHORS[node.id]; if (!anchor) return; const live = node as NodeData & { vx?: number; vy?: number; vz?: number; fx?: number; fy?: number; fz?: number }; if (live.fx != null || live.fy != null || live.fz != null) return; const strength = anchor.strength * 1.28 * alpha; live.vx = (live.vx ?? 0) + (anchor.x - (node.x ?? anchor.x)) * strength; live.vy = (live.vy ?? 0) + (anchor.y - (node.y ?? anchor.y)) * strength; live.vz = (live.vz ?? 0) + (anchor.z - (node.z ?? anchor.z)) * strength; }); });
  }, []);

  const relatedLinks = useMemo(() => {
    const activeMapNodeIds = mapSelection?.nodes ?? [];
    const routeLinkIds = new Set(activeRoute?.linkIds ?? []);
    const routeNodeIds = activeRoute?.nodes ?? [];
    return focusNode || activeMapNodeIds.length > 0 || activeRoute ? LINKS.filter((link) => {
      const sid = typeof link.source === 'object' ? link.source.id : link.source;
      const tid = typeof link.target === 'object' ? link.target.id : link.target;
      if (routeLinkIds.has(link.id)) return true;
      if (routeNodeIds.includes(sid) && routeNodeIds.includes(tid)) return true;
      if (focusNode && (sid === focusNode.id || tid === focusNode.id)) return true;
      return activeMapNodeIds.includes(sid) || activeMapNodeIds.includes(tid);
    }) : [];
  }, [activeRoute, focusNode, mapSelection]);

  const directIds = useMemo(() => {
    const ids = new Set<string>();
    (activeRoute?.nodes ?? []).forEach((id) => ids.add(id));
    if (focusNode) ids.add(focusNode.id);
    (mapSelection?.nodes ?? []).forEach((id) => ids.add(id));
    if (activeRoute && activeRoute.nodes[routeStep]) ids.add(activeRoute.nodes[routeStep]);
    relatedLinks.forEach((link) => { const sid = typeof link.source === 'object' ? link.source.id : link.source; const tid = typeof link.target === 'object' ? link.target.id : link.target; if (focusNode && sid === focusNode.id) ids.add(tid); if (focusNode && tid === focusNode.id) ids.add(sid); });
    return ids;
  }, [activeRoute, focusNode, mapSelection, relatedLinks, routeStep]);

  const secondaryIds = useMemo(() => {
    const ids = new Set<string>();
    LINKS.forEach((link) => { const sid = typeof link.source === 'object' ? link.source.id : link.source; const tid = typeof link.target === 'object' ? link.target.id : link.target; if (directIds.has(sid) && !directIds.has(tid)) ids.add(tid); if (directIds.has(tid) && !directIds.has(sid)) ids.add(sid); });
    return ids;
  }, [directIds]);

  const activeLinkIds = useMemo(() => new Set(relatedLinks.map((link) => link.id)), [relatedLinks]);
  const secondaryLinkIds = useMemo(() => { const ids = new Set<string>(); LINKS.forEach((link) => { const sid = typeof link.source === 'object' ? link.source.id : link.source; const tid = typeof link.target === 'object' ? link.target.id : link.target; if (!activeLinkIds.has(link.id) && (directIds.has(sid) || directIds.has(tid)) && (secondaryIds.has(sid) || secondaryIds.has(tid))) ids.add(link.id); }); return ids; }, [activeLinkIds, directIds, secondaryIds]);

  const graphData = useMemo(() => ({ nodes: NODES as any[], links: LINKS as any[] }), []);
  const connectedIds = useMemo(() => { const ids = new Set<string>(); directIds.forEach((id) => ids.add(id)); secondaryIds.forEach((id) => ids.add(id)); return ids; }, [directIds, secondaryIds]);

  const activeMapEntries = useMemo(() => {
    const countryEntries = Object.values(COUNTRY_FOCUS);
    const entries = [...countryEntries, ...MAP_AREAS, ...CITY_MARKERS];
    const uniqueById = (items: any[]) => items.filter((item, i, arr) => arr.findIndex((c) => c.id === item.id) === i);
    if (mapSelection) return uniqueById(entries.filter((e) => e.id === mapSelection.id || e.nodes.some((nid: string) => connectedIds.has(nid))));
    if (focusNode) return uniqueById(entries.filter((e) => e.nodes.includes(focusNode.id) || e.nodes.some((nid: string) => connectedIds.has(nid))));
    return uniqueById(entries.filter((e) => e.id === 'country-643' || e.id === 'country-804' || e.id === 'country-268'));
  }, [connectedIds, focusNode, mapSelection]);

  useEffect(() => {
    let frame = 0;
    const animate = () => {
      const t = performance.now() * 0.001;
      const currentYear = timelineYearRef.current;
      
      nodeObjectsRef.current.forEach((object) => {
        const hovered = object.userData.nodeId === hoveredNodeIdRef.current;
        const focused = (object.userData.focusScale as number | undefined) ?? 1;
        
        const nYear = object.userData.nodeYear;
        const isFuture = currentYear !== null && nYear !== null && nYear > currentYear;
        
        const target = isFuture ? 0.001 : (hovered ? 1.18 : focused);
        const s = object.scale.x;
        const newScale = s + (target - s) * 0.22;
        object.scale.set(newScale, newScale, newScale);
        object.visible = newScale > 0.01;

        if (focused > 1.0 && !isFuture) {
          const breathe = 1 + Math.sin(t * 2.5) * 0.03;
          object.scale.set(newScale * breathe, newScale * breathe, newScale * breathe);
        }

        object.traverse((child) => {
          if (child === object) return;
          if (child.userData?.globeRotate) child.rotation.y += (child.userData.rotateSpeed as number | undefined) ?? 0.0012;
          if (child.userData?.focusOrbit) child.rotation.z += child.userData.orbitSpeed as number;
          if (child.userData?.unionRing) {
            const axis = child.userData.rotateAxis as 'x' | 'y' | 'z';
            const baseSpeed = child.userData.rotateSpeed as number;
            const speed = baseSpeed * (hovered ? 2.8 : focused > 1 ? 1.65 : 1);
            if (axis === 'x') child.rotation.x += speed;
            else if (axis === 'y') child.rotation.y += speed;
            else child.rotation.z += speed;
          }
          if (child.userData?.leaderOrbit) {
            child.rotation.z += child.userData.orbitSpeed as number;
          }
          if (child.userData?.isFlame) {
            const h = (child.userData.flameHash as number) ?? 0;
            const f = 1 + Math.sin(t * 6.5 + h) * 0.1 + Math.sin(t * 11.3 + h) * 0.04 + Math.sin(t * 17.7 + h) * 0.02;
            child.scale.set(1 / Math.sqrt(f), f, 1 / Math.sqrt(f));
          }
          if (child.userData?.coreRotate) {
            child.rotation.x += 0.006;
            child.rotation.y += 0.009;
            const pulse = 1 + Math.sin(t * 2.0) * 0.12;
            child.scale.set(pulse, pulse, pulse);
            const mat = (child as THREE.Mesh).material as THREE.MeshPhysicalMaterial;
            if (mat.emissiveIntensity !== undefined) {
              mat.emissiveIntensity = 0.5 + Math.sin(t * 2.0) * 0.25;
            }
          }
          if (child.userData?.isMoon) {
            const orbitR = child.userData.orbitRadius as number;
            const speed = (child.userData.orbitSpeed as number | undefined) ?? 1.6;
            const phase = (child.userData.orbitPhase as number | undefined) ?? 0;
            const plane = child.userData.plane || 'xy';
            const currentAngle = t * speed + phase;
            if (plane === 'xy') {
              child.position.x = Math.cos(currentAngle) * orbitR;
              child.position.y = Math.sin(currentAngle) * orbitR;
              child.position.z = 0;
            } else {
              child.position.x = Math.cos(currentAngle) * orbitR;
              child.position.y = 0;
              child.position.z = Math.sin(currentAngle) * orbitR;
            }
            const sr = (child.userData.sphereRadius as number | undefined) ?? 0;
            if (sr > 0) {
              const worldZ = child.getWorldPosition(new THREE.Vector3()).z;
              const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
              const targetOpacity = worldZ < 0 ? 0.28 : 0.95;
              mat.opacity += (targetOpacity - mat.opacity) * 0.12;
            }
          }
          if (child.userData?.isClockSecond) child.rotation.z = -(Date.now() / 1000 % 60) / 60 * Math.PI * 2;
          if (child.userData?.isClockMinute) child.rotation.z = -(Date.now() / 60000 % 60) / 60 * Math.PI * 2;
          if (child.userData?.isClockHour)   child.rotation.z = -(Date.now() / 3600000 % 12) / 12 * Math.PI * 2;
          if (child.userData?.isDNA) child.rotation.y += 0.004;
          if (child.userData?.baptismRipple) {
            const baseR = child.userData.baseR as number;
            const ph = child.userData.phase as number;
            const cycle = (t * 0.7 + ph) % (Math.PI * 2);
            const k = cycle / (Math.PI * 2);
            const sc = 0.5 + k * 2.2;
            child.scale.set(sc, sc, 1);
            const mat = (child as THREE.Mesh).material as THREE.Material & { opacity: number };
            mat.opacity = Math.max(0, 0.5 * (1 - k));
            child.position.y = -baseR * 1.1 + k * baseR * 0.4;
          }
          if (child.userData?.isBook) {
            child.rotation.y = Math.sin(t * 0.35) * 0.1;
            child.rotation.x = Math.sin(t * 0.22) * 0.03;
          }
          if (child.userData?.isCross) child.rotation.z = Math.sin(t * 0.35) * 0.035;
          if (child.userData?.isLighthouseBeam) child.rotation.y += 0.006;
          if (child.userData?.isPrism) child.rotation.y = Math.sin(t * 0.25) * 0.08;
          if (child.userData?.isRainbowRay) {
            const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
            mat.opacity = 0.35 + Math.sin(t * 2 + (child.userData.rayIndex as number) * 0.5) * 0.15;
          }
          if (child.userData?.isNeedle) child.rotation.y += 0.015;
          if (child.userData?.schismHalfA) {
            const base = (child.userData.baseZ as number | undefined);
            if (base === undefined) child.userData.baseZ = child.rotation.z;
            const b = (child.userData.baseZ as number);
            child.rotation.z = b + Math.sin(t * 0.7) * 0.04;
          }
          if (child.userData?.schismHalfB) {
            const base = (child.userData.baseZ as number | undefined);
            if (base === undefined) child.userData.baseZ = child.rotation.z;
            const b = (child.userData.baseZ as number);
            child.rotation.z = b - Math.sin(t * 0.7) * 0.04;
          }
          if (child.userData?.isSpark) {
            const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
            mat.opacity = 0.28 + Math.abs(Math.sin(t * 7.2 + (child.userData.sparkIdx as number) * 1.2)) * 0.42;
          }
          if (child.userData?.isGlow) {
            const sprite = child as THREE.Sprite;
            const mat = sprite.material as THREE.SpriteMaterial;
            const baseOpacity = sprite.userData.baseOpacity as number;
            const baseScale = sprite.userData.baseScale as number;
            if (hovered) {
              const pulse = 1 + Math.sin(t * 3.5) * 0.12;
              sprite.scale.set(baseScale * pulse * 1.18, baseScale * pulse * 1.18, 1);
              mat.opacity = Math.min(1, baseOpacity * 1.35 * pulse);
            } else if (focused > 1) {
              const pulse = 1 + Math.sin(t * 2.0) * 0.09;
              sprite.scale.set(baseScale * pulse * 1.08, baseScale * pulse * 1.08, 1);
              mat.opacity = Math.min(1, baseOpacity * 1.18 * pulse);
            } else {
              const breathe = 1 + Math.sin(t * 0.8) * 0.03;
              sprite.scale.set(baseScale * breathe, baseScale * breathe, 1);
              mat.opacity += (baseOpacity - mat.opacity) * 0.06;
            }
          }
          if (child.userData?.isSphere) {
            const sphere = child as THREE.Mesh;
            const mat = sphere.material as THREE.MeshPhysicalMaterial;
            if (!mat || mat.emissiveIntensity === undefined) return;
            const base = (sphere.userData.baseEmissiveIntensity as number | undefined) ?? 0.12;
            let target: number;
            if (hovered) target = base * 1.9 + Math.sin(t * 4.0) * 0.14;
            else if (focused > 1) target = base * 1.5 + Math.sin(t * 2.5) * 0.10;
            else target = base;
            mat.emissiveIntensity += (target - mat.emissiveIntensity) * 0.09;
          }
        });
      });
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  const getInspectorSafeShift = (mode: InspectorMode) => {
    if (dims.w < 640) return 0;
    if (mode === 'full') return 0.24;
    if (mode === 'peek') return 0.17;
    if (mode === 'rail') return 0.07;
    return 0;
  };

  const focusCameraToNode = useCallback((node: NodeData, mode: InspectorMode) => {
    if (!fgRef.current) return;
    fgRef.current.d3AlphaDecay?.(0.025);
    fgRef.current.d3VelocityDecay?.(0.32);

    const nodeRadius = node.size * 0.52;
    const nodeKind = resolveKind(node);
    const visualRadiusMultiplier =
      nodeKind === 'revival' || nodeKind === 'place' || nodeKind === 'lineage' ? 1.55 :
      nodeKind === 'union' || nodeKind === 'split' || nodeKind === 'merger' ? 1.35 :
      nodeKind === 'root' ? 1.25 : 1;
    const visualRadius = nodeRadius * visualRadiusMultiplier;
    const isMobile = dims.w < 640;

    const nodePos = new THREE.Vector3(node.x ?? 0, node.y ?? 0, node.z ?? 0);
    const target = nodePos.clone().add(new THREE.Vector3(0, isMobile ? visualRadius * 0.08 : visualRadius * 0.12, 0));

    const distance = isMobile ? 116 + visualRadius * 2.0 : 138 + visualRadius * 2.15;
    const cameraDirection = new THREE.Vector3(0.42, 0.22, 1).normalize();
    let cameraPosition = target.clone().add(cameraDirection.clone().multiplyScalar(distance));

    const safeShift = getInspectorSafeShift(mode);
    if (!isMobile && safeShift > 0) {
      const viewDir = target.clone().sub(cameraPosition).normalize();
      const right = new THREE.Vector3().crossVectors(viewDir, new THREE.Vector3(0, 1, 0)).normalize();
      const shiftAmount = distance * safeShift;
      target.add(right.clone().multiplyScalar(shiftAmount));
      cameraPosition.add(right.clone().multiplyScalar(shiftAmount));
    }

    fgRef.current.cameraPosition(
      { x: cameraPosition.x, y: cameraPosition.y, z: cameraPosition.z },
      { x: target.x, y: target.y, z: target.z },
      1200,
    );
  }, [dims.w]);

  const pickPrimaryNodeForSelection = useCallback((selection: MapSelection) => {
    const resolved = selection.nodes.map((nid) => NODES.find((n) => n.id === nid)).filter(Boolean) as NodeData[];
    if (!resolved.length) return null;
    const byId = (id: string) => resolved.find((n) => n.id === id) ?? null;
    if (selection.id === 'country-643') return byId('root') ?? byId('vsehb') ?? resolved[0];
    if (selection.id === 'country-804') return byId('ukr') ?? byId('vsb') ?? resolved[0];
    if (selection.id === 'country-268') return byId('trans') ?? resolved[0];
    if (selection.id === 'country-276') return byId('vseh') ?? byId('pavlov') ?? resolved[0];
    if (selection.id.startsWith('city-')) {
      return resolved.find((n) => n.group !== 'leader') ?? resolved[0];
    }
    return resolved.find((n) => n.group !== 'leader') ?? resolved[0];
  }, []);

  const handleNodeClick = useCallback((node: NodeData) => {
    haptic(10);
    const isSameNode = focusNode?.id === node.id;
    setMapSelection(null); setActiveRoute(null); setContentExpanded(false);
    if (isSameNode) {
      setInspectorMode((prev) => {
        if (prev === 'peek') return 'rail';
        if (prev === 'rail') return 'peek';
        return 'peek';
      });
      return;
    }
    setFocusNode(node);
    const nextMode: InspectorMode = zenMode ? 'closed' : 'peek';
    setInspectorMode(nextMode);
    focusCameraToNode(node, nextMode);
  }, [focusNode, zenMode, focusCameraToNode]);

  const dragReheatRef = useRef(0);
  const handleNodeDrag = useCallback((node: any) => {
    if (!fgRef.current || !node) return;
    // Viscous rubber band: enough damping to avoid jitter, plus a tiny velocity pull
    // on directly connected nodes so the constellation follows the cursor, not just
    // the single grabbed sphere. Never write neighbor coordinates directly.
    fgRef.current.d3VelocityDecay?.(0.26);
    const draggedId = node.id as string;
    const dragged = new THREE.Vector3(node.x ?? 0, node.y ?? 0, node.z ?? 0);
    LINKS.forEach((link) => {
      const sid = typeof link.source === 'object' ? link.source.id : link.source;
      const tid = typeof link.target === 'object' ? link.target.id : link.target;
      if (sid !== draggedId && tid !== draggedId) return;
      const neighborId = sid === draggedId ? tid : sid;
      const neighbor = graphData.nodes.find((n) => n.id === neighborId) as any;
      if (!neighbor || neighbor.fx !== undefined || neighbor.fy !== undefined || neighbor.fz !== undefined) return;
      const anchor = ANCHORS[neighborId];
      const towardDrag = dragged.clone().sub(new THREE.Vector3(neighbor.x ?? 0, neighbor.y ?? 0, neighbor.z ?? 0)).multiplyScalar(0.0032);
      const towardHome = anchor
        ? new THREE.Vector3(anchor.x - (neighbor.x ?? anchor.x), anchor.y - (neighbor.y ?? anchor.y), anchor.z - (neighbor.z ?? anchor.z)).multiplyScalar(0.0012)
        : new THREE.Vector3();
      neighbor.vx = ((neighbor.vx ?? 0) * 0.82) + towardDrag.x + towardHome.x;
      neighbor.vy = ((neighbor.vy ?? 0) * 0.82) + towardDrag.y + towardHome.y;
      neighbor.vz = ((neighbor.vz ?? 0) * 0.82) + towardDrag.z + towardHome.z;
    });
    const now = performance.now();
    if (now - dragReheatRef.current > 80) {
      dragReheatRef.current = now;
      fgRef.current.d3AlphaTarget?.(0.10);
      fgRef.current.d3ReheatSimulation?.();
    }
  }, [graphData.nodes]);

  const handleNodeDragEnd = useCallback((node: any) => {
    if (!fgRef.current) return;
    if (node) {
      node.fx = undefined; node.fy = undefined; node.fz = undefined;
      // Soft push back to anchor
      const anchor = ANCHORS[node.id as string];
      if (anchor) {
        node.vx = ((node.vx ?? 0) * 0.36) + (anchor.x - (node.x ?? anchor.x)) * 0.006;
        node.vy = ((node.vy ?? 0) * 0.36) + (anchor.y - (node.y ?? anchor.y)) * 0.006;
        node.vz = ((node.vz ?? 0) * 0.36) + (anchor.z - (node.z ?? anchor.z)) * 0.006;
      }
    }
    // Return to normal physics
    fgRef.current.d3VelocityDecay?.(0.24); // 0.24 keeps idle calm without making drag feel tense
    fgRef.current.d3AlphaTarget?.(0);
    // Don't fully reheat, just let the residual energy settle it down softly
    fgRef.current.d3ReheatSimulation?.();
  }, []);

  const handleMapSelect = useCallback((selection: MapSelection) => {
    haptic(5);
    setMapMode(true); setMapSelection(selection); setActiveRoute(null); setContentExpanded(false);
    const primaryNode = pickPrimaryNodeForSelection(selection);
    setFocusNode(primaryNode ?? null);
    const nextMode: InspectorMode = zenMode ? 'closed' : 'peek';
    setInspectorMode(nextMode);
    if (primaryNode) focusCameraToNode(primaryNode, nextMode);
  }, [focusCameraToNode, pickPrimaryNodeForSelection, zenMode]);

  const collapseInspector = useCallback(() => {
    if (inspectorPinned) return;
    setInspectorMode((prev) => {
      if (prev === 'full') return 'peek';
      if (prev === 'peek') return 'rail';
      if (prev === 'rail') {
        setZenMode(true);
        return 'closed';
      }
      return prev;
    });
  }, [inspectorPinned]);

  const toggleInspectorDensity = useCallback(() => {
    setInspectorMode((prev) => {
      const next = prev === 'full' ? 'peek' : 'full';
      if (focusNode) focusCameraToNode(focusNode, next);
      return next;
    });
  }, [focusNode, focusCameraToNode]);

  const closeInspector = useCallback(() => {
    haptic(10);
    setFocusNode(null); setMapSelection(null); setActiveRoute(null); setInspectorMode('closed'); setContentExpanded(false); setZenMode(false);
    fgRef.current?.d3AlphaDecay?.(0.0165); fgRef.current?.d3VelocityDecay?.(0.24);
    fgRef.current?.d3ReheatSimulation?.();
    fgRef.current?.cameraPosition(overviewCamera.camera, overviewCamera.target, 900);
  }, [overviewCamera]);

  const handleReset = () => {
    haptic(8);
    setFocusNode(null); setMapSelection(null); setActiveRoute(null); setMapMode(false);
    setContentExpanded(false); setInspectorMode('closed'); setZenMode(false); setInspectorPinned(false); if (timelineYearRef.current !== null) { timelineYearRef.current = null; window.dispatchEvent(new Event('reset-timeline')); }
    fgRef.current?.d3AlphaDecay?.(0.0165);
    fgRef.current?.d3VelocityDecay?.(0.24);
    fgRef.current?.d3ReheatSimulation?.();
    fgRef.current?.cameraPosition(overviewCamera.camera, overviewCamera.target, 900);
  };
  const handleRouteSelect = (route: RoutePreset) => { haptic(5); setActiveRoute(route); setRouteStep(0); setMapSelection(null); setMapMode(true); setContentExpanded(false); const rf = NODES.find((n) => n.id === route.focus) ?? null; setFocusNode(rf); const nextMode: InspectorMode = zenMode ? 'closed' : 'peek'; setInspectorMode(nextMode); if (rf) focusCameraToNode(rf, nextMode); };
  const handleRouteStep = (dir: 1 | -1) => { if (!activeRoute) return; haptic(4); const next = Math.max(0, Math.min(activeRoute.nodes.length - 1, routeStep + dir)); setRouteStep(next); const nodeId = activeRoute.nodes[next]; const stepNode = NODES.find((n) => n.id === nodeId); if (stepNode) { setFocusNode(stepNode); setContentExpanded(false); focusCameraToNode(stepNode, inspectorMode); } };

  const handleRouteStepTo = useCallback((index: number) => {
    if (!activeRoute) return;
    const next = Math.max(0, Math.min(activeRoute.nodes.length - 1, index));
    haptic(4);
    setRouteStep(next);
    const stepNode = NODES.find((n) => n.id === activeRoute.nodes[next]);
    if (stepNode) {
      setFocusNode(stepNode);
      setContentExpanded(false);
      focusCameraToNode(stepNode, inspectorMode);
    }
  }, [activeRoute, focusCameraToNode, inspectorMode]);

  const handleTimelineEventSelect = useCallback((event: any, year: number) => {
    const text = `${event?.year ?? ''} ${event?.title ?? ''} ${event?.description ?? ''} ${event?.details ?? ''}`;
    const fallback = TIMELINE_TARGETS.find((entry) => entry.match.test(text));
    const nodeId = event?.nodeId ?? fallback?.nodeId;
    const routeId = event?.routeId ?? fallback?.routeId;
    const mapId = event?.mapSelectionId ?? fallback?.mapId;
    const node = nodeId ? NODES.find((n) => n.id === nodeId) : null;
    if (!node) return;
    const route = routeId ? ROUTE_PRESETS.find((preset) => preset.id === routeId) ?? null : null;
    const routeIndex = route ? Math.max(0, route.nodes.findIndex((id) => id === node.id)) : 0;
    const selection = findMapSelectionForNode(node.id, mapId);
    setActiveRoute(route);
    setRouteStep(route ? routeIndex : 0);
    setMapMode(Boolean(selection));
    setMapSelection(selection);
    setFocusNode(node);
    setContentExpanded(false);
    const nextMode: InspectorMode = zenMode ? 'closed' : 'peek';
    setInspectorMode(nextMode);
    focusCameraToNode(node, nextMode);
  }, [focusCameraToNode, zenMode]);

  const handleNeighborStep = useCallback((dir: 1 | -1) => {
    if (activeRoute) { handleRouteStep(dir); return; }
    if (!focusNode) return;
    const neighbors = LINKS
      .filter((l) => {
        const sid = typeof l.source === 'object' ? l.source.id : l.source;
        const tid = typeof l.target === 'object' ? l.target.id : l.target;
        return sid === focusNode.id || tid === focusNode.id;
      })
      .map((l) => {
        const sid = typeof l.source === 'object' ? l.source.id : l.source;
        const tid = typeof l.target === 'object' ? l.target.id : l.target;
        return sid === focusNode.id ? tid : sid;
      });
    if (neighbors.length === 0) return;
    haptic(4);
    const targetId = dir === 1 ? neighbors[0] : neighbors[neighbors.length - 1];
    const targetNode = NODES.find((n) => n.id === targetId);
    if (targetNode) {
      setFocusNode(targetNode);
      setContentExpanded(false);
      focusCameraToNode(targetNode, inspectorMode);
    }
  }, [activeRoute, focusNode, inspectorMode, focusCameraToNode]);

  const handleCameraMove = useCallback((direction: CameraMoveDirection) => {
    const camera = fgRef.current?.camera?.() as THREE.PerspectiveCamera | undefined;
    const controls = fgRef.current?.controls?.();
    if (!camera || !controls) return;

    // We want pan-like behavior for arrows, not just orbit, or if orbit, around the center.
    // If we only change theta/phi, we rotate around the current target.
    // But user probably wants to PAN the view left/right.
    const target = (controls.target as THREE.Vector3).clone();
    const panStep = 40;
    
    // Calculate camera basis vectors
    const forward = new THREE.Vector3().subVectors(target, camera.position).normalize();
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();
    
    const nextTarget = target.clone();
    const nextPos = camera.position.clone();

    if (direction === 'left') { nextTarget.sub(right.clone().multiplyScalar(panStep)); nextPos.sub(right.clone().multiplyScalar(panStep)); }
    if (direction === 'right') { nextTarget.add(right.clone().multiplyScalar(panStep)); nextPos.add(right.clone().multiplyScalar(panStep)); }
    if (direction === 'up') { nextTarget.add(up.clone().multiplyScalar(panStep)); nextPos.add(up.clone().multiplyScalar(panStep)); }
    if (direction === 'down') { nextTarget.sub(up.clone().multiplyScalar(panStep)); nextPos.sub(up.clone().multiplyScalar(panStep)); }
    if (direction === 'forward') { 
       const offset = camera.position.clone().sub(target);
       if (offset.length() > 40) nextPos.sub(offset.multiplyScalar(0.2)); 
    }
    if (direction === 'back') { 
       const offset = camera.position.clone().sub(target);
       if (offset.length() < 1000) nextPos.add(offset.multiplyScalar(0.2)); 
    }

    fgRef.current?.cameraPosition?.(
      { x: nextPos.x, y: nextPos.y, z: nextPos.z },
      { x: nextTarget.x, y: nextTarget.y, z: nextTarget.z },
      400,
    );
    haptic(3);
  }, []);

  const handleSceneWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    const scrollHost = target?.closest?.('.custom-scroll') as HTMLElement | null;
    if (scrollHost && scrollHost.scrollHeight > scrollHost.clientHeight) {
      const atTop = scrollHost.scrollTop <= 0;
      const atBottom = scrollHost.scrollTop + scrollHost.clientHeight >= scrollHost.scrollHeight - 1;
      if ((event.deltaY < 0 && !atTop) || (event.deltaY > 0 && !atBottom)) return;
    }
    event.preventDefault();
    event.stopPropagation();
    const camera = fgRef.current?.camera?.() as THREE.PerspectiveCamera | undefined;
    const controls = fgRef.current?.controls?.();
    if (!camera || !controls) return;
    const targetV = (controls.target as THREE.Vector3).clone();
    const offset = camera.position.clone().sub(targetV);
    const factor = event.deltaY > 0 ? 1.08 : 0.92;
    const nextOffset = offset.multiplyScalar(factor);
    const minD = 28;
    const maxD = 1050;
    if (nextOffset.length() < minD || nextOffset.length() > maxD) return;
    const nextPos = targetV.clone().add(nextOffset);
    fgRef.current?.cameraPosition?.({ x: nextPos.x, y: nextPos.y, z: nextPos.z }, { x: targetV.x, y: targetV.y, z: targetV.z }, 120);
  }, []);

  const handleNodeHoverThrottled = useMemo(() => {
    let raf = 0;
    return (node: NodeData | null) => {
      hoveredNodeIdRef.current = node?.id ?? null;
      if (!raf) { raf = requestAnimationFrame(() => { raf = 0; setHoveredNodeId(hoveredNodeIdRef.current); }); }
    };
  }, []);

  const personProfile = focusNode ? personProfiles.find((p) => p.id === focusNode.id) : undefined;
  const mapPlaceRecord = mapSelection ? getMapPlaceRecord(mapSelection.id) : undefined;
  const articleForFocus = focusNode ? articleForNode(focusNode.id) : null;
  const articleForTimelineEvent = useCallback((event: any) => {
    if (event?.articleKey && ARTICLE_PREVIEWS[event.articleKey as keyof typeof ARTICLE_PREVIEWS]) return ARTICLE_PREVIEWS[event.articleKey as keyof typeof ARTICLE_PREVIEWS];
    const text = `${event?.year ?? ''} ${event?.title ?? ''} ${event?.description ?? ''} ${event?.details ?? ''}`;
    const target = TIMELINE_TARGETS.find((entry) => entry.match.test(text));
    if (target?.article) return ARTICLE_PREVIEWS[target.article];
    return target ? articleForNode(target.nodeId) : null;
  }, []);

  const nodeThreeObject = useCallback((node: NodeData) => {
    const hex = GROUP_COLORS[node.group] ?? '#ffffff';
    const r = node.size * 0.52;
    const color = new THREE.Color(hex);
    const group = new THREE.Group();
    const isDirect = directIds.has(node.id);
    const isSecondary = secondaryIds.has(node.id);
    
    // Extract year for Timeline
    const nodeYearMatch = node.year ? node.year.match(/\d{4}/) : null;
    const nodeYear = nodeYearMatch ? parseInt(nodeYearMatch[0], 10) : null;

    const isDimmed = (focusNode !== null && !isDirect && !isSecondary);
    const nodeOpacity = (focusNode === null || isDirect ? 1 : isSecondary ? 0.46 : 0.14);
    const isFocused = focusNode?.id === node.id;
    const kind = resolveKind(node);
    const earthTex = getEarthTexture();

    group.userData.nodeId = node.id;
    group.userData.focusScale = isFocused ? 1.18 : 1;
    group.userData.nodeKind = kind;
    group.userData.nodeYear = nodeYear;
    group.userData.nodeYear = nodeYear;
    nodeObjectsRef.current.set(node.id, group);

    const dimOpacity = (base: number) => isDimmed ? Math.min(base, nodeOpacity) : base;
    const emissInt = isFocused ? 0.7 : isDimmed ? 0.06 : 0.35;

    // --- NODE KIND BUILDERS ---
    if (kind === 'root') {
      const sphereMat = createPremiumMaterial(hex, { map: earthTex, clearcoat: isFocused ? 1.0 : 0.92, clearcoatRoughness: 0.08, roughness: 0.18, metalness: 0.82, emissiveIntensity: isFocused ? 0.78 : isDimmed ? 0.08 : 0.55, transparent: isDimmed, opacity: dimOpacity(1) });
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 64), sphereMat);
      sphere.userData = { globeRotate: true, isSphere: true, baseEmissiveIntensity: 0.55, sphereRadius: r };
      group.add(sphere);

      if (!isDimmed) {
        const auraMat = createPremiumMaterial(hex, { metalness: 0.95, roughness: 0.06, emissiveIntensity: 0.55, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
        const aura = new THREE.Mesh(new THREE.TorusGeometry(r * 1.6, r * 0.02, 16, 128), auraMat);
        aura.rotation.x = Math.PI / 2;
        aura.userData = { unionRing: true, rotateAxis: 'y', rotateSpeed: 0.003 };
        group.add(aura);

        const orbitDefs = [
          { radius: r * 1.5, tube: r * 0.015, tiltX: Math.PI / 2.1, tiltZ: 0.15, speed: 1.3, dotR: r * 0.065 },
          { radius: r * 1.9, tube: r * 0.013, tiltX: Math.PI / 3.4, tiltZ: -0.2, speed: -0.9, dotR: r * 0.058 },
          { radius: r * 2.3, tube: r * 0.011, tiltX: Math.PI / 1.5, tiltZ: 0.35, speed: 0.65, dotR: r * 0.052 },
          { radius: r * 2.7, tube: r * 0.009, tiltX: Math.PI / 4.2, tiltZ: -0.45, speed: -0.45, dotR: r * 0.045 },
        ];
        const dotMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), 0.2), transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending });
        orbitDefs.forEach((def, i) => {
          const orbitGroup = new THREE.Group();
          orbitGroup.rotation.x = def.tiltX;
          orbitGroup.rotation.z = def.tiltZ;
          const lineMat = createGlowMaterial(hex, 0.22);
          const line = new THREE.Mesh(new THREE.TorusGeometry(def.radius, def.tube, 6, 120), lineMat);
          line.userData = { unionRing: true, rotateAxis: 'y', rotateSpeed: 0.003 * (i % 2 === 0 ? 1 : -1) };
          const dot = new THREE.Mesh(new THREE.SphereGeometry(def.dotR, 16, 16), dotMat);
          dot.userData = { isMoon: true, plane: 'xy', orbitRadius: def.radius, orbitSpeed: def.speed, orbitPhase: (i * Math.PI * 2) / orbitDefs.length, sphereRadius: r };
          line.add(dot);
          orbitGroup.add(line);
          group.add(orbitGroup);
        });
      }
    } else if (kind === 'origin') {
      const sphereMat = createPremiumMaterial(hex, { map: earthTex, clearcoat: 0.9, emissiveIntensity: emissInt, transparent: isDimmed, opacity: dimOpacity(1) });
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 48), sphereMat);
      sphere.userData = { globeRotate: true, isSphere: true, baseEmissiveIntensity: emissInt };
      group.add(sphere);

      if (!isDimmed) {
        const orbitGroupA = new THREE.Group();
        const rMatA = createPremiumMaterial(hex, { metalness: 0.95, roughness: 0.08, emissiveIntensity: 0.5, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
        const ringA = new THREE.Mesh(new THREE.TorusGeometry(r * 1.5, r * 0.025, 16, 96), rMatA);
        ringA.userData = { unionRing: true, rotateAxis: 'y', rotateSpeed: 0.006 };
        const moonMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), 0.3), transparent: true, opacity: 0.92, depthWrite: false, blending: THREE.AdditiveBlending });
        const moon = new THREE.Mesh(new THREE.SphereGeometry(r * 0.1, 12, 12), moonMat);
        moon.userData = { isMoon: true, plane: 'xy', orbitRadius: r * 1.5, orbitSpeed: 0.9, orbitPhase: 0, sphereRadius: r };
        ringA.add(moon);
        orbitGroupA.add(ringA);
        group.add(orbitGroupA);

        const orbitGroupB = new THREE.Group();
        orbitGroupB.rotation.x = Math.PI / 2;
        const rMatB = createPremiumMaterial(hex, { metalness: 0.9, roughness: 0.1, emissiveIntensity: 0.4, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
        const ringB = new THREE.Mesh(new THREE.TorusGeometry(r * 1.28, r * 0.018, 12, 96), rMatB);
        ringB.userData = { unionRing: true, rotateAxis: 'x', rotateSpeed: -0.009 };
        orbitGroupB.add(ringB);
        group.add(orbitGroupB);
      }
    } else if (kind === 'union') {
      const coreMat = createPremiumMaterial(hex, { metalness: 0.9, roughness: 0.08, emissiveIntensity: dimOpacity(0.55) });
      const core = new THREE.Mesh(new THREE.SphereGeometry(r * 0.38, 32, 32), coreMat);
      core.userData = { isSphere: true, baseEmissiveIntensity: 0.55 };
      group.add(core);

      const ringsSpec = [
        { rR: r * 1.45, tube: r * 0.048, seg: 128, rotX: 0, rotZ: 0, rotAxis: 'y' as const, speed: 0.008, op: 0.88 },
        { rR: r * 1.15, tube: r * 0.040, seg: 128, rotX: Math.PI / 2, rotZ: 0, rotAxis: 'x' as const, speed: 0.012, op: 0.82 },
        { rR: r * 0.85, tube: r * 0.032, seg: 96, rotX: Math.PI / 3, rotZ: Math.PI / 4, rotAxis: 'z' as const, speed: 0.006, op: 0.75 },
      ];
      ringsSpec.forEach(({ rR, tube, seg, rotX, rotZ, rotAxis, speed, op }) => {
        const mat = createPremiumMaterial(hex, { metalness: 0.95, roughness: 0.06, clearcoat: 1.0, emissiveIntensity: 0.35, transparent: true, opacity: dimOpacity(op), side: THREE.DoubleSide });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(rR, tube, 24, seg), mat);
        ring.rotation.x = rotX; ring.rotation.z = rotZ;
        ring.userData = { unionRing: true, rotateAxis: rotAxis, rotateSpeed: speed };
        group.add(ring);
      });
    } else if (kind === 'split') {
      const splitColor = '#ff3a55'; const splitColorDark = '#cc2240';
      const coreMat = createPremiumMaterial('#1a060a', { metalness: 0.6, roughness: 0.4, emissive: new THREE.Color(splitColorDark), emissiveIntensity: dimOpacity(0.32), transparent: true, opacity: dimOpacity(0.95) });
      group.add(new THREE.Mesh(new THREE.SphereGeometry(r * 0.32, 32, 32), coreMat));
      const innerRingMat = createGlowMaterial(splitColor, dimOpacity(0.45));
      const innerRing = new THREE.Mesh(new THREE.TorusGeometry(r * 0.55, r * 0.018, 8, 64), innerRingMat);
      innerRing.rotation.x = Math.PI / 2; innerRing.userData = { unionRing: true, rotateAxis: 'y', rotateSpeed: -0.012 };
      group.add(innerRing);
      const arcLength = Math.PI * 0.78; const tubeThickness = r * 0.06; const arcRadius = r * 1.18;
      const arcMatA = createPremiumMaterial(splitColor, { metalness: 0.85, roughness: 0.18, emissive: new THREE.Color(splitColor), emissiveIntensity: isFocused ? 0.95 : 0.7, transparent: true, opacity: dimOpacity(0.92) });
      const arcA = new THREE.Mesh(new THREE.TorusGeometry(arcRadius, tubeThickness, 16, 100, arcLength), arcMatA);
      arcA.rotation.x = Math.PI / 2; arcA.rotation.z = -arcLength / 2; arcA.userData = { schismHalfA: true };
      group.add(arcA);
      const arcB = new THREE.Mesh(new THREE.TorusGeometry(arcRadius, tubeThickness, 16, 100, arcLength), arcMatA.clone());
      arcB.rotation.x = Math.PI / 2; arcB.rotation.z = Math.PI - arcLength / 2; arcB.userData = { schismHalfB: true };
      group.add(arcB);
      const auraMat = createGlowMaterial(splitColor, dimOpacity(0.30));
      const aura = new THREE.Mesh(new THREE.TorusGeometry(r * 1.55, r * 0.010, 6, 120), auraMat);
      aura.rotation.x = Math.PI / 2; aura.userData = { unionRing: true, rotateAxis: 'y', rotateSpeed: 0.005 };
      group.add(aura);
      if (!isDimmed) {
        [0, Math.PI].forEach((baseAngle, i) => {
          const spark = new THREE.Mesh(new THREE.SphereGeometry(r * 0.032, 10, 10), createGlowMaterial('#9ddcff', 0.82));
          const sparkAngle = Math.PI / 2 + baseAngle;
          spark.position.set(Math.cos(sparkAngle) * arcRadius, 0, Math.sin(sparkAngle) * arcRadius);
          spark.userData = { isSpark: true, sparkIdx: i };
          group.add(spark);
        });
      }
    } else if (kind === 'revival') {
      const flameLayers = [
        { rr: 1.2, h: 3.2, hex: '#2c0d05', op: 0.05, seg: 6 }, { rr: 0.95, h: 2.85, hex: '#ff2200', op: 0.10, seg: 8 },
        { rr: 0.72, h: 2.48, hex: '#ff5a18', op: 0.22, seg: 10 }, { rr: 0.52, h: 2.1, hex: '#ff9038', op: 0.42, seg: 12 },
        { rr: 0.35, h: 1.72, hex: '#ffcc5c', op: 0.68, seg: 14 }, { rr: 0.18, h: 1.32, hex: '#fff8d8', op: 0.92, seg: 16 },
      ];
      flameLayers.forEach((layer, i) => {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(r * layer.rr, r * layer.h, layer.seg), createGlowMaterial(layer.hex, dimOpacity(layer.op)));
        cone.position.y = r * (layer.h * 0.16 - 0.22);
        cone.userData = { isFlame: true, flameHash: node.id.charCodeAt(0) + i * 7 };
        group.add(cone);
      });
      const coal = new THREE.Mesh(new THREE.SphereGeometry(r * 0.4, 24, 24), createPremiumMaterial('#991a00', { emissiveIntensity: 0.9, roughness: 0.55, metalness: 0.3 }));
      coal.position.y = -r * 0.75;
      group.add(coal);
      if (!isDimmed) {
        const flameAura = new THREE.Mesh(new THREE.TorusGeometry(r * 1.4, r * 0.012, 6, 96), createGlowMaterial('#ff6b35', 0.28));
        flameAura.rotation.x = Math.PI / 2; flameAura.userData = { unionRing: true, rotateAxis: 'y', rotateSpeed: 0.008 };
        group.add(flameAura);
      }
    } else if (kind === 'mission') {
      const disk = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.9, r * 0.1, 32), createPremiumMaterial(hex, { metalness: 0.85, roughness: 0.2, emissiveIntensity: 0.25 }));
      group.add(disk);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.95, r * 0.03, 12, 64), createPremiumMaterial('#d4a857', { metalness: 0.95, roughness: 0.08 }));
      ring.rotation.x = Math.PI / 2; group.add(ring);
      const arrowMat = createPremiumMaterial('#d8dde8', { metalness: 0.9, roughness: 0.12 });
      const northMat = createPremiumMaterial('#ff4b6e', { metalness: 0.88, roughness: 0.1, emissiveIntensity: 0.45 });
      [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach((ang, i) => {
        const arrow = new THREE.Mesh(new THREE.ConeGeometry(r * 0.12, r * 0.5, 6), i === 0 ? northMat : arrowMat);
        arrow.position.set(Math.cos(ang) * r * 0.45, 0, Math.sin(ang) * r * 0.45);
        arrow.rotation.z = -Math.PI / 2; arrow.rotation.y = -ang;
        group.add(arrow);
      });
      const needle = new THREE.Mesh(new THREE.ConeGeometry(r * 0.08, r * 0.7, 4), northMat.clone());
      needle.position.y = r * 0.08; needle.userData = { isNeedle: true };
      group.add(needle);
    } else if (kind === 'place') {
      const stone = createPremiumMaterial('#e8e0d0', { metalness: 0.1, roughness: 0.65, emissiveIntensity: 0.15 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.5, r * 0.55, r * 0.15, 8), stone);
      base.position.y = -r * 1.15;
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.22, r * 0.35, r * 2.2, 8), stone.clone());
      const dome = new THREE.Mesh(new THREE.SphereGeometry(r * 0.26, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), stone.clone());
      dome.position.y = r * 1.1;
      const glassMat = new THREE.MeshPhysicalMaterial({ transmission: 0.9, roughness: 0.1, color: 0xffffff, transparent: true, opacity: 0.4 });
      const lanternGlass = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.2, r * 0.2, r * 0.3, 16), glassMat);
      lanternGlass.position.y = r * 1.25;
      group.add(lanternGlass);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(r * 0.12, 12, 12), createGlowMaterial('#ffd700', 0.9));
      lamp.position.y = r * 1.25;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0, r * 1.2, r * 5, 12, 1, true), createGlowMaterial('#ffeebb', 0.06));
      beam.position.y = r * 3.8; beam.userData = { isLighthouseBeam: true };
      group.add(base, tower, dome, lamp, beam);
    } else if (kind === 'faith') {
      const crossGroup = new THREE.Group();
      crossGroup.userData = { isCross: true };
      const crossMat = createPremiumMaterial('#d4a857', { metalness: 0.92, roughness: 0.08, clearcoat: 1.0, emissiveIntensity: isFocused ? 0.65 : 0.45 });
      const vertical = new THREE.Mesh(new THREE.BoxGeometry(r * 0.18, r * 2.2, r * 0.18), crossMat);
      const horizontal = new THREE.Mesh(new THREE.BoxGeometry(r * 1.4, r * 0.18, r * 0.18), crossMat.clone());
      horizontal.position.y = r * 0.45;
      crossGroup.add(vertical, horizontal);
      const glowTex = getGlowSprite('#d4a857');
      if (glowTex && !isDimmed) {
        const glowMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.55, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
        const glow = new THREE.Sprite(glowMat);
        glow.scale.set(r * 4.5, r * 4.5, 1);
        glow.userData = { isGlow: true, baseOpacity: 0.55, baseScale: r * 4.5 };
        glow.renderOrder = -1;
        crossGroup.add(glow);
      }
      if (!isDimmed) {
        const auraMat = createGlowMaterial('#d4a857', 0.32);
        const aura = new THREE.Mesh(new THREE.TorusGeometry(r * 1.6, r * 0.015, 6, 80), auraMat);
        aura.rotation.x = Math.PI / 2; aura.userData = { unionRing: true, rotateAxis: 'y', rotateSpeed: 0.004 };
        crossGroup.add(aura);
        for (let w = 0; w < 3; w++) {
          const rippleMat = createGlowMaterial('#7fd4e8', 0.0);
          const ripple = new THREE.Mesh(new THREE.TorusGeometry(r * 0.5, r * 0.02, 6, 64), rippleMat);
          ripple.rotation.x = Math.PI / 2; ripple.position.y = -r * 1.1;
          ripple.userData = { baptismRipple: true, phase: (w / 3) * Math.PI * 2, baseR: r };
          crossGroup.add(ripple);
        }
      }
      group.add(crossGroup);
    } else if (kind === 'docs') {
      const book = new THREE.Group();
      book.userData = { isBook: true };
      const pages = new THREE.Mesh(new THREE.BoxGeometry(r * 1.1, r * 1.5, r * 0.45), createPremiumMaterial('#f5e6c8', { metalness: 0.02, roughness: 0.85, emissiveIntensity: 0.12 }));
      const coverMat = createPremiumMaterial('#3a2410', { metalness: 0.15, roughness: 0.65, emissiveIntensity: 0.08 });
      const front = new THREE.Mesh(new THREE.BoxGeometry(r * 1.18, r * 1.58, r * 0.06), coverMat);
      front.position.z = r * 0.26;
      const back = front.clone(); back.position.z = -r * 0.26;
      const spine = new THREE.Mesh(new THREE.BoxGeometry(r * 0.1, r * 1.58, r * 0.48), createPremiumMaterial('#d4a857', { metalness: 0.9, roughness: 0.1, emissiveIntensity: 0.35 }));
      spine.position.x = -r * 0.6;
      book.add(pages, front, back, spine);
      group.add(book);
    } else if (kind === 'prism') {
      const prism = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r * 0.7, r * 1.2, 3), new THREE.MeshPhysicalMaterial({ transmission: 0.86, thickness: 3.0, roughness: 0.02, metalness: 0, ior: 1.8, color: new THREE.Color('#ffffff'), clearcoat: 1.0, transparent: true, opacity: dimOpacity(0.42) }));
      prism.userData = { isPrism: true };
      group.add(prism);
      const input = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.03, r * 0.03, r * 2.2, 6), createGlowMaterial('#ffffff', 0.55));
      input.rotation.z = Math.PI / 2; input.position.x = -r * 1.2; group.add(input);
      const rayColors = ['#ff0000', '#ff8800', '#ffff00', '#00ff66', '#00aaff', '#8844ff'];
      rayColors.forEach((c, i) => {
        const ray = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.018, r * 0.018, r * 1.65, 6), createGlowMaterial(c, 0.46));
        ray.rotation.z = Math.PI / 2 + (i - 2.5) * 0.08; ray.position.x = r * 1.15; ray.position.y = (i - 2.5) * r * 0.08; ray.userData = { isRainbowRay: true, rayIndex: i }; group.add(ray);
      });
    } else if (kind === 'modern') {
      const crystalGrp = new THREE.Group();
      crystalGrp.userData = { globeRotate: true, rotateSpeed: 0.004 };
      const glassMat = new THREE.MeshPhysicalMaterial({ transmission: 0.95, thickness: 1.8, roughness: 0.02, metalness: 0.1, ior: 1.8, color: new THREE.Color('#e0f0ff'), transparent: true, opacity: dimOpacity(0.8) });
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(r * 0.9, 0), glassMat);
      crystalGrp.add(crystal);
      const coreMat = createPremiumMaterial(hex, { metalness: 0.9, roughness: 0.1, emissiveIntensity: 1.5 });
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(r * 0.35, 0), coreMat);
      core.userData = { isSphere: true, baseEmissiveIntensity: 1.5 };
      crystalGrp.add(core);
      if (!isDimmed) {
        const rimMat = createPremiumMaterial('#c0c8d8', { metalness: 0.95, roughness: 0.05 });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.2, r * 0.015, 8, 64), rimMat);
        ring.rotation.x = Math.PI / 2; ring.userData = { unionRing: true, rotateAxis: 'y', rotateSpeed: -0.008 };
        crystalGrp.add(ring);
        const ring2 = new THREE.Mesh(new THREE.TorusGeometry(r * 1.4, r * 0.01, 8, 64), rimMat);
        ring2.rotation.y = Math.PI / 2; ring2.userData = { unionRing: true, rotateAxis: 'x', rotateSpeed: 0.006 };
        crystalGrp.add(ring2);
      }
      group.add(crystalGrp);
    } else if (kind === 'merger') {
      const coreMat = createPremiumMaterial(hex, { metalness: 0.95, roughness: 0.05, emissiveIntensity: 0.85, transparent: isDimmed, opacity: dimOpacity(1) });
      const core = new THREE.Mesh(new THREE.SphereGeometry(r * 0.45, 48, 48), coreMat);
      core.userData = { globeRotate: true, isSphere: true, baseEmissiveIntensity: 0.85 };
      group.add(core);
      const mergerRings = [
        { radius: r * 1.5, tube: r * 0.065, tiltX: Math.PI / 2.2, tiltZ: 0, speed: 0.008, op: 0.88 },
        { radius: r * 1.8, tube: r * 0.055, tiltX: Math.PI / 3.2, tiltZ: Math.PI / 6, speed: -0.012, op: 0.82 },
        { radius: r * 2.1, tube: r * 0.045, tiltX: Math.PI / 1.6, tiltZ: -Math.PI / 5, speed: 0.006, op: 0.75 },
        { radius: r * 2.4, tube: r * 0.035, tiltX: Math.PI / 4.5, tiltZ: Math.PI / 3, speed: -0.009, op: 0.68 },
      ];
      mergerRings.forEach(({ radius, tube, tiltX, tiltZ, speed, op }) => {
        const mat = createPremiumMaterial(hex, { metalness: 0.95, roughness: 0.06, clearcoat: 1.0, emissiveIntensity: 0.35, transparent: true, opacity: dimOpacity(op), side: THREE.DoubleSide });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 24, 128), mat);
        ring.rotation.x = tiltX; ring.rotation.z = tiltZ;
        ring.userData = { unionRing: true, rotateAxis: 'z', rotateSpeed: speed };
        group.add(ring);
      });
    } else if (kind === 'lineage') {
      const helixA: THREE.Vector3[] = [], helixB: THREE.Vector3[] = [];
      for (let i = 0; i < 40; i++) {
        const t = i / 40; const ang = t * Math.PI * 4; const y = (t - 0.5) * r * 4;
        helixA.push(new THREE.Vector3(Math.cos(ang) * r * 0.5, y, Math.sin(ang) * r * 0.5));
        helixB.push(new THREE.Vector3(Math.cos(ang + Math.PI) * r * 0.5, y, Math.sin(ang + Math.PI) * r * 0.5));
      }
      const tubeA = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helixA), 64, r * 0.05, 8, false), createPremiumMaterial(hex, { emissiveIntensity: 0.4, transparent: isDimmed, opacity: dimOpacity(0.9) }));
      tubeA.userData = { isDNA: true }; group.add(tubeA);
      const tubeB = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helixB), 64, r * 0.05, 8, false), createPremiumMaterial('#ffffff', { emissiveIntensity: 0.3, transparent: true, opacity: dimOpacity(0.65) }));
      tubeB.userData = { isDNA: true }; group.add(tubeB);
      for (let i = 1; i < 5; i++) {
        const t = i / 5; const ang = t * Math.PI * 4; const y = (t - 0.5) * r * 4;
        const pA = new THREE.Vector3(Math.cos(ang) * r * 0.5, y, Math.sin(ang) * r * 0.5);
        const pB = new THREE.Vector3(Math.cos(ang + Math.PI) * r * 0.5, y, Math.sin(ang + Math.PI) * r * 0.5);
        const mid = pA.clone().add(pB).multiplyScalar(0.5);
        const bridgeMat = createGlowMaterial(hex, dimOpacity(0.35));
        const bridge = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.025, r * 0.025, pA.distanceTo(pB), 6), bridgeMat);
        bridge.position.copy(mid); bridge.lookAt(pB); bridge.rotateX(Math.PI / 2); group.add(bridge);
      }
    } else {
      const isLeader = node.group === 'leader';
      const sR = isLeader ? r * 0.85 : r;
      
            if (isLeader) {
        const leaderGroup = new THREE.Group();
        const glassMat = new THREE.MeshPhysicalMaterial({ 
          transmission: 0.95, roughness: 0.05, metalness: 0.2, clearcoat: 1.0, ior: 1.5,
          color: new THREE.Color(hex), transparent: true, opacity: dimOpacity(0.85) 
        });
        const glassSphere = new THREE.Mesh(new THREE.SphereGeometry(sR, 32, 32), glassMat);
        glassSphere.userData = { globeRotate: true, isSphere: true, baseEmissiveIntensity: emissInt };
        
        const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex), transparent: true, opacity: dimOpacity(0.3), blending: THREE.AdditiveBlending });
        const coreSphere = new THREE.Mesh(new THREE.SphereGeometry(sR * 0.4, 16, 16), coreMat);
        
        const initial = node.label.charAt(0);
        const text = new SpriteText(initial);
        text.color = isDimmed ? 'rgba(255,255,255,0.2)' : '#ffffff';
        text.textHeight = sR * 1.1;
        text.fontWeight = '900';
        text.renderOrder = 10;
        
        leaderGroup.add(glassSphere, coreSphere, text);
        group.add(leaderGroup);
      } else {
        const sphereMat = createPremiumMaterial(hex, { map: earthTex, clearcoat: isFocused ? 0.95 : 0.7, emissiveIntensity: emissInt, transparent: isDimmed, opacity: dimOpacity(1) });
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(sR, 48, 48), sphereMat);
        sphere.userData = { globeRotate: true, isSphere: true, baseEmissiveIntensity: emissInt };
        group.add(sphere);
      }
      
      if (isLeader && !isDimmed) {
        const orbitGroup = new THREE.Group();
        orbitGroup.rotation.x = Math.PI / 2.2; orbitGroup.rotation.z = Math.PI / 5.5;
        const orbitMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex), transparent: true, opacity: isFocused ? 0.48 : 0.22, side: THREE.DoubleSide, depthWrite: false });
        const orbit = new THREE.Mesh(new THREE.TorusGeometry(sR * 1.5, 0.018, 6, 80), orbitMat);
        orbit.userData = { unionRing: true, rotateAxis: 'y', rotateSpeed: 0.007 };
        
        const moonMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex), transparent: true, opacity: 0.88, depthWrite: false, blending: THREE.AdditiveBlending });
        const moon = new THREE.Mesh(new THREE.SphereGeometry(sR * 0.075, 12, 12), moonMat);
        moon.userData = { isMoon: true, plane: 'xy', orbitRadius: sR * 1.5, orbitSpeed: 1.4, orbitPhase: 0, sphereRadius: sR };
        
        orbit.add(moon);
        orbitGroup.add(orbit);
        group.add(orbitGroup);
      }
    }

    const hitR = kind === 'merger' || kind === 'lineage' ? r * 1.55 : node.isCenter ? r * 1.08 : r * 1.24;
    const hitTarget = new THREE.Mesh(new THREE.SphereGeometry(hitR, 12, 12), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    hitTarget.userData = { interactiveHit: true };
    hitTarget.renderOrder = 2; group.add(hitTarget);

    const glowHex = kind === 'split' ? '#ff4b6e' : kind === 'revival' ? '#ff6b35' : kind === 'faith' ? '#d4a857' : hex;
    const glowTex = getGlowSprite(glowHex);
    if (glowTex) {
      const isLarge = node.isCenter || kind === 'union' || kind === 'split' || kind === 'modern' || kind === 'merger';
      const glowOpacity = isDimmed ? 0.08 : isFocused ? 0.98 : isLarge ? 0.82 : kind === 'revival' ? 0.72 : 0.55;
      const glowScale = r * (isFocused ? 7.5 : isLarge ? 5.5 : kind === 'revival' ? 6.5 : 4.0);
      const glowMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: glowOpacity, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
      const glow = new THREE.Sprite(glowMat);
      glow.scale.set(glowScale, glowScale, 1);
      glow.userData = { isGlow: true, baseOpacity: glowOpacity, baseScale: glowScale };
      glow.renderOrder = -1; group.add(glow);
    }

    const skipHighlight = kind === 'union' || kind === 'merger' || kind === 'lineage';
    if (!isDimmed && !skipHighlight) {
      const hlR = node.group === 'leader' ? r * 0.85 : r;
      const hl = new THREE.Mesh(new THREE.SphereGeometry(hlR * 0.1, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }));
      hl.position.set(-hlR * 0.32, hlR * 0.38, hlR * 0.5); hl.renderOrder = 1; group.add(hl);
    }

    if (isFocused) {
      const focusR = r * 1.62;
      const rmA = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
      const fRingA = new THREE.Mesh(new THREE.TorusGeometry(focusR, 0.022, 10, 128), rmA);
      fRingA.rotation.x = Math.PI / 2; fRingA.userData = { focusOrbit: true, orbitSpeed: 0.0018 };
      const rmB = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.20, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
      const fRingB = new THREE.Mesh(new THREE.TorusGeometry(focusR * 1.18, 0.015, 10, 128), rmB);
      fRingB.rotation.x = Math.PI / 2.5; fRingB.rotation.z = Math.PI / 5; fRingB.userData = { focusOrbit: true, orbitSpeed: -0.0012 };
      group.add(fRingA, fRingB);
    }

    const sideLabelKinds = new Set(['merger', 'union', 'split', 'lineage', 'prism', 'mission', 'place', 'faith', 'docs', 'revival']);
    const useSideLabel = sideLabelKinds.has(kind);
    const labelAnchor = useSideLabel ? r * 2.95 : 0;

    const sphereLabelMap: Record<string, string> = { root: 'ЕХБ', vsehb: 'ВСЕХБ', vseh: 'ВСЕХ', vsb: 'ВСБ', sc: 'СЦ', rsehb: 'РС' };
    const abbr = sphereLabelMap[node.id];
    if (abbr && !isDimmed) {
      const sl = new SpriteText(abbr);
      sl.color = '#ffffff'; sl.fontWeight = '900'; sl.fontFace = 'Inter, system-ui, sans-serif';
      sl.textHeight = node.isCenter && !useSideLabel ? 5.5 : 4.2;
      sl.backgroundColor = 'transparent'; sl.padding = 0;
      sl.strokeColor = 'rgba(0,0,0,0.85)'; sl.strokeWidth = 0.6;
      sl.position.set(labelAnchor, useSideLabel ? r * 0.35 : 0, 0);
      sl.renderOrder = 15; (sl.material as THREE.SpriteMaterial).depthTest = false; (sl.material as THREE.SpriteMaterial).depthWrite = false;
      group.add(sl);
    }

    const labelGap = -(r * 1.4 + 3);
    const mutedLeaderLabel = kind === 'leader' && !isFocused && !directIds.has(node.id);
    const label = new SpriteText(node.label);
    label.color = mutedLeaderLabel ? (isLight ? 'rgba(26,26,34,0.0)' : 'rgba(240,238,235,0.0)') : isDimmed ? (isLight ? 'rgba(26,26,34,0.28)' : 'rgba(240,238,235,0.22)') : isLight ? '#1a1a22' : '#f0ece6';
    label.textHeight = mutedLeaderLabel ? 0.001 : (useSideLabel ? 3.2 : node.isCenter ? 4.6 : node.group === 'leader' ? 2.0 : 3.0);
    label.fontWeight = node.isCenter ? '900' : '700'; label.fontFace = 'Inter, system-ui, sans-serif';
    label.backgroundColor = 'transparent'; label.padding = 0; label.strokeColor = isLight ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)'; label.strokeWidth = 0.45;
    label.position.set(labelAnchor, useSideLabel ? labelGap + r * 1.4 : labelGap, 0);
    label.renderOrder = 10; (label.material as THREE.SpriteMaterial).depthTest = false; (label.material as THREE.SpriteMaterial).depthWrite = false;
    group.add(label);

    if (node.year && !mutedLeaderLabel) {
      const year = new SpriteText(node.year);
      year.color = isDimmed ? (isLight ? 'rgba(26,26,34,0.2)' : 'rgba(240,238,235,0.18)') : hex;
      year.textHeight = useSideLabel ? 1.7 : (node.group === 'leader' ? 1.6 : 1.9);
      year.fontWeight = '700'; year.fontFace = 'JetBrains Mono, monospace'; year.backgroundColor = 'transparent'; year.padding = 0;
      year.strokeColor = isLight ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.75)'; year.strokeWidth = 0.35;
      const yearY = useSideLabel ? labelGap + r * 1.4 - 3.5 : labelGap - (node.isCenter ? 4.5 : 3.5);
      year.position.set(labelAnchor, yearY, 0); year.renderOrder = 10;
      (year.material as THREE.SpriteMaterial).depthTest = false; (year.material as THREE.SpriteMaterial).depthWrite = false;
      group.add(year);
    }

    const subtitleMap: Record<string, string> = { root: 'Евразия', trans: 'Тифлис (Тбилиси)', ukr: 'Южная Украина', spb: 'Санкт-Петербург', vsehb: 'Москва', vseh: 'Санкт-Петербург', vsb: 'Ново-Васильевка', sc: 'Подполье', rsehb: 'Россия' };
    const subtitleText = subtitleMap[node.id];
    if (subtitleText && !isDimmed && node.group !== 'leader' && !useSideLabel) {
      const sub = new SpriteText(subtitleText);
      sub.color = isDimmed ? 'rgba(240,238,235,0.15)' : isLight ? 'rgba(26,26,34,0.4)' : 'rgba(240,238,235,0.38)';
      sub.textHeight = 1.6; sub.fontWeight = '400'; sub.fontFace = 'Inter, system-ui, sans-serif';
      sub.backgroundColor = 'transparent'; sub.padding = 0; sub.strokeColor = isLight ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'; sub.strokeWidth = 0.15;
      const subOffset = node.year ? (node.isCenter ? 8.5 : 7.0) : (node.isCenter ? 4.5 : 3.5);
      sub.position.set(0, labelGap - subOffset, 0); sub.renderOrder = 10;
      (sub.material as THREE.SpriteMaterial).depthTest = false; (sub.material as THREE.SpriteMaterial).depthWrite = false;
      group.add(sub);
    }
    group.traverse((child) => {
      if (child === hitTarget) return;
      child.raycast = () => undefined;
    });
    return group;
  }, [directIds, focusNode, isLight, secondaryIds]);

  const linkThreeObject = useCallback((link: LinkData) => {
    const source = resolveNode(link.source); const target = resolveNode(link.target);
    const blended = new THREE.Color(GROUP_COLORS[source?.group ?? 'root']).lerp(new THREE.Color(GROUP_COLORS[target?.group ?? 'root']), 0.5);
    const isMain = Boolean(source?.isCenter || target?.isCenter); const isActive = activeLinkIds.has(link.id); const isSecondary = secondaryLinkIds.has(link.id); const group = new THREE.Group();
    const coreRadius = isMain ? 0.08 : 0.04; const glowRadius = isMain ? 0.28 : 0.14; const outerGlowRadius = isMain ? 0.55 : 0.28;
    group.add(new THREE.Mesh(makeInitialTube(coreRadius), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: isActive ? 0.92 : isSecondary ? 0.45 : isMain ? 0.42 : 0.22, depthWrite: false, blending: THREE.AdditiveBlending })));
    group.add(new THREE.Mesh(makeInitialTube(glowRadius), new THREE.MeshBasicMaterial({ color: blended, transparent: true, opacity: isActive ? 0.65 : isSecondary ? 0.3 : isMain ? 0.28 : 0.14, depthWrite: false, blending: THREE.AdditiveBlending })));
    group.add(new THREE.Mesh(makeInitialTube(outerGlowRadius), new THREE.MeshBasicMaterial({ color: blended, transparent: true, opacity: isActive ? 0.12 : isSecondary ? 0.05 : isMain ? 0.04 : 0.012, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending })));
    const beadColor = new THREE.Color(0xffffff).lerp(blended, 0.3);
    const beadMat = new THREE.MeshBasicMaterial({ color: beadColor, transparent: true, opacity: isActive ? 0.98 : 0.25, depthWrite: false, blending: THREE.AdditiveBlending });
    const beadSize = isMain ? 0.14 : 0.08;
    const beadA = new THREE.Mesh(new THREE.IcosahedronGeometry(beadSize, 2), beadMat);
    const beadB = new THREE.Mesh(new THREE.IcosahedronGeometry(beadSize * 0.7, 2), beadMat.clone());
    const beadC = new THREE.Mesh(new THREE.IcosahedronGeometry(beadSize * 0.5, 2), beadMat.clone());
    group.add(beadA, beadB, beadC);
    const sourceRadius = (source?.size ?? 10) * 0.52; const targetRadius = (target?.size ?? 10) * 0.52;
    
    const syMatch = source?.year ? source.year.match(/\d{4}/) : null;
    const sy = syMatch ? parseInt(syMatch[0], 10) : null;
    const tyMatch = target?.year ? target.year.match(/\d{4}/) : null;
    const ty = tyMatch ? parseInt(tyMatch[0], 10) : null;
    const linkYear = (sy !== null && ty !== null) ? Math.max(sy, ty) : (sy ?? ty ?? null);
    
    group.userData = { core: group.children[0], glow: group.children[1], outerGlow: group.children[2], beadA, beadB, beadC, coreRadius, glowRadius, outerGlowRadius, isActive, isSecondary, isMain, sourceRadius, targetRadius, linkYear };
    return group;
  }, [activeLinkIds, secondaryLinkIds]);

  const linkPositionUpdate = useCallback((obj: THREE.Object3D, coords: { start: { x: number; y: number; z: number }; end: { x: number; y: number; z: number } }) => {
    const group = obj as THREE.Group; const data = group.userData as any;
    if (!data.core || !data.glow || !data.outerGlow || !data.beadA || !data.beadB || !data.beadC) return false;
    const startRaw = new THREE.Vector3(coords.start.x, coords.start.y, coords.start.z);
    const endRaw = new THREE.Vector3(coords.end.x, coords.end.y, coords.end.z);
    if (!Number.isFinite(startRaw.x) || !Number.isFinite(endRaw.x)) return true;
    const sourceRadius = data.sourceRadius ?? 0; const targetRadius = data.targetRadius ?? 0;
    const dir = endRaw.clone().sub(startRaw).normalize();
    const start = startRaw.clone().add(dir.clone().multiplyScalar(sourceRadius));
    const end = endRaw.clone().sub(dir.clone().multiplyScalar(targetRadius));
    const dist = start.distanceTo(end);
    if (dist < 0.5) return true;
    const lastStart = data.lastStart as THREE.Vector3 | undefined;
    const lastEnd = data.lastEnd as THREE.Vector3 | undefined;
    const needsUpdate = !lastStart || !lastEnd || start.distanceTo(lastStart) > 0.5 || end.distanceTo(lastEnd) > 0.5;
    if (needsUpdate) {
      const curve = makeLinkCurve(start, end);
      data.curve = curve;
      data.core.geometry.dispose(); data.core.geometry = new THREE.TubeGeometry(curve, 32, data.coreRadius, 6, false);
      data.glow.geometry.dispose(); data.glow.geometry = new THREE.TubeGeometry(curve, 20, data.glowRadius, 6, false);
      data.outerGlow.geometry.dispose(); data.outerGlow.geometry = new THREE.TubeGeometry(curve, 14, data.outerGlowRadius, 6, false);
      data.lastStart = start.clone(); data.lastEnd = end.clone();
    }
    
    const currentYear = timelineYearRef.current;
    if (currentYear !== null && data.linkYear !== null && data.linkYear > currentYear) {
      group.visible = false;
      return true;
    } else {
      group.visible = true;
    }

    const time = Date.now() * 0.001; const speed = data.isActive ? 0.55 : 0.28; 
    const curve = data.curve;
    if (curve) {
      const tA = (time * speed) % 1;
      const tB = (tA - 0.04 + 1) % 1;
      const tC = (tA - 0.08 + 1) % 1;
      data.beadA.position.copy(curve.getPoint(tA));
      data.beadB.position.copy(curve.getPoint(tB));
      data.beadC.position.copy(curve.getPoint(tC));
    }
    const pulse = data.isActive ? 0.9 + Math.sin(time * 5) * 0.3 : 1.0;
    data.beadA.scale.set(pulse, pulse, pulse); data.beadB.scale.set(pulse, pulse, pulse); data.beadC.scale.set(pulse, pulse, pulse);
    if (data.isActive) { (data.core.material as THREE.MeshBasicMaterial).opacity = 0.9 + Math.sin(time * 6) * 0.1; }
    return true;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (isTyping) return;
      if (e.key === 'Escape') { if (inspectorMode !== 'closed') { closeInspector(); } }
      if (cameraNavEnabled && (e.key === '+' || e.key === '=')) { e.preventDefault(); handleCameraMove('forward'); return; }
      if (cameraNavEnabled && (e.key === '-' || e.key === '_')) { e.preventDefault(); handleCameraMove('back'); return; }
      if (focusNode && !e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault(); handleNeighborStep(e.key === 'ArrowRight' ? 1 : -1); return;
      }
      if (cameraNavEnabled && (e.shiftKey || !focusNode || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        if (e.key === 'ArrowUp') { e.preventDefault(); handleCameraMove('up'); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); handleCameraMove('down'); return; }
        if (e.key === 'ArrowLeft') { e.preventDefault(); handleCameraMove('left'); return; }
        if (e.key === 'ArrowRight') { e.preventDefault(); handleCameraMove('right'); return; }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cameraNavEnabled, focusNode, inspectorMode, closeInspector, handleCameraMove, handleNeighborStep]);

  const isSmallViewport = dims.w < 640;
  const showLearningCoach = !zenMode && !focusNode && !activeRoute && !mapSelection && !bottomBarExpanded;
  const panelSafeLeft = useMemo(() => {
    if (isSmallViewport) return 16;
    if (!focusNode || inspectorMode === 'closed') return 16;
    if (inspectorMode === 'rail') return 90;
    if (inspectorMode === 'peek') return 320;
    return 360;
  }, [focusNode, inspectorMode, isSmallViewport]);

  const SelectionBadge = focusNode && zenMode ? (
    <motion.button initial={{ opacity: 0, scale: 0.9, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: -10 }} onClick={() => { haptic(10); setZenMode(false); setInspectorMode('peek'); if (focusNode) focusCameraToNode(focusNode, 'peek'); }} className="absolute left-5 top-5 z-50 flex items-center gap-3 rounded-2xl border bg-black/50 px-4 py-3 backdrop-blur-2xl transition hover:bg-black/65 active:scale-95" style={{ borderColor: `${GROUP_COLORS[focusNode.group]}40`, boxShadow: `0 0 0 1px ${GROUP_COLORS[focusNode.group]}15, 0 16px 48px rgba(0,0,0,0.4)` }}>
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: GROUP_COLORS[focusNode.group], boxShadow: `0 0 8px ${GROUP_COLORS[focusNode.group]}` }} />
      <div className="text-left">
        <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/35">{GROUP_LABELS[focusNode.group]}</div>
        <div className="text-sm font-black text-white">{focusNode.label}</div>
        {focusNode.year && <div className="font-mono text-[10px]" style={{ color: GROUP_COLORS[focusNode.group] }}>{focusNode.year}</div>}
        <div className="mt-0.5 line-clamp-1 text-[10px] text-white/35">Нажмите, чтобы вернуть инспектор</div>
      </div>
      <ChevronRight size={14} className="text-white/30" />
    </motion.button>
  ) : null;

  return (
    <div className="relative h-[100dvh] w-screen">
      <div className="h-full w-full">
        <div ref={containerRef} className="relative h-full w-full overflow-hidden" style={{ background: isLight ? '#f5f0eb' : '#06060c', touchAction: 'none', overscrollBehavior: 'none', cursor: hoveredNodeId ? 'pointer' : isNavigating ? 'grabbing' : 'grab' }} onWheelCapture={handleSceneWheel} onContextMenu={(e) => e.preventDefault()} onMouseLeave={() => { hoveredNodeIdRef.current = null; setHoveredNodeId(null); }}>
          {nightMapUrl && (<div className="pointer-events-none absolute inset-0" style={{ backgroundImage: `url(${nightMapUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: isLight ? 0.2 : 0.62, filter: isLight ? 'saturate(0.6) contrast(0.85)' : 'saturate(1.2) contrast(1.1) brightness(0.7)' }} />)}
          <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 20% 16%, rgba(255,255,255,0.06) 0 1px, transparent 1.4px), radial-gradient(circle at 70% 28%, rgba(255,255,255,0.04) 0 1px, transparent 1.3px), radial-gradient(circle at 54% 72%, rgba(255,255,255,0.03) 0 1px, transparent 1.4px)', backgroundSize: '240px 240px, 180px 180px, 220px 220px, 220px 220px', opacity: isLight ? 0.2 : 0.45 }} />
          <svg className="pointer-events-none absolute inset-0 z-[9] h-full w-full" viewBox="0 0 1200 650" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <defs>
              <filter id="countryGlowSmart" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3.5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              <filter id="countryBorder" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            {countries.map((geo) => { const id = String(geo.id).padStart(3, '0'); const focus = COUNTRY_FOCUS[id]; const pathD = geoPathGenerator(geo as any) ?? undefined; if (!pathD) return null; const exact = Boolean(focus && (mapSelection?.id === focus.id || (focusNode && focus.nodes.includes(focusNode.id)))); const related = Boolean(focus && !exact && focus.nodes.some((nid) => connectedIds.has(nid))); return (<path key={id} d={pathD} fill={exact && focus ? `${focus.color}14` : related && focus ? `${focus.color}08` : 'rgba(255,255,255,0.010)'} stroke={focus ? focus.color : isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.050)'} strokeWidth={exact ? 1.1 : related ? 0.7 : 0.55} opacity={exact ? 0.48 : related ? 0.26 : focus ? 0.16 : 0.26} filter={exact ? 'url(#countryGlowSmart)' : 'url(#countryBorder)'} className="transition-all duration-500" style={{ pointerEvents: mapMode && focus ? 'auto' : 'none', cursor: mapMode && focus ? 'pointer' : 'default' }} onClick={(ev) => { if (!mapMode || !focus) return; ev.stopPropagation(); handleMapSelect({ id: focus.id, label: focus.label, color: focus.color, nodes: focus.nodes }); }} />); })}
          </svg>
          {CITY_MARKERS.map((city) => { const projected = projection([city.lon, city.lat]); if (!projected) return null; const exact = Boolean(mapSelection?.id === city.id || (focusNode && city.nodes.includes(focusNode.id))); const related = !exact && city.nodes.some((nid) => connectedIds.has(nid)); const visible = mapMode || exact || related || !focusNode; return (<button key={city.id} type="button" onClick={() => handleMapSelect({ id: city.id, label: city.label, color: city.color, nodes: city.nodes })} className="absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-all duration-500" style={{ left: `${(projected[0] / 1200) * 100}%`, top: `${(projected[1] / 650) * 100}%`, pointerEvents: 'auto', opacity: visible ? (exact ? 1 : related ? 0.7 : 0.28) : 0.08 }}><div className="relative"><div className="absolute -inset-4 rounded-full blur-xl" style={{ background: `${city.color}55`, opacity: exact ? 0.9 : related ? 0.45 : 0.15 }} /><div className="relative rounded-full" style={{ width: exact ? 10 : 7, height: exact ? 10 : 7, background: city.color, boxShadow: `0 0 16px ${city.color}` }} /></div>{(mapMode || exact) && (<span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap text-[11px] font-semibold" style={{ color: city.color, textShadow: '0 0 12px rgba(0,0,0,0.8)' }}>{city.label}</span>)}</button>); })}
          <div className="pointer-events-none absolute inset-0" style={{ background: isLight ? 'linear-gradient(90deg, rgba(250,248,245,0.45), rgba(250,248,245,0.08) 46%, rgba(250,248,245,0.45))' : 'radial-gradient(circle at 52% 46%, rgba(6,6,12,0.05), rgba(3,3,7,0.45) 80%), linear-gradient(90deg, rgba(3,3,7,0.55), rgba(3,3,7,0.05) 48%, rgba(3,3,7,0.55))' }} />
          {mapMode && !focusNode && (<motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} className="pointer-events-none absolute left-5 top-5 z-30 rounded-2xl border border-brand-gold/25 bg-black/55 px-4 py-3 text-xs text-white/70 backdrop-blur-2xl" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(196,166,126,0.08)' }}><p className="font-bold text-brand-gold tracking-wide">Режим карты</p><p className="mt-1 max-w-[220px] leading-5 text-white/55">Страны и города кликабельны.</p></motion.div>)}
          <ContextStatusBar activeRoute={activeRoute} routeStep={routeStep} mapSelection={mapSelection} focusLabel={focusNode?.label} />
          
          <SceneControls mapMode={mapMode} zenMode={zenMode} hasFocus={Boolean(focusNode)} cameraNavEnabled={cameraNavEnabled} onToggleMap={() => setMapMode((v) => !v)} onToggleZen={() => { setZenMode((v) => !v); if (!zenMode) setInspectorMode('closed'); else if (focusNode) { setInspectorMode('peek'); focusCameraToNode(focusNode, 'peek'); } }} onToggleCameraNav={() => setCameraNavEnabled((v) => !v)} onReset={handleReset} onOverview={() => fgRef.current?.cameraPosition(overviewCamera.camera, overviewCamera.target, 700)} onFocusReturn={focusNode ? () => focusCameraToNode(focusNode, inspectorMode) : undefined} onToggleLegend={() => setShowLegend(!showLegend)} />
          <AnimatePresence>{cameraNavEnabled && !zenMode && (<CameraNavPad onMove={handleCameraMove} onToggle={() => setCameraNavEnabled(false)} />)}</AnimatePresence>
          <AnimatePresence><LearningCoach visible={showLearningCoach} onOpenRoutes={() => setBottomBarExpanded(true)} onOpenMap={() => setMapMode(true)} /></AnimatePresence>
          <AnimatePresence>{hoveredNodeId && !focusNode && (() => { const hNode = NODES.find((n) => n.id === hoveredNodeId); if (!hNode) return null; return (<motion.div key={hoveredNodeId} initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.95 }} transition={{ duration: 0.12 }} className="pointer-events-none absolute bottom-28 left-1/2 z-40 -translate-x-1/2 rounded-2xl border backdrop-blur-2xl sm:bottom-32" style={{ color: GROUP_COLORS[hNode.group], borderColor: `${GROUP_COLORS[hNode.group]}35`, background: 'rgba(5,5,12,0.75)', boxShadow: `0 0 24px ${GROUP_COLORS[hNode.group]}18`, padding: '6px 14px 7px' }}><span className="text-[8.5px] uppercase tracking-[0.18em]" style={{ color: GROUP_COLORS[hNode.group], opacity: 0.6 }}>{GROUP_LABELS[hNode.group]}</span><div className="flex items-baseline gap-2"><span className="text-[13px] font-bold leading-tight text-white">{hNode.label}</span>{hNode.year && <span className="font-mono text-[9px]" style={{ color: GROUP_COLORS[hNode.group], opacity: 0.7 }}>{hNode.year}</span>}</div></motion.div>); })()}</AnimatePresence>
          {(focusNode || mapSelection) && (<div className="pointer-events-none absolute bottom-20 right-4 z-30 hidden rounded-2xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-[10px] text-white/55 backdrop-blur-xl md:block" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}><div className="mb-1.5 flex items-center gap-2"><span className="h-1.5 w-6 rounded-full" style={{ background: 'linear-gradient(90deg, #c4a67e, #d4a857)' }} />прямая связь</div><div className="flex items-center gap-2"><span className="h-px w-6 rounded-full bg-white/30" />вторичная</div></div>)}

          {/* Timeline: ref-based so RAF can dim future nodes without rebuilding graph state. */}
          {!zenMode && <TimelineOverlay timelineYearRef={timelineYearRef} bottomBarExpanded={bottomBarExpanded} onEventSelect={handleTimelineEventSelect} getArticleForEvent={articleForTimelineEvent} />}

          {focusNode && !zenMode && (
            <>
              <motion.button initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} onClick={() => handleNeighborStep(-1)} className="group absolute left-4 top-1/2 z-30 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border backdrop-blur-2xl transition-all hover:scale-110 active:scale-95 sm:flex" style={{ borderColor: activeRoute ? `${activeRoute.color}50` : 'rgba(196,166,126,0.32)', background: 'rgba(5,5,12,0.72)', color: activeRoute ? activeRoute.color : '#c4a67e', boxShadow: `0 8px 24px rgba(0,0,0,0.42), 0 0 0 1px ${activeRoute ? activeRoute.color + '15' : 'rgba(196,166,126,0.10)'}` }} aria-label={activeRoute ? 'Предыдущий шаг маршрута' : 'Предыдущий связанный узел'}><ChevronLeft size={18} className="transition-transform group-hover:-translate-x-0.5" /></motion.button>
              <motion.button initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} onClick={() => handleNeighborStep(1)} className="group absolute right-4 top-1/2 z-30 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border backdrop-blur-2xl transition-all hover:scale-110 active:scale-95 sm:flex" style={{ borderColor: activeRoute ? `${activeRoute.color}50` : 'rgba(196,166,126,0.32)', background: 'rgba(5,5,12,0.72)', color: activeRoute ? activeRoute.color : '#c4a67e', boxShadow: `0 8px 24px rgba(0,0,0,0.42), 0 0 0 1px ${activeRoute ? activeRoute.color + '15' : 'rgba(196,166,126,0.10)'}` }} aria-label={activeRoute ? 'Следующий шаг маршрута' : 'Следующий связанный узел'}><ChevronRight size={18} className="transition-transform group-hover:translate-x-0.5" /></motion.button>
              {activeRoute && (<motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="pointer-events-none absolute left-1/2 top-[calc(50%+38px)] z-30 hidden -translate-x-1/2 rounded-full border px-3 py-1 text-center backdrop-blur-2xl sm:block" style={{ borderColor: `${activeRoute.color}40`, background: 'rgba(5,5,12,0.72)', boxShadow: `0 4px 16px rgba(0,0,0,0.4)` }}><span className="font-mono text-[10px] font-bold" style={{ color: activeRoute.color }}>{routeStep + 1} / {activeRoute.nodes.length}</span></motion.div>)}
            </>
          )}

          <BottomBar left={panelSafeLeft} hidden={isSmallViewport && inspectorMode === 'full'} expanded={bottomBarExpanded} activeRoute={activeRoute} routeStep={routeStep} mapSelection={mapSelection} onToggle={() => setBottomBarExpanded((v) => !v)} onRouteSelect={handleRouteSelect} onRouteStepTo={handleRouteStepTo} onMapSelect={handleMapSelect} />
          
          <ForceGraph3D
            ref={fgRef} graphData={graphData} width={dims.w} height={dims.h} backgroundColor="rgba(0,0,0,0)"
            nodeThreeObject={nodeThreeObject as any} nodeThreeObjectExtend={false}
            linkThreeObject={linkThreeObject as any} linkThreeObjectExtend={false}
            linkPositionUpdate={linkPositionUpdate as any} linkWidth={0} linkDirectionalParticles={0} linkDirectionalParticleWidth={0} linkDirectionalParticleSpeed={0}
            onNodeClick={handleNodeClick as any} nodeLabel="" d3AlphaDecay={0.0165} d3VelocityDecay={0.24}
            warmupTicks={150} cooldownTicks={220} cooldownTime={7000} enableNodeDrag={true}
            onNodeDrag={handleNodeDrag as any} onNodeDragEnd={handleNodeDragEnd as any}
            showNavInfo={false} onBackgroundClick={() => { if (!isNavigating) collapseInspector(); }}
            controlType="orbit" onNodeHover={(node: any) => handleNodeHoverThrottled(node ? (node as NodeData) : null)}
          />

          <AnimatePresence>{SelectionBadge}</AnimatePresence>

          <AnimatePresence mode="wait">
            {focusNode && !zenMode && inspectorMode !== 'closed' && (
              <motion.aside key="inspector" initial={{ opacity: 0, x: -40, scale: 0.96 }} animate={{ opacity: (isNavigating && !inspectorPinned) ? 0.28 : 1, x: 0, scale: 1, width: isSmallViewport && inspectorMode === 'full' ? '100%' : inspectorMode === 'rail' ? 72 : inspectorMode === 'peek' ? 300 : 320, pointerEvents: (isNavigating && !inspectorPinned) ? 'none' : 'auto' }} exit={{ opacity: 0, x: -40, scale: 0.96 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }} className="absolute z-[55] overflow-hidden border shadow-2xl will-change-transform" style={{ background: 'rgba(4,4,10,0.97)', backdropFilter: 'blur(48px) saturate(200%)', borderColor: `${GROUP_COLORS[focusNode.group]}38`, boxShadow: `0 0 0 1px ${GROUP_COLORS[focusNode.group]}15, 0 32px 100px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)`, left: isSmallViewport && inspectorMode === 'full' ? 0 : 20, top: isSmallViewport && inspectorMode === 'full' ? undefined : 20, bottom: isSmallViewport && inspectorMode === 'full' ? 0 : undefined, borderRadius: isSmallViewport && inspectorMode === 'full' ? '24px 24px 0 0' : 24, height: inspectorMode === 'full' ? isSmallViewport ? '82vh' : 'calc(100% - 40px)' : 'auto', maxHeight: inspectorMode === 'full' ? undefined : isSmallViewport ? 460 : 520 }} onTouchStart={(e) => { (e.currentTarget as HTMLElement).dataset.startX = String(e.touches[0].clientX); }} onTouchEnd={(e) => { const start = Number((e.currentTarget as HTMLElement).dataset.startX || 0); if (e.changedTouches[0].clientX - start > 80) { if (inspectorMode === 'full') { setInspectorMode('peek'); focusCameraToNode(focusNode, 'peek'); } else if (inspectorMode === 'peek') { setInspectorMode('rail'); focusCameraToNode(focusNode, 'rail'); } } }}>
                {isSmallViewport && inspectorMode === 'full' && (<div className="flex justify-center pt-2"><div className="h-1 w-12 rounded-full bg-white/15" /></div>)}
                <div className="flex items-center justify-between border-b border-white/[0.08] px-3 py-2.5">
                  <div className="flex items-center gap-1">
                    <PanelButton onClick={() => setInspectorPinned(p => !p)} active={inspectorPinned} title={inspectorPinned ? "Открепить" : "Закрепить"} className="h-7 w-7 border-transparent">{inspectorPinned ? <PinOff size={12} /> : <Pin size={12} />}</PanelButton>
                    <PanelButton onClick={() => setZenMode(true)} title="Чистый вид (Zen)" className="h-7 w-7 border-transparent"><EyeOff size={12} /></PanelButton>
                  </div>
                  <div className="flex items-center gap-1">
                    {inspectorMode !== 'rail' && (<PanelButton onClick={() => { setInspectorMode('rail'); focusCameraToNode(focusNode, 'rail'); }} title="Свернуть" className="h-7 w-7 border-transparent"><PanelLeftClose size={12} /></PanelButton>)}
                    <PanelButton onClick={toggleInspectorDensity} title={inspectorMode === 'full' ? "Компактно" : "Развернуть"} className="h-7 w-7 border-transparent">{inspectorMode === 'full' ? <Minimize2 size={12} /> : <Maximize2 size={12} />}</PanelButton>
                    <PanelButton onClick={closeInspector} danger title="Закрыть" className="h-7 w-7 border-transparent"><X size={12} /></PanelButton>
                  </div>
                </div>
                {inspectorMode === 'rail' ? (
                  <button aria-label="Открыть инспектор" onClick={() => { haptic(5); setInspectorMode('peek'); focusCameraToNode(focusNode, 'peek'); }} className="group flex w-[72px] cursor-pointer flex-col items-center gap-2.5 px-3 py-4 text-center active:scale-95 transition-transform hover:bg-white/[0.03]">
                    <motion.span animate={{ scale: [1, 1.18, 1] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }} className="h-2.5 w-2.5 rounded-full" style={{ background: GROUP_COLORS[focusNode.group], boxShadow: `0 0 12px ${GROUP_COLORS[focusNode.group]}, 0 0 24px ${GROUP_COLORS[focusNode.group]}66` }} />
                    {focusNode.year && <span className="font-mono text-[10px] font-bold" style={{ color: GROUP_COLORS[focusNode.group] }}>{focusNode.year.split('–')[0]}</span>}
                    <span className="line-clamp-3 text-[9px] font-bold leading-[1.25] text-white/70">{focusNode.label}</span>
                    <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[8px] text-white/35">{relatedLinks.length} св.</span>
                    <ChevronRight size={12} className="text-white/25 transition group-hover:translate-x-0.5 group-hover:text-white/60" />
                  </button>
                ) : inspectorMode === 'peek' ? (
                  <div className="w-[300px] p-5 pb-3">
                    <div className="mb-3">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: GROUP_COLORS[focusNode.group], boxShadow: `0 0 6px ${GROUP_COLORS[focusNode.group]}` }} />
                        <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">{GROUP_LABELS[focusNode.group]}</span>
                      </div>
                      <h3 className="text-lg font-black leading-tight tracking-tight text-white">{focusNode.label}</h3>
                      {focusNode.year && <p className="mt-1 font-mono text-xs font-semibold" style={{ color: GROUP_COLORS[focusNode.group] }}>{focusNode.year}</p>}
                    </div>
                    <p className="mb-3 line-clamp-2 text-[12px] leading-[1.6] text-white/55">{focusNode.desc}</p>
                    {activeRoute && (
                      <div className="mb-3 flex items-center gap-2">
                        <button onClick={() => { haptic(4); handleRouteStep(-1); }} disabled={routeStep === 0} className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] py-1.5 text-[11px] font-semibold transition hover:bg-white/[0.08] active:scale-95 disabled:opacity-30">←</button>
                        <span className="font-mono text-[10px] text-white/40">{routeStep + 1}/{activeRoute.nodes.length}</span>
                        <button onClick={() => { haptic(4); handleRouteStep(1); }} disabled={routeStep >= activeRoute.nodes.length - 1} className="flex-1 rounded-xl py-1.5 text-[11px] font-semibold transition active:scale-95 disabled:opacity-30" style={{ background: `${activeRoute.color}22`, color: activeRoute.color, border: `1px solid ${activeRoute.color}44` }}>→</button>
                      </div>
                    )}
                    <motion.button onClick={() => { haptic(5); setInspectorMode('full'); focusCameraToNode(focusNode, 'full'); }} whileHover={{ y: 1 }} whileTap={{ scale: 0.95 }} className="group mx-auto mt-2 flex h-8 items-center gap-1.5 rounded-full border px-3 transition-all" style={{ borderColor: `${GROUP_COLORS[focusNode.group]}35`, background: `${GROUP_COLORS[focusNode.group]}0c`, color: GROUP_COLORS[focusNode.group] }} aria-label="Показать полное досье">
                      <span className="text-[9px] font-bold uppercase tracking-[0.12em]">Досье</span>
                      <motion.span animate={{ y: [0, 2, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}><ChevronDown size={13} /></motion.span>
                    </motion.button>
                  </div>
                ) : (
                  /* === FULL DOSSIER: глубокая, насыщенная карточка === */
                  <div className="custom-scroll h-full overflow-y-auto">
                    {/* Sticky header с акцентной полоской */}
                    <div className="sticky top-0 z-10 border-b border-white/6 px-5 py-4 backdrop-blur-xl" style={{ background: isLight ? 'rgba(255,255,255,0.92)' : 'rgba(5,5,11,0.94)' }}>
                       <div className="mb-2 flex items-center gap-2">
                        <Sparkles size={11} style={{ color: GROUP_COLORS[focusNode.group] }} />
                        <span className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: GROUP_COLORS[focusNode.group] }}>{GROUP_LABELS[focusNode.group]}</span>
                        <span className="ml-auto flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-white/40">
                          <span className="h-1 w-1 rounded-full" style={{ background: GROUP_COLORS[focusNode.group] }} />
                          Досье
                        </span>
                      </div>
                      <h3 className="text-[1.15rem] font-black leading-tight tracking-tight text-white">{focusNode.label}</h3>
                      {focusNode.year && <p className="mt-1 font-mono text-[11px] font-semibold" style={{ color: GROUP_COLORS[focusNode.group] }}>{focusNode.year}</p>}
                      {personProfile?.role && (
                        <p className="mt-2 text-[11px] leading-5 text-white/55">{personProfile.role}</p>
                      )}
                    </div>

                    <div className="space-y-4 p-5">
                      {/* === Описание === */}
                      <section>
                        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/30 mb-2">Описание</p>
                        <p className="text-[0.8375rem] leading-[1.7] text-white/82">{focusNode.desc}</p>
                        {personProfile?.contribution && personProfile.contribution !== focusNode.desc && (
                          <p className="mt-2.5 text-[12px] leading-[1.65] text-white/65">{personProfile.contribution}</p>
                        )}
                      </section>

                      {/* === Регион (для лидеров) === */}
                      {personProfile?.region && (
                        <section className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                          <div className="flex items-start gap-2.5">
                            <MapPin size={13} className="mt-0.5 shrink-0" style={{ color: GROUP_COLORS[focusNode.group] }} />
                            <div className="min-w-0">
                              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/35">Регион действия</p>
                              <p className="mt-0.5 text-[11.5px] leading-5 text-white/75">{personProfile.region}</p>
                            </div>
                          </div>
                        </section>
                      )}

                      {/* === Stats === */}
                      {focusNode.stats && (
                        <section>
                          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/30 mb-2">Цифры</p>
                          <div className="grid grid-cols-3 gap-1.5">
                            {[{ label: 'верующих', value: focusNode.stats.users }, { label: 'год основания', value: focusNode.stats.year }, { label: 'источников', value: focusNode.stats.sources }].map((s) => (
                              <div key={s.label} className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-2 py-2.5 text-center">
                                <div className="text-sm font-black text-white truncate" style={{ color: GROUP_COLORS[focusNode.group] }}>{s.value}</div>
                                <div className="mt-1 text-[8px] uppercase tracking-[0.1em] text-white/35">{s.label}</div>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}

                      {/* === Геолокация (если есть выбор по карте) === */}
                      {mapSelection && mapPlaceRecord && (
                        <section className="rounded-xl border px-3.5 py-3" style={{ borderColor: `${mapSelection.color}38`, background: `${mapSelection.color}0c` }}>
                          <div className="mb-1.5 flex items-center gap-2"><MapPin size={11} style={{ color: mapSelection.color }} /><span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: mapSelection.color }}>{mapSelection.label}</span></div>
                          <p className="text-[11.5px] leading-[1.65] text-white/70">{mapPlaceRecord.summary}</p>
                          {mapPlaceRecord.historicalNotes.length > 0 && (
                            <ul className="mt-2.5 space-y-1.5 border-t border-white/[0.06] pt-2.5">
                              {mapPlaceRecord.historicalNotes.slice(0, 3).map((note) => (
                                <li key={note} className="flex gap-2 text-[10.5px] leading-4 text-white/55">
                                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full" style={{ background: mapSelection.color }} />
                                  <span>{note}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </section>
                      )}

                      {/* === Архивные подробности (highlights) === */}
                      {personProfile && personProfile.highlights.length > 0 && (
                        <section>
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">Архивная карточка</p>
                            <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] font-mono text-white/40">{personProfile.highlights.length}</span>
                          </div>
                          <div className="space-y-2">
                            {personProfile.highlights.slice(0, contentExpanded ? personProfile.highlights.length : 4).map((h) => (
                              <p key={h} className="flex gap-2.5 text-[11.5px] leading-[1.65] text-white/72">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: GROUP_COLORS[focusNode.group] }} />
                                <span>{h}</span>
                              </p>
                            ))}
                          </div>
                          {personProfile.highlights.length > 4 && (
                            <button onClick={() => setContentExpanded((s) => !s)} className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold text-white/55 transition hover:bg-white/[0.08] hover:text-white/85">
                              {contentExpanded ? 'Свернуть' : `Ещё ${personProfile.highlights.length - 4}`}
                              <ChevronDown size={11} className={`transition-transform ${contentExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          )}
                        </section>
                      )}

                      {/* === Хронология (chronology) для лидеров === */}
                      {personProfile && personProfile.chronology.length > 0 && (
                        <section>
                          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/30 mb-2">Хронология жизни</p>
                          <div className="relative space-y-2 pl-3.5">
                            <div className="absolute left-0 top-1.5 bottom-1.5 w-px" style={{ background: `linear-gradient(to bottom, ${GROUP_COLORS[focusNode.group]}55, ${GROUP_COLORS[focusNode.group]}10, transparent)` }} />
                            {personProfile.chronology.map((item) => (
                              <div key={`${item.year}-${item.text}`} className="relative">
                                <div className="absolute -left-3.5 top-1.5 h-1.5 w-1.5 -translate-x-1/2 rounded-full" style={{ background: GROUP_COLORS[focusNode.group], boxShadow: `0 0 6px ${GROUP_COLORS[focusNode.group]}80` }} />
                                <div className="text-[11px] leading-[1.55]">
                                  <span className="font-mono font-bold" style={{ color: GROUP_COLORS[focusNode.group] }}>{item.year}</span>
                                  <span className="ml-2 text-white/65">{item.text}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}

                      {/* === Этапы развития (для союзов/регионов) === */}
                      {focusNode.stages && (
                        <section>
                          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/30 mb-2">Ключевые этапы</p>
                          <div className="relative space-y-2 pl-3.5">
                            <div className="absolute left-0 top-1.5 bottom-1.5 w-px" style={{ background: `linear-gradient(to bottom, ${GROUP_COLORS[focusNode.group]}55, ${GROUP_COLORS[focusNode.group]}10, transparent)` }} />
                            {focusNode.stages.map((stage) => (
                              <div key={stage.year} className="relative">
                                <div className="absolute -left-3.5 top-1.5 h-1.5 w-1.5 -translate-x-1/2 rounded-full" style={{ background: GROUP_COLORS[focusNode.group], boxShadow: `0 0 6px ${GROUP_COLORS[focusNode.group]}80` }} />
                                <div className="text-[11px] leading-[1.55]">
                                  <span className="font-mono font-bold" style={{ color: GROUP_COLORS[focusNode.group] }}>{stage.year}</span>
                                  <span className="ml-2 text-white/65">{stage.text}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}

                      {/* === Спорный вопрос === */}
                      {(() => {
                        const dispute = biographyDisputes.find((e) => e.person.toLowerCase().includes(focusNode.label.split(' ').slice(-1)[0].toLowerCase()));
                        if (!dispute) return null;
                        return (
                          <section className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3.5">
                            <div className="mb-2 flex items-center gap-1.5 text-amber-400">
                              <AlertTriangle size={12} />
                              <span className="text-[9px] font-bold uppercase tracking-[0.14em]">Спорный вопрос: {dispute.issue}</span>
                            </div>
                            <div className="space-y-2 text-[11px] leading-[1.55]">
                              <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-2.5"><strong className="text-amber-300/90">Версия A:</strong> <span className="text-white/75">{dispute.versionA}</span></div>
                              <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-2.5"><strong className="text-amber-300/90">Версия B:</strong> <span className="text-white/75">{dispute.versionB}</span></div>
                            </div>
                            <p className="mt-2 text-[10.5px] leading-4 text-white/55 italic">{dispute.note}</p>
                          </section>
                        );
                      })()}

                      {/* === Судьба === */}
                      {personProfile?.fate && (
                        <section className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/30 mb-1.5">Судьба</p>
                          <p className="text-[11.5px] leading-[1.6] text-white/72">{personProfile.fate}</p>
                        </section>
                      )}

                      {/* === Активный маршрут === */}
                      {activeRoute && (
                        <section className="rounded-xl border px-3.5 py-3" style={{ borderColor: `${activeRoute.color}38`, background: `${activeRoute.color}0e` }}>
                          <div className="mb-1.5 flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: activeRoute.color }} />
                            <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: activeRoute.color }}>Маршрут: {activeRoute.label}</span>
                            <span className="ml-auto font-mono text-[10px] text-white/40">{routeStep + 1}/{activeRoute.nodes.length}</span>
                          </div>
                          <p className="mb-2.5 text-[11px] leading-[1.6] text-white/60">{activeRoute.summary}</p>
                          <div className="flex items-center gap-2">
                            <button onClick={() => { haptic(4); handleRouteStep(-1); }} disabled={routeStep === 0} className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] py-1.5 text-[11px] font-semibold transition hover:bg-white/[0.08] active:scale-95 disabled:opacity-30">← Назад</button>
                            <button onClick={() => { haptic(4); handleRouteStep(1); }} disabled={routeStep >= activeRoute.nodes.length - 1} className="flex-1 rounded-xl py-1.5 text-[11px] font-semibold transition active:scale-95 disabled:opacity-30" style={{ background: `${activeRoute.color}22`, color: activeRoute.color, border: `1px solid ${activeRoute.color}44` }}>Вперёд →</button>
                          </div>
                        </section>
                      )}

                      {articleForFocus && (
                        <section className="overflow-hidden rounded-xl border border-brand-gold/20 bg-brand-gold/[0.045]">
                          <a href={articleForFocus.url} target="_top" className="group flex gap-3 p-3 text-left transition hover:bg-brand-gold/[0.055]" aria-label={`Открыть статью серии: ${articleForFocus.title}`}>
                            <img src={articleForFocus.cover} alt="" width={96} height={54} loading="lazy" decoding="async" className="h-[54px] w-24 shrink-0 rounded-lg border border-white/[0.08] object-cover" />
                            <span className="min-w-0"><span className="block text-[8px] font-bold uppercase tracking-[0.16em] text-brand-gold/80">Связанная статья · {articleForFocus.kicker}</span><span className="mt-1 block text-[12px] font-black leading-tight text-white group-hover:text-brand-gold">{articleForFocus.title}</span><span className="mt-1 line-clamp-2 block text-[10.5px] leading-4 text-white/55">{articleForFocus.desc}</span></span>
                          </a>
                        </section>
                      )}

                      {/* === Связи === */}
                      {relatedLinks.length > 0 && (
                        <section>
                          <div className="mb-2 flex items-center justify-between">
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">Связанные узлы</p>
                              <p className="text-[8px] text-white/22 mt-0.5">Нажмите для перехода к узлу</p>
                            </div>
                            <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] font-mono text-white/40">{relatedLinks.length}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {relatedLinks.map((link) => {
                              const sid = typeof link.source === 'object' ? link.source.id : link.source;
                              const tid = typeof link.target === 'object' ? link.target.id : link.target;
                              const otherId = sid === focusNode.id ? tid : sid;
                              const other = NODES.find((n) => n.id === otherId);
                              if (!other) return null;
                              return (
                                <button key={link.id} onClick={() => { haptic(5); handleNodeClick(other); }} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold transition-all hover:scale-[1.04] active:scale-95" style={{ borderColor: `${GROUP_COLORS[other.group]}52`, color: GROUP_COLORS[other.group], background: `${GROUP_COLORS[other.group]}10` }}>
                                  <span className="h-1 w-1 rounded-full" style={{ background: GROUP_COLORS[other.group] }} />
                                  {other.label}
                                </button>
                              );
                            })}
                          </div>
                        </section>
                      )}

                      {/* === География влияния === */}
                      {activeMapEntries.length > 0 && (
                        <section>
                          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/30 mb-1">География влияния</p>
                          <p className="text-[10px] leading-4 text-white/40 mb-2">Страны и города, связанные с этим узлом</p>
                          <div className="flex flex-wrap gap-1.5">
                            {activeMapEntries.slice(0, 6).map((entry) => (
                              <button key={entry.id} onClick={() => handleMapSelect({ id: entry.id, label: entry.label, color: entry.color, nodes: entry.nodes })} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold transition hover:scale-[1.04] active:scale-95" style={{ borderColor: `${entry.color}50`, color: entry.color, background: `${entry.color}12` }}>
                                <MapPin size={9} />
                                {entry.label}
                              </button>
                            ))}
                          </div>
                        </section>
                      )}

                      {/* === Источник === */}
                      {personProfile?.source && (
                        <section className="rounded-xl border border-brand-gold/20 bg-brand-gold/[0.04] p-3">
                          <div className="mb-1.5 flex items-center gap-1.5 text-brand-gold/85">
                            <BookOpen size={11} />
                            <span className="text-[9px] font-bold uppercase tracking-[0.14em]">Источники</span>
                          </div>
                          <p className="text-[10.5px] leading-[1.55] text-white/65">{personProfile.source}</p>
                        </section>
                      )}

                      {/* === Кнопка свернуть — компактная, заметная === */}
                      <button
                        onClick={() => { haptic(5); setInspectorMode('peek'); focusCameraToNode(focusNode, 'peek'); }}
                        className="group sticky bottom-0 z-10 mx-auto mt-3 mb-1 flex h-8 items-center gap-1.5 rounded-full border px-3.5 text-[9px] font-bold uppercase tracking-[0.12em] transition hover:scale-[1.03] active:scale-95"
                        style={{
                          borderColor: `${GROUP_COLORS[focusNode.group]}45`,
                          background: `${GROUP_COLORS[focusNode.group]}14`,
                          color: GROUP_COLORS[focusNode.group],
                        }}
                      >
                        <ChevronDown size={11} className="rotate-180" />
                        Свернуть
                      </button>
                    </div>
                  </div>
                )}
              </motion.aside>
            )}
          </AnimatePresence>

          {/* Intro Narrative Overlay */}
          <AnimatePresence>
            {showIntro && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-auto absolute inset-0 z-[100] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
                <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} className="relative max-w-lg overflow-hidden rounded-3xl border border-[#c4a67e]/30 bg-[#06060c] p-8 text-center shadow-2xl">
                  <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#c4a67e]/10"><Sparkles size={28} className="text-[#c4a67e]" /></div>
                  <h2 className="mb-3 text-2xl font-black text-white">Карта истории ЕХБ</h2>
                  <p className="mb-6 text-sm leading-relaxed text-white/70">Исследуйте 3D-сеть возникновения и развития евангельского движения.<br/>От первых истоков — через союзы и гонения — к современности.</p>
                  <div className="mb-8 grid grid-cols-3 gap-3 text-left">
                    <div className="rounded-xl bg-white/5 p-3"><div className="mb-1 flex items-center justify-center text-xs font-bold text-[#c4a67e]">1. Вращайте</div><div className="text-[10px] text-center text-white/50">камеру для обзора</div></div>
                    <div className="rounded-xl bg-white/5 p-3"><div className="mb-1 flex items-center justify-center text-xs font-bold text-[#c4a67e]">2. Выбирайте</div><div className="text-[10px] text-center text-white/50">узлы и маршруты</div></div>
                    <div className="rounded-xl bg-white/5 p-3"><div className="mb-1 flex items-center justify-center text-xs font-bold text-[#c4a67e]">3. Читайте</div><div className="text-[10px] text-center text-white/50">досье и хронику</div></div>
                  </div>
                  <button onClick={() => { haptic(10); setShowIntro(false); }} className="w-full rounded-full bg-[#c4a67e] py-3.5 text-[11px] font-bold uppercase tracking-widest text-black transition-transform hover:scale-[1.02] active:scale-95">Начать исследование</button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Legend Overlay */}
          <AnimatePresence>
            {showLegend && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="absolute right-16 top-20 z-40 w-64 rounded-2xl border border-white/10 bg-black/60 p-4 backdrop-blur-2xl">
                <h4 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#c4a67e]">Легенда карты</h4>
                <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.035] p-3 text-[10px] leading-4 text-white/55">
                  <div><span className="font-bold text-[#c4a67e]">Цвет</span> = слой истории: истоки, союзы, гонения, самиздат.</div>
                  <div><span className="font-bold text-[#c4a67e]">A/B/C</span> = уровень источника: документ, исследование, память.</div>
                  <div><span className="font-bold text-[#c4a67e]">Красный</span> = гонения / совесть / давление государства.</div>
                </div>
                <ul className="space-y-2.5 text-[11px] text-white/80">
                  <li className="flex items-center gap-3"><div className="h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_8px_white]" /> Зерно — исток движения</li>
                  <li className="flex items-center gap-3"><div className="h-2.5 w-2.5 border border-white" /> Портал — регион</li>
                  <li className="flex items-center gap-3"><div className="flex h-3 w-3 items-center justify-center rounded-full border border-white"><div className="h-1 w-1 rounded-full bg-white"/></div> Гироскоп — союз</li>
                  <li className="flex items-center gap-3"><div className="h-3 w-3 rounded-full bg-[#ff3a55] opacity-80" /> Разлом — раскол</li>
                  <li className="flex items-center gap-3"><div className="h-2.5 w-2.5 bg-white opacity-80" style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}/> Пламя — пробуждение</li>
                  <li className="flex items-center gap-3"><div className="h-2.5 w-2.5 rounded-full bg-[#d4a857]" /> Крест — символ веры</li>
                  <li className="flex items-center gap-3"><div className="h-3 w-2 bg-[#f5e6c8]" /> Книга — документ</li>
                  <li className="flex items-center gap-3"><div className="h-3 w-3 bg-[#e0f0ff] opacity-80" style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}/> Кристалл — современность</li>
                  <li className="flex items-center gap-3"><div className="h-3 w-2.5 bg-white/50" style={{ borderRadius: '4px 4px 0 0' }} /> Силуэт — личность</li>
                </ul>
              </motion.div>
            )}
          </AnimatePresence>

          {focusNode && inspectorMode === 'full' && <div className="fixed inset-0 z-[54] bg-black/20 sm:hidden" onClick={collapseInspector} />}
        </div>
      </div>
    </div>
  );
}
