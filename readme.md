# Metrological CLI

The Metrological CLI is the _Command Line Interface_ tool for uploading Lightning Apps to the Metrological backend.

The recommended way of using the Metrological CLI for uploading an App is using `npx`.

You can either run the following command inside the root of a Lightning App project:

```bash
npx @metrological/cli upload
```

Or you can specify an _upload_ script inside the `package.json` of your App:

```json
{
  "name": "mylightningapp",
  "scripts": {
    "upload": "npx --yes @metrological/cli upload"
  }
}
```

Then simply run `npm run upload` inside the root folder of your App.


Alternatively you can install the Metrological CLI _globally_ on your system, by running the following command:

```bash
npm install -g @metrological/cli
```

Then inside the root of a Lightning App you can run the following command.

```bash
metro upload
```