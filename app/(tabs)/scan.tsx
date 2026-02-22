import TextRecognition, {
    TextBlock,
    TextRecognitionResult,
} from "@react-native-ml-kit/text-recognition";
import { useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { AppState, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
    Camera,
    PhotoFile,
    useCameraDevice,
    useCameraPermission,
} from "react-native-vision-camera";
import { MenuInteractionOverlay } from "../../components/MenuInteractionOverlay";
import { Button as Btn, buttonColors, Colors, Fonts, FontSize, Spacing } from "../../constants/DesignSystem";

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}

const OCR_INTERVAL_MS = 500;

// Helper function to transform ML Kit coordinates based on photo orientation and platform
// 
// Platform differences:
// - iOS: Photos are captured in landscape orientation internally (raw sensor pixels).
//   ML Kit processes raw pixels, so coordinates need to be rotated based on orientation.
// - Android: takeSnapshot captures in current preview orientation, coordinates align with display.
//
function transformCoordinates(
  frame: { left: number; top: number; width: number; height: number },
  photo: PhotoFile,
  displayWidth: number,
  displayHeight: number,
  isFirstBlock: boolean = false
): { x: number; y: number; width: number; height: number } {
  const photoWidth = photo.width;
  const photoHeight = photo.height;
  const orientation = photo.orientation;

  // On Android, ML Kit's InputImage.fromFilePath() automatically reads EXIF orientation
  // and returns bounding box coordinates relative to the DISPLAY-oriented image.
  // However, photo.width and photo.height are raw sensor dimensions.
  if (Platform.OS === 'android') {
    // Determine if we're in portrait or landscape display mode
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
    
    const effectivePhotoWidth = photoHeight;
    const effectivePhotoHeight = photoWidth;
    
    const scaleX = displayWidth / effectivePhotoWidth;
    const scaleY = displayHeight / effectivePhotoHeight;
    
    const rotatedLeft = frame.top;
    const rotatedTop = photoWidth - frame.left - frame.width;

    return {
      x: rotatedLeft * scaleX,
      y: rotatedTop * scaleY,
      width: frame.height * scaleX,
      height: frame.width * scaleY,
    };
  }

  const isDisplayLandscape = displayWidth > displayHeight;
  
  if (isFirstBlock) {
    console.log(`[iOS Transform] =============================================`);
    console.log(`[iOS Transform] INPUTS:`);
    console.log(`[iOS Transform] Photo: ${photoWidth}x${photoHeight} (${orientation})`);
    console.log(`[iOS Transform] Display: ${displayWidth}x${displayHeight} (Landscape: ${isDisplayLandscape})`);
    console.log(`[iOS Transform] Frame: x=${frame.left}, y=${frame.top}, w=${frame.width}, h=${frame.height}`);
  }

  let transformedLeft: number;
  let transformedTop: number;
  let transformedWidth: number;
  let transformedHeight: number;
  let effectiveWidth: number;
  let effectiveHeight: number;

  switch (orientation) {
    case 'landscape-left':
      if (isFirstBlock) console.log(`[iOS Transform] Processing case: landscape-left`);
    
      if (isDisplayLandscape) {
        if (isFirstBlock) console.log(`[iOS Transform] Branch: Display is Landscape -> Direct Mapping`);
        transformedLeft = frame.left;
        transformedTop = frame.top;
        transformedWidth = frame.width;
        transformedHeight = frame.height;
        effectiveWidth = photoWidth;
        effectiveHeight = photoHeight;
      } else {
        if (isFirstBlock) console.log(`[iOS Transform] Branch: Display is Portrait -> Rotate 90 CCW`);
        transformedLeft = frame.top;
        transformedTop = photoWidth - frame.left - frame.width;
        transformedWidth = frame.height;
        transformedHeight = frame.width;
        effectiveWidth = photoHeight;
        effectiveHeight = photoWidth;
      }
      break;

    case 'landscape-right':
      if (isFirstBlock) console.log(`[iOS Transform] Processing case: landscape-right`);
      
      if (isDisplayLandscape) {
        if (isFirstBlock) console.log(`[iOS Transform] Branch: Display is Landscape -> Direct Mapping`);
        transformedLeft = frame.left;
        transformedTop = frame.top;
        transformedWidth = frame.width;
        transformedHeight = frame.height;
        effectiveWidth = photoWidth;
        effectiveHeight = photoHeight;
      } else {
        if (isFirstBlock) console.log(`[iOS Transform] Branch: Display is Portrait -> Rotate 90 CW`);
        transformedLeft = photoHeight - frame.top - frame.height;
        transformedTop = frame.left;
        transformedWidth = frame.height;
        transformedHeight = frame.width;
        effectiveWidth = photoHeight;
        effectiveHeight = photoWidth;
      }
      break;

    case 'portrait':
      if (isFirstBlock) console.log(`[iOS Transform] Processing case: portrait`);
      const isPhotoLandscape = photoWidth > photoHeight;
      
      if (isPhotoLandscape && !isDisplayLandscape) {
        if (isFirstBlock) console.log(`[iOS Transform] Branch: Photo Landscape & Display Portrait -> Device likely Landscape -> Direct Mapping`);
        transformedLeft = frame.left;
        transformedTop = frame.top;
        transformedWidth = frame.width;
        transformedHeight = frame.height;
        effectiveWidth = photoWidth;
        effectiveHeight = photoHeight;
      } else if (isDisplayLandscape) {
        if (isFirstBlock) console.log(`[iOS Transform] Branch: Display is Landscape`);
        if (isPhotoLandscape) {
          if (isFirstBlock) console.log(`[iOS Transform] Sub-Branch: Photo is also Landscape -> Direct Mapping`);
          transformedLeft = frame.left;
          transformedTop = frame.top;
          transformedWidth = frame.width;
          transformedHeight = frame.height;
          effectiveWidth = photoWidth;
          effectiveHeight = photoHeight;
        } else {
          if (isFirstBlock) console.log(`[iOS Transform] Sub-Branch: Photo is Portrait -> Rotate 90 CW`);
          transformedLeft = photoHeight - frame.top - frame.height;
          transformedTop = frame.left;
          transformedWidth = frame.height;
          transformedHeight = frame.width;
          effectiveWidth = photoHeight;
          effectiveHeight = photoWidth;
        }
      } else {
        if (isFirstBlock) console.log(`[iOS Transform] Branch: Standard Portrait -> No Rotation`);
        transformedLeft = frame.left;
        transformedTop = frame.top;
        transformedWidth = frame.width;
        transformedHeight = frame.height;
        effectiveWidth = photoWidth;
        effectiveHeight = photoHeight;
      }
      break;

    case 'portrait-upside-down':
      if (isFirstBlock) console.log(`[iOS Transform] Processing case: portrait-upside-down`);
      
      if (isDisplayLandscape) {
         transformedLeft = photoWidth - frame.left - frame.width;
         transformedTop = photoHeight - frame.top - frame.height;
         transformedWidth = frame.width;
         transformedHeight = frame.height;
         effectiveWidth = photoWidth;
         effectiveHeight = photoHeight;
      } else {
          transformedLeft = photoWidth - frame.left - frame.width;
          transformedTop = photoHeight - frame.top - frame.height;
          transformedWidth = frame.width;
          transformedHeight = frame.height;
          effectiveWidth = photoWidth;
          effectiveHeight = photoHeight;
      }
      break;

    default:
      if (isFirstBlock) console.log(`[iOS Transform] Processing case: DEFAULT (${orientation})`);
      transformedLeft = frame.left;
      transformedTop = frame.top;
      transformedWidth = frame.width;
      transformedHeight = frame.height;
      effectiveWidth = photoWidth;
      effectiveHeight = photoHeight;
      break;
  }

  if (isFirstBlock) {
    console.log(`[iOS Transform] POST-ROTATION State:`);
    console.log(`  Transformed Rect: x=${transformedLeft}, y=${transformedTop}, w=${transformedWidth}, h=${transformedHeight}`);
    console.log(`  Effective Dims: ${effectiveWidth}x${effectiveHeight}`);
  }

  let actualDisplayWidth = displayWidth;
  let actualDisplayHeight = displayHeight;
  const isPhotoLandscape = photoWidth > photoHeight;
  
  if ((orientation === 'portrait' || orientation === 'portrait-upside-down') && isPhotoLandscape && !isDisplayLandscape) {
    actualDisplayWidth = displayHeight;
    actualDisplayHeight = displayWidth;
    if (isFirstBlock) console.log(`[iOS] Swapped display dims for landscape device (${orientation}): ${actualDisplayWidth}x${actualDisplayHeight}`);
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
    if (isFirstBlock) console.log(`[iOS Transform] CROP: Photo wider. cropOffsetX=${cropOffsetX.toFixed(1)}`);
  } else if (photoAspect < displayAspect) {
    visibleHeight = effectiveWidth / displayAspect;
    cropOffsetY = (effectiveHeight - visibleHeight) / 2;
    if (isFirstBlock) console.log(`[iOS Transform] CROP: Photo taller. cropOffsetY=${cropOffsetY.toFixed(1)}`);
  }
  
  const scaleX = actualDisplayWidth / visibleWidth;
  const scaleY = actualDisplayHeight / visibleHeight;

  const adjustedLeft = transformedLeft - cropOffsetX;
  const adjustedTop = transformedTop - cropOffsetY;
  
  let finalX = adjustedLeft * scaleX;
  let finalY = adjustedTop * scaleY;
  let finalWidth = transformedWidth * scaleX;
  let finalHeight = transformedHeight * scaleY;

  if ((orientation === 'portrait' || orientation === 'portrait-upside-down') && isPhotoLandscape && !isDisplayLandscape) {
     if (isFirstBlock) console.log(`[iOS] Mapping Landscape coordinates back to Portrait container...`);
     const oldX = finalX;
     const oldY = finalY;
     const oldW = finalWidth;
     const oldH = finalHeight;
     
     if (orientation === 'portrait-upside-down') {
         finalX = oldY;
         finalY = displayHeight - oldX - oldW;
         finalWidth = oldH;
         finalHeight = oldW;
     } else {
        finalX = displayWidth - oldY - oldH;
        finalY = oldX;
        finalWidth = oldH;
        finalHeight = oldW;
     }

     if (isFirstBlock) console.log(`[iOS] Rotated Result: x=${finalX.toFixed(1)}, y=${finalY.toFixed(1)}`);
  }

  if (isFirstBlock) {
    console.log(`[iOS Transform] SCALING:`);
    console.log(`  ScaleX: ${scaleX.toFixed(4)}, ScaleY: ${scaleY.toFixed(4)}`);
    console.log(`  Visible Dims: ${visibleWidth.toFixed(1)}x${visibleHeight.toFixed(1)}`);
    console.log(`  Final Result: x=${finalX.toFixed(1)}, y=${finalY.toFixed(1)}, w=${finalWidth.toFixed(1)}, h=${finalHeight.toFixed(1)}`);
    console.log(`[iOS Transform] =============================================`);
  }

  return {
    x: finalX,
    y: finalY,
    width: finalWidth,
    height: finalHeight,
  };
}

