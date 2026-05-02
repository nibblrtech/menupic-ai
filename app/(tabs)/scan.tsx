import { Ionicons } from "@expo/vector-icons";
import TextRecognition, {
    TextBlock,
    TextRecognitionResult,
    TextRecognitionScript,
} from "@react-native-ml-kit/text-recognition";
import { useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import RevenueCatUI from 'react-native-purchases-ui';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
    Camera,
    PhotoFile,
    useCameraDevice,
    useCameraPermission,
} from "react-native-vision-camera";
import FreezeZoomOverlay from "../../components/FreezeZoomOverlay";
import { MenuInteractionOverlay } from "../../components/MenuInteractionOverlay";
import { Colors, Fonts, FontSize, Spacing } from "../../constants/DesignSystem";
import { useAuth } from "../../contexts/AuthContext";
import { useProfile } from "../../contexts/ProfileContext";
import { useSubscription } from "../../contexts/SubscriptionContext";

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}

const OCR_INTERVAL_MS = 1000;

// Transform ML Kit bounding-box coordinates into display space.
//
// Platform differences:
// - iOS: Photos are captured in landscape orientation internally (raw sensor pixels).
//   ML Kit processes raw pixels, so coordinates need to be rotated based on orientation.
// - Android: takeSnapshot captures in current preview orientation, coordinates align with display.
function transformCoordinates(
  frame: { left: number; top: number; width: number; height: number },
  photo: PhotoFile,
  displayWidth: number,
  displayHeight: number,
): { x: number; y: number; width: number; height: number } {
  const photoWidth = photo.width;
  const photoHeight = photo.height;
  const orientation = photo.orientation;

  // Android: ML Kit reads EXIF orientation and returns coordinates in display space.
  // photo.width/height are raw sensor dimensions, so we need to handle the mismatch.
  if (Platform.OS === 'android') {
    const isDisplayPortrait = displayHeight > displayWidth;
    const isPhotoPortrait = photoHeight > photoWidth;

    if (isDisplayPortrait === isPhotoPortrait) {
      const scaleX = displayWidth / photoWidth;
      const scaleY = displayHeight / photoHeight;
      return {
        x: frame.left * scaleX,
        y: frame.top * scaleY,
        width: frame.width * scaleX,
        height: frame.height * scaleY,
      };
    }

    const scaleX = displayWidth / photoHeight;
    const scaleY = displayHeight / photoWidth;
    return {
      x: frame.top * scaleX,
      y: (photoWidth - frame.left - frame.width) * scaleY,
      width: frame.height * scaleX,
      height: frame.width * scaleY,
    };
  }

  // iOS: photo.width/height are raw sensor dimensions.
  // ML Kit processes raw pixels without applying EXIF rotation.
  // We rotate and scale coordinates based on the device orientation.
  const isDisplayLandscape = displayWidth > displayHeight;
  const isPhotoLandscape = photoWidth > photoHeight;

  let transformedLeft: number;
  let transformedTop: number;
  let transformedWidth: number;
  let transformedHeight: number;
  let effectiveWidth: number;
  let effectiveHeight: number;

  switch (orientation) {
    case 'landscape-left':
      if (isDisplayLandscape) {
        transformedLeft = frame.left;
        transformedTop = frame.top;
        transformedWidth = frame.width;
        transformedHeight = frame.height;
        effectiveWidth = photoWidth;
        effectiveHeight = photoHeight;
      } else {
        // Rotate 90° CCW to portrait
        transformedLeft = frame.top;
        transformedTop = photoWidth - frame.left - frame.width;
        transformedWidth = frame.height;
        transformedHeight = frame.width;
        effectiveWidth = photoHeight;
        effectiveHeight = photoWidth;
      }
      break;

    case 'landscape-right':
      if (isDisplayLandscape) {
        transformedLeft = frame.left;
        transformedTop = frame.top;
        transformedWidth = frame.width;
        transformedHeight = frame.height;
        effectiveWidth = photoWidth;
        effectiveHeight = photoHeight;
      } else {
        // Rotate 90° CW to portrait
        transformedLeft = photoHeight - frame.top - frame.height;
        transformedTop = frame.left;
        transformedWidth = frame.height;
        transformedHeight = frame.width;
        effectiveWidth = photoHeight;
        effectiveHeight = photoWidth;
      }
      break;

    case 'portrait-upside-down':
      if (isPhotoLandscape && !isDisplayLandscape) {
        // iOS reports portrait-upside-down when tilting toward landscape-right
        // (home button moving to the left). Treat identically to landscape-right:
        // rotate 90° CW — no swap/remap needed downstream.
        transformedLeft = photoHeight - frame.top - frame.height;
        transformedTop = frame.left;
        transformedWidth = frame.height;
        transformedHeight = frame.width;
        effectiveWidth = photoHeight;
        effectiveHeight = photoWidth;
      } else {
        // True portrait-upside-down: flip 180°
        transformedLeft = photoWidth - frame.left - frame.width;
        transformedTop = photoHeight - frame.top - frame.height;
        transformedWidth = frame.width;
        transformedHeight = frame.height;
        effectiveWidth = photoWidth;
        effectiveHeight = photoHeight;
      }
      break;

    case 'portrait':
    default:
      if (isPhotoLandscape && !isDisplayLandscape) {
        // Raw sensor is landscape, device orientation is portrait: direct mapping.
        transformedLeft = frame.left;
        transformedTop = frame.top;
        transformedWidth = frame.width;
        transformedHeight = frame.height;
        effectiveWidth = photoWidth;
        effectiveHeight = photoHeight;
      } else if (isDisplayLandscape && !isPhotoLandscape) {
        // Rotate 90° CW for portrait photo in landscape display
        transformedLeft = photoHeight - frame.top - frame.height;
        transformedTop = frame.left;
        transformedWidth = frame.height;
        transformedHeight = frame.width;
        effectiveWidth = photoHeight;
        effectiveHeight = photoWidth;
      } else {
        // Same orientation: direct mapping
        transformedLeft = frame.left;
        transformedTop = frame.top;
        transformedWidth = frame.width;
        transformedHeight = frame.height;
        effectiveWidth = photoWidth;
        effectiveHeight = photoHeight;
      }
      break;
  }

  // For portrait with landscape raw sensor in portrait display,
  // swap display dimensions to match the landscape coordinate space.
  // (portrait-upside-down+landscape is handled like landscape-right — no swap needed.)
  let actualDisplayWidth = displayWidth;
  let actualDisplayHeight = displayHeight;
  if (orientation === 'portrait' && isPhotoLandscape && !isDisplayLandscape) {
    actualDisplayWidth = displayHeight;
    actualDisplayHeight = displayWidth;
  }

  const photoAspect = effectiveWidth / effectiveHeight;
  const displayAspect = actualDisplayWidth / actualDisplayHeight;

  let cropOffsetX = 0;
  let cropOffsetY = 0;
  let visibleWidth = effectiveWidth;
  let visibleHeight = effectiveHeight;

  if (photoAspect > displayAspect) {
    visibleWidth = effectiveHeight * displayAspect;
    cropOffsetX = (effectiveWidth - visibleWidth) / 2;
  } else if (photoAspect < displayAspect) {
    visibleHeight = effectiveWidth / displayAspect;
    cropOffsetY = (effectiveHeight - visibleHeight) / 2;
  }

  const scaleX = actualDisplayWidth / visibleWidth;
  const scaleY = actualDisplayHeight / visibleHeight;

  let finalX = (transformedLeft - cropOffsetX) * scaleX;
  let finalY = (transformedTop - cropOffsetY) * scaleY;
  let finalWidth = transformedWidth * scaleX;
  let finalHeight = transformedHeight * scaleY;

  // Map landscape-space coordinates back to portrait display space.
  // Only for portrait + landscape raw sensor in portrait display.
  // (portrait-upside-down+landscape uses the landscape-right path — no remap needed.)
  if (orientation === 'portrait' && isPhotoLandscape && !isDisplayLandscape) {
    const oldX = finalX;
    const oldY = finalY;
    const oldW = finalWidth;
    const oldH = finalHeight;
    finalX = displayWidth - oldY - oldH;
    finalY = oldX;
    finalWidth = oldH;
    finalHeight = oldW;
  }

  return { x: finalX, y: finalY, width: finalWidth, height: finalHeight };
}

