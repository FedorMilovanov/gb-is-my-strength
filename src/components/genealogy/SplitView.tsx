/**
 * SplitView — side-by-side comparison of Matthew 1 and Luke 3 genealogies.
 *
 * Shows both lines from David to Christ in parallel columns:
 * - Left:  Matthew (Solomon → kings → Joseph, royal/legal line)
 * - Right: Luke    (Nathan → ... → Mary, blood line)
 * Meeting point: Jesus Christ.
 *
 * Highlights differences, shared names, and the Jeconiah curse problem.
 */

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type SyntheticEvent,
} from 'react';
import type { Person } from './types';
import { getLineStyle, ROLE_LABELS } from './theme';

interface SplitViewProps {
  persons: Person[];
  onClose: () => void;
}

function traceLine(persons: Person[], fromId: string, toId: string): Person[] {
  const chain: Person[] = [];
  const byId = new Map(persons.map(p => [p.id, p]));
  let cur = byId.get(fromId);
  const guard = new Set<string>();
  while (cur && !guard.has(cur.id)) {
    chain.push(cur);
    guard.add(cur.id);
    if (cur.id === toId) break;
    // Follow father, or mother for Jesus→Mary
    if (cur.id === 'jesus' && cur.mother) cur = byId.get(cur.mother);
    else cur = cur.father ? byId.get(cur.father) : undefined;
  }
  return chain;
}

