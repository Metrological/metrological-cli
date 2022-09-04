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

const axios = require('axios')
const chalk = require('chalk')
const execa = require('execa')
const FormData = require('form-data')
const fs = require('fs')
const os = require('os')
const path = require('path')
const shell = require('shelljs')
const targz = require('targz')

const ask = require('../helpers/ask')
const exit = require('../helpers/exit')
const sequence = require('../helpers/sequence')
const spinner = require('../helpers/spinner')

const UPLOAD_ERRORS = {
  version_already_exists: 'The current version of your app already exists',
  missing_field_file: 'There is a missing field',
  app_belongs_to_other_user: 'You are not the owner of this app',
}

const login = key => {
  spinner.start('Authenticating with Metrological Back Office')
  return axios
    .get('https://api.metrological.com/api/authentication/login-status', {
      headers: { 'X-Api-Token': key },
    })
    .then(({ data }) => {
      const user = data.securityContext.pop()
      if (user) {
        spinner.succeed()
        return user
      }
      exit('Unexpected authentication error')
    })
    .catch(err => {
      exit('Incorrect API key or not logged in to metrological dashboard')
    })
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

const nodeModuleInstall = () => {
  spinner.start(`Installing app dependencies`)
  
  let npmCmd = os.platform().startsWith('win') ? 'npm.cmd' : 'npm'

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

const readMetadata = () => {
  return new Promise((resolve, reject) => {
    const file = path.join(process.cwd(), 'metadata.json')
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

const requiredMetaData = (metadata) => {
  spinner.start('Checking required fields in metadata.json')

  const schema = {
    splashImage: value => typeof value === 'string' || value instanceof String,
    icon: value => typeof value === 'string' || value instanceof String
  };
  const requireDate = { // Dates when required metafields fail upload
    splashImage: "2022-11-30",
    icon: "2022-11-30"
  }

  const validate = (object, schema) => Object
    .keys(schema)
    .filter(key => !schema[key](object[key]))
    .map(key => ({
      key: key,
      msg: `${key} is a required field`,
      date: new Date(requireDate[key])
    }));

  const errors = validate(metadata, schema);

  if (errors.length > 0) {
    spinner.fail()
    let allowUpload = true
    console.log(chalk.red('--------------------------------------------------------------'))
    errors.forEach((element) => {
      if (element.date < new Date()) {
        allowUpload = false
        console.log(chalk.italic(`** Metadata: ${element.msg}!!!`))
      } else
        console.log(chalk.italic(`** Metadata: ${element.msg}. After ${element.date.toLocaleString()} you will not be able to upload.`))
    })
    console.log(chalk.red('--------------------------------------------------------------'))
    return (!allowUpload) ? process.exit(1) : metadata;
  } else {
    spinner.succeed()
    return metadata
  }
}

const bundleApp = (es, metadata) => {
  spinner.start(`Building ${es} appBundle and saving to build`)
  
  var cmd = '--' + es
  //TODO lightningjs cli needs es version on build command same as dist

  return execa('lng', ['build'])
    .then((e) => {
      spinner.succeed()
      return
    })
    .catch(e => {
      spinner.fail(`Error while bundling app `+es)
      console.log(chalk.red('--------------------------------------------------------------'))
      console.log(chalk.italic(e))
      console.log(chalk.red('--------------------------------------------------------------'))
      process.env.LNG_BUILD_EXIT_ON_FAIL === 'true' && process.exit(1)
    })
}

const copyFiles = folder => {
  spinner.start('Copying assets to "' + folder.split('/').pop() + '"')
  shell.cp('-r', './src', folder)
  shell.cp('-r', './static', folder)
  shell.cp('./metadata.json', folder)
  shell.cp('./build/appBundle.js', folder)
  shell.cp('./build/appBundle.js.map', folder)
  shell.cp('./build/appBundle.es5.js', folder)
  shell.cp('./build/appBundle.es5.js.map', folder)
  spinner.succeed()
}

const pack = (buildDir, releasesDir, metadata) => {
  const filename = [metadata.identifier, metadata.version, 'tgz'].join('.').replace(/\s/g, '_')
  const target = path.join(releasesDir, filename)

  spinner.start(
    'Creating release package "' + filename + '" in "' + releasesDir.split('/').pop() + '" folder'
  )

  return tar(buildDir, target)
    .then(() => {
      spinner.succeed()
      return target
    })
    .catch(e => {
      console.log(`Error occurred while creating release package\n\n${e}`)
      exit()
    })
}

const tar = (src, dest) => {
  return new Promise((resolve, reject) => {
    targz.compress({ src, dest }, err => {
      if (err) {
        console.log(`Error while compressing the tar file. Error is : ${err}`)
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

const checkUploadFileSize = packageData => {
  const stats = fs.statSync(packageData.tgzFile)
  const fileSizeInMB = stats.size / 1000000 //convert from Bytes to MB

  if (fileSizeInMB >= 10) {
    exit('Upload File size is greater than 10 MB. Please make sure the size is less than 10MB')
  }
  return packageData
}

const upload = (packageData, user) => {
  //TODO  this error is not giving user feedback ['missingFiles: should contain folders(src, static) and files(metadata.json, appBundle.js, appBundle.es5.js)']
  spinner.start('Uploading package to Metrological Back Office')
  if (!packageData.identifier) {
    exit("Metadata.json doesn't contain an identifier field")
  }
  if (!packageData.version) {
    exit("Metadata.json doesn't contain an version field")
  }

  const form = new FormData()
  form.append('id', packageData.identifier)
  form.append('version', packageData.version)
  form.append('upload', fs.createReadStream(packageData.tgzFile))

  const headers = form.getHeaders()
  headers['X-Api-Token'] = user.apiKey

  axios
    .post('https://api.metrological.com/api/' + user.type + '/app-store/upload-lightning', form, {
      headers,
    })
    .then(({ data }) => {
      // errors also return a 200 status reponse, so we intercept errors here manually
      if (data.error) {
        exit(UPLOAD_ERRORS[data.error] || data.error)
      } else {
        spinner.succeed()
      }
    })
    .catch(err => {
      console.log(err);
      exit(UPLOAD_ERRORS[err] || err)
    })
}

module.exports = () => {
  let user
  // set environment to production (to enable minify)
  process.env.NODE_ENV = 'production'
  const releasesDir = path.join(process.cwd(), 'releases')
  const tmpDir = path.join(process.cwd(), '/.tmp')
  let packageData
  return sequence([
    // todo: save API key locally for future use and set it as default answer
    () => ask('Please provide your API key'),
    apiKey => login(apiKey).then(usr => ((user = usr), (usr.apiKey = apiKey))),
    () => removeFolder("node_modules"),
    () => nodeModuleInstall(),
    () => readMetadata().then(metadata => {
            packageData = metadata
            return metadata
          }),
    () => requiredMetaData(packageData),
    () => bundleApp('es5', packageData),
    //() => bundleApp('es6', packageData),
    //() => removeFolder(tmpDir),
    () => ensureFolderExists(tmpDir),
    () => copyFiles(tmpDir),
    () => ensureFolderExists(releasesDir),
    () => pack(tmpDir, releasesDir, packageData),
    tgzFile => (packageData.tgzFile = tgzFile),
    () => checkUploadFileSize(packageData),
    () => upload(packageData, user),
  ])
}
