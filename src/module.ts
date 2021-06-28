import * as core from '@actions/core'
import path from 'path'
import * as fs from 'fs'

export interface IModuleHandler {
  resolve(dir: string, excludedModules: string[]): string[]
  writeModuleVersion(dir: string, version: string): void
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

export const defaultModuleHandler: IModuleHandler = {
  resolve: resolve,
  writeModuleVersion
}
