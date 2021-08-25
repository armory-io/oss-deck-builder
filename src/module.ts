import {IExecutor} from './builder'
import * as core from '@actions/core'
import path from 'path'
import * as fs from 'fs'

export interface IModuleHandler {
  resolve(dir: string, excludedModules: string[]): string[]
  writeModuleVersion(dir: string, version: string): void
  build(executor: IExecutor, dir: string, modules: string[]): Promise<void>
}

export const resolve = (dir: string, excludedModules: string[]): string[] => {
  return fs
    .readdirSync(dir, {
      withFileTypes: true
    })
    .filter(dirEntry => dirEntry.isDirectory())
    .map(dirEntry => dirEntry.name)
    .filter(moduleCandidate => !excludedModules.includes(moduleCandidate))
    .filter(moduleCandidate => {
      const doesPackageJsonExist = fs.existsSync(
        path.join(dir, moduleCandidate, 'package.json')
      )
      if (!doesPackageJsonExist) {
        core.warning(
          `Skipping module ${moduleCandidate}, no package.json found`
        )
      }
      return doesPackageJsonExist
    })
}

export const writeModuleVersion = (moduleDir: string, version: string) => {
  const packagePath = path.join(moduleDir, 'package.json')
  const packageJSON = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))
  packageJSON.version = version
  fs.writeFileSync(packagePath, JSON.stringify(packageJSON, null, 2), 'utf-8')
}

const build = async (executor: IExecutor, dir: string, modules: string[]) => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(dir, 'package.json')).toString('utf-8')
  )
  if (packageJson?.scripts?.modules) {
    core.info('Using buildModules yarn script...')
    await executor.exec('yarn', ['modules'], {
      cwd: dir,
      listeners: {
        stdline: line => core.info(`yarn modules: ${line}`)
      }
    })
  } else {
    core.info('Using legacy build_modules.sh script...')
    await executor.exec('app/scripts/modules/build_modules.sh', modules, {
      cwd: dir,
      listeners: {
        stdline: line =>
          core.info(`app/scripts/modules/build_modules.sh: ${line}`)
      }
    })
  }
}

export const defaultModuleHandler: IModuleHandler = {
  resolve: resolve,
  writeModuleVersion,
  build
}
