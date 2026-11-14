import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// The first paint background must be inlined in index.html (see #95): if it
// only lives in index.css, Firefox paints a white canvas while the bundle
// loads. These tests keep the colour in sync across the three places that
// define it and make sure the inline style is actually critical-path safe.
const APP_BACKGROUND = '#2c2c2c';

const root = resolve(__dirname, '../..');

function read(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf-8');
}

function rgbToHex(value: string): string {
  const match = value.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (!match) throw new Error(`Not an rgb() colour: ${value}`);
  const hex = match
    .slice(1, 4)
    .map((channel) => Number(channel).toString(16).padStart(2, '0'))
    .join('');
  return `#${hex}`;
}

describe('index.html', () => {
  const html = read('index.html');

  it('inlines the app background in the head', () => {
    const head = html.slice(0, html.indexOf('</head>'));
    expect(head).toContain(`background-color: ${APP_BACKGROUND}`);
  });

  it('paints the background before any external stylesheet or module script', () => {
    const inlineStyle = html.indexOf('background-color: ' + APP_BACKGROUND);
    const firstStylesheet = html.search(/<link[^>]+rel="stylesheet"/);
    const firstModuleScript = html.search(/<script[^>]+type="module"/);

    expect(inlineStyle).toBeGreaterThan(-1);
    if (firstStylesheet !== -1) {
      expect(inlineStyle).toBeLessThan(firstStylesheet);
    }
    if (firstModuleScript !== -1) {
      expect(inlineStyle).toBeLessThan(firstModuleScript);
    }
  });
});

describe('app background colour', () => {
  it('is declared as --bg-dark and used for the document canvas', () => {
    const css = read('src/index.css');
    const bgDark = css.match(/--bg-dark:\s*([^;]+);/)?.[1]?.trim();
    const rootBlock = css.slice(0, css.indexOf('@media'));

    expect(bgDark).toBeDefined();
    expect(bgDark).toMatch(/^rgb\(/);
    expect(rgbToHex(bgDark!)).toBe(APP_BACKGROUND);
    expect(rootBlock).toContain('background-color: var(--bg-dark);');
  });

  it('is used by the PWA splash screen background', () => {
    const manifest = JSON.parse(read('public/manifest.webmanifest'));
    expect(manifest.background_color).toBe(APP_BACKGROUND);
  });
});
