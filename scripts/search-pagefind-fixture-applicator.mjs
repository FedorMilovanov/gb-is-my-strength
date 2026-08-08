#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';

const file = 'scripts/search-modal-browser-contract.mjs';
const write = process.argv.includes('--write');
const oldBlock = `    {\n      const { context, page, input } = await openFixture();\n      await page.evaluate(() => {\n        const urls = Array.from({ length: 16 }, (_, index) => index < 2 ? '/fixture/pagefind-duplicate/' : '/fixture/pagefind-' + index + '/');\n        window.__pagefind__ = {\n          search: async () => ({\n            results: urls.map((url, index) => ({\n              data: async () => ({\n                url,\n                meta: { title: 'Fixture Pagefind ' + index, author: '', readTime: '1', category: 'Fixture', scripture: '' },\n                excerpt: 'Fixture Pagefind excerpt ' + index,\n              }),\n            })),\n          }),\n        };\n        window.__pagefindReady__ = true;\n        window.__pagefindFailed__ = false;\n      });\n      await input.fill('fixture-pagefind');\n      summary.pagefind = await assertPaged(page, 15, 'рез.');\n      await context.close();\n    }`;

const newBlock = `    {\n      const pagefindModule = \\\`\n        export async function search() {\n          const urls = Array.from({ length: 16 }, (_, index) => index < 2 ? '/fixture/pagefind-duplicate/' : '/fixture/pagefind-' + index + '/');\n          return {\n            results: urls.map((url, index) => ({\n              data: async () => ({\n                url,\n                meta: { title: 'Fixture Pagefind ' + index, author: '', readTime: '1', category: 'Fixture', scripture: '' },\n                excerpt: 'Fixture Pagefind excerpt ' + index,\n              }),\n            })),\n          };\n        }\n      \\\`;\n      const { context, page, input } = await openFixture(async (fixturePage) => {\n        await fixturePage.route('**/pagefind/pagefind.js', async (route) => {\n          await route.fulfill({\n            status: 200,\n            contentType: 'text/javascript',\n            body: route.request().method() === 'HEAD' ? '' : pagefindModule,\n          });\n        });\n      });\n      await input.fill('fixture-pagefind');\n      summary.pagefind = await assertPaged(page, 15, 'рез.');\n      await context.close();\n    }`;

let source = fs.readFileSync(file, 'utf8');
const count = source.split(oldBlock).length - 1;
if (write) {
  if (count !== 1) throw new Error('[search-pagefind-fixture] expected exactly one old fixture block, got ' + count);
  source = source.replace(oldBlock, newBlock);
  fs.writeFileSync(file, source);
}
const final = fs.readFileSync(file, 'utf8');
for (const marker of [
  "fixturePage.route('**/pagefind/pagefind.js'",
  "route.request().method() === 'HEAD' ? '' : pagefindModule",
  "summary.pagefind = await assertPaged(page, 15, 'рез.')",
]) {
  if (!final.includes(marker)) throw new Error('[search-pagefind-fixture] missing final marker: ' + marker);
}
if (final.includes('window.__pagefindReady__ = true;')) throw new Error('[search-pagefind-fixture] post-open Pagefind stub survived');
console.log('[search-pagefind-fixture] deterministic module route OK');
