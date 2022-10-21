# Metrological CLI

The Metrological CLI is the _Command Line Interface_ tool for uploading Lightning Apps to the Metrological Dashboard.

## Prerequisites
You need to have the `@lightningjs/cli` installed globally on your system. This is needed (for now) because under the hood it will trigger the `lng build` command. If you haven't done so, run this command: 
```bash
npm install -g @lightningjs/cli
```

To verify if you have the Lightning CLI installed, run:
```bash
lng --version
```

⚠️ This should output a version of __2.9.0 or higher__ 

## Usage

### Using npx (recommended)

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

### Installing globally
Alternatively you can install the Metrological CLI _globally_ on your system, by running the following command:

```bash
npm install -g @metrological/cli
```

Then inside the root of a Lightning App you can run the following command.

```bash
metro upload
```