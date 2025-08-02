import { cac } from 'cac'
import pc from 'picocolors'

import { parseAllPackages, migrateToСatalogs, getCatalogSummary } from '.'

interface ParseOptions {
  output: 'json' | 'summary'
  onlyCatalog: boolean
  verbose: boolean
}

interface CatalogOptions {
  verbose: boolean
}

interface MigrateOptions {
  verbose: boolean
}

const logln = (msg = ''): boolean => process.stdout.write(msg + '\n')
const cli = cac('catpm')

cli
  .command('[root]', 'Parse all package.json files in the project')
  .option('--output <format>', 'Output format: json, summary', { default: 'summary' })
  .option('--only-catalog', 'Show only packages with catalog dependencies')
  .option('--verbose', 'Enable verbose logging')
  .action(async (root: string = process.cwd(), options: ParseOptions) => {
    if (options.verbose) process.env.DEBUG = 'catpm:*'

    const packages = await parseAllPackages(root)

    if (options.output === 'json') {
      logln(JSON.stringify(packages, null, 2))
      return
    }

    const filtered = options.onlyCatalog
      ? packages.filter(pkg => Object.values(pkg.originalDependencies)
          .some(deps => Object.values(deps)
            .some(version => version.startsWith('catalog:'))))
      : packages

    if (!filtered.length) {
      logln(pc.dim('no packages found'))
      return
    }

    logln(`found ${pc.white(filtered.length)} package.json files\n`)

    filtered.forEach(pkg => {
      logln(pc.white(pkg.name ?? pkg.file))
      logln(`   path: ${pc.dim(pkg.file)}`)

      Object.entries(pkg.categorizedDependencies).forEach(([type, deps]) => {
        const depEntries = Object.entries(deps)
        if (depEntries.length) {
          logln(`   ${pc.dim(type)}:`)
          depEntries.forEach(([name, dep]) => {
            const catalogInfo = dep.isCatalogDependency ? ` ${pc.dim(`[${dep.catalog ?? 'default'}]`)}` : ''
            logln(`     ${pc.gray(name)}: ${pc.dim(dep.version)}${catalogInfo}`)
          })
        }
      })
      logln()
    })
  })

cli
  .command('catalog [root]', 'Show catalog information')
  .option('--verbose', 'Enable verbose logging')
  .action((root: string = process.cwd(), options: CatalogOptions) => {
    if (options.verbose) process.env.DEBUG = 'catpm:*'

    const { catalogs, totalCatalogs, totalPackages } = getCatalogSummary(root)

    logln(pc.dim('catalog information:'))
    logln(`total catalogs: ${pc.white(totalCatalogs)}`)
    logln(`total packages: ${pc.white(totalPackages)}`)

    if (!totalCatalogs) {
      logln(pc.dim('\nno catalogs found'))
      return
    }

    Object.entries(catalogs).forEach(([catalogName, packages]) => {
      logln(`\n${pc.white(catalogName)}:`)
      Object.entries(packages).forEach(([pkg, version]) => {
        logln(`  ${pc.gray(pkg)}: ${pc.dim(version)}`)
      })
    })
  })

cli
  .command('migrate [root]', 'Migrate dependencies to catalogs')
  .option('--verbose', 'Enable verbose logging')
  .action(async (root: string = process.cwd(), options: MigrateOptions) => {
    if (options.verbose) process.env.DEBUG = 'catpm:*'

    const result = await migrateToСatalogs(root)

    if ('error' in result) {
      logln(pc.red(result.error))
      return
    }

    logln(pc.dim('migration completed:'))
    logln(`packages updated: ${pc.white(result.packagesUpdated)}`)
    logln(`dependencies migrated: ${pc.white(result.dependenciesMigrated)}`)

    if (result.catalogsCreated.length) {
      logln(`\ncatalogs created: ${result.catalogsCreated.map(c => pc.gray(c)).join(', ')}`)
    }
  })

cli.help(() => {
  logln()
  logln('  ,-.       _,---._ __  / \\       ' + pc.bold('catpm') + ' - pnpm catalog package manager')
  logln(' /  )    .-\'       `./ /   \\     ')
  logln('(  (   ,\'            `/    /|     ' + pc.bold('usage:') + ' catpm ' + pc.gray('[root] [options]'))
  logln(' \\  `-"             \'\\   / |    ')
  logln('  `.              ,  \\ \\ /  |     ' + pc.bold('commands:'))
  logln('   /`.          ,\'-`----Y   |       catpm ' + pc.gray('[root]') + '       parse packages')
  logln('  (            ;        |   \'       catpm ' + pc.gray('catalog') + '      show catalog info')
  logln('  |  ,-.    ,-\'         |  /        catpm ' + pc.gray('migrate') + '      migrate to catalogs')
  logln('  |  | (   |      catpm | /       ' + pc.bold('options:'))
  logln('  )  |  \\  `._________|/            ' + pc.gray('-h, --help') + '         show help')
  logln('   `--\'   `--\'                      ' + pc.gray('-v, --version') + '      show version')
  logln('                                    ' + pc.gray('--verbose') + '          enable debug logs')
  logln('                                    ' + pc.gray('--output <fmt>') + '     json|summary|catalog')
  logln('                                    ' + pc.gray('--group-by <type>') + '  type|package|catalog')
  logln('                                    ' + pc.gray('--only-catalog') + '     filter catalog deps only')

  process.exit(0)
})

cli.version('1.0.0')

if (process.argv.length === 2) {
  cli.outputHelp()
} else {
  cli.parse()
}
export { cli };
