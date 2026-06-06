import { Ionicons } from "@expo/vector-icons";
import TextRecognition, {
    TextBlock,
    TextRecognitionScript
} from "@react-native-ml-kit/text-recognition";
import { useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, PixelRatio, Platform, Pressable, StyleSheet, Text, View } from "react-native";
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
import { useProfile } from "../../contexts/ProfileContext";
import { useSubscription } from "../../contexts/SubscriptionContext";

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}

const OCR_INTERVAL_MS = 500;

// Transform ML Kit bounding-box coordinates into display space.
//
// The Camera uses outputOrientation="preview" so the EXIF orientation is always
// portrait, but iOS sensor pixels are always stored landscape in the JPEG file
// (photoWidth > photoHeight). ML Kit reads those raw landscape pixels and returns
// landscape-space coordinates, which must be rotated 90° into portrait display space.
//
// On Android, takeSnapshot returns portrait-oriented pixels directly, so only
// a simple cover-crop scale is needed.
//
// NOTE: We branch on Platform.OS — NOT on photo.width > photo.height — because some
// Android devices can return landscape-dimensioned snapshots, which would otherwise
// incorrectly trigger the iOS rotation path.
let _lastTransformLogMs = 0;

function transformCoordinates(
  frame: { left: number; top: number; width: number; height: number },
  photo: PhotoFile,
  displayWidth: number,
  displayHeight: number,
): { x: number; y: number; width: number; height: number } {
  const photoWidth = photo.width;
  const photoHeight = photo.height;

  if (Platform.OS === 'ios') {
    // iOS: raw sensor pixels are landscape (photoWidth > photoHeight).
    // Map ML Kit landscape coords to portrait display space.
    //   landscape display "width"  = displayHeight  (portrait height)
    //   landscape display "height" = displayWidth   (portrait width)
    const lsDisplayW = displayHeight;
    const lsDisplayH = displayWidth;

    const photoAspect = photoWidth / photoHeight;
    const displayAspect = lsDisplayW / lsDisplayH;

    let cropOffsetX = 0;
    let cropOffsetY = 0;
    let visibleWidth = photoWidth;
    let visibleHeight = photoHeight;

    if (photoAspect > displayAspect) {
      visibleWidth = photoHeight * displayAspect;
      cropOffsetX = (photoWidth - visibleWidth) / 2;
    } else if (photoAspect < displayAspect) {
      visibleHeight = photoWidth / displayAspect;
      cropOffsetY = (photoHeight - visibleHeight) / 2;
    }

    const scaleX = lsDisplayW / visibleWidth;
    const scaleY = lsDisplayH / visibleHeight;

    // Scale into landscape display space
    const lsX = (frame.left - cropOffsetX) * scaleX;
    const lsY = (frame.top - cropOffsetY) * scaleY;
    const lsW = frame.width * scaleX;
    const lsH = frame.height * scaleY;

    // Rotate 90° from landscape display space into portrait display space
    return {
      x: displayWidth - lsY - lsH,
      y: lsX,
      width: lsH,
      height: lsW,
    };
  }

  // Android: takeSnapshot returns portrait-oriented pixels matching the preview.
  // ML Kit returns portrait-space coordinates — simple cover-crop scale suffices.
  const photoAspect = photoWidth / photoHeight;
  const displayAspect = displayWidth / displayHeight;

  let cropOffsetX = 0;
  let cropOffsetY = 0;
  let visibleWidth = photoWidth;
  let visibleHeight = photoHeight;

  if (photoAspect > displayAspect) {
    // Photo wider than display → crop left/right edges
    visibleWidth = photoHeight * displayAspect;
    cropOffsetX = (photoWidth - visibleWidth) / 2;
  } else if (photoAspect < displayAspect) {
    // Photo taller than display → crop top/bottom edges
    visibleHeight = photoWidth / displayAspect;
    cropOffsetY = (photoHeight - visibleHeight) / 2;
  }

  const scaleX = displayWidth / visibleWidth;
  const scaleY = displayHeight / visibleHeight;

  const result = {
    x: (frame.left - cropOffsetX) * scaleX,
    y: (frame.top - cropOffsetY) * scaleY,
    width: frame.width * scaleX,
    height: frame.height * scaleY,
  };

  if (__DEV__) {
    const now = Date.now();
    if (now - _lastTransformLogMs > 2000) {
      _lastTransformLogMs = now;
      const density = PixelRatio.get();
      // Center-point sanity check: photo center should map to display center.
      const centerX = ((photoWidth / 2) - cropOffsetX) * scaleX;
      const centerY = ((photoHeight / 2) - cropOffsetY) * scaleY;
      // dp-equivalent photo size — if this matches displayWidth/displayHeight the
      // scale factors would be ~1 and boxes would be in dp already (wrong assumption).
      const photoWidthDp  = photoWidth  / density;
      const photoHeightDp = photoHeight / density;
      console.log(
        `[Transform/Android] ===== STEP-BY-STEP =====\n` +
        `  density=${density.toFixed(3)}\n` +
        `  photo_px=${photoWidth}x${photoHeight}\n` +
        `  photo_dp=${photoWidthDp.toFixed(1)}x${photoHeightDp.toFixed(1)} (photo_px/density)\n` +
        `  display_dp=${displayWidth.toFixed(1)}x${displayHeight.toFixed(1)}\n` +
        `  photoAspect=${photoAspect.toFixed(4)}  displayAspect=${displayAspect.toFixed(4)}\n` +
        `  cropOffsetX_px=${cropOffsetX.toFixed(1)}  cropOffsetY_px=${cropOffsetY.toFixed(1)}\n` +
        `  visibleW_px=${visibleWidth.toFixed(1)}  visibleH_px=${visibleHeight.toFixed(1)}\n` +
        `  scaleX(px->dp)=${scaleX.toFixed(6)}  scaleY(px->dp)=${scaleY.toFixed(6)}\n` +
        `  [sanity] scaleX*density=${(scaleX*density).toFixed(4)} (expect ~1 if photo fills display)\n` +
        `  raw_frame=(left=${frame.left.toFixed(0)},top=${frame.top.toFixed(0)},w=${frame.width.toFixed(0)},h=${frame.height.toFixed(0)})\n` +
        `  result_dp=(x=${result.x.toFixed(1)},y=${result.y.toFixed(1)},w=${result.width.toFixed(1)},h=${result.height.toFixed(1)})\n` +
        `  CENTER_CHECK dp=(${centerX.toFixed(1)},${centerY.toFixed(1)}) expected=(${(displayWidth/2).toFixed(1)},${(displayHeight/2).toFixed(1)})\n` +
        `  [hint] if CENTER_CHECK y >> expected y, boxes are shifted DOWN`
      );
    }
  }

  return result;
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

async function recognizeAllScripts(
  imagePath: string,
  scripts: TextRecognitionScript[] = ALL_SCRIPTS,
): Promise<{ blocks: TextBlock[]; producingScripts: TextRecognitionScript[] }> {
  // Run the requested script models in parallel.
  const results = await Promise.allSettled(
    scripts.map(script => TextRecognition.recognize(imagePath, script))
  );
  const allBlocks: TextBlock[] = [];
  const producingScripts: TextRecognitionScript[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      if (result.value.blocks.length > 0) producingScripts.push(scripts[i]);
      allBlocks.push(...result.value.blocks);
    } else {
      console.log('[OCR] Script failed:', result.reason);
    }
  }
  return { blocks: allBlocks, producingScripts };
}

