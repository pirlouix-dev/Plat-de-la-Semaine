import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

describe('.gitignore', () => {
  const gitignorePath = resolve(__dirname, '../../.gitignore');
  const content = readFileSync(gitignorePath, 'utf-8');
  const lines = content.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

  it('should exist', () => {
    expect(content).toBeTruthy();
  });

  it('should cover .env files broadly', () => {
    expect(lines).toContain('.env');
    expect(lines).toContain('.env.*');
    expect(lines).toContain('.env.*.*');
  });

  it('should exclude node_modules', () => {
    expect(lines).toContain('/node_modules/');
  });

  it('should exclude build output', () => {
    expect(lines).toContain('/dist/');
  });

  it('should exclude macOS .DS_Store', () => {
    expect(lines).toContain('.DS_Store');
  });
});