// Run OCR for every supported script sequentially and return all blocks merged
// into a single result object, so callers can treat it as one recognition call.
const ALL_SCRIPTS = [
  TextRecognitionScript.LATIN,
  TextRecognitionScript.CHINESE,
  TextRecognitionScript.JAPANESE,
  TextRecognitionScript.KOREAN,
  TextRecognitionScript.DEVANAGARI,
];

async function recognizeAllScripts(imagePath: string): Promise<{ blocks: TextBlock[] }> {
  const allBlocks: TextBlock[] = [];
  for (const script of ALL_SCRIPTS) {
    try {
      const result: TextRecognitionResult = await TextRecognition.recognize(imagePath, script);
      allBlocks.push(...result.blocks);
    } catch (err) {
      console.log(`[OCR] Script ${script} failed:`, err);
    }
  }
  return { blocks: allBlocks };
}

export default function ScanScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const insets = useSafeAreaInsets();
  const device = useCameraDevice("back");
  const cameraRef = useRef<Camera>(null);
  const overlayRef = useRef<any>(null);
  const isFocused = useIsFocused();

  const { mode } = useAuth();

  // ── Paywall gate ──
  const {
    needsPaywall,
    isLoading: subLoading,
    menuPicOffering,
    creditProductPurchase,
    refreshStatus,
  } = useSubscription();
  const { profile, isLoading: profileLoading } = useProfile();

  // All hooks must be called unconditionally (Rules of Hooks)
  const [boundingBoxes, setBoundingBoxes] = useState<BoundingBox[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraLayout, setCameraLayout] = useState({ width: 0, height: 0 });
  const [status, setStatus] = useState<'idle' | 'identifying' | 'generating-image' | 'complete' | 'image-error'>('idle');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');

  // ── Freeze-zoom state ──────────────────────────────────────────────────────
  const [isFrozen, setIsFrozen] = useState(false);
  const [frozenPhotoUri, setFrozenPhotoUri] = useState<string | null>(null);
  const [frozenPhotoOrientation, setFrozenPhotoOrientation] = useState<string | undefined>(undefined);
  const [frozenBoxes, setFrozenBoxes] = useState<BoundingBox[]>([]);
  const isFreezing = useRef(false);

  // Incrementing this key forces the OCR polling loop to fully tear down and
  // restart — equivalent to navigating away and back to the scan tab.
  const [ocrKey, setOcrKey] = useState(0);

  // Called by MenuInteractionOverlay when the results modal is dismissed.
  // Fully resets all scan/freeze state and force-restarts the OCR loop so the
  // camera is guaranteed to resume scanning immediately.
  const handleResultClose = useCallback(() => {
    overlayRef.current?.cancelCurrentOperation?.();
    setIsFrozen(false);
    setFrozenPhotoUri(null);
    setFrozenPhotoOrientation(undefined);
    setFrozenBoxes([]);
    setBoundingBoxes([]);
    isFreezing.current = false;
    // Bump the key to force the OCR useEffect to re-run from scratch.
    setOcrKey(k => k + 1);
  }, []);

  // Pause camera when app is backgrounded
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
    });
    return () => sub.remove();
  }, []);

  // Trigger the OS native camera permission prompt only when the user definitively has
  // scans (i.e. paywall won't appear). Watching profile.scans directly avoids firing
  // during the 800 ms debounce window before the paywall shows up.
  useEffect(() => {
    const hasScans = (profile?.scans ?? 0) > 0;
    if (hasScans && !hasPermission) {
      requestPermission();
    }
  }, [profile?.scans, hasPermission, requestPermission]);

  // Edge-case: nothing to do here now that the paywall is always shown when scans === 0.

  const isActive = isFocused && appActive;

  // Use refs for values accessed in the polling loop to avoid stale closures
  const cameraLayoutRef = useRef(cameraLayout);
  const statusRef = useRef(status);
  const cancelledRef = useRef(false);
  const isFrozenRef = useRef(isFrozen);
  const ocrDebugLastLogRef = useRef(0); // timestamp of last OCR debug log

  useEffect(() => { cameraLayoutRef.current = cameraLayout; }, [cameraLayout]);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { isFrozenRef.current = isFrozen; }, [isFrozen]);

  useEffect(() => {
    if (!hasPermission || !device || !isCameraReady || !isActive) return;

    cancelledRef.current = false;

    const scheduleNext = () => {
      if (cancelledRef.current) return;
      setTimeout(runOnce, OCR_INTERVAL_MS);
    };

    const runOnce = async () => {
      if (cancelledRef.current) return;
      const layout = cameraLayoutRef.current;

      // Skip while frozen — no need to keep taking photos
      if (isFrozenRef.current) {
        scheduleNext();
        return;
      }

      // Also skip if a freeze capture is in-flight — two concurrent takePhoto calls
      // can cause a camera error on iOS.
      if (!cameraRef.current || layout.width === 0 || statusRef.current !== 'idle' || isFreezing.current) {
        scheduleNext();
        return;
      }

      try {
        setIsProcessing(true);

        const photo = Platform.OS === 'android'
          ? await cameraRef.current.takeSnapshot({ quality: 85 })
          : await cameraRef.current.takePhoto({ flash: 'off', enableShutterSound: false });

        if (cancelledRef.current) return;

        const result = await recognizeAllScripts(`file://${photo.path}`);

        if (cancelledRef.current) return;

        const rawCount = result.blocks.filter((b: TextBlock) => b.frame != null).length;
        const boxes: BoundingBox[] = result.blocks
          .filter((block: TextBlock) => block.frame != null)
          .map((block: TextBlock) => {
            const frame = block.frame!;

            const transformed = transformCoordinates(
              { left: frame.left, top: frame.top, width: frame.width, height: frame.height },
              photo,
              layout.width,
              layout.height,
            );

            return {
              ...transformed,
              text: block.text
            };
          });

        // Debug: log raw ML Kit count vs displayed count, plus out-of-bounds boxes.
        // Throttled to once per 2s so logs stay readable while scanning.
        const now = Date.now();
        if (now - ocrDebugLastLogRef.current > 2000) {
          ocrDebugLastLogRef.current = now;
          const outOfBounds = boxes.filter(
            b => b.x < 0 || b.y < 0 || b.x + b.width > layout.width || b.y + b.height > layout.height
          ).length;
          console.log(
            `[OCR] raw=${rawCount} displayed=${boxes.length} oob=${outOfBounds}` +
            ` photo=${photo.width}x${photo.height} orient=${photo.orientation}` +
            ` display=${layout.width.toFixed(0)}x${layout.height.toFixed(0)}`
          );
        }

        if (!cancelledRef.current) {
          setBoundingBoxes(boxes);
        }
      } catch (error) {
        console.log("OCR Error:", error);
      } finally {
        setIsProcessing(false);
        scheduleNext();
      }
    };

    // Kick off the first run
    scheduleNext();

    return () => {
      cancelledRef.current = true;
    };
  }, [hasPermission, device, isCameraReady, isActive, ocrKey]);

  const onCameraLayout = (event: any) => {
    const { width, height } = event.nativeEvent.layout;
    setCameraLayout({ width, height });
  };

  // ── Freeze / unfreeze helpers ─────────────────────────────────────────────
  const handleFreezeToggle = async () => {
    if (isFrozen) {
      // Return to live view — clear stale bounding boxes so the live OCR
      // loop starts fresh instead of briefly showing leftover freeze boxes.
      // Also cancel any in-flight identify/image-gen so the OCR polling guard
      // (statusRef.current !== 'idle') doesn't permanently block new OCR ticks.
      overlayRef.current?.cancelCurrentOperation?.();
      setIsFrozen(false);
      setFrozenPhotoUri(null);
      setFrozenPhotoOrientation(undefined);
      setFrozenBoxes([]);
      setBoundingBoxes([]);
      isFreezing.current = false;
      return;
    }

    if (isFreezing.current || !cameraRef.current) return;
    isFreezing.current = true;

    try {
      const photo = Platform.OS === 'android'
        ? await cameraRef.current.takeSnapshot({ quality: 85 })
        : await cameraRef.current.takePhoto({ flash: 'off', enableShutterSound: false });

      const layout = cameraLayoutRef.current;

      // Show the frozen image immediately with the current block-level boxes
      // as a placeholder so the user sees something right away.
      setFrozenBoxes([...boundingBoxes]);
      setFrozenPhotoUri(`file://${photo.path}`);
      setFrozenPhotoOrientation(photo.orientation ?? undefined);
      console.log(`[Freeze] photo ${photo.width}x${photo.height} orientation=${photo.orientation} display=${layout.width}x${layout.height}`);
      setIsFrozen(true);

      // Re-run OCR on the ENTIRE frozen photo to get finer, line-level boxes.
      // Using lines instead of blocks gives much better granularity when the
      // user zooms in — what was one merged paragraph block becomes individual
      // selectable lines.
      try {
        const ocrResult = await recognizeAllScripts(`file://${photo.path}`);

        const lineBoxes: BoundingBox[] = [];
        ocrResult.blocks.forEach((block: TextBlock) => {
          // Try line-level first for finer granularity
          const lines: any[] = (block as any).lines ?? [];
          if (lines.length > 0) {
            lines.forEach((line: any) => {
              if (line.frame != null) {
                const transformed = transformCoordinates(
                  { left: line.frame.left, top: line.frame.top, width: line.frame.width, height: line.frame.height },
                  photo,
                  layout.width,
                  layout.height,
                );
                lineBoxes.push({ ...transformed, text: line.text });
              }
            });
          } else if (block.frame != null) {
            // Fallback to block-level if no lines are available
            const transformed = transformCoordinates(
              { left: block.frame.left, top: block.frame.top, width: block.frame.width, height: block.frame.height },
              photo,
              layout.width,
              layout.height,
            );
            lineBoxes.push({ ...transformed, text: block.text });
          }
        });

        // Replace the block-level placeholder with the fine-grained line-level boxes
        setFrozenBoxes(lineBoxes);
      } catch (ocrErr) {
        // OCR failed after freeze — keep the block-level placeholder boxes
        console.log('[FreezeZoom] Line-level OCR error (keeping block-level fallback):', ocrErr);
      }
    } catch (e) {
      console.log('[FreezeZoom] Capture error:', e);
    } finally {
      // Always release the freeze lock so a subsequent freeze attempt is never
      // blocked. The unfreeze path also clears this, but using finally here
      // ensures it resets even on the success path.
      isFreezing.current = false;
    }
  };

  // ── Early returns (AFTER all hooks) ──

  // Show a loading indicator while subscription/profile data is loading
  if (subLoading || profileLoading) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.permissionContainer}>
          <ActivityIndicator size="large" color={Colors.textOnDark} />
        </View>
      </View>
    );
  }

  // Gate access to the scan page: show paywall when user has 0 scans.
  // Defer until the result popup is closed so the user can finish reading
  // the dish detail before being interrupted by the paywall.
  if (needsPaywall && status !== 'complete') {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.dark }}>
        <StatusBar style="light" />
        <RevenueCatUI.Paywall
          options={{
            offering: menuPicOffering ?? undefined,
            displayCloseButton: false,
          }}
          onPurchaseCompleted={({ storeTransaction }) => {
            creditProductPurchase(storeTransaction.productIdentifier);
            // Ask for camera permission immediately so the camera is ready
            // the moment the paywall unmounts.
            if (!hasPermission) {
              requestPermission();
            }
          }}
          onRestoreCompleted={() => {
            refreshStatus();
            if (!hasPermission) {
              requestPermission();
            }
          }}
        />
      </View>
    );
  }

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>No Camera Found</Text>
          <Text style={styles.permissionMessage}>
            Unable to access camera device
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text style={styles.headerText}>MenuPic AI</Text>
        <Text style={styles.headerSubtext}>
          {isFrozen
            ? 'Pinch & drag to explore'
            : boundingBoxes.length > 0
            ? `Detected ${boundingBoxes.length} text blocks`
            : 'Scanning...'}
        </Text>

        {/* Freeze / unfreeze button — upper-right of header */}
        <Pressable
          onPress={handleFreezeToggle}
          style={styles.freezeButton}
          hitSlop={8}
        >
          {isFrozen ? (
            <Ionicons name="close-circle" size={28} color={Colors.textOnDark} />
          ) : (
            // Document + magnifying-glass composite icon
            <View style={styles.freezeIconComposite}>
              <Ionicons name="document-text-outline" size={26} color={Colors.textOnDark} />
              <Ionicons
                name="search"
                size={14}
                color={Colors.textOnDark}
                style={styles.freezeIconBadge}
              />
            </View>
          )}
        </Pressable>
      </View>

      {/* Camera View with Bounding Box Overlay */}
      <View style={styles.cameraContainer} onLayout={onCameraLayout}>
        <Camera
          ref={cameraRef}
          style={styles.camera}
          device={device}
          isActive={isActive}
          photo={true}
          video={true}
          onInitialized={() => setIsCameraReady(true)}
          onError={(e) => console.log('Camera error:', e)}
        />

        <View style={styles.overlayContainer} pointerEvents="box-none">
          {boundingBoxes.map((box, index) => (
            <Pressable
              key={index}
              onPressIn={(evt) => {
                const locX = evt.nativeEvent.locationX;
                const locY = evt.nativeEvent.locationY;
                const windowX = box.x + locX;
                const windowY = box.y + locY;
                console.log('[Scan] Pressable onPressIn window coords:', { windowX, windowY, boxIndex: index });
                overlayRef.current?.identifyAtPoint(windowX, windowY);
              }}
              style={({ pressed }) => [
                styles.boundingBox,
                {
                  left: box.x,
                  top: box.y,
                  width: box.width,
                  height: box.height,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            />
          ))}
        </View>

        {/* Freeze-zoom overlay — shown instead of live camera when frozen */}
        {isFrozen && frozenPhotoUri && cameraLayout.width > 0 && (
          <FreezeZoomOverlay
            photoUri={frozenPhotoUri}
            boundingBoxes={frozenBoxes}
            containerWidth={cameraLayout.width}
            containerHeight={cameraLayout.height}
            photoOrientation={frozenPhotoOrientation}
            onBoxTap={(windowX, windowY) => {
              overlayRef.current?.identifyAtPoint(windowX, windowY);
            }}
          />
        )}

        {isProcessing && !isFrozen && (
          <View style={styles.processingIndicator}>
            <Text style={styles.processingText}>●</Text>
          </View>
        )}

        {cameraLayout.width > 0 && (
          <MenuInteractionOverlay 
            ref={overlayRef}
            status={status}
            setStatus={setStatus}
            onResultClose={handleResultClose}
            textBlocks={(isFrozen ? frozenBoxes : boundingBoxes).map(b => ({
              text: b.text,
              frame: { x: b.x, y: b.y, width: b.width, height: b.height }
            }))}
            originalImageWidth={cameraLayout.width}
            originalImageHeight={cameraLayout.height}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.dark,
  },
  permissionTitle: {
    fontSize: FontSize.normal,
    fontFamily: Fonts.bold,
    color: Colors.textOnDark,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  permissionMessage: {
    fontSize: FontSize.normal,
    fontFamily: Fonts.regular,
    color: Colors.textOnDark,
    textAlign: 'center',
    marginBottom: Spacing.md,
    opacity: 0.7,
  },
  header: {
    backgroundColor: Colors.dark,
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.dividerDark,
    position: 'relative',
  },
  freezeButton: {
    position: 'absolute',
    right: Spacing.sm,
    bottom: Spacing.sm,
    padding: 4,
  },
  freezeIconComposite: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freezeIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: -2,
  },
  headerText: {
    color: Colors.textOnDark,
    fontSize: FontSize.title,
    fontFamily: Fonts.bold,
  },
  headerSubtext: {
    color: Colors.textOnDark,
    fontSize: FontSize.small,
    fontFamily: Fonts.regular,
    marginTop: 4,
    opacity: 0.5,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  boundingBox: {
    position: 'absolute',
    backgroundColor: 'rgba(255,246,238,0.18)',
    borderRadius: 4,
    borderWidth: 2,
    borderColor: 'rgba(255,246,238,0.85)',
  },
  processingIndicator: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    backgroundColor: 'rgba(31,41,51,0.7)',
    borderRadius: Spacing.xs,
    padding: 4,
  },
  processingText: {
    color: Colors.textOnDark,
    fontSize: FontSize.small,
    fontFamily: Fonts.regular,
    opacity: 0.7,
  },
});
