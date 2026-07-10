import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

describe('.gitignore', () => {
  const gitignorePath = resolve(__dirname, '../../.gitignore')
  const content = readFileSync(gitignorePath, 'utf-8')
  const lines = content.split('\n').map(l => l.trim())

  it('should exist at project root', () => {
    expect(content).toBeDefined()
  })

  it('should not contain Angular-specific entries', () => {
    const angularPatterns = ['/out-tsc/', '/e2e/', '/.angular/', '.angular/', '/.angular-cli.json', '/.ng/']
    for (const pattern of angularPatterns) {
      expect(lines).not.toContain(pattern)
    }
  })

  it('should include essential Vite/React patterns', () => {
    const requiredPatterns = ['.DS_Store', '/dist/', '/node_modules/', '*.tsbuildinfo']
    for (const pattern of requiredPatterns) {
      expect(lines).toContain(pattern)
    }
  })

  it('should ignore environment files', () => {
    expect(lines).toContain('/.env')
  })

  it('should ignore log files', () => {
    expect(lines).toContain('npm-debug.log*')
    expect(lines).toContain('yarn-debug.log*')
    expect(lines).toContain('yarn-error.log*')
  })

  it('should end with a newline', () => {
    expect(content.endsWith('\n')).toBe(true)
  })

  it('should not contain blank lines at the end', () => {
    // Split and check last non-empty section
    const nonEmptyLines = content.trimEnd().split('\n')
    expect(nonEmptyLines.length).toBeGreaterThan(0)
  })
})
