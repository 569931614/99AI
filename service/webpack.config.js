module.exports = function (options, webpack) {
  const externals = {
    // 将 sharp 标记为外部依赖，不打包进 bundle
    sharp: 'commonjs2 sharp',
    // ali-oss 也作为外部依赖
    'ali-oss': 'commonjs2 ali-oss',
    // websocket 相关依赖
    '@nestjs/platform-socket.io': 'commonjs2 @nestjs/platform-socket.io',
    '@nestjs/websockets': 'commonjs2 @nestjs/websockets',
    // fastify 静态文件服务
    '@fastify/static': 'commonjs2 @fastify/static',
    // pdf 解析库
    'pdf-parse': 'commonjs2 pdf-parse',
  };

  return {
    ...options,
    externals: [
      externals,
      // 函数形式的 external，确保 sharp 及其子路径都作为外部依赖
      function ({ request }, callback) {
        if (/^sharp(\/.*)?$/.test(request)) {
          return callback(null, 'commonjs2 ' + request);
        }
        callback();
      },
    ],
  };
};
