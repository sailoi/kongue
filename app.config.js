module.exports = {
  expo: {
    name: "Kongue",
    slug: "lang_learn_app",
    version: "1.0.0",
    description: "Learn to speak, naturally",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "kongue",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.sailoilabs.kongue"
    },
    android: {
      package: "com.sailoilabs.kongue",
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: {
            backgroundColor: "#000000"
          }
        }
      ]
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true
    },
    extra: {
      router: {},
      eas: {
        projectId: "f9ceaee4-46bb-44a8-a72e-0bccd47e9ec5"
      }
    },
    owner: "sailoi-labs",
    runtimeVersion: {
      policy: "appVersion"
    },
    updates: {
      url: "https://u.expo.dev/f9ceaee4-46bb-44a8-a72e-0bccd47e9ec5"
    }
  }
};