function buildTextKey(boxes: BoundingBox[]): string {
  return boxes.map(b => b.text.trim()).sort().join('\0');
}

function shouldUpdateBoxes(prev: BoundingBox[], next: BoundingBox[]): boolean {
  if (prev.length !== next.length) return true;
  if (prev.length === 0) return false;

  if (buildTextKey(prev) !== buildTextKey(next)) return true;

  // Same text content: still allow coordinate correction if movement is meaningful.
  // This fixes the "settling" behavior where early scans are mispositioned.
  let totalDelta = 0;
  const count = Math.min(prev.length, next.length);
  for (let i = 0; i < count; i++) {
    const dx = Math.abs(prev[i].x - next[i].x);
    const dy = Math.abs(prev[i].y - next[i].y);
    const dw = Math.abs(prev[i].width - next[i].width);
    const dh = Math.abs(prev[i].height - next[i].height);
    totalDelta += dx + dy + dw + dh;
  }

  const avgDelta = totalDelta / (count * 4);
  return avgDelta > 1.25;
}

export default function ScanScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const insets = useSafeAreaInsets();
  const device = useCameraDevice("back");
  const cameraRef = useRef<Camera>(null);
  const overlayRef = useRef<any>(null);
  const isFocused = useIsFocused();

  // ── Paywall gate ──
  const {
    needsPaywall,
    isLoading: subLoading,
    presentPaywall,
  } = useSubscription();
  const { profile, isLoading: profileLoading } = useProfile();

  // All hooks must be called unconditionally (Rules of Hooks)
  const [boundingBoxes, setBoundingBoxes] = useState<BoundingBox[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraLayout, setCameraLayout] = useState({ width: 0, height: 0 });
  const [status, setStatus] = useState<'idle' | 'identifying' | 'generating-image' | 'complete' | 'image-error'>('idle');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [isOpeningPaywall, setIsOpeningPaywall] = useState(false);
  const paywallInFlightRef = useRef(false);

  // ── Freeze-zoom state ──────────────────────────────────────────────────────
  const [isFrozen, setIsFrozen] = useState(false);
  const [frozenPhotoUri, setFrozenPhotoUri] = useState<string | null>(null);
  const [frozenBoxes, setFrozenBoxes] = useState<BoundingBox[]>([]);
  const isFreezing = useRef(false);
  const cameraContainerRef = useRef<any>(null);

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

  const openRevenueCatPaywall = useCallback(async () => {
    if (paywallInFlightRef.current) return;

    paywallInFlightRef.current = true;
    setIsOpeningPaywall(true);

    try {
      await presentPaywall();
    } finally {
      setIsOpeningPaywall(false);
      paywallInFlightRef.current = false;
    }
  }, [presentPaywall]);

  // Ensure the scan gate actually uses the RevenueCat paywall when scans are depleted.
  useEffect(() => {
    if (!needsPaywall) return;
    if (subLoading || profileLoading) return;
    if (status === 'complete') return;
    if (!isFocused || !appActive) return;

    void openRevenueCatPaywall();
  }, [
    needsPaywall,
    subLoading,
    profileLoading,
    status,
    isFocused,
    appActive,
    openRevenueCatPaywall,
  ]);

  const isActive = isFocused && appActive;

  // Use refs for values accessed in the polling loop to avoid stale closures
  const cameraLayoutRef = useRef(cameraLayout);
  const statusRef = useRef(status);
  const cancelledRef = useRef(false);
  const isFrozenRef = useRef(isFrozen);
  const ocrDebugLastLogRef = useRef(0); // timestamp of last OCR debug log
  // Keep previous boxes so we can skip tiny redraw noise but still accept
  // meaningful coordinate corrections from subsequent scans.
  const lastBoxesRef = useRef<BoundingBox[]>([]);
  // Adaptive script selection: after probing all scripts, only run the ones
  // that actually returned blocks for this menu. null = not yet probed.
  const activeScriptsRef = useRef<TextRecognitionScript[] | null>(null);
  // How many live OCR scans have run in this session (used to schedule re-probes).
  const liveOcrScanCountRef = useRef(0);
  // Re-run all scripts every N scans to catch new script types entering the frame.
  const REPROBE_INTERVAL = 10;

  useEffect(() => { cameraLayoutRef.current = cameraLayout; }, [cameraLayout]);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { isFrozenRef.current = isFrozen; }, [isFrozen]);

  useEffect(() => {
    if (!hasPermission || !device || !isCameraReady || !isActive) return;

    cancelledRef.current = false;
    // Reset adaptive state so each camera session starts with a fresh probe.
    activeScriptsRef.current = null;
    liveOcrScanCountRef.current = 0;

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

        // Determine whether to probe all scripts or use the focused subset.
        // Probe on the first scan (activeScripts===null) and every REPROBE_INTERVAL scans.
        const scanCount = liveOcrScanCountRef.current;
        const isProbing = activeScriptsRef.current === null || scanCount % REPROBE_INTERVAL === 0;
        const scriptsToRun = isProbing ? ALL_SCRIPTS : activeScriptsRef.current!;

        const result = await recognizeAllScripts(`file://${photo.path}`, scriptsToRun);
        liveOcrScanCountRef.current = scanCount + 1;

        // After a probe, lock in only the scripts that produced blocks.
        // After a focused run that finds nothing, reset so we re-probe next cycle.
        if (isProbing) {
          activeScriptsRef.current = result.producingScripts.length > 0
            ? result.producingScripts
            : null; // nothing found yet — keep probing
          if (__DEV__) console.log(`[OCR/scripts] probe → active=[${(activeScriptsRef.current ?? ALL_SCRIPTS).join(',')}]`);
        } else if (result.producingScripts.length === 0) {
          activeScriptsRef.current = null; // scene changed, re-probe next cycle
        }

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
          const density = PixelRatio.get();
          const photoToDisplayRatioX = photo.width / layout.width;
          const photoToDisplayRatioY = photo.height / layout.height;
          // First block's raw ML Kit coords and transformed coords — for offset diagnosis
          const firstRaw = result.blocks.find((b: TextBlock) => b.frame != null)?.frame;
          const firstBox = boxes[0];
          console.log(
            `[OCR] raw=${rawCount} displayed=${boxes.length} oob=${outOfBounds}` +
            ` photo=${photo.width}x${photo.height}` +
            ` display=${layout.width.toFixed(0)}x${layout.height.toFixed(0)}` +
            ` density=${density.toFixed(3)}` +
            ` photoRatio=${photoToDisplayRatioX.toFixed(3)}x${photoToDisplayRatioY.toFixed(3)}` +
            (firstRaw && firstBox
              ? ` first_raw=(${firstRaw.left.toFixed(0)},${firstRaw.top.toFixed(0)})` +
                ` first_dp=(${firstBox.x.toFixed(1)},${firstBox.y.toFixed(1)})`
              : '')
          );
          // OOB detail — shows direction and magnitude of out-of-bounds boxes
          const oobList = boxes.filter(
            b => b.x < 0 || b.y < 0 || b.x + b.width > layout.width || b.y + b.height > layout.height
          );
          if (oobList.length > 0) {
            const sample = oobList.slice(0, 4);
            console.log(
              `[OCR/OOB-detail] ${oobList.length} oob — sample:` +
              sample.map(b =>
                ` (x=${b.x.toFixed(0)},y=${b.y.toFixed(0)},r=${(b.x+b.width).toFixed(0)},bot=${(b.y+b.height).toFixed(0)})`
              ).join('')
            );
          }
        }

        if (!cancelledRef.current) {
          if (shouldUpdateBoxes(lastBoxesRef.current, boxes)) {
            lastBoxesRef.current = boxes;
            setBoundingBoxes(boxes);
          }
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
    console.log(`[CameraLayout] ${width.toFixed(1)}x${height.toFixed(1)} density=${PixelRatio.get().toFixed(3)} platform=${Platform.OS}`);
    setCameraLayout({ width, height });
    // Measure absolute on-screen position — detects unexpected header/inset offsets
    cameraContainerRef.current?.measureInWindow((x: number, y: number, w: number, h: number) => {
      console.log(
        `[CameraContainer/pos] abs=(${x.toFixed(1)},${y.toFixed(1)}) size=${w.toFixed(1)}x${h.toFixed(1)}` +
        ` insets=(top=${insets.top},bot=${insets.bottom},left=${insets.left},right=${insets.right})`
      );
    });
  };

  // ── Freeze / unfreeze helpers ─────────────────────────────────────────────
  const handleFreezeToggle = async () => {
    console.log(`[FreezeToggle] pressed — isFrozen=${isFrozen} platform=${Platform.OS}`);
    if (isFrozen) {
      // Return to live view — clear stale bounding boxes so the live OCR
      // loop starts fresh instead of briefly showing leftover freeze boxes.
      // Also cancel any in-flight identify/image-gen so the OCR polling guard
      // (statusRef.current !== 'idle') doesn't permanently block new OCR ticks.
      overlayRef.current?.cancelCurrentOperation?.();
      setIsFrozen(false);
      setFrozenPhotoUri(null);
      setFrozenBoxes([]);
      setBoundingBoxes([]);
      isFreezing.current = false;
      return;
    }

    if (isFreezing.current || !cameraRef.current) return;
    isFreezing.current = true;

    try {
      const photo = Platform.OS === 'android'
        ? await cameraRef.current.takeSnapshot({ quality: 100 })
        : await cameraRef.current.takePhoto({ flash: 'off', enableShutterSound: false });

      const layout = cameraLayoutRef.current;

      // Show the frozen image immediately, but do not reuse live boxes from a
      // different frame. Those stale boxes are a major source of apparent
      // misalignment in zoom mode until fresh OCR lands.
      setFrozenBoxes([]);
      setFrozenPhotoUri(`file://${photo.path}`);
      console.log(`[Freeze] photo ${photo.width}x${photo.height} display=${layout.width}x${layout.height}`);
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

        if (__DEV__ && lineBoxes.length > 0) {
          // Find the first line with a valid raw frame for comparison
          let firstRawLine: any = null;
          outer: for (const block of ocrResult.blocks) {
            for (const line of ((block as any).lines ?? [])) {
              if (line.frame != null) { firstRawLine = line; break outer; }
            }
          }
          console.log(
            `[Freeze OCR] ${lineBoxes.length} boxes` +
            ` photo=${photo.width}x${photo.height}` +
            ` display=${layout.width.toFixed(0)}x${layout.height.toFixed(0)}` +
            ` density=${PixelRatio.get().toFixed(3)}` +
            (firstRawLine
              ? ` first_raw=(${firstRawLine.frame.left.toFixed(0)},${firstRawLine.frame.top.toFixed(0)})` +
                ` first_dp=(${lineBoxes[0].x.toFixed(1)},${lineBoxes[0].y.toFixed(1)})`
              : '')
          );
        }
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

  // Gate access to the scan page: RevenueCat paywall is the primary purchase flow
  // when user scans are depleted. Keep this fallback view so users can re-open
  // the paywall if they dismiss it without purchasing.
  if (needsPaywall && status !== 'complete') {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.dark }}>
        <StatusBar style="light" />
        <View style={styles.paywallGateContainer}>
          <Text style={styles.headerText}>MenuPic AI</Text>
          <Text style={[styles.headerSubtext, { marginBottom: Spacing.md, opacity: 0.65 }]}>
            Get scan credits to start identifying dishes
          </Text>
          <Pressable
            onPress={openRevenueCatPaywall}
            disabled={isOpeningPaywall}
            style={({ pressed }) => [
              styles.paywallGateButton,
              isOpeningPaywall && styles.paywallGateButtonDisabled,
              pressed && !isOpeningPaywall ? { opacity: 0.75 } : null,
            ]}
          >
            {isOpeningPaywall ? (
              <ActivityIndicator size="small" color={Colors.textOnLight} />
            ) : (
              <Text style={styles.paywallGateButtonText}>Open Paywall</Text>
            )}
          </Pressable>
        </View>
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

      {/* Camera View with Bounding Box Overlay — fills all available space */}
      <View style={styles.cameraContainer} onLayout={onCameraLayout} ref={cameraContainerRef}>
        <Camera
          ref={cameraRef}
          style={styles.camera}
          device={device}
          isActive={isActive}
          photo={true}
          outputOrientation="preview"
          onInitialized={() => setIsCameraReady(true)}
          onError={(e) => console.log('Camera error:', e)}
          onLayout={(e) => {
            if (__DEV__) {
              const { width, height, x, y } = e.nativeEvent.layout;
              console.log(`[Camera onLayout] ${width.toFixed(2)}x${height.toFixed(2)} at (${x.toFixed(2)},${y.toFixed(2)}) container=${cameraLayout.width.toFixed(2)}x${cameraLayout.height.toFixed(2)}`);
            }
          }}
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

        {/* Header overlaid at the top of the camera — keeps cameraContainer full-height
            so the camera preview and overlay share the same coordinate origin */}
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
  paywallGateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  paywallGateButton: {
    minWidth: 180,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.light,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  paywallGateButtonDisabled: {
    opacity: 0.7,
  },
  paywallGateButtonText: {
    color: Colors.textOnLight,
    fontSize: FontSize.normal,
    fontFamily: Fonts.bold,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.dark,
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.dividerDark,
    zIndex: 20,
    elevation: 20,
  },
  freezeButton: {
    position: 'absolute',
    right: Spacing.sm,
    bottom: Spacing.sm,
    padding: 4,
    zIndex: 10,
    elevation: 10,
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
