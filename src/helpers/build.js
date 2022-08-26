/*
 * If not stated otherwise in this file or this component's LICENSE file the
 * following copyright and licenses apply:
 *
 * Copyright 2020 Metrological
 *
 * Licensed under the Apache License, Version 2.0 (the License);
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const shell = require('shelljs')
const fs = require('fs')
const execa = require('execa')
const os = require('os')
const path = require('path')
const chalk = require('chalk')
const esbuild = require('esbuild')
const spinner = require('./spinner')
const isLocallyInstalled = require('./localinstallationcheck')
const exit = require('./exit')
const depth = 3

const findFile = (parent, filePath, depthCount = 0) => {
  if (depthCount >= depth) throw new Error('Required files not found at the given path')

  const fullPath = path.join(parent, filePath)
  if (fs.existsSync(fullPath)) {
    return fullPath
  }
  return findFile(path.join(parent, '..'), filePath, ++depthCount)
}

const removeFolder = folder => {
  spinner.start('Removing "' + folder.split('/').pop() + '" folder')
  shell.rm('-rf', folder)
  spinner.succeed()
}

const ensureFolderExists = folder => {
  spinner.start('Ensuring "' + folder.split('/').pop() + '" folder exists')
  shell.mkdir('-p', folder)
  spinner.succeed()
}

const copyStaticFolder = folder => {
  spinner.start('Copying static assets to "' + folder.split('/').pop() + '"')
  shell.cp('-r', './static', folder)
  spinner.succeed()
}

const copySrcFolder = folder => {
  shell.cp('-r', './src', folder)
}

const copyMetadata = folder => {
  const file = path.join(process.cwd(), 'metadata.json')
  if (fs.existsSync(file)) {
    spinner.start('Copying metadata.json to "' + folder.split('/').pop() + '"')
    shell.cp(file, folder)
    spinner.succeed()
  } else {
    spinner.warn(`Metadata file not found at the ${process.cwd()}`)
  }
}

const readMetadata = () => {
  return readJson('metadata.json')
}

const readJson = fileName => {
  return new Promise((resolve, reject) => {
    const file = path.join(process.cwd(), fileName)
    if (fs.existsSync(file)) {
      try {
        resolve(JSON.parse(fs.readFileSync(file, 'utf8')))
      } catch (e) {
        spinner.fail(`Error occurred while reading ${file} file\n\n${e}`)
        reject(e)
      }
    } else {
      spinner.fail(`File not found error occurred while reading ${file} file`)
      reject('"' + fileName + '" not found')
    }
  })
}

const bundleEs6App = (folder, metadata, options = {}) => {
  if (process.env.LNG_BUNDLER === 'esbuild') {
    return buildAppEsBuild(folder, metadata, 'es6', options)
  } else {
    return bundleAppRollup(folder, metadata, 'es6', options)
  }
}

const bundleEs5App = (folder, metadata, options = {}) => {
  if (process.env.LNG_BUNDLER === 'esbuild') {
    return buildAppEsBuild(folder, metadata, 'es5', options)
  } else {
    return bundleAppRollup(folder, metadata, 'es5', options)
  }
}

const buildAppEsBuild = async (folder, metadata, type) => {
  spinner.start(
    `Building ${type.toUpperCase()} appBundle using [esbuild] and saving to ${folder
      .split('/')
      .pop()}`
  )
  try {
    const getConfig = require(`../configs/esbuild.${type}.config`)
    await esbuild.build(getConfig(folder, makeSafeAppId(metadata)))
    spinner.succeed()
    return metadata
  } catch (e) {
    spinner.fail(`Error while creating ${type.toUpperCase()} bundle using [esbuild] (see log)`)
    console.log(chalk.red('--------------------------------------------------------------'))
    console.log(chalk.italic(e.message))
    console.log(chalk.red('--------------------------------------------------------------'))
    process.env.LNG_BUILD_EXIT_ON_FAIL === 'true' && process.exit(1)
  }
}

const bundleAppRollup = (folder, metadata, type, options) => {
  spinner.start(`Building ${type.toUpperCase()} appBundle and saving to ${folder.split('/').pop()}`)

  const enterFile = fs.existsSync(path.join(process.cwd(), 'src/index.ts'))
    ? 'src/index.ts'
    : 'src/index.js'

  const args = [
    '-c',
    path.join(__dirname, `../configs/rollup.${type}.config.js`),
    '--input',
    path.join(process.cwd(), enterFile),
    '--file',
    path.join(folder, type === 'es6' ? 'appBundle.js' : 'appBundle.es5.js'),
    '--name',
    makeSafeAppId(metadata),
  ]

  if (options.sourcemaps === false) args.push('--no-sourcemap')

  const levelsDown = isLocallyInstalled()
    ? findFile(process.cwd(), 'node_modules/.bin/rollup')
    : path.join(__dirname, '../..', 'node_modules/.bin/rollup')
  process.env.LNG_BUILD_FAIL_ON_WARNINGS === 'true' ? args.push('--failAfterWarnings') : ''
  return execa(levelsDown, args)
    .then(() => {
      spinner.succeed()
      return metadata
    })
    .catch(e => {
      spinner.fail(`Error while creating ${type.toUpperCase()} bundle (see log)`)
      console.log(chalk.red('--------------------------------------------------------------'))
      console.log(chalk.italic(e.stderr))
      console.log(chalk.red('--------------------------------------------------------------'))
      process.env.LNG_BUILD_EXIT_ON_FAIL === 'true' && process.exit(1)
    })
}

const getEnvAppVars = (parsed = {}) =>
  Object.keys(parsed)
    .filter(key => key.startsWith('APP_'))
    .reduce((env, key) => {
      env[key] = parsed[key]
      return env
    }, {})

const getAppVersion = () => {
  return require(path.join(process.cwd(), 'metadata.json')).version
}

const getSdkVersion = () => {
  const packagePath = hasNewSDK()
    ? 'node_modules/@lightningjs/sdk'
    : 'node_modules/wpe-lightning-sdk'
  const packageJsonPath = findFile(process.cwd(), packagePath)
  return require(path.join(packageJsonPath, 'package.json')).version
}

const getCliVersion = () => {
  return require(path.join(__dirname, '../../package.json')).version
}

const makeSafeAppId = metadata =>
  ['APP', metadata.identifier && metadata.identifier.replace(/\./g, '_').replace(/-/g, '_')]
    .filter(val => val)
    .join('_')

const hasNewSDK = () => {
  const dependencies = Object.keys(require(path.join(process.cwd(), 'package.json')).dependencies)
  return dependencies.indexOf('@lightningjs/sdk') > -1
}

const ensureCorrectGitIgnore = () => {
  return new Promise(resolve => {
    const filename = path.join(process.cwd(), '.gitignore')
    try {
      const gitIgnoreEntries = fs.readFileSync(filename, 'utf8').split(os.EOL)
      const missingEntries = [
        process.env.LNG_BUILD_FOLDER || 'dist',
        'releases',
        '.tmp',
        process.env.LNG_BUILD_FOLDER || 'build',
      ].filter(entry => gitIgnoreEntries.indexOf(entry) === -1)

      if (missingEntries.length) {
        fs.appendFileSync(filename, os.EOL + missingEntries.join(os.EOL) + os.EOL)
      }

      resolve()
    } catch (e) {
      // no .gitignore file, so let's just move on
      resolve()
    }
  })
}

const ensureLightningApp = () => {
  return new Promise(resolve => {
    const packageJsonPath = path.join(process.cwd(), 'package.json')
    if (!fs.existsSync(packageJsonPath)) {
      exit(`Package.json is not available at ${process.cwd()}. Build process cannot be proceeded`)
    }
    const packageJson = require(packageJsonPath)
    if (
      packageJson.dependencies &&
      (Object.keys(packageJson.dependencies).indexOf('wpe-lightning-sdk') > -1 ||
        Object.keys(packageJson.dependencies).indexOf('@lightningjs/sdk') > -1)
    ) {
      resolve()
    } else {
      exit('Please make sure you are running the command in the Application directory')
    }
  })
}

const nodeModuleInstall = () => {
  spinner.start(`Installing app dependencies`)
  
  var npmCmd = os.platform().startsWith('win') ? 'npm.cmd' : 'npm'

  return execa(npmCmd, ['i'])
    .then(() => {
      spinner.succeed()
      return
    })
    .catch(e => {
      spinner.fail(`Error while installing app dependencies`)
      console.log(chalk.red('--------------------------------------------------------------'))
      console.log(chalk.italic(e.stderr))
      console.log(chalk.red('--------------------------------------------------------------'))
      process.env.LNG_BUILD_EXIT_ON_FAIL === 'true' && process.exit(1)
    })
}

module.exports = {
  removeFolder,
  ensureFolderExists,
  copyStaticFolder,
  copySrcFolder,
  copyMetadata,
  readMetadata,
  bundleEs6App,
  bundleEs5App,
  getEnvAppVars,
  ensureCorrectGitIgnore,
  getAppVersion,
  getSdkVersion,
  getCliVersion,
  makeSafeAppId,
  hasNewSDK,
  ensureLightningApp,
  findFile,
  nodeModuleInstall
}
