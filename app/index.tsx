import { Image } from "expo-image";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useRef, useState } from "react";
import {
    Alert,
    Dimensions,
    Linking,
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
import { Button as Btn, Colors, Fonts, FontSize, Spacing } from "../constants/DesignSystem";
import { useAuth } from "../contexts/AuthContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/**
 * Three slide indices — each maps to a live-rendered "screenshot" component.
 * Adding a slide is as simple as adding an index and a case in renderCarouselItem.
 */
const SLIDES: number[] = [0, 1, 2];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { continueAsGuest, isAuthReady, resetGuestState } = useAuth();
  const logoTapCount = useRef(0);
  const logoTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const carouselRef = useRef<ICarouselInstance>(null);
  const progress = useSharedValue<number>(0);
  const [carouselContainerHeight, setCarouselContainerHeight] = useState(0);

  const handleContinueAsGuest = async () => {
    try {
      await continueAsGuest();
      router.replace("/(tabs)/scan");
    } catch (error) {
      console.error("[Auth] Continue as guest error:", error);
      Alert.alert("Try Again", "Unable to start right now. Please try again.");
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
          <Pressable
            onPress={() => {
              logoTapCount.current += 1;
              if (logoTapTimer.current) clearTimeout(logoTapTimer.current);
              if (logoTapCount.current >= 7) {
                logoTapCount.current = 0;
                resetGuestState().then(() => {
                  Alert.alert('Reset', 'Guest state cleared — back to first launch.');
                });
              } else {
                logoTapTimer.current = setTimeout(() => { logoTapCount.current = 0; }, 1500);
              }
            }}
          >
            <Image
              source={require("../assets/images/icon.png")}
              style={styles.logo}
              contentFit="contain"
            />
          </Pressable>
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

        {/* Get Started Section */}
        <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 20 }]}>
          <Pressable
            style={[styles.getStartedButton, !isAuthReady && styles.getStartedButtonDisabled]}
            onPress={handleContinueAsGuest}
            disabled={!isAuthReady}
          >
            <Text style={styles.getStartedButtonText}>
              {isAuthReady ? "Start Scanning" : "Preparing..."}
            </Text>
          </Pressable>

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
    marginTop: Spacing.md,
  },
  getStartedButton: {
    width: '100%',
    height: Btn.height,
    borderRadius: Btn.borderRadius,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.dividerDark,
    backgroundColor: 'transparent',
  },
  getStartedButtonDisabled: {
    opacity: 0.55,
  },
  getStartedButtonText: {
    color: Colors.textOnDark,
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
