const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo config plugin that restricts the app to phone-sized screens on Android,
 * excluding 7-inch (large) and 10-inch (xlarge) tablet form factors.
 *
 * This causes Google Play to hide the app from tablet device listings.
 */
const withPhoneOnly = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Replace or set <supports-screens> to exclude large/xlarge (tablet) screens
    manifest['supports-screens'] = [
      {
        $: {
          'android:smallScreens': 'true',
          'android:normalScreens': 'true',
          'android:largeScreens': 'false',
          'android:xlargeScreens': 'false',
        },
      },
    ];

    return config;
  });
};

module.exports = withPhoneOnly;
