import * as fs from 'fs'
import program from 'commander'
import {DeckBuilder} from './builder'
import {defaultModuleHandler} from './module'
import {exec} from '@actions/exec'
import {parse} from 'yaml'
import * as path from 'path'
import camelcase from 'camelcase'

interface Inputs {
  deckPath: string
  version: string
  artifactoryUrl: string
  artifactoryToken: string
  artifactoryResolveRepo: string
  artifactoryDeployRepo: string
  buildNumber: string
  buildName: string
  buildUrl: string
}

const startProgram = (config: IActionConfig): Inputs => {
  Object.entries(config.inputs).forEach(([key, value]) => {
    if (value.required) {
      program.requiredOption(
        `--${key} <${key.split('_').pop()}>`,
        value.description
      )
    } else {
      program.option(
        `--${key} <${key.split('_').pop()}>`,
        value.description,
        value.default
      )
    }
  })
  program.parse()

  const inputs: any = {}
  for (const [key, value] of Object.entries(program.opts())) {
    console.log('key', key, 'value', value)
    inputs[camelcase(key)] = value
  }

  return inputs as Inputs
}

interface IActionConfig {
  name: string
  description: string
  author: string
  inputs: {
    [key: string]: {
      required: boolean
      default?: string
      description: string
    }
  }
  runs: {
    using: string
    main: string
  }
}

const run = async () => {
  const config = parse(
    fs.readFileSync(path.join(__dirname, '../action.yml'), 'utf-8')
  ) as IActionConfig

  const inputs = startProgram(config)

  await new DeckBuilder(
    defaultModuleHandler,
    {exec},
    inputs.deckPath,
    inputs.version,
    inputs.artifactoryUrl,
    inputs.artifactoryToken,
    inputs.artifactoryResolveRepo,
    inputs.artifactoryDeployRepo,
    inputs.buildName,
    inputs.buildNumber,
    inputs.buildUrl
  ).build()
}

run().catch(e => console.log(`Error: ${e.message}`))
