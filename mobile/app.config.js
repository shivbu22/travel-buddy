const { releaseConfig } = require('./release-config.cjs');

module.exports = ({ config }) => releaseConfig(config);
