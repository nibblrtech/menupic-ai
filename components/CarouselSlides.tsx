/**
 * CarouselSlides — Live-rendered "screenshot" slides for the home-screen carousel.
 *
 * Each slide is a pure React Native view that mirrors a real app screen.
 * Because they reference the Design System constants directly they stay
 * pixel-perfect with every style change — no static images to maintain.
 *
 * Slides:
 *   0 · MenuPageSlide   — an obscure Japanese restaurant menu (what you'd scan)
 *   1 · ScanPageSlide   — the scan screen with OCR bounding-box overlays
 *   2 · ResultPageSlide — the result card with simulated AI dish image & details
 */
import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Fonts, Spacing } from '../constants/DesignSystem';

const RADIUS = Spacing.md; // 24 — matches carousel item border-radius

// ─────────────────────────────────────────────────────────────────────────────
// Slide 0 · Foreign Menu
// ─────────────────────────────────────────────────────────────────────────────

const MENU_BG     = '#F5E8C8';
const MENU_INK    = '#2C1A0E';
const MENU_ACCENT = '#7A5C28'; // warm gold — dividers & accents
const MENU_WINE   = '#5C4020'; // muted brown — wine pairing lines

/**
 * Reference design dimensions. MenuCardContent is always laid out at exactly
 * REF_W × REF_H, then MenuPageSlide transform-scales that inner view to fill
 * whatever space the carousel card provides — so all proportions are preserved.
 */
const REF_W = 300;
const REF_H = 400;

/** A bounding box in the REF_W × REF_H pixel coordinate space. */
type OcrBox = { x: number; y: number; w: number; h: number };

/** Optional refs passed into MenuCourse so MenuCardContent can measure each text. */
type CourseRefs = {
  name?: React.RefObject<Text | null>;
  desc?: React.RefObject<Text | null>;
  wine?: React.RefObject<Text | null>;
  /** Receives the max rendered line width of the desc text via onTextLayout. */
  descWidthRef?: React.MutableRefObject<number>;
};

function MenuCourse({
  name,
  description,
  wine,
  textRefs,
}: {
  name: string;
  description: string;
  wine: string;
  textRefs?: CourseRefs;
}) {
  return (
    <View style={menuSt.course}>
      <Text ref={textRefs?.name} style={menuSt.courseName}>{name}</Text>
      <Text
        ref={textRefs?.desc}
        style={menuSt.courseDesc}
        numberOfLines={2}
        onTextLayout={textRefs?.descWidthRef ? (e) => {
          const maxW = Math.max(0, ...e.nativeEvent.lines.map((l) => l.width));
          textRefs.descWidthRef!.current = maxW;
        } : undefined}
      >{description}</Text>
      <Text ref={textRefs?.wine} style={menuSt.courseWine} numberOfLines={1}>◆  {wine}</Text>
    </View>
  );
}

/**
 * Inner menu markup — shared by MenuPageSlide and the ScanPageSlide background.
 *
 * When `onOcrBoxes` is provided (scan slide only), every text element is
 * measured relative to the `content` root via measureLayout after layout
 * completes.  The returned boxes are in the REF_W × REF_H pixel space, so
 * the caller can scale them exactly like the menu itself.
 *
 * Header texts (centered) additionally use onTextLayout to get the actual
 * rendered text width so the box is tight around the glyphs, not full-width.
 */
