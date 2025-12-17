'use strict';

const path = require('path');
const webpack = require('webpack');

/** @type {import('webpack').Configuration} */
const config = {
  target: 'node',
  mode: 'none',

  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  plugins: [
    // Define navigator as undefined for Node.js environment
    // This prevents deprecation warnings from axios and other libraries
    new webpack.DefinePlugin({
      'navigator': 'undefined'
    })
  ],
  devtool: 'nosources-source-map',
  infrastructureLogging: {
    level: 'log'
  }
};

module.exports = config;
