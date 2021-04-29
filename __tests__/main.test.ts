import {DeckBuilder} from '../src/builder'
import {IModuleHandler} from '../src/module'
import {ExecOptions} from '@actions/exec'
import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'

interface ICommand {
  command: string
  dir?: string
}

test('runs commands to build deck', async () => {
  const commands: ICommand[] = []
  let version = ''

  const builder = new DeckBuilder(
    {
      resolve: (dir: string) => {
        return ['core', 'amazon']
      },
      writeModuleVersion: (dir: string, v: string) => {
        version = v
      }
    },
    {
      exec: async (cmd: string, args?: string[], opts?: ExecOptions) => {
        commands.push({command: `${cmd} ${args?.join(' ')}`, dir: opts?.cwd})
        return 0
      }
    },
    'deck',
    '2021.4.28-21.37.41.master',
    'https://armory.jfrog.io/artifactory',
    '<token>',
    'npm-all',
    'armory-npm-local',
    '<build-name>',
    '<build-number>',
    '<build-url>'
  )
  await builder.build()

  expect(version).toEqual('2021.4.28-21.37.41.master')
  expect(commands).toEqual([
    {
      command:
        'jfrog config add armory-artifactory-deck --artifactory-url=https://armory.jfrog.io/artifactory --access-token=<token> --interactive=false'
    },
    {command: 'yarn --frozen-lockfile', dir: 'deck'},
    {command: 'app/scripts/modules/build_modules.sh core amazon', dir: 'deck'},
    {
      command:
        'jfrog rt npmc --server-id-deploy=armory-artifactory-deck --server-id-resolve=armory-artifactory-deck --repo-resolve=npm-all --repo-deploy=armory-npm-local',
      dir: 'deck/app/scripts/modules/core'
    },
    {
      command:
        'jfrog rt npmp --build-name=<build-name> --build-number=<build-number>',
      dir: 'deck/app/scripts/modules/core'
    },
    {
      command:
        'jfrog rt npmc --server-id-deploy=armory-artifactory-deck --server-id-resolve=armory-artifactory-deck --repo-resolve=npm-all --repo-deploy=armory-npm-local',
      dir: 'deck/app/scripts/modules/amazon'
    },
    {
      command:
        'jfrog rt npmp --build-name=<build-name> --build-number=<build-number>',
      dir: 'deck/app/scripts/modules/amazon'
    },
    {
      command: 'jfrog rt bag <build-name> <build-number>',
      dir: 'deck'
    },
    {
      command:
        'jfrog rt bp <build-name> <build-number> --build-url=<build-url>',
      dir: 'deck'
    }
  ])
})