function MenuCardContent({
  onOcrBoxes,
}: {
  onOcrBoxes?: (boxes: OcrBox[]) => void;
} = {}) {
  const rootRef   = useRef<View>(null);

  // ── Text refs (12 total) ────────────────────────────────────────────
  const rNameRef  = useRef<Text>(null);
  const rSubRef   = useRef<Text>(null);
  const c1NameRef = useRef<Text>(null);
  const c1DescRef = useRef<Text>(null);
  const c1WineRef = useRef<Text>(null);
  const c2NameRef = useRef<Text>(null);
  const c2DescRef = useRef<Text>(null);
  const c2WineRef = useRef<Text>(null);
  const c3NameRef = useRef<Text>(null);
  const c3DescRef = useRef<Text>(null);
  const c3WineRef = useRef<Text>(null);
  const c4NameRef = useRef<Text>(null);
  const c4DescRef = useRef<Text>(null);
  const c4WineRef = useRef<Text>(null);
  const c5NameRef = useRef<Text>(null);
  const c5DescRef = useRef<Text>(null);
  const c5WineRef = useRef<Text>(null);

  // Actual rendered widths for header texts (set by onTextLayout before measureAll runs)
  const rNameTextW = useRef(0);
  const rSubTextW  = useRef(0);
  // Actual rendered max-line widths for desc texts (wrapping text fills container width
  // on measureLayout, so we must capture the real rendered width via onTextLayout)
  const c1DescW = useRef(0);
  const c2DescW = useRef(0);
  const c3DescW = useRef(0);
  const c4DescW = useRef(0);
  const c5DescW = useRef(0);

  /**
   * After the root view lays out, measure every text element relative to
   * the root.  Header refs get their x re-centered using the real text width
   * captured by onTextLayout; course name / wine refs already have
   * alignSelf:'flex-start' so measureLayout returns the true content width.
   */
  const measureAll = useCallback(() => {
    if (!onOcrBoxes || !rootRef.current) return;
    const root = rootRef.current;

    // Course text refs in box order (header handled separately below)
    const courseRefs = [
      c1NameRef, c1DescRef, c1WineRef,
      c2NameRef, c2DescRef, c2WineRef,
      c3NameRef, c3DescRef, c3WineRef,
      c4NameRef, c4DescRef, c4WineRef,
      c5NameRef, c5DescRef, c5WineRef,
    ];

    const boxes: OcrBox[] = Array(17).fill({ x: 0, y: 0, w: 0, h: 0 });
    let remaining = 17;

    const done = (i: number, box: OcrBox) => {
      boxes[i] = box;
      if (--remaining === 0) onOcrBoxes([...boxes]);
    };

    // Header: measureLayout gives position; width comes from onTextLayout
    const measureHeader = (ref: React.RefObject<Text | null>, widthRef: React.MutableRefObject<number>, idx: number) => {
      if (!ref.current) { done(idx, { x: 0, y: 0, w: 0, h: 0 }); return; }
      (ref.current as any).measureLayout(
        root,
        (_x: number, y: number, fullW: number, h: number) => {
          const tw = widthRef.current || fullW;
          done(idx, { x: (REF_W - tw) / 2, y, w: tw, h });
        },
        () => done(idx, { x: 0, y: 0, w: 0, h: 0 }),
      );
    };
    measureHeader(rNameRef, rNameTextW, 0);
    measureHeader(rSubRef,  rSubTextW,  1);

    // Course texts: measureLayout gives exact position + content width.
    // For desc elements (every 3rd starting at index 1), measureLayout returns
    // the full container width because wrapping text fills its parent even with
    // alignSelf:'flex-start'.  Use the real max line width from onTextLayout instead.
    const descWidthRefs = [c1DescW, c2DescW, c3DescW, c4DescW, c5DescW];
    courseRefs.forEach((ref, i) => {
      if (!ref.current) { done(i + 2, { x: 0, y: 0, w: 0, h: 0 }); return; }
      const isDesc = i % 3 === 1;
      const capturedDescW = isDesc ? descWidthRefs[Math.floor(i / 3)].current : 0;
      (ref.current as any).measureLayout(
        root,
        (x: number, y: number, w: number, h: number) => {
          const finalW = isDesc ? (capturedDescW || w) : w;
          done(i + 2, { x, y, w: finalW, h });
        },
        () => done(i + 2, { x: 0, y: 0, w: 0, h: 0 }),
      );
    });
  }, [onOcrBoxes]);

  return (
    <View ref={rootRef} style={menuSt.content} onLayout={measureAll}>
      <View style={menuSt.header}>
        <Text
          ref={rNameRef}
          style={menuSt.restaurantName}
          onTextLayout={(e) => { rNameTextW.current = e.nativeEvent.lines[0]?.width ?? 0; }}
        >
          མཚོ་ཆེན་དཀར་པོ།
        </Text>
        <Text
          ref={rSubRef}
          style={menuSt.restaurantSub}
          onTextLayout={(e) => { rSubTextW.current = e.nativeEvent.lines[0]?.width ?? 0; }}
        >
          རྒྱ་མཚོའི་ཟས་རིགས།  ·  ལྷ་ས།
        </Text>
      </View>

      <View style={menuSt.divider} />

      <View style={menuSt.body}>
        <MenuCourse
          name="ཉ་ཆེན།"
          description="ཉ་ཆེན་གི་ཤ་ཞིབ་མ། མཆིན་པ་སྨན། གསེར་གྱི་བག་ལེབ། སྤང་རྩི།"
          wine="གྲུ་བཞི་འབྲུམ་ཆང་། ཝ་ཁའོ། ༢༠༢༣"
          textRefs={{ name: c1NameRef, desc: c1DescRef, wine: c1WineRef, descWidthRef: c1DescW }}
        />
        <View style={menuSt.courseSep} />
        <MenuCourse
          name="ཤ་ལྷ།"
          description="ཤ་ལྷ་རླངས་བཙལ། སྐྱུར་ཤིང་། རྒྱ་མཚོའི་ཆུ་རོལ།"
          wine="དཀར་ཆང་། ལྭར། ༢༠༢༢"
          textRefs={{ name: c2NameRef, desc: c2DescRef, wine: c2WineRef, descWidthRef: c2DescW }}
        />
        <View style={menuSt.courseSep} />
        <MenuCourse
          name="དམར་ཉ། · ཉ་སྒོང་།"
          description="དམར་ཉ་དལ་བཙོས། རྒྱལ་གྱི་ཉ་སྒོང་། རྩི་དྲུལ་རྩི།"
          wine="གསེར་ཆང་། ཤམ་པཉི། ༢༠༡༥"
          textRefs={{ name: c3NameRef, desc: c3DescRef, wine: c3WineRef, descWidthRef: c3DescW }}
        />
        <View style={menuSt.courseSep} />
        <MenuCourse
          name="གཞུང་ཉ།"
          description="གཞུང་ཉ་རྫས་སྦྱོར། རྒྱུན་ཤིང་། ཐིག་སྣུམ་རྩི།"
          wine="དཀར་ཆང་། ཨི་བི་རི་ཡ། ༢༠༢༣"
          textRefs={{ name: c4NameRef, desc: c4DescRef, wine: c4WineRef, descWidthRef: c4DescW }}
        />
        <View style={menuSt.courseSep} />
        <MenuCourse
          name="ནག་གུར་གུར།"
          description="ནག་གུར་གུར་དྲོད་ལྡན། ཐའི་ཧི་ཊི་གི་གཤེར་མ།"
          wine="མངར་ཆང་། པོར་ཏུ་གལ།"
          textRefs={{ name: c5NameRef, desc: c5DescRef, wine: c5WineRef, descWidthRef: c5DescW }}
        />
      </View>
    </View>
  );
}

