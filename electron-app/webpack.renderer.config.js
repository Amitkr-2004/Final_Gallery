/**
 * Webpack Configuration for Renderer Process (React UI)
 */

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

const isDevelopment = process.env.NODE_ENV === 'development';

module.exports = {
  mode: isDevelopment ? 'development' : 'production',
  target: 'web',

  entry: ['./src/renderer/polyfills.js', './src/renderer/App.jsx'],

  output: {
    path: path.resolve(__dirname, 'dist/renderer'),
    filename: 'renderer.js',
    clean: true,
    publicPath: isDevelopment ? '/' : './'
  },

  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-env',
              '@babel/preset-react'
            ]
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg)$/,
        type: 'asset/resource'
      }
    ]
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: './src/renderer/index.html',
      filename: 'index.html'
    }),
    new webpack.DefinePlugin({
      'global': 'window',
      'global.GENTLY': false
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
      global: 'global'
    }),
    new webpack.BannerPlugin({
      banner: 'if (typeof global === "undefined") { var global = window; }',
      raw: true,
      entryOnly: false
    })
  ],

  resolve: {
    extensions: ['.js', '.jsx', '.json'],
    fallback: {
      "path": require.resolve("path-browserify"),
      "os": require.resolve("os-browserify/browser"),
      "crypto": require.resolve("crypto-browserify"),
      "stream": require.resolve("stream-browserify"),
      "buffer": require.resolve("buffer/"),
      "process": require.resolve("process/browser"),
      "events": require.resolve("events/"),
      "util": require.resolve("util/"),
      "assert": require.resolve("assert/"),
      "url": require.resolve("url/"),
      "querystring": require.resolve("querystring-es3")
    }
  },

  devServer: {
    port: 9000,
    hot: true,
    static: {
      directory: path.join(__dirname, 'dist/renderer')
    },
    devMiddleware: {
      writeToDisk: true
    },
    client: {
      webSocketURL: 'ws://localhost:9000/ws',
      logging: 'info',
      overlay: {
        errors: true,
        warnings: false
      },
      reconnect: 5
    },
    webSocketServer: 'ws',
    allowedHosts: 'all',
    headers: {
      'Access-Control-Allow-Origin': '*'
    }
  },

  devtool: isDevelopment ? 'source-map' : false
};
