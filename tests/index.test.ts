import mockFs from 'mock-fs';
import { describe, it, expect, afterEach, vi } from 'vitest';

import { parseAllPackages, getCatalogSummary, migrateToСatalogs } from "../src";

vi.mock('../src/catalogs.js', () => ({
  categorizePackage: vi.fn((name: string) =>
    name.startsWith('react') ? 'ui' :
    name.startsWith('vite') ? 'build' : null
  )
}))

describe('parseAllPackages', () => {
  afterEach(() => { mockFs.restore(); })

  it('parses catalog dependencies', async () => {
    mockFs({
      '/test/pnpm-workspace.yaml': 'catalog:\n  react: ^18.0.0\ncatalogs:\n  build:\n    vite: ^5.0.0',
      '/test/package.json': '{"dependencies":{"react":"catalog:","lodash":"^4.0.0"}}'
    })

    const [pkg] = await parseAllPackages('/test')

    expect(pkg?.categorizedDependencies.dependencies?.react).toEqual({
      version: '^18.0.0', catalog: 'default', isCatalogDependency: true
    })
    expect(pkg?.categorizedDependencies.dependencies?.lodash).toEqual({
      version: '^4.0.0', isCatalogDependency: false
    })
  })

  it('handles no workspace', async () => {
    mockFs({ '/test/package.json': '{"dependencies":{"express":"^4.0.0"}}' })

    const [pkg] = await parseAllPackages('/test')
    expect(pkg?.categorizedDependencies.dependencies?.express?.isCatalogDependency).toBe(false)
  })
})

describe('getCatalogSummary', () => {
  afterEach(() => { mockFs.restore(); })

  it('returns summary', () => {
    mockFs({
      '/test/pnpm-workspace.yaml': 'catalog:\n  react: ^18.0.0\ncatalogs:\n  ui:\n    vue: ^3.0.0'
    })

    const result = getCatalogSummary('/test')
    expect(result.totalCatalogs).toBe(2)
    expect(result.totalPackages).toBe(2)
  })

  it('handles no workspace', () => {
    mockFs({ '/test': {} })
    expect(getCatalogSummary('/test').totalCatalogs).toBe(0)
  })
})

describe('migrateToСatalogs', () => {
  afterEach(() => { mockFs.restore(); })

  it('migrates deps', async () => {
    mockFs({
      '/test/package.json': '{"dependencies":{"react":"^18.0.0","vite":"^5.0.0","lodash":"^4.0.0"}}'
    })

    const result = await migrateToСatalogs('/test')
    expect(result.dependenciesMigrated).toBe(2)
    expect(result.catalogsCreated).toEqual(['ui', 'build'])
  })

  it('skips non-matching deps', async () => {
    mockFs({ '/test/package.json': '{"dependencies":{"lodash":"^4.0.0"}}' })

    const result = await migrateToСatalogs('/test')
    expect(result.dependenciesMigrated).toBe(0)
  })
})