/**
 * Slide 0 outer shell — measures itself, then transform-scales the inner
 * REF_W × REF_H content to fill the available space proportionally.
 */
export function MenuPageSlide() {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const scale = size ? Math.min(size.w / REF_W, size.h / REF_H) : 0;

  return (
    <View
      style={menuSt.container}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ w: width, h: height });
      }}
    >
      {scale > 0 && (
        <View
          style={{
            position: 'absolute',
            width: REF_W,
            height: REF_H,
            left: (size!.w - REF_W) / 2,
            top: (size!.h - REF_H) / 2,
            transform: [{ scale }],
          }}
        >
          <MenuCardContent />
        </View>
      )}

      {/* Unscaled English context label — always crisp, tells new users
           what they're looking at before they've read the onboarding copy */}
      <View style={menuSt.contextBadge} pointerEvents="none">
        <Text style={menuSt.contextBadgeText}>📋  Restaurant Menu</Text>
      </View>
    </View>
  );
}

const menuSt = StyleSheet.create({
  // Outer shell — provides background, border-radius, clipping, and the
  // measurement surface for onLayout.  No padding here so the inner content
  // can be centered + scaled without any inherited offsets.
  container: {
    flex: 1,
    backgroundColor: MENU_BG,
    borderRadius: RADIUS,
    overflow: 'hidden',
  },
  // Inner padded content — sized to REF_W × REF_H via the transform container.
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
  },
  header: {
    alignItems: 'center',
    marginBottom: 10,
  },
  restaurantName: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: MENU_INK,
    letterSpacing: 1,
  },
  restaurantSub: {
    fontFamily: Fonts.regular,
    fontSize: 10,
    color: MENU_INK,
    opacity: 0.5,
    letterSpacing: 0.8,
    marginTop: 3,
  },
  divider: {
    height: 1.5,
    backgroundColor: MENU_ACCENT,
    opacity: 0.5,
    marginBottom: 8,
  },
  body: {
    flex: 1,
    justifyContent: 'space-evenly',
  },
  course: {},
  courseName: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: MENU_INK,
    letterSpacing: 0.5,
    marginBottom: 2,
    alignSelf: 'flex-start', // shrink to text width so measureLayout returns content width
  },
  courseDesc: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: MENU_INK,
    opacity: 0.72,
    lineHeight: 16,
    marginBottom: 3,
    alignSelf: 'flex-start', // shrink to longest rendered line so measureLayout returns content width
  },
  courseWine: {
    fontFamily: Fonts.regular,
    fontSize: 10,
    color: MENU_WINE,
    opacity: 0.85,
    alignSelf: 'flex-start', // shrink to text width so measureLayout returns content width
  },
  courseSep: {
    height: 1,
    backgroundColor: MENU_ACCENT,
    opacity: 0.2,
    marginVertical: 5,
  },
  // Context badge lives in the outer (unscaled) container so it is always
  // pixel-sharp and legible regardless of the card's rendered size.
  contextBadge: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    backgroundColor: 'rgba(44, 26, 14, 0.55)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  contextBadgeText: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: '#F5E8C8',
    letterSpacing: 0.4,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Slide 1 · Scan Page  (phone-frame mock-up)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders the menu (at REF_W × REF_H, scaled to fit) and the live OCR overlays.
 *
 * `ocrBoxes`   — boxes in REF_W × REF_H pixel space (from MenuCardContent.measureAll).
 * `onOcrBoxes` — forwarded to MenuCardContent to trigger measurement after layout.
 *
 * Box positioning (exact — same maths as the menu transform):
 *   visual_left = scaledLeft + box.x * scale
 *   visual_top  = scaledTop  + box.y * scale
 *   visual_w    = box.w * scale
 *   visual_h    = box.h * scale
 */
