'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createDesktopDelivery, PREFIX } = require('./reader-desktop-delivery');

function projectDesktopDist({ distDir, sourceDir, contract }) {
  const delivery = createDesktopDelivery(contract);
  const pending = [];
  // Validate every target before writing any HTML. Only registered Astro
  // production reading pages may receive this static head-tail projection.
  for (const route of contract.routes) {
    if (!route.startsWith('/') || !route.endsWith('/') ||
        route.split('/').some(part => part === '..' || part === '.') ||
        /[\\?#]/.test(route)) throw new Error('Invalid desktop route: ' + route);
    const file = path.join(distDir, route.slice(1), 'index.html');
    const html = fs.readFileSync(file, 'utf8');
    if ((html.match(/<\/head>/gi) || []).length !== 1 ||
        html.includes('data-gb-reader-desktop-css') ||
        html.includes('data-gb-reader-desktop-bootstrap') ||
        html.includes('/__reader_w57__/') || html.includes(PREFIX)) {
      throw new Error('Invalid or duplicate desktop head: ' + route);
    }
    const { links, bootstrap } = delivery.headFor(route);
    const markup = links.map(({href,media}) =>
      '<link rel="stylesheet" data-gb-reader-desktop-css media="'+media+'" href="'+href+'">').join('') +
      '<script data-gb-reader-desktop-bootstrap src="'+bootstrap.href+'"></script>';
    pending.push({file, html:html.replace(/<\/head>/i, markup+'$&')});
  }
  delivery.materializeAssets(distDir, sourceDir);
  for (const {file,html} of pending) fs.writeFileSync(file,html,'utf8');
  return {routes:pending.length,assets:contract.styles.length+contract.scripts.length+1};
}

module.exports = { projectDesktopDist };
