#!/usr/bin/env node

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

// load and parse (optional) .env file with
require('dotenv').config()

const program = require('commander')
const chalk = require('chalk')

const uploadAction = require('../src/actions/upload')

const updateCheck = (force = null) => upToDate(force === null ? Math.random() < 0.8 : !force)

program
  .command('upload')
  .description(
    [
      '🚀',
      ' '.repeat(3),
      'Upload the Lightning App to the Metrological Back Office to be published in an App Store',
    ].join('')
  )
  .action(() => {
    uploadAction()
    //updateCheck(true)
      //.then(() => uploadAction())
      .catch(e => {
        console.error(e)
        process.exit(1)
      })
  })

program.on('command:*', () => {
  console.log('Use ' + chalk.yellow('metro -h') + ' to see a full list of available commands')
  process.exit(1)
})

program.parse(process.argv)

if (!process.argv.slice(2).length) {
  program.outputHelp()
}