function ScanCameraContent({
  cameraW,
  cameraH,
  ocrBoxes,
  onOcrBoxes,
}: {
  cameraW: number;
  cameraH: number;
  ocrBoxes: OcrBox[];
  onOcrBoxes: (boxes: OcrBox[]) => void;
}) {
  const scale      = Math.min(cameraW / REF_W, cameraH / REF_H);
  const scaledLeft = (cameraW - REF_W * scale) / 2;
  const scaledTop  = (cameraH - REF_H * scale) / 2;
  const layoutLeft = (cameraW - REF_W) / 2;
  const layoutTop  = (cameraH - REF_H) / 2;

  return (
    <>
      {/* Menu at reference size, scaled to fill camera area */}
      <View
        style={{
          position: 'absolute',
          width:  REF_W,
          height: REF_H,
          left: layoutLeft,
          top:  layoutTop,
          transform: [{ scale }],
        }}
      >
        <MenuCardContent onOcrBoxes={onOcrBoxes} />
      </View>

      {/* OCR highlight boxes — pixel-space coords scaled identically to the menu */}
      {ocrBoxes.map((box, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left:   scaledLeft + box.x * scale,
            top:    scaledTop  + box.y * scale,
            width:  box.w * scale,
            height: box.h * scale,
            backgroundColor: 'rgba(44,26,14,0.08)',
            borderRadius: 2 * scale,
            borderWidth: 1,
            borderColor: 'rgba(44,26,14,0.50)',
          }}
        />
      ))}

      {/* Scanning corner brackets */}
      {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
        <View key={corner} style={[scanSt.corner, scanSt[corner]]} pointerEvents="none" />
      ))}

      {/* Live indicator */}
      <View style={scanSt.liveChip} pointerEvents="none">
        <View style={scanSt.liveDot} />
        <Text style={scanSt.liveText}>SCANNING</Text>
      </View>
    </>
  );
}

