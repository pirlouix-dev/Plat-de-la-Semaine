import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

describe('index.css — consolidated global styles', () => {
  const indexPath = resolve(__dirname, '../index.css')
  const content = readFileSync(indexPath, 'utf-8')
  const lines = content.split('\n').map((l: string) => l.trim())

  it('should contain the universal reset (*, *::before, *::after)', () => {
    // The reset previously in App.css should now be in index.css
    expect(lines).toContain('*,')
    expect(lines).toContain('*::before,')
    expect(lines).toContain('*::after {')
  })

  it('should contain box-sizing: border-box in the universal reset', () => {
    expect(content).toMatch(/\*[^}]*box-sizing:\s*border-box[^}]*}/)
  })

  it('should contain the --bg-dark variable', () => {
    // Previously defined only in App.css, now consolidated in index.css
    expect(content).toMatch(/--bg-dark:\s*rgb\(44,\s*44,\s*44\)/)
  })

  it('should define body min-height as 100dvh', () => {
    expect(content).toMatch(/body\s*\{[^}]*min-height:\s*100dvh/)
  })

  it('should define body min-width as 320px', () => {
    expect(content).toMatch(/body\s*\{[^}]*min-width:\s*320px/)
  })

  it('should set body background-color to var(--bg-dark)', () => {
    expect(content).toMatch(/body\s*\{[^}]*background-color:\s*var\(--bg-dark\)/)
  })

  it('should set #root width to 100%', () => {
    expect(content).toMatch(/#root\s*\{[^}]*width:\s*100%/)
  })

  it('should not contain conflicting duplicate body style blocks', () => {
    // Only one body block should exist
    const bodyBlocks = content.match(/body\s*\{/g)
    expect(bodyBlocks?.length).toBe(1)
  })
})

describe('App.css — scoped to App only', () => {
  const appPath = resolve(__dirname, '../App.css')
  const content = readFileSync(appPath, 'utf-8')

  it('should not contain any CSS body rules', () => {
    // Body styles should ONLY be in index.css
    expect(content).not.toMatch(/body\s*\{/)
  })

  it('should not contain the universal reset (*, *::before, *::after)', () => {
    // The * reset must not be duplicated in App.css
    expect(content).not.toMatch(/\*\s*\{/)
    expect(content).not.toMatch(/\*::(before|after)/)
  })

  it('should not contain --bg-dark definition', () => {
    // Variable should be consolidated in index.css
    expect(content).not.toMatch(/--bg-dark/)
  })

  it('should not contain conflicting display or placement rules', () => {
    expect(content).not.toMatch(/display:\s*flex/)
    expect(content).not.toMatch(/place-items/)
    expect(content).not.toMatch(/justify-content/)
    expect(content).not.toMatch(/height:\s*auto/)
  })
})
