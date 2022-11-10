const { Validator } = require('jsonschema');
const chalk = require('chalk');
const spinner = require('@lightningjs/cli/src/helpers/spinner');

const validator = new Validator();

// NOTE: Only use patterns as recommended here:
// https://json-schema.org/understanding-json-schema/reference/regular_expressions.html
const URL_PATTERN = '^https?://'; // Used pattern from https://github.com/json-schema-org/json-schema-spec/issues/233#issuecomment-279180514
// TODO: It would be nice to also add validation for icons:
// if the path exists
// if the icons match a specific dimension as described here:
// https://metrological.atlassian.net/wiki/spaces/MET/pages/2874638351/Icons+artwork
const ICON_PATTERN = '^./static/.+.(png|jpg|jpeg)$';

const schema = {
  id: '/Metadata',
  type: 'object',
  properties: {
    name: { type: 'string', required: true },
    identifier: { type: 'string', required: true },
    version: { type: 'string', required: true },
    externalUrl: { type: 'uri', pattern: URL_PATTERN },
    icon: { type: 'string', required: true, pattern: ICON_PATTERN },
    icons: {
      type: 'object',
      properties: {
        default: { type: 'string', pattern: ICON_PATTERN },
        square: { type: 'string', pattern: ICON_PATTERN },
        rounded: { type: 'string', pattern: ICON_PATTERN },
        landscape: { type: 'string', pattern: ICON_PATTERN },
      },
    },
    splashImage: { type: 'string', pattern: ICON_PATTERN }, // For Comcast only
    artwork: {
      type: 'object',
      properties: {
        '1920x1080': { type: 'string', pattern: ICON_PATTERN },
        '1280x720': { type: 'string', pattern: ICON_PATTERN },
      },
    },
  },
};

const abort = (msg) => {
  spinner.fail();
  console.error(chalk.red(msg));
  process.exit(1);
};

module.exports = function validateMetadata(metadata) {
  spinner.start('Checking validity of metadata.json');

  if (!metadata) {
    return abort("Metadata wasn't found, make sure it's provided through a metadata.json file");
  }

  // 'instance' will hold the validated properties
  const { valid, errors, instance } = validator.validate(metadata, schema);

  // 'valid' is a bool indicating if the data is valid
  if (!valid) {
    // 'path' is an array with a length depending on the depth/tree of the property
    const { path, message } = errors[0];
    return abort(`Metadata is invalid: "${path.join('.')}" ${message}`);
  }

  spinner.succeed();

  return instance;
};
