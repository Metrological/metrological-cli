const chalk = require('chalk');
const spinner = require('@lightningjs/cli/src/helpers/spinner');
const validateMetadata = require('./validate-metadata');

// Mocking globals and external packages to prevent logs during tests
// These globals could be mocked in a setup file, the jest.mock's are
// automatically cleared before each test
global.console = {
  error: jest.fn(),
  log: jest.fn(),
  warn: console.log,
};

global.process = {
  exit: jest.fn(),
};

jest.mock('chalk', () => ({
  red: jest.fn(),
  green: jest.fn(),
  italic: jest.fn(),
  yellow: jest.fn(),
}));

jest.mock('@lightningjs/cli/src/helpers/spinner', () => ({
  start: jest.fn(),
  fail: jest.fn(),
  succeed: jest.fn(),
}));

// This is needed because the 'abort' function cannot be exported separately because
// of the validateMetadata export
const expectAbort = (msg) => {
  expect(spinner.fail).toHaveBeenCalledTimes(1);
  // This allows for partial/loose matching
  expect(chalk.red).toHaveBeenCalledWith(expect.stringContaining(msg));
  expect(process.exit).toHaveBeenCalledWith(1);
};

describe('validateMetadata', () => {
  it('correctly starts a spinner', () => {
    validateMetadata();
    expect(spinner.start).toHaveBeenCalledWith('Checking validity of metadata.json');
  });
  it("exits correctly when metadata isn't passed", () => {
    validateMetadata();
    expectAbort("Metadata wasn't found, make sure it's provided through a metadata.json file");
  });
  it('exits correctly when name is missing', () => {
    validateMetadata({});
    expectAbort('Metadata is invalid: "name" is required');
  });
  it('exits correctly when name is invalid', () => {
    validateMetadata({ name: 123 });
    expectAbort('Metadata is invalid: "name" is not of a type(s) string');
  });
  it('exits correctly when identifier is missing', () => {
    validateMetadata({ name: 'validName' });
    expectAbort('"identifier" is required');
  });
  it('exits correctly when identifier is invalid', () => {
    validateMetadata({ name: 'validName', identifier: 123 });
    expectAbort('"identifier" is not of a type(s) string');
  });
  it('exits correctly when version is missing', () => {
    validateMetadata({ name: 'validName', identifier: 'validIdentifier' });
    expectAbort('"version" is required');
  });
  it('exits correctly when version is of invalid type', () => {
    validateMetadata({ name: 'validName', identifier: 'validIdentifier', version: 1 });
    expectAbort('"version" is not of a type(s) string');
  });
  it('exits correctly when version has unexpected value', () => {
    validateMetadata({ name: 'validName', identifier: 'validIdentifier', version: '1.0.2-alpha.0' });
    expectAbort('"version" does not match pattern');
  });

  it('exits correctly when an invalid URL is passed', () => {
    validateMetadata({
      name: 'validName', identifier: 'validIdentifier', version: '1.2.3', externalUrl: '/non-valid-url',
    });
    expectAbort('"externalUrl" does not match pattern');
  });

  it('exits correctly when an invalid icon path is passed', () => {
    validateMetadata({
      name: 'validName', identifier: 'validIdentifier', version: '1.2.3', icon: './static/bla',
    });
    expectAbort('"icon" does not match pattern');
  });

  it('exits correctly when an invalid artwork object is passed', () => {
    validateMetadata({
      name: 'validName',
      identifier: 'validIdentifier',
      version: '1.2.3',
      icon: './static/bla.jpg',
      icons: {
        default: './static/bla.jpg',
        square: './static/bla.jpg',
        rounded: './static/bla.jpg',
        landscape: './static/bla.jpg',
      },
      artwork: {},
    });
    expectAbort('"artwork.1920x1080" is required');
  });

  it('does not exit when only required properties are passed and valid', () => {
    validateMetadata({
      name: 'MyApp',
      identifier: 'com.metrological.app.MyApp',
      version: '1.2.3',
      icon: './static/bla.jpg',
      icons: {
        default: './static/bla.jpg',
        square: './static/bla.jpg',
        rounded: './static/bla.jpg',
        landscape: './static/bla.jpg',
      },
    });
    expect(console.error).not.toHaveBeenCalled();
    expect(spinner.succeed).toHaveBeenCalled();
  });

  it('does not exit when additional properties are passed and valid', () => {
    const validMetadata = {
      name: 'MyApp',
      identifier: 'com.metrological.app.MyApp',
      version: '1.2.3',
      externalUrl: 'https://valid-test-url.com',
      icon: './static/bla.jpg',
      icons: {
        default: './static/bla.jpg',
        square: './static/bla.jpg',
        rounded: './static/bla.jpg',
        landscape: './static/bla.jpg',
      },
      splashImage: './static/bla.jpg',
    };
    const result = validateMetadata(validMetadata);
    expect(result).toBe(validMetadata);
    expect(console.error).not.toHaveBeenCalled();
    expect(spinner.succeed).toHaveBeenCalled();
  });
});
