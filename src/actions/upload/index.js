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

const axios = require("axios");
const chalk = require("chalk");
const execa = require("execa");
const FormData = require("form-data");
const fs = require("fs");
const os = require("os");
const path = require("path");
const shell = require("shelljs");
const targz = require("targz");

const ask = require("@lightningjs/cli/src/helpers/ask");
const exit = require("@lightningjs/cli/src/helpers/exit");
const spinner = require("@lightningjs/cli/src/helpers/spinner");
const buildHelpers = require("@lightningjs/cli/src/helpers/build");

const validateMetadata = require("./validate-metadata");

// Only log when debugging is enabled
let debuggingEnabled = false;
const debugLogger = (msg) => {
  if (!debuggingEnabled) {
    return;
  }
  spinner.stop();
  console.log(`${chalk.bgWhite("[debug]")} ${chalk.blackBright(msg)}`);
};

// These codes are returned by the backend, convert them into readable error messages
const UPLOAD_ERRORS = {
  version_already_exists: "The current version of your app already exists",
  missing_field_file: "There is a missing field",
  app_belongs_to_other_user: "You are not the owner of this app",
};

const login = (key) => {
  spinner.start("Authenticating with Metrological Back Office");
  return axios
    .post(
      "https://api.metrological.com/api/authentication/login-dashboard",
      {
        email: "product@xite.com",
        password: "Xite@metrological1",
      },
      {
        headers: {
          Accept: "application/json, text/plain, */*",
          "Content-Type": "application/json;charset=UTF-8",
        },
      }
    )
    .then((res) => res.data);
};

const nodeModuleInstall = () => {
  spinner.start("Installing app dependencies");
  const npmCmd = os.platform().startsWith("win") ? "npm.cmd" : "npm";

  return execa(npmCmd, ["i"])
    .then(() => {
      spinner.succeed();
    })
    .catch((e) => {
      spinner.fail("Error while installing app dependencies");
      console.log(
        chalk.red(
          "--------------------------------------------------------------"
        )
      );
      console.log(chalk.italic(e.stderr));
      console.log(
        chalk.red(
          "--------------------------------------------------------------"
        )
      );
      process.exit(1);
    });
};

const bundleApp = () => {
  spinner.start("Building appBundle and saving to build");

  return execa("lng", ["build", "--es5", "--es6"])
    .then(() => {
      spinner.succeed();
    })
    .catch((e) => {
      spinner.fail("Error while bundling app.");
      console.log(
        chalk.red(
          "--------------------------------------------------------------"
        )
      );
      console.log(chalk.italic(e));
      console.log(
        chalk.red(
          "--------------------------------------------------------------"
        )
      );
      return process.env.LNG_BUILD_EXIT_ON_FAIL === "true" && process.exit(1);
    });
};

const copyFile = (filePath, folder, isFolder) => {
  const exists = shell.test("-e", filePath);
  debugLogger(
    `Copying ${isFolder ? "folder" : "file"} "${filePath}" to "${folder}"`
  );
  if (!exists) {
    debugLogger(
      `${
        isFolder ? "Folder" : "File"
      } ${filePath} does not exist in ${shell.pwd()}`
    );
    debugLogger(
      `Founds paths: ${shell
        .ls("-R", shell.pwd())
        .grep("-v", "node_modules|src")}`
    );
    console.log(" ");
    console.log(chalk.red(`Could not find ${filePath}`));
    process.exit(1);
  }

  if (isFolder) {
    shell.cp("-r", filePath, folder);
    return;
  }
  shell.cp(filePath, folder);
};

const copyFiles = (folder, isExternalApp) => {
  spinner.start(`Copying assets to "${folder.split("/").pop()}"`);
  // Always copy metadata.json
  shell.cp("./metadata.json", folder);

  // Always copy static folder as it probably contains icons
  copyFile("./static", folder, true);

  if (!isExternalApp) {
    copyFile("./src", folder, true);
    [
      "./build/appBundle.js",
      "./build/appBundle.js.map",
      "./build/appBundle.es5.js",
      "./build/appBundle.es5.js.map",
    ].forEach((p) => copyFile(p, folder, false));
  }

  spinner.succeed();
};

const tar = (src, dest) =>
  new Promise((resolve, reject) => {
    targz.compress({ src, dest }, (err) => {
      if (err) {
        console.log(`Error while compressing the tar file. Error is : ${err}`);
        reject(err);
      } else {
        resolve();
      }
    });
  });

