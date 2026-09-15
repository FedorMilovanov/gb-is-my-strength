/** Source-based comparison of Matthew 1 and Luke 3, in the named edition. */

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type SyntheticEvent,
} from 'react';
import type { Person } from './types';
import { getGospelComparison, gospelSource, type ComparisonRange } from './gospelSequences';
import './SplitView.css';

interface SplitViewProps {
  persons: Person[];
  onClose: () => void;
  returnFocusTo: HTMLElement | null;
}

function SplitViewComponent({ persons, onClose, returnFocusTo }: SplitViewProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  // A touch activation in WebKit need not focus its button. The caller owns
  // the actual opener; document.activeElement can still be the search field.
  const restoreFocusRef = useRef<HTMLElement | null>(returnFocusTo);

  const [range, setRange] = useState<ComparisonRange>('david');
  const [mobileLine, setMobileLine] = useState('both');
  const { lines, sharedIds } = useMemo(() => getGospelComparison(persons, range), [persons, range]);

  useEffect(() => {
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
      'summary',
      '[tabindex]:not([tabindex="-1"])',
    ].join(','))).filter(element => {
      const style = window.getComputedStyle(element);
      return element.getClientRects().length > 0 && style.display !== 'none' && style.visibility !== 'hidden' && !element.hasAttribute('inert');
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
    >
      <header className="genealogy-split-header">
        <div>
          <p className="genealogy-split-eyebrow">{gospelSource.translation}</p>
          <h2 id="genealogy-split-title">Две родословные Христа</h2>
          <p id="genealogy-split-description">
            Последовательности Матфея и Луки. Имена расположены от предков к Христу.
          </p>
        </div>
        <button ref={closeButtonRef} autoFocus onClick={requestClose}
          className="genealogy-split-close" aria-label="Закрыть сравнение">×</button>
      </header>

      <div className="genealogy-split-options">
        <div className="genealogy-split-switch" role="group" aria-label="Границы сравнения">
          <button type="button" aria-pressed={range === 'david'} onClick={() => setRange('david')}>От Давида</button>
          <button type="button" aria-pressed={range === 'full'} onClick={() => setRange('full')}>Полностью</button>
        </div>
        <div className="genealogy-split-switch genealogy-split-mobile-switch" role="group" aria-label="Показать родословную">
          {([['matthew', 'Матфей'], ['both', 'Обе линии'], ['luke', 'Лука']] as const).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={mobileLine === id}
              onClick={() => setMobileLine(id)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="genealogy-split-columns" data-mobile-line={mobileLine} data-range={range}>
        {lines.map(line => (
          <section key={line.id} className={`genealogy-split-column genealogy-split-${line.id}`}
            data-gospel={line.id} role="region" aria-label={line.title} tabIndex={0}>
            <div className="genealogy-split-column-heading">
              <h3>{line.title}</h3>
              <a href={line.sourceUrl} target="_blank" rel="noopener noreferrer"
                aria-label={`Открыть ${line.sourceRef}, Синодальный перевод, в новой вкладке`}>{line.sourceRef} ↗</a>
            </div>
            <p className="genealogy-split-line-context">
              {line.id === 'matthew' ? 'Через Соломона' : 'Через Нафана'} · {line.entries.length} записей
            </p>
            <ol className="genealogy-split-list" aria-label={`Последовательность: ${line.title}`}>
              {line.entries.map(entry => (
                <li key={entry.id} data-gospel-entry={entry.id} data-person-id={entry.personId}
                  className={sharedIds.has(entry.personId) ? 'genealogy-split-shared' : undefined}>
                  <span className="genealogy-split-person">{entry.name}</span>
                  <span className="genealogy-split-entry-ref" title={`Форма в тексте: ${entry.sourceForm}`}>{entry.ref}</span>
                  {sharedIds.has(entry.personId) && <span className="genealogy-split-shared-mark" aria-label="Общая персона">≡</span>}
                </li>
              ))}
            </ol>
            <details className="genealogy-split-notes">
              <summary>Как читать эту последовательность</summary>
              {line.notes.map(note => <p key={note}>{note}</p>)}
              <p>Имена приведены в именительном падеже. Список передаёт порядок родословной и не утверждает непосредственное биологическое отцовство между каждой парой.</p>
            </details>
          </section>
        ))}
      </div>

      <footer className="genealogy-split-footer">
        <span>≡ — общая персона. Совпадение имени само по себе не означает родство или тождество людей.</span>
        <span className="genealogy-split-count" aria-live="polite">{lines[0].entries.length} Мф · {lines[1].entries.length} Лк</span>
      </footer>
    </dialog>
  );
}

export const SplitView = memo(SplitViewComponent);