function SplitViewComponent({ persons, onClose }: SplitViewProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const { matthewLine, lukeLine, sharedNames } = useMemo(() => {
    // Matthew: Jesus → Joseph → Jacob → ... → Solomon → David → ... → Abraham
    const mt = traceLine(persons, 'jesus', 'david')
      .filter(p => p.lineage === 'messianic-matthew' || p.lineage === 'messianic-fulfillment' || p.id === 'david')
      .reverse();
    // Luke: Jesus → Mary → Heli → ... → Nathan → David → ... → Adam
    const lk = traceLine(persons, 'jesus', 'david')
      .filter(p => p.lineage === 'messianic-luke' || p.lineage === 'messianic-fulfillment' || p.id === 'david')
      .reverse();

    const mtNames = new Set(mt.map(p => p.name.ru));
    const lkNames = new Set(lk.map(p => p.name.ru));
    const shared = new Set([...mtNames].filter(n => lkNames.has(n)));

    return { matthewLine: mt, lukeLine: lk, sharedNames: shared };
  }, [persons]);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    closeButtonRef.current?.focus({ preventScroll: true });

    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  const requestClose = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
  }, []);

  const handleDialogClose = useCallback(() => {
    // The native close algorithm finishes before the close event. Restore the
    // exact opener here, after UA modal focus handling, then let React remove
    // the closed surface. This avoids racing native focus restoration.
    const opener = restoreFocusRef.current;
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    onClose();
  }, [onClose]);

  const handleCancel = useCallback((event: SyntheticEvent<HTMLDialogElement>) => {
    // Keep Escape dismissal in the same native close lifecycle as the explicit
    // close button so both paths restore the exact opener.
    event.preventDefault();
    requestClose();
  }, [requestClose]);

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    // showModal() supplies truthful modal semantics and makes the covered page
    // inert. Chromium can still hand focus to the document after the final
    // tabbable element, so keep only that boundary transition inside the modal
    // rather than implementing a synthetic per-key navigation model.
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>([
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(','))).filter(element => {
      const style = window.getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && !element.hasAttribute('inert');
    });

    if (focusable.length === 0) {
      event.preventDefault();
      dialog.focus({ preventScroll: true });
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    const focusEscaped = !(active instanceof Node) || !dialog.contains(active);

    if (event.shiftKey && (active === first || focusEscaped)) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && (active === last || focusEscaped)) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  }, []);

  const renderEntry = (p: Person) => {
    const ls = getLineStyle(p.lineage);
    const isShared = sharedNames.has(p.name.ru);
    const isDisputed = Boolean(p.disputed);
    const roleLabel = p.role ? ROLE_LABELS[p.role] : undefined;
    return (
      <div
        key={p.id}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '5px 8px', borderRadius: '6px',
          background: isShared ? 'rgba(212,168,87,0.08)' : 'transparent',
          border: isDisputed ? '1px solid rgba(192,57,43,0.3)' : '1px solid transparent',
          marginBottom: '2px',
        }}
      >
        <span style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: ls.fill, flexShrink: 0,
        }} />
        <span style={{
          color: p.role === 'messiah' ? '#ffd700' : ls.text,
          fontSize: '12px', fontWeight: isShared ? 600 : 400,
          fontFamily: '"Lora", Georgia, serif',
        }}>
          {p.name.ru}
        </span>
        {roleLabel && roleLabel !== 'Личность' && (
          <span style={{ color: 'rgba(200,184,154,0.35)', fontSize: '9px' }}>{roleLabel}</span>
        )}
        {isDisputed && (
          <span style={{ color: '#e87060', fontSize: '9px', fontWeight: 700 }}>⚠</span>
        )}
        {isShared && (
          <span style={{ color: 'rgba(212,168,87,0.5)', fontSize: '8px' }}>≡</span>
        )}
      </div>
    );
  };

  return (
    <dialog
      ref={dialogRef}
      className="genealogy-split-dialog"
      aria-labelledby="genealogy-split-title"
      aria-describedby="genealogy-split-description"
      onCancel={handleCancel}
      onClose={handleDialogClose}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        width: '100vw', height: '100dvh', maxWidth: 'none', maxHeight: 'none',
        margin: 0, padding: 0, border: 0,
        background: 'rgba(5,4,2,0.95)', backdropFilter: 'blur(20px)',
        display: 'flex', flexDirection: 'column',
        color: '#c8b89a',
        fontFamily: '"Lora", Georgia, serif',
        animation: 'genealogy-fade-in .2s ease-out',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderBottom: '1px solid rgba(212,168,87,0.12)',
      }}>
        <div>
          <div id="genealogy-split-title" style={{ color: '#d4a857', fontSize: '16px', fontWeight: 700 }}>
            Две родословные Христа
          </div>
          <div id="genealogy-split-description" style={{ color: 'rgba(200,184,154,0.4)', fontSize: '11px', marginTop: '2px' }}>
            Матфей (царственная линия через Соломона) vs Лука (кровная линия через Нафана)
          </div>
        </div>
        <button
          ref={closeButtonRef}
          autoFocus
          onClick={requestClose}
          aria-label="Закрыть сравнение"
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(212,168,87,0.2)',
            borderRadius: '8px', color: '#c8b89a', fontSize: '18px',
            cursor: 'pointer', width: '36px', height: '36px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >×</button>
      </div>

      {/* Two columns */}
      <div style={{ display: 'flex', gap: '0', flex: 1, overflow: 'hidden' }}>
        {/* Matthew column */}
        <div
          role="region"
          aria-label="Родословие по Матфею"
          tabIndex={0}
          style={{ flex: 1, overflowY: 'auto', padding: '14px', borderRight: '1px solid rgba(212,168,87,0.08)' }}
        >
          <div style={{ color: '#c8923d', fontSize: '13px', fontWeight: 700, marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid rgba(200,146,61,0.2)' }}>
            📜 Матфей 1:1–17
          </div>
          <div style={{ color: 'rgba(200,184,154,0.35)', fontSize: '10px', marginBottom: '10px' }}>
            Авраам → Давид → <b style={{color:'#c8923d'}}>Соломон</b> → цари → Иосиф → Христос
          </div>
          {matthewLine.map(renderEntry)}
        </div>

        {/* Luke column */}
        <div
          role="region"
          aria-label="Родословие по Луке"
          tabIndex={0}
          style={{ flex: 1, overflowY: 'auto', padding: '14px' }}
        >
          <div style={{ color: '#b8965a', fontSize: '13px', fontWeight: 700, marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid rgba(184,150,90,0.2)' }}>
            📜 Лука 3:23–38
          </div>
          <div style={{ color: 'rgba(200,184,154,0.35)', fontSize: '10px', marginBottom: '10px' }}>
            Адам → Ной → Авраам → Давид → <b style={{color:'#b8965a'}}>Нафан</b> → ... → Мария → Христос
          </div>
          {lukeLine.map(renderEntry)}
        </div>
      </div>

      {/* Legend */}
      <div style={{
        padding: '10px 20px', borderTop: '1px solid rgba(212,168,87,0.08)',
        display: 'flex', gap: '16px', fontSize: '10px', color: 'rgba(200,184,154,0.4)',
      }}>
        <span>≡ — общее имя в обеих линиях</span>
        <span>⚠ — спорное место (нажмите в древе для деталей)</span>
        <span style={{ marginLeft: 'auto' }}>{matthewLine.length} Мф · {lukeLine.length} Лк</span>
      </div>

      <style>{`
        .genealogy-split-dialog::backdrop {
          background: rgba(5, 4, 2, 0.7);
          backdrop-filter: blur(4px);
        }
        @keyframes genealogy-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </dialog>
  );
}

export const SplitView = memo(SplitViewComponent);
