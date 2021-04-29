import * as core from '@actions/core'
import {DeckBuilder} from './builder'
import {defaultModuleHandler} from './module'
import {exec} from '@actions/exec'

async function run(): Promise<void> {
  await new DeckBuilder(
    defaultModuleHandler,
    {exec},
    core.getInput('deck_path'),
    core.getInput('version'),
    core.getInput('artifactory_url'),
    core.getInput('artifactory_token'),
    core.getInput('artifactory_resolve_repo'),
    core.getInput('artifactory_deploy_repo'),
    core.getInput('build_name'),
    core.getInput('build_number'),
    core.getInput('build_url')
  ).build()
}

run().catch(e => core.setFailed(e))
