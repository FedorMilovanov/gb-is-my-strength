#!/usr/bin/env node
/**
 * css-layer-validator.js — validates CSS @layer architecture and counts.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CSS_DIR = path.join(ROOT, 'css');
const SRC_STYLES = path.join(ROOT, 'src/styles');

const files = [];
if (fs.existsSync(CSS_DIR)) {
  fs.readdirSync(CSS_DIR).forEach(f => {
    if (f.endsWith('.css')) files.push(path.join(CSS_DIR, f));
  });
}
if (fs.existsSync(SRC_STYLES)) {
  fs.readdirSync(SRC_STYLES).forEach(f => {
    if (f.endsWith('.css')) files.push(path.join(SRC_STYLES, f));
  });
}

let totalImportant = 0;
let totalBraceOpen = 0;
let totalBraceClose = 0;
let layerDeclCount = 0;
let layerBlockCount = 0;
let errors = 0;
let warnings = 0;

console.log('CSS Layer Validator');
console.log('='.repeat(50));

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const important = (content.match(/!important/g) || []).length;
  const bracesOpen = (content.match(/\{/g) || []).length;
  const bracesClose = (content.match(/\}/g) || []).length;
  const layerDecl = (content.match(/@layer\s+\w+/g) || []).length;
  const layerBlock = (content.match(/@layer\s*\w*\s*\{/g) || []).length;
  
  totalImportant += important;
  totalBraceOpen += bracesOpen;
  totalBraceClose += bracesClose;
  layerDeclCount += layerDecl;
  layerBlockCount += layerBlock;
  
  const balanced = bracesOpen === bracesClose;
  const sizeKB = (fs.statSync(file).size / 1024).toFixed(1);
  
  console.log(`${balanced ? '✅' : '❌'} ${path.basename(file)}: ${sizeKB}KB, !important=${important}, braces=${bracesOpen}/${bracesClose}, @layer=${layerBlock}`);
  
  if (!balanced) {
    errors++;
    console.log(`   ❌ UNBALANCED BRACES: ${bracesOpen} open vs ${bracesClose} close`);
    try {
      const lines = content.split('\n');
      let depth = 0;
      lines.forEach((line, idx) => {
        const open = (line.match(/\{/g) || []).length;
        const close = (line.match(/\}/g) || []).length;
        depth += open - close;
        if (depth < 0) {
          console.log(`   ❌ Negative depth at line ${idx+1}: ${line.trim().slice(0,60)}`);
        }
      });
      if (depth !== 0) console.log(`   ❌ Final depth: ${depth} (should be 0)`);
    } catch(e) {}
  }
}

console.log('');
console.log(`TOTAL: ${files.length} files, ${totalImportant} !important, ${totalBraceOpen}/${totalBraceClose} braces, ${layerBlockCount} @layer blocks`);

// Target: if site-layered.css exists, check layer order
const layered = path.join(CSS_DIR, 'site-layered.css');
if (fs.existsSync(layered)) {
  const lc = fs.readFileSync(layered, 'utf8');
  const orderMatch = lc.match(/@layer\s+([\w,\s]+);/);
  if (orderMatch) {
    console.log(`✅ site-layered.css layer order: ${orderMatch[1].trim()}`);
  } else {
    warnings++;
    console.log('⚠️ site-layered.css missing @layer order declaration at top');
  }
} else {
  console.log('ℹ️ site-layered.css not found — @layer migration not started');
}

if (errors > 0) {
  console.log(`❌ FAILED: ${errors} errors, ${warnings} warnings`);
  process.exit(1);
} else {
  console.log(`✅ PASSED: ${errors} errors, ${warnings} warnings`);
}
