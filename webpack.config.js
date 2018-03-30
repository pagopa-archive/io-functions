/**
 * Decorates the default webpack configuration (coming from funcpack).
 * See https://github.com/Azure/azure-functions-pack
 */
module.exports = function(config, webpack) {
  // fix an error with npm modules that call GENTLY.hijack(require)
  // ie. formidable needed by superagent
  // see https://github.com/felixge/node-formidable/issues/337
  config.plugins.push(new webpack.DefinePlugin({ "global.GENTLY": false }));
  return config;
};
