import TextRecognition, {
    TextBlock,
    TextRecognitionResult,
} from "@react-native-ml-kit/text-recognition";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
    Camera,
    PhotoFile,
    useCameraDevice,
    useCameraPermission,
} from "react-native-vision-camera";
import { MenuInteractionOverlay } from "../components/MenuInteractionOverlay";

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
    
    //console.log(`[Android Transform] orientation: ${orientation}, photo: ${photoWidth}x${photoHeight}, display: ${displayWidth}x${displayHeight}, isDisplayPortrait: ${isDisplayPortrait}, isPhotoPortrait: ${isPhotoPortrait}`);
    // When using takeSnapshot, the snapshot is captured in the current preview orientation
    // ML Kit returns coordinates relative to the snapshot image
    // We need to handle the case where snapshot dimensions don't match display orientation
    
    // If display and photo orientations match, just scale directly
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
    
    // Orientations don't match - photo needs rotation to match display
    // This happens when the snapshot was captured in a different orientation than expected
    // Rotate coordinates 90° and swap dimensions
    const effectivePhotoWidth = photoHeight;
    const effectivePhotoHeight = photoWidth;
    
    const scaleX = displayWidth / effectivePhotoWidth;
    const scaleY = displayHeight / effectivePhotoHeight;
    
    // Rotate the coordinates 90° clockwise
    const rotatedLeft = frame.top;
    const rotatedTop = photoWidth - frame.left - frame.width;

    return {
      x: rotatedLeft * scaleX,
      y: rotatedTop * scaleY,
      width: frame.height * scaleX,
      height: frame.width * scaleY,
    };
  }

  // iOS with takePhoto: ML Kit processes raw sensor pixels.
  // Coordinates returned are in RAW PIXEL space, so we must rotate them
  // based on the orientation to match display space.
  
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

  // Transform raw pixel coordinates based on orientation
  switch (orientation) {
    case 'landscape-left':
      // Phone held in portrait, home button on right
      // Raw image is landscape, needs 90° CCW rotation for portrait display
      if (isFirstBlock) console.log(`[iOS Transform] Processing case: landscape-left`);
    
      if (isDisplayLandscape) {
        if (isFirstBlock) console.log(`[iOS Transform] Branch: Display is Landscape -> Direct Mapping`);
        // Device is in landscape, and display is landscape.
        // Direct mapping (no rotation needed relative to display)
        transformedLeft = frame.left;
        transformedTop = frame.top;
        transformedWidth = frame.width;
        transformedHeight = frame.height;
        effectiveWidth = photoWidth;
        effectiveHeight = photoHeight;
      } else {
        if (isFirstBlock) console.log(`[iOS Transform] Branch: Display is Portrait -> Rotate 90 CCW`);
        // Display is portrait (locked?), but device is landscape-left.
        // Needs 90° CCW rotation to fit portrait display
        transformedLeft = frame.top;
        transformedTop = photoWidth - frame.left - frame.width;
        transformedWidth = frame.height;
        transformedHeight = frame.width;
        effectiveWidth = photoHeight;
        effectiveHeight = photoWidth;
      }
      break;

    case 'landscape-right':
      // Phone held in portrait, home button on left  
      // Raw image is landscape, needs 90° CW rotation for portrait display
      if (isFirstBlock) console.log(`[iOS Transform] Processing case: landscape-right`);
      
      if (isDisplayLandscape) {
        if (isFirstBlock) console.log(`[iOS Transform] Branch: Display is Landscape -> Direct Mapping`);
        // Device is in landscape, and display is landscape.
        // Direct mapping (no rotation needed relative to display)
        // Note: Even if device is rotated 180 relative to landscape-left, 
        // the screen is also rotated 180, so image aligns with screen.
        transformedLeft = frame.left;
        transformedTop = frame.top;
        transformedWidth = frame.width;
        transformedHeight = frame.height;
        effectiveWidth = photoWidth;
        effectiveHeight = photoHeight;
      } else {
        if (isFirstBlock) console.log(`[iOS Transform] Branch: Display is Portrait -> Rotate 90 CW`);
        // Display is portrait, device is landscape-right
        // Needs 90° CW rotation
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
      // Critical: When orientation='portrait', the actual device orientation depends on photo dimensions
      // - Photo landscape (4224x2376) + display portrait (428x827) = device IS landscape
      // - Photo portrait + display portrait = device IS portrait
      const isPhotoLandscape = photoWidth > photoHeight;
      
      if (isPhotoLandscape && !isDisplayLandscape) {
        // Device is ACTUALLY in landscape (photo is landscape, display layout stuck at portrait)
        // No rotation needed - photo and device orientation match
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
          // Photo is already landscape, display is landscape - they match!
          // No rotation needed, just direct mapping
          transformedLeft = frame.left;
          transformedTop = frame.top;
          transformedWidth = frame.width;
          transformedHeight = frame.height;
          effectiveWidth = photoWidth;
          effectiveHeight = photoHeight;
        } else {
          if (isFirstBlock) console.log(`[iOS Transform] Sub-Branch: Photo is Portrait -> Rotate 90 CW`);
          // Photo is portrait, display is landscape - need 90° rotation
          transformedLeft = photoHeight - frame.top - frame.height;
          transformedTop = frame.left;
          transformedWidth = frame.height;
          transformedHeight = frame.width;
          effectiveWidth = photoHeight;
          effectiveHeight = photoWidth;
        }
      } else {
        if (isFirstBlock) console.log(`[iOS Transform] Branch: Standard Portrait -> No Rotation`);
        // Portrait display, portrait photo - no rotation needed (original behavior)
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
      // Phone held in landscape (home button on left)
      // Raw image needs 180° rotation
      
      if (isDisplayLandscape) {
         // Display matches device orientation (Landscape & Landscape)
         // Raw image needs 180 rotation
         transformedLeft = photoWidth - frame.left - frame.width;
         transformedTop = photoHeight - frame.top - frame.height;
         transformedWidth = frame.width;
         transformedHeight = frame.height;
         effectiveWidth = photoWidth;
         effectiveHeight = photoHeight;
      } else {
         // Display is Portrait, but device is Landscape (Home button Left)
         // The rotation logic for this case is tricky.
         // 'portrait-upside-down' usually means rotating 180 degrees.
         // However, if the display is stuck in Portrait, we might need a 90-degree offset?
         
         // Let's try treating it like the "portrait" case where we map directly without rotation
         // if we are swapping dimensions later.
         
         // If we rotate 180, we get a Landscape image (4224x2376).
         // If we then swap display to Landscape (827x428), we are mapping Landscape Image -> Landscape Display.
         // This *should* work if the raw coordinates are correct relative to that 180-rotated image.
         // Looking at the logs:
         // Raw Frame: x=3622, y=2210 (bottom right quadrant)
         // Rotated 180: x=95, y=96 (top left quadrant)
         // Result: x=18, y=0 (Top Left of screen)
         // If the user is seeing boxes in the wrong place, maybe the 180 rotation is WRONG for this specific
         // "Device Landscape / UI Portrait" combo.
         // If "portrait-upside-down" raw data is actually ALREADY roughly aligned with the camera sensor
         // which is aligned with the screen...?
         // HYPOTHESIS: When (Device=LandscapeLeft/Right) but (UI=Portrait), the "orientation" tag
         // might be misleading relative to how we want to display it on a "SWAPPED" screen.
         // Let's try NO ROTATION (Direct Mapping) and see if that aligns better.
         // If we don't rotate: x=3622, y=2210.
         // Scaled (0.2x): x=700, y=400. (Bottom Right).
         // Let's try 90 degree rotation?
         // Revert to standard 180 rotation for now, but verify effective dims.
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

  // When device is in landscape but layout dimensions are stuck at portrait,
  // swap display dimensions for correct aspect ratio and scaling
  let actualDisplayWidth = displayWidth;
  let actualDisplayHeight = displayHeight;
  const isPhotoLandscape = photoWidth > photoHeight;
  
  if ((orientation === 'portrait' || orientation === 'portrait-upside-down') && isPhotoLandscape && !isDisplayLandscape) {
    // Device is landscape, layout is portrait - swap dimensions
    actualDisplayWidth = displayHeight;
    actualDisplayHeight = displayWidth;
    if (isFirstBlock) console.log(`[iOS] Swapped display dims for landscape device (${orientation}): ${actualDisplayWidth}x${actualDisplayHeight}`);
  }

  // The camera preview uses "cover" mode - it crops the photo to fill the display
  // We need to account for this cropping when mapping coordinates
  const photoAspect = effectiveWidth / effectiveHeight;
  const displayAspect = actualDisplayWidth / actualDisplayHeight;
  
  let cropOffsetX = 0;
  let cropOffsetY = 0;
  let visibleWidth = effectiveWidth;
  let visibleHeight = effectiveHeight;
  
  if (photoAspect > displayAspect) {
    // Photo is wider than display - left/right edges are cropped
    visibleWidth = effectiveHeight * displayAspect;
    cropOffsetX = (effectiveWidth - visibleWidth) / 2;
    if (isFirstBlock) console.log(`[iOS Transform] CROP: Photo wider. cropOffsetX=${cropOffsetX.toFixed(1)}`);
  } else if (photoAspect < displayAspect) {
    // Photo is taller than display - top/bottom edges are cropped
    visibleHeight = effectiveWidth / displayAspect;
    cropOffsetY = (effectiveHeight - visibleHeight) / 2;
    if (isFirstBlock) console.log(`[iOS Transform] CROP: Photo taller. cropOffsetY=${cropOffsetY.toFixed(1)}`);
  }
  
  // Adjust coordinates for cropping, then scale to display
  // CRITICAL FIX: The coordinates in 'transformed' are in the "effective" coordinate space.
  // When scaling to display, we must ensure we are scaling based on the visible portion.
  
  const scaleX = actualDisplayWidth / visibleWidth;
  const scaleY = actualDisplayHeight / visibleHeight;

  // Apply the crop offset first
  const adjustedLeft = transformedLeft - cropOffsetX;
  const adjustedTop = transformedTop - cropOffsetY;
  
  let finalX = adjustedLeft * scaleX;
  let finalY = adjustedTop * scaleY;
  let finalWidth = transformedWidth * scaleX;
  let finalHeight = transformedHeight * scaleY;

  // FINAL ADJUSTMENT for Landscape-in-Portrait-UI scenarios:
  // If we swapped dimensions to calculating scaling correctly, we produced Landscape coordinates.
  // But the React Native View container is still Portrait (unrotated).
  // We need to map these coordinates back into the Portrait system.
  if ((orientation === 'portrait' || orientation === 'portrait-upside-down') && isPhotoLandscape && !isDisplayLandscape) {
     if (isFirstBlock) console.log(`[iOS] Mapping Landscape coordinates back to Portrait container...`);
     const oldX = finalX;
     const oldY = finalY;
     const oldW = finalWidth;
     const oldH = finalHeight;
     
     // The "Display" is stuck in portrait (e.g. 400x800).
     // We calculated positions for a landscape (800x400) overlay.
     // We need to rotate 90 degrees to fit.
     
     // Which way?
     // 'portrait-upside-down' (Home Left) usually means "Top" is "Right".
     // So we rotate -90 (CCW).
     // (x_new, y_new) = (y_old, displayWidth - x_old - w_old)
     
     if (orientation === 'portrait-upside-down') {
         // Home Left logic (Notch Right)
         // Physical (0,0) is User Top-Right.
         // Physical X goes DOWN. Physical Y goes LEFT.
         // Visual X (Right) -> Inverted Physical Y.
         // Visual Y (Down) -> Physical X.
         finalX = oldY;
         finalY = displayHeight - oldX - oldW;
         
         finalWidth = oldH;
         finalHeight = oldW;
     } else {
        // Home Right logic (Notch Left)
        // Physical (0,0) is User Bottom-Left.
        // Physical X goes UP. Physical Y goes RIGHT.
        // Visual X (Right) -> Physical Y.
        // Visual Y (Down) -> Inverted Physical X.
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

export default function Index() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const insets = useSafeAreaInsets();
  const device = useCameraDevice("back");
  const cameraRef = useRef<Camera>(null);
  const overlayRef = useRef<any>(null);
  
  const [boundingBoxes, setBoundingBoxes] = useState<BoundingBox[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraLayout, setCameraLayout] = useState({ width: 0, height: 0 });
  // Overlay/dialog status to pause OCR and clicks when non-idle
  const [status, setStatus] = useState<'idle' | 'identifying' | 'generating-image' | 'complete' | 'image-error'>('idle');

  // Periodic OCR processing
  const processFrame = useCallback(async () => {
    if (!cameraRef.current || isProcessing || cameraLayout.width === 0) return;
    if (status !== 'idle') return; // freeze OCR when overlay/dialog is open

    try {
      setIsProcessing(true);
      
      // Platform-specific capture:
      // - Android: takeSnapshot works well and coordinates align with preview
      // - iOS: takePhoto is required because takeSnapshot doesn't work properly in landscape for ML Kit
      const photo = Platform.OS === 'android'
        ? await cameraRef.current.takeSnapshot({ quality: 85 })
        : await cameraRef.current.takePhoto({ flash: 'off' });

      // Calculate aspect ratios for debugging
      const photoAspect = photo.height > photo.width 
        ? photo.height / photo.width 
        : photo.width / photo.height;
      const displayAspect = cameraLayout.height / cameraLayout.width;
      
      // console.log(`[${Platform.OS}] Photo: ${photo.width}x${photo.height} ...`);

      // Run ML Kit text recognition
      const result: TextRecognitionResult = await TextRecognition.recognize(
        `file://${photo.path}`
      );

      // console.log(`[${Platform.OS}] OCR found ${result.blocks.length} blocks...`);

      // Extract bounding boxes from text blocks
      const boxes: BoundingBox[] = result.blocks
        .filter((block: TextBlock) => block.frame != null)
        .map((block: TextBlock, index: number) => {
          const frame = block.frame!;
          
          // Debugging logs removed for production
          
          // Transform coordinates based on photo orientation
          const transformed = transformCoordinates(
            { left: frame.left, top: frame.top, width: frame.width, height: frame.height },
            photo,
            cameraLayout.width,
            cameraLayout.height,
            false // Disable detailed logging
          );
          
          // Debug: log transformed coordinates on iOS
          if (index < 3 && Platform.OS === 'ios') {
            //console.log(`[iOS] Block ${index}: transformed = {x: ${transformed.x.toFixed(1)}, y: ${transformed.y.toFixed(1)}, w: ${transformed.width.toFixed(1)}, h: ${transformed.height.toFixed(1)}}`);
          }
          
          // Debug: log transformed coordinates
          if (index < 3 && Platform.OS === 'android') {
            //console.log(`[Android] Block ${index}: transformed = {x: ${transformed.x.toFixed(1)}, y: ${transformed.y.toFixed(1)}, w: ${transformed.width.toFixed(1)}, h: ${transformed.height.toFixed(1)}}`);
          }

          return {
            ...transformed,
            text: block.text
          };
        });

      setBoundingBoxes(boxes);
    } catch (error) {
      console.log("OCR Error:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, cameraLayout, status]);

  // Set up periodic OCR
  useEffect(() => {
    if (!hasPermission || !device) return;

    const interval = setInterval(() => {
      processFrame();
    }, OCR_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [hasPermission, device, processFrame]);

  // Handle camera layout
  const onCameraLayout = (event: any) => {
    const { width, height } = event.nativeEvent.layout;
    setCameraLayout({ width, height });
  };

  // Camera permissions are still loading
  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
      </View>
    );
  }

  // Camera permissions are not granted yet
  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionMessage}>
            We need your permission to show the camera
          </Text>
          <Button onPress={requestPermission} title="Grant Permission" />
        </View>
      </View>
    );
  }

  // No camera device available
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
          isActive={true}
          photo={true}
          video={true}
        />

        {/* Bounding Box Overlay - each box is individually pressable */}
        <View style={styles.overlayContainer} pointerEvents="box-none">
          {boundingBoxes.map((box, index) => (
            <Pressable
              key={index}
              onPressIn={(evt) => {
                const locX = evt.nativeEvent.locationX;
                const locY = evt.nativeEvent.locationY;
                const windowX = box.x + locX;
                const windowY = box.y + locY;
                console.log('[Index] Pressable onPressIn window coords:', { windowX, windowY, boxIndex: index });
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

        {/* Processing Indicator */}
        {isProcessing && (
          <View style={styles.processingIndicator}>
            <Text style={styles.processingText}>●</Text>
          </View>
        )}

        {/* Interaction Overlay - Passes screen-space coordinates and blocks to Gemini Service */}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  permissionMessage: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    color: "#666",
  },
  header: {
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 20,
    paddingBottom: 12,
    alignItems: "center",
  },
  headerText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  headerSubtext: {
    color: "#4CAF50",
    fontSize: 12,
    marginTop: 4,
  },
  cameraContainer: {
    flex: 1,
    position: "relative",
  },
  camera: {
    flex: 1,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  boundingBox: {
    position: "absolute",
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    borderRadius: 4,
  },
  processingIndicator: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 12,
    padding: 4,
  },
  processingText: {
    color: "#FF5722",
    fontSize: 16,
  },
});