/**
 * Slide 1 outer shell — a phone-frame mock-up that scales to fill the
 * carousel card, with the scan-screen UI inside.
 */
export function ScanPageSlide() {
  const [cardSize, setCardSize] = useState<{ w: number; h: number } | null>(null);
  const [camSize,  setCamSize]  = useState<{ w: number; h: number } | null>(null);
  const [ocrBoxes, setOcrBoxes] = useState<OcrBox[]>([]);

  return (
    <View
      style={scanSt.cardOuter}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setCardSize({ w: width, h: height });
      }}
    >
      {cardSize && (
        <>
          {/* ── Phone frame — silver aluminum body ── */}
          <View style={[scanSt.phoneOuter, {
            width:  cardSize.w * 0.8,
            height: cardSize.h,
          }]}>

            {/* Hardware side buttons */}
            <View style={[scanSt.sideBtn, scanSt.volUp]} />
            <View style={[scanSt.sideBtn, scanSt.volDown]} />
            <View style={[scanSt.sideBtn, scanSt.powerBtn]} />

            {/* Screen glass — inset within the silver frame */}
            <View style={scanSt.phoneScreen}>

              {/* Dynamic Island */}
              <View style={scanSt.island} />

              {/* Screen area */}
              <View style={scanSt.screen}>

                {/* Status bar row */}
                <View style={scanSt.statusBar}>
                  <Text style={scanSt.statusTime}>9:41</Text>
                  <View style={scanSt.statusIcons}>
                    <Text style={scanSt.statusIcon}>●●●●</Text>
                    <Text style={scanSt.statusIcon}>▮</Text>
                  </View>
                </View>

                {/* App header */}
                <View style={scanSt.appHeader}>
                  <Text style={scanSt.appTitle}>MenuPic AI</Text>
                  <Text style={scanSt.appSub}>
                    {ocrBoxes.length > 0 ? `${ocrBoxes.length} text blocks detected` : 'Scanning…'}
                  </Text>
                </View>

                {/* Camera feed */}
                <View
                  style={scanSt.camera}
                  onLayout={(e) => {
                    const { width, height } = e.nativeEvent.layout;
                    setCamSize({ w: width, h: height });
                  }}
                >
                  {camSize && (
                    <ScanCameraContent
                      cameraW={camSize.w}
                      cameraH={camSize.h}
                      ocrBoxes={ocrBoxes}
                      onOcrBoxes={setOcrBoxes}
                    />
                  )}
                </View>

                {/* Context badge */}
                <View style={scanSt.bottomBar}>
                  <View style={scanSt.contextBadge}>
                    <Text style={scanSt.contextBadgeText}>📷  Scanning...</Text>
                  </View>
                </View>

              </View>

              {/* Home indicator */}
              <View style={scanSt.homeBar} />

            </View>
          </View>
        </>
      )}
    </View>
  );
}