const pack = (buildDir, releasesDir, metadata) => {
  const filename = [metadata.identifier, metadata.version, "tgz"]
    .join(".")
    .replace(/\s/g, "_");
  const target = path.join(releasesDir, filename);

  spinner.start(
    `Creating release package "${filename}" in "${releasesDir
      .split("/")
      .pop()}" folder`
  );

  return tar(buildDir, target)
    .then(() => {
      spinner.succeed();
      return target;
    })
    .catch((e) => {
      console.log(`Error occurred while creating release package\n\n${e}`);
      exit();
    });
};

const checkUploadFileSize = (tgzFile) => {
  const stats = fs.statSync(tgzFile);
  const fileSizeInMB = stats.size / 1000000; // convert from Bytes to MB

  if (fileSizeInMB >= 10) {
    exit(
      "Upload File size is greater than 10 MB. Please make sure the size is less than 10MB"
    );
  }
};

const upload = async (metadata, user, apiKey, tgzFile) => {
  spinner.start("Uploading package to Metrological Back Office");

  const form = new FormData();
  form.append("id", metadata.identifier);
  form.append("version", metadata.version);
  form.append("upload", fs.createReadStream(tgzFile));

  const headers = form.getHeaders();
  headers["X-Api-Token"] = apiKey;

  const { data } = await axios.post(
    `https://api.metrological.com/api/developer/app-store/upload-lightning`,
    form,
    {
      headers,
    }
  );

  // errors also return a 200 status response, so we intercept errors here manually
  if (data.error) {
    // The backend sometimes returns errors as an array, sometimes as a single string.
    // We need to support both cases (at least for now)
    if (Array.isArray(data.error)) {
      data.error.forEach((msg) => {
        spinner.fail(msg);
      });
      process.exit();
    } else {
      exit(UPLOAD_ERRORS[data.error] || data.error);
    }
  } else {
    spinner.succeed();
  }
};

const packageJSON = require("../../../package.json");

module.exports = async (debug) => {
  // This should move into a utility thingy
  debuggingEnabled = debug;
  debugLogger(`Node version: ${process.version}`);
  debugLogger(`metrological-cli version: ${packageJSON.version}`);
  debugLogger(
    `lightning-cli version: ${shell
      .exec("lng --version", { silent: true })
      .stdout.replace("Lightning-CLI ", "")
      .trim()}`
  );
  debugLogger(
    `lightning-cli PATH: ${shell.exec("which lng", { silent: true }).stdout}`
  );
  debugLogger(`Platform: ${process.platform}`);
  debugLogger(`Cwd: ${process.cwd()}`);
  debugLogger(`Environment variables: ${JSON.stringify(process.env)}`);
  // set environment to production (to enable minify)
  process.env.NODE_ENV = "production";

  // The '.tmp' dir will hold the files that are going to be packed
  const tmpDir = path.join(process.cwd(), "/.tmp");
  debugLogger(`tmpDir: ${tmpDir}`);
  buildHelpers.removeFolder(tmpDir);
  debugLogger(`removed folder: ${tmpDir}`);

  // The 'releases' folder will hold all packed apps
  const releasesDir = path.join(process.cwd(), "releases");
  debugLogger(`releasesDir: ${releasesDir}`);

  // Clear the console
  if (!debug) {
    console.clear();
  }

  // todo: save API key locally for future use and set it as default answer
  const apiKey = await ask("Please provide your API key");
  const metadataRaw = await buildHelpers.readMetadata();
  const metadata = validateMetadata(metadataRaw);

  debugLogger(`metadata: ${JSON.stringify(metadata)}`);

  // Only start building non-externally hosted apps
  if (metadata.externalUrl) {
    console.log(" ");
    console.log(
      chalk.yellow("Detected externally hosted app, skipping build steps")
    );
  } else {
    // await nodeModuleInstall();
    // debugLogger("Starting build");
    // await bundleApp();
    // debugLogger(
    //   `Done building app, files: ${shell.ls(path.join(process.cwd(), "build"))}`
    // );
  }

  buildHelpers.ensureFolderExists(tmpDir);
  debugLogger(`created folder: ${tmpDir}`);

  copyFiles(tmpDir, !!metadata.externalUrl);
  buildHelpers.ensureFolderExists(releasesDir);
  const tgzFile = await pack(tmpDir, releasesDir, metadata);
  checkUploadFileSize(tgzFile);
  try {
    await upload(metadata, null, apiKey, tgzFile);
  } catch (e) {
    console.log(`Error occurred while uploading the app`, e);
    // Always clean up the .tmp directory if the upload did not succeed
    // Note that the 'releases' directory is untouched
    buildHelpers.removeFolder(tmpDir);
  }
};
