/**
 * Genealogy theme — parchment-premium visual identity.
 *
 * Single source of truth for lineage colors, era metadata, layout constants.
 * Imported by nodes, edges, panels, and legend.
 */

import type { Lineage, EraId, Role } from './types';

export interface LineageStyle {
  bg: string;
  border: string;
  text: string;
  glow: string;
  fill: string;
}

export const LINEAGE_STYLES: Record<Lineage, LineageStyle> = {
  messianic:             { bg: 'rgba(212,168,87,0.14)',  border: '#d4a857', text: '#f5e6c8', glow: 'rgba(212,168,87,0.45)', fill: '#d4a857' },
  'messianic-matthew':   { bg: 'rgba(184,134,61,0.12)',  border: '#c8923d', text: '#e8d5b0', glow: 'rgba(184,134,61,0.4)',  fill: '#c8923d' },
  'messianic-luke':      { bg: 'rgba(180,145,90,0.12)',  border: '#b8965a', text: '#e0d0b8', glow: 'rgba(180,145,90,0.4)',  fill: '#b8965a' },
  'messianic-fulfillment':{ bg: 'rgba(255,215,0,0.18)',  border: '#ffd700', text: '#fff8e0', glow: 'rgba(255,215,0,0.65)', fill: '#ffd700' },
  cainite:               { bg: 'rgba(150,60,60,0.10)',   border: '#9a4040', text: '#d4a0a0', glow: 'rgba(150,60,60,0.3)',  fill: '#9a4040' },
  rejected:              { bg: 'rgba(100,100,100,0.06)', border: '#5a5a5a', text: '#999999', glow: 'none',                   fill: '#5a5a5a' },
  neutral:               { bg: 'rgba(140,120,90,0.07)',  border: '#7a6a4e', text: '#b8a888', glow: 'none',                   fill: '#7a6a4e' },
};

export const getLineStyle = (lineage: string): LineageStyle =>
  LINEAGE_STYLES[lineage as Lineage] ?? LINEAGE_STYLES.neutral;

export interface EraMeta {
  label: string;
  color: string;
}

export const ERA_META: Record<EraId, EraMeta> = {
  creation:       { label: 'Сотворение',            color: '#8B6914' },
  antediluvian:   { label: 'Допотопный мир',        color: '#A0734A' },
  flood:          { label: 'Потоп',                 color: '#5A7A8C' },
  postdiluvian:   { label: 'Послепотопный мир',     color: '#6B8E4E' },
  patriarchs:     { label: 'Патриархи',             color: '#C4A04A' },
  kings:          { label: 'Царства',               color: '#B8743A' },
  exile:          { label: 'Плен и восстановление', color: '#8C6A4A' },
  incarnation:    { label: 'Воплощение',            color: '#D4A857' },
};

export const ROLE_LABELS: Record<Role, string> = {
  patriarch: 'Патриарх',
  matriarch: 'Праматерь',
  king: 'Царь',
  prince: 'Князь',
  priest: 'Священник',
  prophet: 'Пророк',
  governor: 'Правитель',
  messiah: 'Мессия',
  'foster-father': 'Приёмный отец',
  person: 'Личность',
  group: 'Группа',
};

// ── Layout constants ──
export const NODE_W = 172;
export const NODE_H = 72;
export const MAX_LIFESPAN = 969; // Methuselah

// ── Semantic-zoom visibility rules ──
export const KEY_ROLES = new Set<Role>([
  'patriarch', 'king', 'messiah', 'prophet', 'matriarch', 'priest', 'governor', 'foster-father',
]);

/** Persons always visible at the cosmic (zoomed-out) level. */
export const COSMIC_ANCHORS = new Set<string>(['adam', 'noah', 'abram', 'david']);