const scanSt = StyleSheet.create({
  // ── Outer carousel card shell ───────────────────────────────────────────────
  cardOuter: {
    flex: 1,
    backgroundColor: Colors.dark,
    borderRadius: RADIUS,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Phone frame — silver aluminum body ───────────────────────────────────────
  phoneOuter: {
    backgroundColor: '#C8C8C8',          // silver aluminum
    borderRadius: 44,
    padding: 7,                           // creates the visible frame ring
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)', // polished-edge highlight
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },

  // ── Hardware side buttons (protrude from the silver frame) ────────────────
  sideBtn: {
    position: 'absolute',
    backgroundColor: '#ABABAB',          // slightly darker = machined recess
    borderRadius: 2,
  },
  volUp:    { left: -3, top: '24%', width: 4, height: 22 } as any,
  volDown:  { left: -3, top: '33%', width: 4, height: 22 } as any,
  powerBtn: { right: -3, top: '29%', width: 4, height: 38 } as any,

  // ── Screen glass — inset display within the silver frame ─────────────────
  phoneScreen: {
    flex: 1,
    width: '100%',
    borderRadius: 37,                    // frame radius minus padding
    overflow: 'hidden',
    backgroundColor: Colors.dark,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.5)',      // dark ring at glass-to-frame junction
    alignItems: 'center',
  },

  island: {
    width: 80,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#000000',
    marginTop: 8,
    zIndex: 10,
  },

  // ── Screen inside the phone ──────────────────────────────────────────────────
  screen: {
    flex: 1,
    width: '100%',
    backgroundColor: Colors.dark,
    overflow: 'hidden',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 4,
  },
  statusTime: {
    color: Colors.textOnDark,
    fontFamily: Fonts.bold,
    fontSize: 9,
  },
  statusIcons: {
    flexDirection: 'row',
    gap: 4,
  },
  statusIcon: {
    color: Colors.textOnDark,
    fontFamily: Fonts.regular,
    fontSize: 6,
    opacity: 0.7,
  },
  appHeader: {
    backgroundColor: Colors.dark,
    paddingHorizontal: 12,
    paddingBottom: 6,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.dividerDark,
  },
  appTitle: {
    color: Colors.textOnDark,
    fontFamily: Fonts.bold,
    fontSize: 11,
  },
  appSub: {
    color: Colors.textOnDark,
    fontFamily: Fonts.regular,
    fontSize: 8,
    opacity: 0.5,
    marginTop: 1,
  },
  camera: {
    flex: 1,
    backgroundColor: MENU_BG,
    overflow: 'hidden',
  },

  // ── Scan overlay UI ──────────────────────────────────────────────────────────
  // Corner bracket marks shown at the four corners of the camera feed
  corner: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderColor: 'rgba(44,26,14,0.65)',
    borderWidth: 0,
  },
  tl: { top: 6, left: 6,   borderTopWidth: 2.5, borderLeftWidth:  2.5 },
  tr: { top: 6, right: 6,  borderTopWidth: 2.5, borderRightWidth: 2.5 },
  bl: { bottom: 6, left: 6,   borderBottomWidth: 2.5, borderLeftWidth:  2.5 },
  br: { bottom: 6, right: 6,  borderBottomWidth: 2.5, borderRightWidth: 2.5 },

  liveChip: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(31,41,51,0.72)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 4,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E84040',
  },
  liveText: {
    color: Colors.textOnDark,
    fontFamily: Fonts.bold,
    fontSize: 7,
    letterSpacing: 0.5,
  },

  // ── Bottom bar with Scan button ──────────────────────────────────────────────
  bottomBar: {
    backgroundColor: Colors.dark,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.dividerDark,
    alignItems: 'center',
  },
  contextBadge: {
    backgroundColor: 'rgba(44, 26, 14, 0.55)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  contextBadgeText: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: '#F5E8C8',
    letterSpacing: 0.4,
  },

  // ── Home indicator ───────────────────────────────────────────────────────────
  homeBar: {
    width: 80,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginBottom: 6,
    marginTop: 4,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Slide 2 · Result Page
// ─────────────────────────────────────────────────────────────────────────────

/** Yakitori piece colours alternated across the row */
const PIECE_COLORS = [
  { bg: '#C4701A', border: '#E88A25' }, // thigh — amber
  { bg: '#8C4D0C', border: '#B8671A' }, // tsukune — dark brown
  { bg: '#C4701A', border: '#E88A25' },
  { bg: '#A3591A', border: '#CC7820' }, // breast — mid-brown
  { bg: '#8C4D0C', border: '#B8671A' },
  { bg: '#C4701A', border: '#E88A25' },
];

export function ResultPageSlide() {
  return (
    <View style={resultSt.container}>
      {/* ── Simulated AI-generated food photo ─────────────────────────────── */}
      <View style={resultSt.imageArea}>
        {/* Charcoal-grill stripe pattern */}
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={[resultSt.grillLine, { top: 8 + i * 16 }]} />
        ))}

        {/* Row of yakitori pieces */}
        <View style={resultSt.piecesRow}>
          {PIECE_COLORS.map((c, i) => (
            <View
              key={i}
              style={[
                resultSt.piece,
                i % 2 === 1 ? resultSt.pieceSmall : null,
                { backgroundColor: c.bg, borderColor: c.border },
              ]}
            />
          ))}
        </View>

        {/* Warm glaze sheen overlay */}
        <View style={resultSt.sheen} />

        {/* AI label */}
        <View style={resultSt.aiBadge}>
          <Text style={resultSt.aiText}>AI ✨</Text>
        </View>
      </View>

      {/* ── Dish info ──────────────────────────────────────────────────────── */}
      <Text style={resultSt.dishTitle}>焼き鳥盛り合わせ</Text>
      <Text style={resultSt.dishSub}>Yakitori Assortment</Text>

      <View style={resultSt.divider} />

      <Text style={resultSt.sectionLabel}>DESCRIPTION</Text>
      <Text style={resultSt.body} numberOfLines={2}>
        Skewered grilled chicken over charcoal — thigh, breast & tsukune meatballs with tare glaze.
      </Text>

      {/* ── Done button ────────────────────────────────────────────────────── */}
      <View style={resultSt.doneButton}>
        <Text style={resultSt.doneText}>Done</Text>
      </View>
    </View>
  );
}

