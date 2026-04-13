import {
    GoogleSignin,
    statusCodes,
} from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import { Image } from "expo-image";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useRef, useState } from "react";
import {
    Alert,
    Dimensions,
    Linking,
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
import { MenuPageSlide, ResultPageSlide, ScanPageSlide } from "../components/CarouselSlides";
import { Button as Btn, buttonColors, Colors, Fonts, FontSize, Spacing } from "../constants/DesignSystem";
import { useAuth } from "../contexts/AuthContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/**
 * Three slide indices — each maps to a live-rendered "screenshot" component.
 * Adding a slide is as simple as adding an index and a case in renderCarouselItem.
 */
const SLIDES: number[] = [0, 1, 2];

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
  const [carouselContainerHeight, setCarouselContainerHeight] = useState(0);

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

  const renderCarouselItem = ({ item: slideIndex }: { item: number }) => (
    <View style={styles.carouselItem}>
      {slideIndex === 0 && <MenuPageSlide />}
      {slideIndex === 1 && <ScanPageSlide />}
      {slideIndex === 2 && <ResultPageSlide />}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={[styles.content, { paddingTop: insets.top + Spacing.sm }]}>
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
        <View
          style={styles.carouselContainer}
          onLayout={(e) => setCarouselContainerHeight(e.nativeEvent.layout.height)}
        >
          {carouselContainerHeight > 0 && (
            <Carousel
              ref={carouselRef}
              width={SCREEN_WIDTH - 40}
              height={carouselContainerHeight - 38}
              data={SLIDES}
              loop
              autoPlay
              autoPlayInterval={10000}
              onProgressChange={progress}
              renderItem={renderCarouselItem}
              style={styles.carousel}
            />
          )}

          <Pagination.Basic
            progress={progress}
            data={SLIDES}
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
              cornerRadius={Btn.borderRadius}
              style={styles.appleButton}
              onPress={handleAppleSignIn}
            />
          ) : (
            <Pressable style={styles.googleButton} onPress={handleGoogleSignIn}>
              <Text style={styles.googleButtonText}>Sign in with Google</Text>
            </Pressable>
          )}

          <Text style={styles.termsText}>
            By continuing, you agree to our{" "}
            <Text
              style={styles.termsLink}
              onPress={() => Linking.openURL("https://sites.google.com/view/nibblr/menu-pic-terms-of-use?authuser=0")}
            >
              Terms of Use
            </Text>
            {" and "}
            <Text
              style={styles.termsLink}
              onPress={() => Linking.openURL("https://sites.google.com/view/nibblr/menu-pic-privacy-policy?authuser=0")}
            >
              Privacy Policy
            </Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

const _btn = buttonColors('dark');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark,
  },
  content: {
    flex: 1,
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: Spacing.xs,
    marginBottom: 4,
  },
  appName: {
    color: Colors.textOnDark,
    fontSize: FontSize.title,
    fontFamily: Fonts.bold,
    letterSpacing: 1,
  },
  tagline: {
    color: Colors.textOnDark,
    fontSize: FontSize.small,
    fontFamily: Fonts.regular,
    opacity: 0.6,
    marginTop: Spacing.xs / 2,
  },
  carouselContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carousel: {
    alignSelf: 'center',
  },
  carouselItem: {
    flex: 1,
    borderRadius: Spacing.md,
    marginHorizontal: Spacing.xs / 2,
    overflow: 'hidden',
  },
  paginationDot: {
    width: Spacing.xs,
    height: Spacing.xs,
    borderRadius: 4,
    backgroundColor: Colors.dividerDark,
  },
  paginationActiveDot: {
    width: Spacing.xs,
    height: Spacing.xs,
    borderRadius: 4,
    backgroundColor: Colors.light,
    overflow: 'hidden',
  },
  paginationContainer: {
    gap: 6,
    marginTop: Spacing.sm,
  },
  bottomSection: {
    width: '100%',
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
  },
  appleButton: {
    width: '100%',
    height: Btn.height,
    marginBottom: Spacing.xs,
  },
  googleButton: {
    width: '100%',
    height: Btn.height,
    backgroundColor: _btn.bg,
    borderRadius: Btn.borderRadius,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  googleButtonText: {
    color: _btn.text,
    fontSize: FontSize.normal,
    fontFamily: Fonts.bold,
  },
  termsText: {
    color: Colors.textOnDark,
    fontSize: FontSize.small,
    fontFamily: Fonts.regular,
    textAlign: 'center',
    lineHeight: 18,
    opacity: 0.5,
  },
  termsLink: {
    color: Colors.textOnDark,
    fontSize: FontSize.small,
    fontFamily: Fonts.bold,
    textDecorationLine: 'underline',
    opacity: 1,
  },
});
