/* Record lifecycle domain: no DOM, no independent storage or lock.
 * All writes are delegated to the canonical six-key storage authority. */
export function createRecordTransactions({mutateLibrary, libraryFailure, gbHighlightKey, NOTES_KEY, QUOTES_KEY, LIMIT_NOTES, LIMIT_QUOTES}) {
  function restoreDeleted(receipt, copyId = null) {
    if (!receipt || !receipt.entry || ![NOTES_KEY, QUOTES_KEY].includes(receipt.key))
      return Promise.resolve(libraryFailure('invalid-receipt'));
    const {key, entry, index, clearedLinks = []} = receipt;
    return mutateLibrary([QUOTES_KEY, NOTES_KEY], stores => {
      const items = stores[key], quotes = stores[QUOTES_KEY], notes = stores[NOTES_KEY];
      const sameId = (a,b) => a != null && b != null && String(a) === String(b);
      const id = copyId ?? entry.id;
      if (items.some(x => x && sameId(x.id,id))) return { reason: 'id-collision' };
      if (copyId !== null && (key === NOTES_KEY
        ? quotes.some(q => sameId(q?.annotation?.noteId,id))
        : notes.some(n => sameId(n?.quoteId,id)))) return { reason: 'id-collision' };
      if (items.length >= (key === NOTES_KEY ? LIMIT_NOTES : LIMIT_QUOTES)) return { reason: 'capacity' };
      let restored = copyId === null ? entry : { ...entry, id: copyId, savedAt: Date.now() };
      const changes = {};
      if (key === NOTES_KEY) {
        if (copyId !== null) {
          delete restored.quoteId;
        } else {
          if (entry.quoteId != null && notes.some(n => n && sameId(n.quoteId,entry.quoteId)))
            return { reason: 'link-conflict' };
          if (entry.quoteId != null && Object.hasOwn(receipt,'relatedQuote')) {
            const related = quotes.filter(q => q && sameId(q.id,entry.quoteId));
            if (related.length > 1 || (related.length ? JSON.stringify(related[0]) : null) !== receipt.relatedQuote)
              return { reason: 'link-conflict' };
          }
          // Any forward claim now present was not part of the cleared
          // post-delete state. Do not let Undo attach to a newly claimed note.
          if (quotes.some(q => sameId(q?.annotation?.noteId,entry.id)) ||
              clearedLinks.length > 1 ||
              (entry.quoteId != null && clearedLinks.some(link => !sameId(link.id,entry.quoteId))))
            return { reason: 'link-conflict' };
          if (entry.quoteId != null && quotes.some(q => sameId(q?.id,entry.quoteId) &&
              q?.annotation?.noteId != null && !sameId(q.annotation.noteId,entry.id)))
            return { reason: 'link-conflict' };
          for (const link of clearedLinks) {
            const found = quotes.filter(q => q && sameId(q.id,link.id));
            if (found.length !== 1 || JSON.stringify(found[0]) !== link.postDelete ||
                notes.some(n => n && sameId(n.quoteId,link.id))) return { reason: 'link-conflict' };
          }
          if (clearedLinks.length) changes[QUOTES_KEY] = quotes.map(q => {
            const link = clearedLinks.find(l => q && sameId(q.id,l.id));
            return link ? { ...q, annotation: { ...q.annotation, noteId: link.noteId } } : q;
          });
        }
      } else {
        const rangeKey = gbHighlightKey(entry);
        if (rangeKey && quotes.some(q => gbHighlightKey(q) === rangeKey))
          return { reason: 'range-conflict' };
        if (copyId !== null && restored.annotation)
          restored = { ...restored, annotation: { ...restored.annotation, noteId: null } };
        const explicit = restored.annotation?.noteId;
        const reverse = notes.filter(n => n && sameId(n.quoteId,restored.id));
        if (reverse.length > 1) return { reason: 'link-conflict' };
        const targetId = explicit ?? reverse[0]?.id;
        if (targetId != null && (notes.filter(n => sameId(n?.id,targetId)).length !== 1 ||
            quotes.some(q => sameId(q?.annotation?.noteId,targetId))))
          return { reason: 'link-conflict' };
        if (explicit != null) {
          const linked = notes.filter(n => n && sameId(n.id,explicit));
          if (linked.length !== 1 || (linked[0].quoteId != null && !sameId(linked[0].quoteId,restored.id)) ||
              reverse.some(n => n !== linked[0])) return { reason: 'link-conflict' };
        }
      }
      const next = items.slice();
      next.splice(Math.min(index,next.length),0,restored);
      changes[key] = next;
      return { changes, result: { restored } };
    });
  }
  function saveNoteRecord({context,editing,created,text}) {
    const keys = !editing ? [NOTES_KEY, QUOTES_KEY] : [NOTES_KEY];
    return mutateLibrary(keys, stores => {
      const current = stores[NOTES_KEY];
      if (!editing) {
        if (current.length >= LIMIT_NOTES) return { reason: 'capacity' };
        if (current.some(x => x && String(x.id) === String(created.id)) ||
            stores[QUOTES_KEY].some(q => q?.annotation?.noteId != null &&
              String(q.annotation.noteId) === String(created.id))) return { reason: 'id-collision' };
        if (context?.quoteId != null) {
          const linked = stores[QUOTES_KEY].filter(x => x && String(x.id) === String(context.quoteId));
          if (linked.length !== 1 || JSON.stringify(linked[0]) !== context.quoteSnapshot || linked[0].annotation?.noteId != null ||
              current.some(x => x?.quoteId != null && String(x.quoteId) === String(context.quoteId)))
            return { reason: 'link-conflict' };
        }
        return { changes: { [NOTES_KEY]: [created, ...current] } };
      }
      const matches = current.filter(x => x && String(x.id) === String(editing.id));
      const live = matches[0];
      if (matches.length !== 1 || JSON.stringify(live) !== editing.recordSnapshot)
        return { reason: 'conflict', current };
      return { changes: { [NOTES_KEY]: current.map(x => x === live ? { ...x, text } : x) } };
    });
  }
  function deleteRecord(item) {
    const key = item.type === 'note' ? NOTES_KEY : QUOTES_KEY;
    const keys = key === NOTES_KEY ? [QUOTES_KEY, NOTES_KEY] : [QUOTES_KEY];
    return mutateLibrary(keys, stores => {
      const current = stores[key];
      const matches = current.filter(x => x && String(x.id) === String(item.id));
      if (matches.length > 1) return { reason: 'duplicate' };
      if (matches.length !== 1 || JSON.stringify(matches[0]) !== item.recordSnapshot)
        return { reason: 'conflict' };
      const entry = matches[0], index = current.indexOf(entry);
      const changes = { [key]: current.filter(x => x !== entry) };
      const clearedLinks = [];
      if (key === NOTES_KEY) {
        const linked = stores[QUOTES_KEY].filter(q => q?.annotation?.noteId != null &&
          String(q.annotation.noteId) === String(entry.id));
        if (linked.some(q => stores[QUOTES_KEY].filter(x => x && String(x.id) === String(q.id)).length !== 1))
          return { reason: 'duplicate' };
        if (linked.length) changes[QUOTES_KEY] = stores[QUOTES_KEY].map(q => {
          if (!linked.includes(q)) return q;
          const next = { ...q, annotation: { ...q.annotation, noteId: null } };
          clearedLinks.push({ id: q.id, noteId: q.annotation.noteId, postDelete: JSON.stringify(next) });
          return next;
        });
      }
      const receipt = { key, entry, index, clearedLinks };
      if (key === NOTES_KEY && entry.quoteId != null) {
        const related = (changes[QUOTES_KEY] || stores[QUOTES_KEY]).filter(q => q && String(q.id) === String(entry.quoteId));
        if (related.length > 1) return { reason: 'duplicate' };
        receipt.relatedQuote = related.length ? JSON.stringify(related[0]) : null;
      }
      return { changes, result: { receipt } };
    });
  }
  return Object.freeze({restoreDeleted,saveNoteRecord,deleteRecord});
}
