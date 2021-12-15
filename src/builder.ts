import * as core from '@actions/core'
import {ExecOptions} from '@actions/exec'
import path from 'path'
import {IModuleHandler} from './module'
import {valid} from 'semver'

const ROOT_MODULES_PATH = 'packages'
const LEGACY_MODULES_PATH = 'app/scripts/modules'
const ARTIFACTORY_SERVER_ALIAS = 'armory-artifactory-deck'
const EXCLUDED_MODULES = [
  'app',
  'eslint-plugin',
  'mocks',
  'pluginsdk-peerdeps',
  'pluginsdk',
  'scripts'
]

export interface IExecutor {
  exec(cmd: string, args?: string[], options?: ExecOptions): Promise<number>
}

export interface IDeckModule {
  moduleName: string
  modulePath: string
}

export class DeckBuilder {
  constructor(
    private moduleHandler: IModuleHandler,
    private executor: IExecutor,
    private deckPath: string,
    private version: string,
    private artifactoryUrl: string,
    private artifactoryToken: string,
    private artifactoryResolveRepo: string,
    private artifactoryDeployRepo: string,
    private buildName: string,
    private buildNumber: string,
    private buildUrl: string
  ) {
    if (!valid(version)) {
      throw new Error(`${version} is not valid semver.`)
    }
  }

  build = async () => {
    await this.writeGlobalArtifactoryAuth(
      this.artifactoryUrl,
      this.artifactoryToken
    )

    core.info('Resolving modules...')
    const modules = this.resolveModules()
    if (modules.length === 0) {
      core.setFailed('Could not resolve Deck modules')
      return
    }
    core.info(`Resolved ${modules.length} modules: ${modules.entries()}`)

    core.info("Running 'yarn'")
    await this.yarnInstall(this.deckPath)
    core.info("Done running 'yarn'")

    core.info('Building modules...')
    await this.buildModules(this.deckPath, modules)
    core.info('Done building modules')

    for (const m of modules) {
      core.info(`Publishing ${m.moduleName} from ${m.modulePath}...`)
      const moduleDir = path.join(this.deckPath, m.modulePath, m.moduleName)
      await this.writeNPMAuth(
        moduleDir,
        this.artifactoryResolveRepo,
        this.artifactoryDeployRepo
      )
      this.moduleHandler.writeModuleVersion(moduleDir, this.version)
      await this.publishModule(moduleDir, this.buildName, this.buildNumber)
    }

    await this.collectBuildInfo(this.deckPath, this.buildName, this.buildNumber)

    core.info(`Publishing build info...`)
    await this.publishBuildInfo(
      this.deckPath,
      this.buildName,
      this.buildNumber,
      this.buildUrl
    )
    core.info(`Done`)
  }

  private resolveModules = (): IDeckModule[] => {
    const rootPath = path.join(this.deckPath, ROOT_MODULES_PATH)
    core.info('Resolving Root modules in path: ' +rootPath)
    const rootModules = this.moduleHandler.resolve(
        rootPath,
        EXCLUDED_MODULES
    ).map( moduleName => {
      return {
        moduleName,
        modulePath: ROOT_MODULES_PATH
      }
    })

    if (!this.version.includes("release-2.26.x") && !this.version.includes("release-2.25.x")) {
      return rootModules
    }

    const legacyPath = path.join(this.deckPath, LEGACY_MODULES_PATH)
    core.info('Resolving Legacy modules in path: ' + legacyPath)
    const legacyModules = this.moduleHandler.resolve(
        legacyPath,
        EXCLUDED_MODULES
    ).filter( module => {
      return rootModules.findIndex( m => {
        return m.moduleName === module
      }
      ) < 0
    }).map( moduleName => {
      return {
        moduleName,
        modulePath: LEGACY_MODULES_PATH
      }
    })

    return rootModules.concat(legacyModules)
  }

  private yarnInstall = async (dir: string) => {
    try {
      await this.executor.exec('yarn', ['--frozen-lockfile'], {
        cwd: dir
      })
    } catch (e) {
      if (!e.toString().includes('code: 127')) {
        throw e
      }
      core.warning(`Non-fatal error running 'yarn': ${e.message}`)
    }
  }

  private buildModules = async (dir: string, modules: IDeckModule[]) => {
    const moduleNames = modules.map(m => {return m.moduleName})
    await this.moduleHandler.build(this.executor, dir, moduleNames)
  }

  private writeGlobalArtifactoryAuth = async (
    artifactoryUrl: string,
    token: string
  ) => {
    let err = ''
    try {
      await this.executor.exec(
        'jfrog',
        [
          'config',
          'add',
          ARTIFACTORY_SERVER_ALIAS,
          `--artifactory-url=${artifactoryUrl}`,
          `--access-token=${token}`,
          '--interactive=false'
        ],
        {
          listeners: {
            stderr: line => {
              err = line.toString()
            }
          }
        }
      )
    } catch (e) {
      if (
        err.includes(`Server ID '${ARTIFACTORY_SERVER_ALIAS}' already exists.`)
      ) {
        core.info(`Artifactory was already configured.`)
      } else {
        throw e
      }
    }
  }

  private writeNPMAuth = async (
    moduleDir: string,
    resolveRepo: string,
    deployRepo: string
  ) => {
    await this.executor.exec(
      'jfrog',
      [
        'rt',
        'npmc',
        `--server-id-deploy=${ARTIFACTORY_SERVER_ALIAS}`,
        `--server-id-resolve=${ARTIFACTORY_SERVER_ALIAS}`,
        `--repo-resolve=${resolveRepo}`,
        `--repo-deploy=${deployRepo}`
      ],
      {
        cwd: moduleDir
      }
    )
  }

  private publishModule = async (
    moduleDir: string,
    buildName: string,
    buildNumber: string
  ) => {
    await this.executor.exec(
      'jfrog',
      [
        'rt',
        'npmp',
        `--build-name=${buildName}`,
        `--build-number=${buildNumber}`
      ],
      {
        cwd: moduleDir
      }
    )
  }

  private collectBuildInfo = async (
    moduleDir: string,
    buildName: string,
    buildNumber: string
  ) => {
    await this.executor.exec('jfrog', ['rt', 'bag', buildName, buildNumber], {
      cwd: moduleDir
    })
  }

  private publishBuildInfo = async (
    moduleDir: string,
    buildName: string,
    buildNumber: string,
    buildUrl: string
  ) => {
    await this.executor.exec(
      'jfrog',
      ['rt', 'bp', buildName, buildNumber, `--build-url=${buildUrl}`],
      {
        cwd: moduleDir
      }
    )
  }
}
