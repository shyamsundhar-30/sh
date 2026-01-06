const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(
    {
      ...env,
      babel: {
        dangerouslyAddModulePathsToTranspile: ['@react-navigation']
      }
    },
    argv
  );

  // Properly alias react-native to react-native-web for ALL imports
  config.resolve = config.resolve || {};
  config.resolve.alias = config.resolve.alias || {};
  
  // Only alias exact 'react-native' imports, let internal paths work
  config.resolve.alias['react-native$'] = 'react-native-web';

  // Ensure .web.js extensions are checked first
  config.resolve.extensions = [
    '.web.js',
    '.web.jsx', 
    '.web.ts',
    '.web.tsx',
    '.js',
    '.jsx',
    '.ts', 
    '.tsx',
    '.json',
  ];

  // Exclude problematic native-only modules from the bundle
  config.resolve.alias['react-native-maps'] = require.resolve('./stubs/react-native-maps.js');
  config.resolve.alias['react-native-proximity'] = require.resolve('./stubs/react-native-proximity.js');
  
  return config;
};
