import fs from 'node:fs'
import path from 'node:path'

import debug from 'debug'
import { parsePnpmWorkspaceYaml, type PnpmWorkspaceYaml } from 'pnpm-workspace-yaml'
import { glob } from 'tinyglobby'

import { categorizePackage } from './catalogs.js'

const log = debug('catpm:core')

interface PackageJson {
  name?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

interface DependencyWithCatalog {
  version: string
  catalog?: string
  isCatalogDependency: boolean
}

interface ParsedPackage {
  file: string
  name?: string
  originalDependencies: Record<string, Record<string, string>>
  categorizedDependencies: Record<string, Record<string, DependencyWithCatalog>>
}

const DEP_TYPES = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const

function loadWorkspace(rootDir: string): {
  catalogs: Record<string, Record<string, string>>;
  packages: string[] | null;
} {
  const workspaceFile = path.join(rootDir, 'pnpm-workspace.yaml')

  if (!fs.existsSync(workspaceFile)) {
    log('No workspace found')
    return { catalogs: {}, packages: null }
  }

  try {
    const config = parsePnpmWorkspaceYaml(fs.readFileSync(workspaceFile, 'utf-8')).toJSON()
    const catalogs = { ...config.catalogs }
    if (config.catalog) catalogs.default = config.catalog
    return { catalogs, packages: config.packages ?? null }
  } catch (error) {
    log('Failed to parse workspace: %s', error)
    return { catalogs: {}, packages: null }
  }
}

async function findPackageFiles(rootDir: string): Promise<string[]> {
  const { packages } = loadWorkspace(rootDir)
  const rootPkg = path.join(rootDir, 'package.json')

  if (!packages?.length) return fs.existsSync(rootPkg) ? [rootPkg] : []

  const files = await Promise.all(
    packages.map(pattern =>
      glob([path.join(pattern, 'package.json').replace(/\\/g, '/')], {
        cwd: rootDir, absolute: true, ignore: ['**/node_modules/**']
      })
    )
  ).then(results => results.flat())

  if (fs.existsSync(rootPkg) && !files.includes(rootPkg)) files.push(rootPkg)
  return files
}

function categorizeDependencies(
  deps: Record<string, string> = {},
  catalogs: Record<string, Record<string, string>>
): Record<string, DependencyWithCatalog> {
  const entries: [string, DependencyWithCatalog][] = Object.entries(deps).map(([name, version]) => {
    if (!version.startsWith('catalog:')) {
      return [name, { version, isCatalogDependency: false }]
    }

    const catalogName = version.slice(8) || 'default'
    return [name, {
      version: catalogs[catalogName]?.[name] ?? version,
      catalog: catalogName,
      isCatalogDependency: true
    }]
  })

  return Object.fromEntries(entries)
}

export async function parseAllPackages(rootDir: string): Promise<ParsedPackage[]> {
  const { catalogs } = loadWorkspace(rootDir)
  const files = await findPackageFiles(rootDir)

  return files.map(file => {
    try {
      const pkg = JSON.parse(fs.readFileSync(file, 'utf-8')) as PackageJson
      const originalDependencies = Object.fromEntries(DEP_TYPES.map(type => [type, pkg[type] ?? {}]))
      const categorizedDependencies = Object.fromEntries(DEP_TYPES.map(type => [type, categorizeDependencies(pkg[type], catalogs)]))

      return { file: path.relative(rootDir, file), name: pkg.name, originalDependencies, categorizedDependencies }
    } catch (error) {
      log('Failed to parse %s: %s', file, error)
      return null
    }
  }).filter(Boolean) as ParsedPackage[]
}

export function getCatalogSummary(rootDir: string): {
  catalogs: Record<string, Record<string, string>>;
  totalCatalogs: number;
  totalPackages: number;
} {
  const { catalogs } = loadWorkspace(rootDir)
  return {
    catalogs,
    totalCatalogs: Object.keys(catalogs).length,
    totalPackages: Object.values(catalogs).reduce((acc, catalog) => acc + Object.keys(catalog).length, 0)
  }
}

export async function migrateToСatalogs(rootDir: string): Promise<{
  packagesUpdated: number;
  dependenciesMigrated: number;
  catalogsCreated: string[];
  error?: string;
}> {
  const workspaceFile = path.join(rootDir, 'pnpm-workspace.yaml')

  if (!fs.existsSync(workspaceFile)) {
    return { packagesUpdated: 0, dependenciesMigrated: 0, catalogsCreated: [], error: 'No pnpm-workspace.yaml found' }
  }

  let workspace: PnpmWorkspaceYaml
  try {
    workspace = parsePnpmWorkspaceYaml(fs.readFileSync(workspaceFile, 'utf-8'))
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { packagesUpdated: 0, dependenciesMigrated: 0, catalogsCreated: [], error: `Failed to parse workspace: ${errorMessage}` }
  }

  const files = await findPackageFiles(rootDir)
  const catalogDeps: Record<string, Record<string, string>> = {}
  let totalMigrated = 0, packagesUpdated = 0

  for (const file of files) {
    const pkg = JSON.parse(fs.readFileSync(file, 'utf-8')) as PackageJson
    let fileUpdated = false

    for (const depType of DEP_TYPES) {
      const deps = pkg[depType]
      if (!deps) continue

      for (const [name, version] of Object.entries(deps)) {
        if (version.startsWith('catalog:')) continue

        const catalog = categorizePackage(name)
        if (!catalog) continue

        catalogDeps[catalog] ??= {}
        catalogDeps[catalog][name] = version
        deps[name] = `catalog:${catalog}`
        fileUpdated = true
        totalMigrated++
      }
    }

    if (fileUpdated) {
      fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n')
      packagesUpdated++
    }
  }

  Object.entries(catalogDeps).forEach(([catalogName, deps]) =>
    { Object.entries(deps).forEach(([name, version]) =>
      { workspace.setPackage(catalogName, name, version); }
    ); }
  )

  if (workspace.hasChanged()) fs.writeFileSync(workspaceFile, workspace.toString())

  return { packagesUpdated, dependenciesMigrated: totalMigrated, catalogsCreated: Object.keys(catalogDeps) }
}
