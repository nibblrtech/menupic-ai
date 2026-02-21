import {
    GoogleSignin,
    statusCodes,
} from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import { Image } from "expo-image";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useRef } from "react";
import {
    Alert,
    Dimensions,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSharedValue } from "react-native-reanimated";
import Carousel, {
    ICarouselInstance,
    Pagination,
} from "react-native-reanimated-carousel";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Carousel slides showcasing app features
const CAROUSEL_DATA = [
  {
    id: 1,
    title: "Scan Any Menu",
    description: "Point your camera at any restaurant menu and instantly recognize text",
    emoji: "📸",
    backgroundColor: "#1a472a",
  },
  {
    id: 2,
    title: "AI-Powered Identification",
    description: "Tap on any dish name to get AI-generated descriptions and images",
    emoji: "🤖",
    backgroundColor: "#2d1b4e",
  },
  {
    id: 3,
    title: "See Your Food",
    description: "Get beautiful AI-generated images of dishes before you order",
    emoji: "🍽️",
    backgroundColor: "#4a1a1a",
  },
  {
    id: 4,
    title: "Works Everywhere",
    description: "Supports menus in multiple languages with real-time OCR",
    emoji: "🌍",
    backgroundColor: "#1a3a4a",
  },
];

// Configure Google Sign-In only on Android (iOS uses Apple Sign-In)
if (Platform.OS === "android") {
  GoogleSignin.configure({
    // TODO: Replace with your actual Google Cloud OAuth web client ID
    webClientId: "568081811104-4vr26mj5jmd3kg52kn68ksitpo0f8a9f.apps.googleusercontent.com",
    //webClientId: "YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com",
    offlineAccess: true,
  });
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, isSignedIn } = useAuth();
  const carouselRef = useRef<ICarouselInstance>(null);
  const progress = useSharedValue<number>(0);

  // If already signed in, redirect to tabs
  React.useEffect(() => {
    if (isSignedIn) {
      router.replace("/(tabs)/scan");
    }
  }, [isSignedIn]);

  const handleAppleSignIn = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // `credential.user` is Apple's stable opaque user ID — this is the `sub` claim.
      // It is always present, regardless of whether the user shared their email.
      // `credential.email` is only returned on the VERY FIRST sign-in; null on all subsequent ones.
      const sub = credential.user;
      const email = credential.email ?? null;

      console.log("[Auth] Apple Sign-In claims discovered:", {
        sub,
        email,
        fullName: credential.fullName,
        realUserStatus: credential.realUserStatus,
      });
      console.log("[Auth] Using sub as userId:", sub);

      signIn(sub, email);
      router.replace("/(tabs)/scan");
    } catch (e: any) {
      if (e.code === "ERR_REQUEST_CANCELED") {
        console.log("[Auth] User canceled Apple Sign-In");
      } else {
        console.error("[Auth] Apple Sign-In error:", e);
        Alert.alert("Sign-In Error", "Failed to sign in with Apple. Please try again.");
      }
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();

      if (response.type === "success" && response.data?.user?.email) {
        const { email, id: googleSub, name, photo } = response.data.user;

        // Google Sign-In reliably returns email on every sign-in, making it
        // a stable identifier for Android. `id` is the Google `sub` claim and
        // is also available if you prefer a non-PII identifier in future.
        console.log("[Auth] Google Sign-In claims discovered:", {
          email,
          googleSub,
          name,
          photo,
        });
        console.log("[Auth] Using email as userId:", email);

        signIn(email, email);
        router.replace("/(tabs)/scan");
      } else {
        console.log("[Auth] Google Sign-In cancelled or no email");
      }
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log("[Auth] User canceled Google Sign-In");
      } else if (error.code === statusCodes.IN_PROGRESS) {
        console.log("[Auth] Google Sign-In already in progress");
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert("Error", "Google Play Services are not available on this device.");
      } else {
        const errorCode = error.code ?? "no code";
        const errorMessage = error.message ?? "no message";
        const errorDetails = JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
        console.error("[Auth] Google Sign-In error:", errorDetails);
        Alert.alert(
          "Sign-In Error",
          `Code: ${errorCode}\nMessage: ${errorMessage}\n\nFull error:\n${errorDetails}`
        );
      }
    }
  };

  const onPressPagination = (index: number) => {
    carouselRef.current?.scrollTo({
      index,
      animated: true,
    });
  };

  const renderCarouselItem = ({ item }: { item: (typeof CAROUSEL_DATA)[number] }) => (
    <View style={[styles.carouselItem, { backgroundColor: item.backgroundColor }]}>
      <Text style={styles.carouselEmoji}>{item.emoji}</Text>
      <Text style={styles.carouselTitle}>{item.title}</Text>
      <Text style={styles.carouselDescription}>{item.description}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
        {/* App Logo & Name */}
        <View style={styles.logoContainer}>
          <Image
            source={require("../assets/images/icon.png")}
            style={styles.logo}
            contentFit="contain"
          />
          <Text style={styles.appName}>MenuPic AI</Text>
          <Text style={styles.tagline}>See your food before you order</Text>
        </View>

        {/* Carousel */}
        <View style={styles.carouselContainer}>
          <Carousel
            ref={carouselRef}
            width={SCREEN_WIDTH - 40}
            height={240}
            data={CAROUSEL_DATA}
            loop
            autoPlay
            autoPlayInterval={3000}
            onProgressChange={progress}
            renderItem={renderCarouselItem}
            style={styles.carousel}
          />

          <Pagination.Basic
            progress={progress}
            data={CAROUSEL_DATA}
            dotStyle={styles.paginationDot}
            activeDotStyle={styles.paginationActiveDot}
            containerStyle={styles.paginationContainer}
            onPress={onPressPagination}
          />
        </View>

        {/* Get Started / Sign-In Section */}
        <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 20 }]}>
          {Platform.OS === "ios" ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={16}
              style={styles.appleButton}
              onPress={handleAppleSignIn}
            />
          ) : (
            <Pressable style={styles.googleButton} onPress={handleGoogleSignIn}>
              <Text style={styles.googleButtonText}>Sign in with Google</Text>
            </Pressable>
          )}

          <Text style={styles.termsText}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  content: {
    flex: 1,
    alignItems: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    marginBottom: 12,
  },
  appName: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  tagline: {
    color: "#888",
    fontSize: 16,
    marginTop: 6,
  },
  carouselContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  carousel: {
    alignSelf: "center",
  },
  carouselItem: {
    flex: 1,
    borderRadius: 20,
    padding: 30,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 4,
  },
  carouselEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  carouselTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  carouselDescription: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  paginationActiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4CAF50",
    overflow: "hidden",
  },
  paginationContainer: {
    gap: 6,
    marginTop: 16,
  },
  bottomSection: {
    width: "100%",
    paddingHorizontal: 20,
    alignItems: "center",
  },
  appleButton: {
    width: "100%",
    height: 52,
    marginBottom: 12,
  },
  googleButton: {
    width: "100%",
    height: 52,
    backgroundColor: "#fff",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  googleButtonText: {
    color: "#000",
    fontSize: 17,
    fontWeight: "600",
  },
  termsText: {
    color: "#555",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});
