/**
 * FreezeZoomOverlay
 *
 * Displays a frozen camera image that the user can pinch-to-zoom and pan.
 * OCR bounding-boxes are drawn and remain tappable (when not mid-gesture).
 *
 * Design decisions
 * ─────────────────
 * • Image quality: the photo is rendered at its actual on-screen size
 *   (width = containerWidth * scale, height = containerHeight * scale) via
 *   useAnimatedStyle, NOT via a `transform: scale()`. This forces the image
 *   pipeline to use the source photo's full resolution at every zoom level
 *   instead of upscaling a pre-rasterised bitmap, giving sharp results.
 *
 * • Bounding boxes: each AnimatedBox lives in its own Animated.View that
 *   computes left/top/width/height from the same shared values but renders
 *   at 1× scale. borderWidth and borderRadius are never magnified.
 *
 * • Entry animation: scale starts at 1 and springs to 2 on mount so the
 *   user can see the zoom-in transition.
 *
 * Constraints
 *  - Entry / initial zoom: 2×   Min: 1×   Max: 5×
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import {
    Gesture,
    GestureDetector,
    GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    type SharedValue,
} from 'react-native-reanimated';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}

interface FreezeZoomOverlayProps {
  photoUri: string;
  boundingBoxes: BoundingBox[];
  containerWidth: number;
  containerHeight: number;
  onBoxTap: (windowX: number, windowY: number) => void;
}

interface AnimatedBoxProps {
  box: BoundingBox;
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  containerWidth: number;
  containerHeight: number;
  gestureActiveRef: React.RefObject<boolean>;
  onBoxTap: (windowX: number, windowY: number) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const INITIAL_SCALE = 2;

/**
 * How long (ms) to keep gestureActiveRef=true after a pan/pinch ends.
 * Prevents the touch-up that finishes a gesture from immediately firing
 * onPress on an OCR bounding box.
 */
const GESTURE_COOLDOWN_MS = 250;

/** Entry spring: smooth 1 → 2 zoom-in animation on mount */
const ENTRY_SPRING = { damping: 28, stiffness: 160, mass: 0.5 };
/** Snap-back spring used when scale is nudged below MIN */
const SNAP_SPRING  = { damping: 20, stiffness: 200, mass: 0.4 };

// ─── AnimatedBox ─────────────────────────────────────────────────────────────
/**
 * A single OCR bounding box that computes its own screen-space position from
 * the zoom/pan shared values without ever applying a scale transform.
 * This keeps borderWidth, borderRadius, and background opacity at pixel-perfect
 * 1× fidelity regardless of zoom level.
 *
 * Position math (centre-anchor model):
 *   imageLeft = (containerWidth  - containerWidth  * s) / 2 + translateX
 *   imageTop  = (containerHeight - containerHeight * s) / 2 + translateY
 *   boxLeft   = imageLeft + box.x * s
 *   boxTop    = imageTop  + box.y * s
 */
function AnimatedBox({
  box,
  scale,
  translateX,
  translateY,
  containerWidth,
  containerHeight,
  gestureActiveRef,
  onBoxTap,
}: AnimatedBoxProps) {
  const animStyle = useAnimatedStyle(() => {
    const s  = scale.value;
    const il = (containerWidth  - containerWidth  * s) / 2 + translateX.value;
    const it = (containerHeight - containerHeight * s) / 2 + translateY.value;
    return {
      left:   il + box.x * s,
      top:    it + box.y * s,
      width:  box.width  * s,
      height: box.height * s,
    };
  });

  return (
    <Animated.View style={[styles.boundingBox, animStyle]}>
      <Pressable
        style={StyleSheet.absoluteFillObject}
        onPress={() => {
          // onPress (not onPressIn) so that a pan/pinch gesture can cancel
          // the touch before identify fires. The cooldown on gestureActiveRef
          // prevents the touch-up that ends a pan from also triggering a tap.
          if (gestureActiveRef.current) return;
          // Forward the centre of the box in original layout-space coords
          onBoxTap(box.x + box.width / 2, box.y + box.height / 2);
        }}
      />
    </Animated.View>
  );
}

// ─── FreezeZoomOverlay ────────────────────────────────────────────────────────

const AnimatedImage = Animated.createAnimatedComponent(Image);