const resultSt = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light,
    borderRadius: RADIUS,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    overflow: 'hidden',
  },
  // ── AI image area ─────────────────────────────────────────────────────────
  imageArea: {
    height: 72,
    borderRadius: 10,
    backgroundColor: '#1E0C04',
    marginBottom: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  grillLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#0A0402',
    opacity: 0.65,
  },
  piecesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 1,
  },
  piece: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    elevation: 2,
  },
  pieceSmall: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  sheen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,150,40,0.06)',
  },
  aiBadge: {
    position: 'absolute',
    top: 6,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 2,
  },
  aiText: {
    color: '#ffffff',
    fontFamily: Fonts.bold,
    fontSize: 9,
  },
  // ── Text content ──────────────────────────────────────────────────────────
  dishTitle: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: Colors.textOnLight,
    marginBottom: 1,
  },
  dishSub: {
    fontFamily: Fonts.regular,
    fontSize: 10,
    color: Colors.textOnLight,
    opacity: 0.5,
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dividerLight,
    marginBottom: 4,
  },
  sectionLabel: {
    fontFamily: Fonts.bold,
    fontSize: 8,
    color: Colors.textOnLight,
    opacity: 0.45,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  body: {
    fontFamily: Fonts.regular,
    fontSize: 10,
    color: Colors.textOnLight,
    lineHeight: 15,
    opacity: 0.75,
    flex: 1,
  },
  // ── Done button ───────────────────────────────────────────────────────────
  doneButton: {
    height: 30,
    borderRadius: 20,
    backgroundColor: Colors.dark,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  doneText: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: Colors.textOnDark,
  },
});
