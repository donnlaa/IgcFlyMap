const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  entry: './testjs.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  externals: [nodeExternals()],
  mode: 'development',
};
