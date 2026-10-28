'use strict';

const configStore = require('./config-store');

module.exports = {
  load: configStore.load,
  save: configStore.save,
  DEFAULTS: configStore.DEFAULTS,
  getConfigFile: configStore.getConfigFile
};
