# Metrological CLI <!-- omit from toc -->

[![npm version](https://badge.fury.io/js/@metrological%2Fcli.svg)](https://badge.fury.io/js/@metrological%2Fcli)[![npm monthly downloads](https://img.shields.io/npm/dm/@metrological/cli.svg)](https://www.npmjs.com/package/@metrological/cli)

The Metrological CLI is the _Command Line Interface_ tool for uploading Lightning Apps to the Metrological Dashboard.

# Table of contents <!-- omit from toc -->
- [Prerequisites](#prerequisites)
- [Migrating from `lng upload` to `metro upload`](#migrating-from-lng-upload-to-metro-upload)
- [Usage](#usage)
  - [Method 1: Using npx (recommended)](#method-1-using-npx-recommended)
  - [Method 2: Installing as a devDependency](#method-2-installing-as-a-devdependency)
  - [Method 3: Installing globally](#method-3-installing-globally)
- [Available commands](#available-commands)

## Prerequisites

You need to have the `@lightningjs/cli` installed globally on your system. This is needed (for now) because under the hood it will trigger the `lng build` command. If you haven't done so, run this command:

```bash
npm install -g @lightningjs/cli
```

To verify if you have the Lightning CLI installed, run:

```bash
lng --version
```

⚠️ This should output a version of **2.9.0 or higher**

## Migrating from `lng upload` to `metro upload`

In the January 2023 release of the [Lightning-CLI](https://github.com/rdkcentral/Lightning-CLI) package, the `upload` command has been deprecated, as was announced in [this blog post](https://lightningjs.io/announcements/lightning-oct-22/) in October 2022. Luckily, it's easy to migrate from `lng upload` to `metro upload`:

1. Install the Metrological-CLI as described in the ['Usage'](#usage) section below
2. Check for any references to `lng upload` in your tooling (like your `package.json` or any custom build configuration)
3. Change this reference to either `npx @metrological/cli upload` or `metro upload`, depending on the way you've installed the Metrological-CLI package. See ['Usage'](#usage) for the recommend ways of installing it.

## Usage

### Method 1: Using npx (recommended)

You can use `npx` to execute the `upload` command instantly

```bash
npx @metrological/cli upload
```

You can also specify a script inside the `package.json` of your App, which uses the `npx` command

```json
{
  "name": "MyLightningApp",
  "scripts": {
    "upload": "npx @metrological/cli upload"
  }
}
```

To execute this, run `npm run upload` inside the root folder of your App (this is [default NPM behaviour](https://docs.npmjs.com/cli/v8/commands/npm-run-script))

### Method 2: Installing as a devDependency

You can install the Metrological CLI as a `devDependency` by running the NPM command for it:

```bash
npm install --save-dev @metrological/cli
```

You can then add a `script` in your `package.json` to use it, like so:

```json
{
  "name": "MyLightningApp",
  "scripts": {
    "upload": "metro upload"
  }
}
```

### Method 3: Installing globally

Alternatively you can install the Metrological CLI _globally_ on your system, by running the following command:

```bash
npm install -g @metrological/cli
```

Then inside the root of a Lightning App you can run the following command.

```bash
metro upload
```

## Available commands

| Command     | Description                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------- |
| `upload`    | :rocket: Upload the Lightning App to the Metrological Back Office to be published in an App Store |
| `--help`    | Output the version number                                                                         |
| `--version` | Display help for command                                                                          |
