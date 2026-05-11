module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@': './src',
            '@core': './src/core',
            '@features': './src/features',
            '@navigation': './src/navigation',
            '@components': './src/components',
            '@store': './src/store',
          },
        },
      ],
      'react-native-worklets/plugin',
    ],
  };
};