export default function FreezeZoomOverlay({
  photoUri,
  boundingBoxes,
  containerWidth,
  containerHeight,
  onBoxTap,
}: FreezeZoomOverlayProps) {
  // ── Shared values ────────────────────────────────────────────────────────
  // scale starts at 1; a useEffect immediately springs it to INITIAL_SCALE (2)
  // so the user sees a smooth entry animation.
  const scale      = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const savedScale      = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // ── Entry animation ──────────────────────────────────────────────────────
  useEffect(() => {
    scale.value = withSpring(INITIAL_SCALE, ENTRY_SPRING);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Gesture-active flag ──────────────────────────────────────────────────
  const gestureActiveRef = useRef(false);
  // Tracks the epoch-ms at which the last gesture ended so we can apply a
  // brief cooldown before allowing box taps again.
  const gestureEndAtRef = useRef<number>(0);

  const setGestureActive = useCallback((v: boolean) => {
    if (v) {
      gestureActiveRef.current = true;
    } else {
      // Don't immediately clear — wait GESTURE_COOLDOWN_MS so the touch-up
      // event that ended the pan/pinch cannot also fire onPress on a box.
      gestureEndAtRef.current = Date.now();
      setTimeout(() => {
        gestureActiveRef.current = false;
      }, GESTURE_COOLDOWN_MS);
    }
  }, []);

  // ── Clamp helper (worklet) ───────────────────────────────────────────────
  // Keeps the image flush against the container edges; no gaps allowed.
  //   maxOffset = (zoomed dimension - container dimension) / 2
  function clampTranslate(tx: number, ty: number, s: number) {
    'worklet';
    const maxX = Math.max(0, (containerWidth  * s - containerWidth)  / 2);
    const maxY = Math.max(0, (containerHeight * s - containerHeight) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, tx)),
      y: Math.min(maxY, Math.max(-maxY, ty)),
    };
  }

  // ── Pinch ────────────────────────────────────────────────────────────────
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      'worklet';
      savedScale.value      = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      runOnJS(setGestureActive)(true);
    })
    .onUpdate((e) => {
      'worklet';
      const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, savedScale.value * e.scale));
      scale.value = s;
      const c = clampTranslate(savedTranslateX.value, savedTranslateY.value, s);
      translateX.value = c.x;
      translateY.value = c.y;
    })
    .onEnd(() => {
      'worklet';
      if (scale.value < MIN_SCALE) {
        scale.value = withSpring(MIN_SCALE, SNAP_SPRING);
        const c = clampTranslate(translateX.value, translateY.value, MIN_SCALE);
        translateX.value = withSpring(c.x, SNAP_SPRING);
        translateY.value = withSpring(c.y, SNAP_SPRING);
      }
      runOnJS(setGestureActive)(false);
    });

  // ── Pan ──────────────────────────────────────────────────────────────────
  const panGesture = Gesture.Pan()
    .minDistance(2)
    .onStart(() => {
      'worklet';
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      runOnJS(setGestureActive)(true);
    })
    .onUpdate((e) => {
      'worklet';
      const c = clampTranslate(
        savedTranslateX.value + e.translationX,
        savedTranslateY.value + e.translationY,
        scale.value,
      );
      translateX.value = c.x;
      translateY.value = c.y;
    })
    .onEnd(() => {
      'worklet';
      runOnJS(setGestureActive)(false);
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  // ── Image animated style ─────────────────────────────────────────────────
  // The Image is sized to containerWidth * scale × containerHeight * scale and
  // positioned so it stays centred as scale changes.  No `transform: scale()`
  // is used, so the image pipeline renders at the true display size — sharp at
  // any zoom level.
  const imageStyle = useAnimatedStyle(() => {
    const s = scale.value;
    const w = containerWidth  * s;
    const h = containerHeight * s;
    return {
      width:  w,
      height: h,
      left:   (containerWidth  - w) / 2 + translateX.value,
      top:    (containerHeight - h) / 2 + translateY.value,
    };
  });

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={[StyleSheet.absoluteFillObject, styles.root]} pointerEvents="box-none">
      <GestureHandlerRootView style={StyleSheet.absoluteFillObject}>
        <GestureDetector gesture={composedGesture}>
          <View style={StyleSheet.absoluteFillObject}>

            {/* ── Image layer: rendered at physical zoom size, no upscale artifact ── */}
            <AnimatedImage
              source={{ uri: photoUri }}
              resizeMode="cover"
              style={[styles.image, imageStyle]}
            />

            {/* ── Box layer: each box has its own animated position at 1× scale ── */}
            {boundingBoxes.map((box, index) => (
              <AnimatedBox
                key={index}
                box={box}
                scale={scale}
                translateX={translateX}
                translateY={translateY}
                containerWidth={containerWidth}
                containerHeight={containerHeight}
                gestureActiveRef={gestureActiveRef}
                onBoxTap={onBoxTap}
              />
            ))}

          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
  },
  image: {
    position: 'absolute',
  },
  boundingBox: {
    position: 'absolute',
    backgroundColor: 'rgba(255,246,238,0.18)',
    borderRadius: 4,
    borderWidth: 2,
    borderColor: 'rgba(255,246,238,0.85)',
  },
});
