'use strict';

function itemIdentity(block) {
  const link = String(block).match(/<link>([^<]+)<\/link>/i)?.[1]?.trim();
  if (!link) throw new Error('RSS item missing link while ordering final projection');
  return link;
}

function itemTimestamp(block) {
  const identity = itemIdentity(block);
  const value = String(block).match(/<pubDate>([^<]+)<\/pubDate>/i)?.[1]?.trim();
  if (!value) throw new Error(`${identity}: RSS item missing pubDate while ordering final projection`);
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) throw new Error(`${identity}: invalid RSS pubDate ${JSON.stringify(value)}`);
  return timestamp;
}

function orderProjectedRss(xml) {
  const source = String(xml || '');
  const matches = [...source.matchAll(/<item>[\s\S]*?<\/item>/gi)];
  if (!matches.length) throw new Error('RSS contains no items while ordering final projection');

  const entries = matches.map((match) => ({
    block: match[0],
    identity: itemIdentity(match[0]),
    timestamp: itemTimestamp(match[0]),
  }));
  entries.sort((left, right) => {
    const byDate = right.timestamp - left.timestamp;
    return byDate || left.identity.localeCompare(right.identity, 'ru');
  });

  const first = matches[0].index;
  const last = matches[matches.length - 1];
  const end = last.index + last[0].length;
  const replacement = entries.map((entry) => entry.block).join('\n\n    ');
  return source.slice(0, first) + replacement + source.slice(end);
}

module.exports = {
  itemIdentity,
  itemTimestamp,
  orderProjectedRss,
};
