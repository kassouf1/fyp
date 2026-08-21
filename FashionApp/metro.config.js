const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  '@ungap/structured-clone': path.resolve(
    __dirname,
    'node_modules/@ungap/structured-clone/cjs/index.js'
  ),
};

module.exports = config;