export default function ScanScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const insets = useSafeAreaInsets();
  const device = useCameraDevice("back");
  const cameraRef = useRef<Camera>(null);
  const overlayRef = useRef<any>(null);
  const isFocused = useIsFocused();
  
  const [boundingBoxes, setBoundingBoxes] = useState<BoundingBox[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraLayout, setCameraLayout] = useState({ width: 0, height: 0 });
  const [status, setStatus] = useState<'idle' | 'identifying' | 'generating-image' | 'complete' | 'image-error'>('idle');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');

  // Pause camera when app is backgrounded
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
    });
    return () => sub.remove();
  }, []);

  const isActive = isFocused && appActive;

  // Use refs for values accessed in the polling loop to avoid stale closures
  const cameraLayoutRef = useRef(cameraLayout);
  const statusRef = useRef(status);
  const cancelledRef = useRef(false);

  useEffect(() => { cameraLayoutRef.current = cameraLayout; }, [cameraLayout]);
  useEffect(() => { statusRef.current = status; }, [status]);

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

      if (!cameraRef.current || layout.width === 0 || statusRef.current !== 'idle') {
        scheduleNext();
        return;
      }

      try {
        setIsProcessing(true);

        const photo = Platform.OS === 'android'
          ? await cameraRef.current.takeSnapshot({ quality: 85 })
          : await cameraRef.current.takePhoto({ flash: 'off' });

        if (cancelledRef.current) return;

        const result: TextRecognitionResult = await TextRecognition.recognize(
          `file://${photo.path}`
        );

        if (cancelledRef.current) return;

        const boxes: BoundingBox[] = result.blocks
          .filter((block: TextBlock) => block.frame != null)
          .map((block: TextBlock) => {
            const frame = block.frame!;

            const transformed = transformCoordinates(
              { left: frame.left, top: frame.top, width: frame.width, height: frame.height },
              photo,
              layout.width,
              layout.height,
              false
            );

            return {
              ...transformed,
              text: block.text
            };
          });

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
  }, [hasPermission, device, isCameraReady, isActive]);

  const onCameraLayout = (event: any) => {
    const { width, height } = event.nativeEvent.layout;
    setCameraLayout({ width, height });
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
      </View>
    );
  }

  if (!hasPermission) {
    const _btn = buttonColors('dark');
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionMessage}>
            We need your permission to show the camera
          </Text>
          <Pressable style={styles.permissionButton} onPress={requestPermission}>
            <Text style={[styles.permissionButtonText, { color: _btn.text }]}>Grant Permission</Text>
          </Pressable>
        </View>
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
          {boundingBoxes.length > 0
            ? `Detected ${boundingBoxes.length} text blocks`
            : "Scanning..."}
        </Text>
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

        {isProcessing && (
          <View style={styles.processingIndicator}>
            <Text style={styles.processingText}>●</Text>
          </View>
        )}

        {cameraLayout.width > 0 && (
          <MenuInteractionOverlay 
            ref={overlayRef}
            status={status}
            setStatus={setStatus}
            textBlocks={boundingBoxes.map(b => ({
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

const _permBtn = buttonColors('dark');

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
  permissionButton: {
    height: Btn.height,
    borderRadius: Btn.borderRadius,
    backgroundColor: _permBtn.bg,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionButtonText: {
    fontSize: FontSize.normal,
    fontFamily: Fonts.bold,
  },
  header: {
    backgroundColor: Colors.dark,
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.xs,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.dividerDark,
  },
  headerText: {
    color: Colors.textOnDark,
    fontSize: FontSize.normal,
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
    backgroundColor: 'rgba(255,246,238,0.12)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,246,238,0.3)',
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
