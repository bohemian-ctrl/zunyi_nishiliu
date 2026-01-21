const { defineConfig } = require('@vue/cli-service')
const path = require('path')
const webpack = require('webpack')
const CopyWebpackPlugin = require('copy-webpack-plugin')

module.exports = defineConfig({
  publicPath:'./',
  lintOnSave: false,
  transpileDependencies: true,
  configureWebpack: {
    resolve: {
      alias: {
        cesium: path.resolve(__dirname, 'node_modules/cesium')
      }
    },
    plugins: [
      new webpack.DefinePlugin({
        CESIUM_BASE_URL: JSON.stringify('/zunyi_nishiliu/dist/cesium/')
      }),
      // 复制Cesium静态资源
      new CopyWebpackPlugin({
        patterns: [
          {

            from: path.resolve(__dirname, 'node_modules/cesium/Build/Cesium/Workers'),
            to: 'cesium/Workers'
          },
          {
            from: path.resolve(__dirname, 'node_modules/cesium/Build/Cesium/ThirdParty'),
            to: 'cesium/ThirdParty'
          },
          {
            from: path.resolve(__dirname, 'node_modules/cesium/Build/Cesium/Assets'),
            to: 'cesium/Assets'
          },
          {
            from: path.resolve(__dirname, 'node_modules/cesium/Build/Cesium/Widgets'),
            to: 'cesium/Widgets'
          }
        ]
      })
    ]
  },
  chainWebpack: config => {
    // Cesium 模块处理
    config.module
      .rule('cesium')
      .test(/\.js$/)
      .include.add(path.resolve(__dirname, 'node_modules/cesium'))
      .end()
      .use('babel-loader')
      .loader('babel-loader')
      .end()
    
    // 优化：确保 Cesium 只被打包一次
    config.optimization.splitChunks({
      chunks: 'all',
      cacheGroups: {
        cesium: {
          name: 'cesium',
          test: /[\\/]node_modules[\\/]cesium[\\/]/,
          priority: 30, // 提高优先级，确保优先处理
          reuseExistingChunk: true,
          enforce: true,
          chunks: 'all'
        },
        // 其他第三方库
        vendor: {
          name: 'vendor',
          test: /[\\/]node_modules[\\/]/,
          priority: 10,
          reuseExistingChunk: true,
          chunks: 'all'
        }
      }
    })
  }
})
