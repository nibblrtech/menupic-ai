const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin that copies assets/adi-registration.properties into
 * android/app/src/main/assets/ during prebuild.
 *
 * This file is required by Google Play's Android Developer Verification
 * process to prove ownership of the app's package name. Google provides the
 * token value via the Play Console; place it in assets/adi-registration.properties
 * at the project root and this plugin ensures it ends up in the APK's
 * native assets folder.
 */
const withAdiRegistration = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const sourceFile = path.join(projectRoot, 'assets', 'adi-registration.properties');
      const destDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'assets'
      );
      const destFile = path.join(destDir, 'adi-registration.properties');

      if (!fs.existsSync(sourceFile)) {
        throw new Error(
          `[withAdiRegistration] Source file not found: ${sourceFile}\n` +
            'Create assets/adi-registration.properties with the token provided by Google Play Console.'
        );
      }

      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(sourceFile, destFile);
      console.log(`[withAdiRegistration] Copied adi-registration.properties to ${destFile}`);

      return config;
    },
  ]);
};

module.exports = withAdiRegistration;
