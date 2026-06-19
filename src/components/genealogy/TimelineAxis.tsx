/**
 * TimelineAxis — vertical AM (Anno Mundi) chronological scale.
 *
 * Renders on the left edge of the canvas, showing key biblical milestones
 * (Creation AM 0, Flood AM 1656, Abraham AM 1948, David, Christ AM ~4000).
 * Users see at a glance WHERE in salvation history they are looking.
 */

import { memo } from 'react';
import type { Era } from './types';
import { ERA_META } from './theme';

interface TimelineAxisProps {
  eras: Era[];
  amMin: number;
  amMax: number;
  /** Canvas height in px (should match layout Y_SPAN + margins). */
  height: number;
}

const MILESTONES: { am: number; label: string; ref?: string }[] = [
  { am: 0,    label: 'Сотворение',    ref: 'Быт 1' },
  { am: 1656, label: 'Потоп',         ref: 'Быт 7' },
  { am: 1948, label: 'Авраам',        ref: 'Быт 12' },
  { am: 2513, label: 'Исход',         ref: 'Исх 12' },
  { am: 2992, label: 'Давид',         ref: '2Цар 5' },
  { am: 3520, label: 'Плен',          ref: '4Цар 25' },
  { am: 4000, label: 'Христос',       ref: 'Мф 1' },
];

function TimelineAxisComponent({ eras, amMin, amMax, height }: TimelineAxisProps) {
  const range = Math.max(1, amMax - amMin);
  const yForAM = (am: number) => ((am - amMin) / range) * height;

  return (
    <div
      style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: '70px', zIndex: 5, pointerEvents: 'none',
      }}
      aria-hidden="true"
    >
      {/* Vertical line */}
      <div style={{
        position: 'absolute', left: '60px', top: 0, bottom: 0,
        width: '1px', background: 'rgba(212,168,87,0.12)',
      }} />

      {/* Era bands */}
      {eras.filter(e => e.amStart != null && e.amEnd != null).map(e => {
        const y1 = yForAM(e.amStart!);
        const y2 = yForAM(e.amEnd!);
        const h = Math.max(2, y2 - y1);
        const meta = ERA_META[e.id as keyof typeof ERA_META];
        return (
          <div key={e.id} style={{
            position: 'absolute', left: '55px', top: `${y1}px`,
            width: '11px', height: `${h}px`,
            background: `${e.color}30`,
            borderLeft: `2px solid ${e.color}80`,
            borderRadius: '0 2px 2px 0',
          }} title={meta?.label || e.name} />
        );
      })}

      {/* Milestone labels */}
      {MILESTONES.filter(m => m.am >= amMin && m.am <= amMax).map(m => {
        const y = yForAM(m.am);
        const isMajor = [0, 1656, 4000].includes(m.am);
        return (
          <div key={m.am} style={{
            position: 'absolute', left: '0px', top: `${y - 8}px`,
            display: 'flex', alignItems: 'center', gap: '4px',
          }}>
            {/* tick mark */}
            <div style={{
              width: isMajor ? '60px' : '50px', height: '1px',
              background: isMajor ? 'rgba(212,168,87,0.5)' : 'rgba(212,168,87,0.2)',
            }} />
            {/* label */}
            <div style={{
              color: isMajor ? '#d4a857' : 'rgba(200,184,154,0.4)',
              fontSize: isMajor ? '10px' : '9px',
              fontWeight: isMajor ? 700 : 400,
              fontFamily: '"Lora", Georgia, serif',
              whiteSpace: 'nowrap',
              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
            }}>
              {m.label}
              <span style={{ fontSize: '8px', opacity: 0.6, marginLeft: '2px' }}>AM {m.am}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const TimelineAxis = memo(TimelineAxisComponent);
