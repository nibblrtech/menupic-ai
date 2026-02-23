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
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Fonts, Spacing } from '../constants/DesignSystem';

const RADIUS = Spacing.md; // 24 — matches carousel item border-radius

// ─────────────────────────────────────────────────────────────────────────────
// Slide 0 · Foreign Menu
// ─────────────────────────────────────────────────────────────────────────────

const MENU_BG  = '#F5E8C8';
const MENU_INK = '#2C1A0E';

function MenuSection({
  title,
  items,
}: {
  title: string;
  items: Array<{ name: string; price: string }>;
}) {
  return (
    <View style={menuSt.section}>
      <View style={menuSt.sectionHeaderRow}>
        <View style={menuSt.sectionLine} />
        <Text style={menuSt.sectionTitle}>{title}</Text>
        <View style={menuSt.sectionLine} />
      </View>
      {items.map((item, i) => (
        <View key={i} style={menuSt.row}>
          <Text style={menuSt.itemName}>{item.name}</Text>
          <Text style={menuSt.dots} numberOfLines={1}>{'·  ·  ·  ·  ·'}</Text>
          <Text style={menuSt.price}>{item.price}</Text>
        </View>
      ))}
    </View>
  );
}

/** Inner menu markup — shared by MenuPageSlide and the ScanPageSlide background. */
function MenuCardContent() {
  return (
    <>
      <View style={menuSt.header}>
        <Text style={menuSt.restaurantName}>麺と炭火　夕暮れ</Text>
        <Text style={menuSt.restaurantSub}>NOODLES · CHARCOAL GRILL · IZAKAYA</Text>
      </View>

      <View style={menuSt.divider} />

      <View style={menuSt.body}>
        <MenuSection
          title="前菜"
          items={[
            { name: '枝豆', price: '¥380' },
            { name: '揚げ出し豆腐', price: '¥520' },
          ]}
        />
        <MenuSection
          title="麺類"
          items={[
            { name: '醤油ラーメン', price: '¥890' },
            { name: 'つけ麺', price: '¥950' },
          ]}
        />
        <MenuSection
          title="焼き物"
          items={[
            { name: '焼き鳥盛り合わせ', price: '¥1,200' },
            { name: '炙りチャーシュー', price: '¥780' },
          ]}
        />
      </View>

      <Text style={menuSt.footer}>ご注文はスタッフにお申し付けください</Text>
    </>
  );
}

export function MenuPageSlide() {
  return (
    <View style={menuSt.container}>
      <MenuCardContent />
    </View>
  );
}

const menuSt = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MENU_BG,
    borderRadius: RADIUS,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    overflow: 'hidden',
  },
  header: {
    alignItems: 'center',
    marginBottom: 6,
  },
  restaurantName: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: MENU_INK,
    letterSpacing: 0.5,
  },
  restaurantSub: {
    fontFamily: Fonts.regular,
    fontSize: 8,
    color: MENU_INK,
    opacity: 0.55,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: MENU_INK,
    opacity: 0.2,
    marginBottom: 6,
  },
  body: {
    flex: 1,
    justifyContent: 'space-evenly',
  },
  section: {},
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: MENU_INK,
    opacity: 0.18,
  },
  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    color: MENU_INK,
    opacity: 0.6,
    paddingHorizontal: 8,
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  itemName: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: MENU_INK,
  },
  dots: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 10,
    color: MENU_INK,
    opacity: 0.25,
    textAlign: 'center',
    overflow: 'hidden',
  },
  price: {
    fontFamily: Fonts.bold,
    fontSize: 11,
    color: MENU_INK,
    opacity: 0.85,
    minWidth: 44,
    textAlign: 'right',
  },
  footer: {
    fontFamily: Fonts.regular,
    fontSize: 8,
    color: MENU_INK,
    opacity: 0.35,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginTop: 4,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Slide 1 · Scan Page
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bounding boxes as percentages (0–100) of the camera-feed area.
 * Calibrated to sit over the actual text rendered by MenuCardContent.
 */
const OCR_BOXES: Array<{ x: number; y: number; w: number; h: number }> = [
  // ── Header ──────────────────────────────────────────────────────────────
  { x:  8, y:  3, w: 72, h:  7 }, // restaurant name
  { x: 16, y: 11, w: 58, h:  5 }, // subtitle
  // ── 前菜 section ────────────────────────────────────────────────────────
  { x: 22, y: 21, w: 44, h:  6 }, // section header
  { x:  3, y: 29, w: 40, h:  6 }, // 枝豆
  { x: 73, y: 29, w: 22, h:  6 }, // ¥380
  { x:  3, y: 36, w: 55, h:  6 }, // 揚げ出し豆腐
  { x: 73, y: 36, w: 22, h:  6 }, // ¥520
  // ── 麺類 section ────────────────────────────────────────────────────────
  { x: 22, y: 51, w: 44, h:  6 }, // section header
  { x:  3, y: 59, w: 46, h:  6 }, // 醤油ラーメン
  { x: 73, y: 59, w: 22, h:  6 }, // ¥890
  { x:  3, y: 66, w: 28, h:  6 }, // つけ麺
  { x: 73, y: 66, w: 22, h:  6 }, // ¥950
  // ── 焼き物 section ──────────────────────────────────────────────────────
  { x: 22, y: 79, w: 44, h:  6 }, // section header
  { x:  3, y: 87, w: 54, h:  6 }, // 焼き鳥盛り合わせ
  { x: 73, y: 87, w: 22, h:  6 }, // ¥1,200
];

export function ScanPageSlide() {
  return (
    <View style={scanSt.container}>
      {/* Header — mirrors the real scan screen header */}
      <View style={scanSt.header}>
        <Text style={scanSt.headerTitle}>MenuPic AI</Text>
        <Text style={scanSt.headerSub}>
          Detected {OCR_BOXES.length} text blocks
        </Text>
      </View>

      {/* Camera feed — the same menu as slide 0, with OCR boxes on top */}
      <View style={scanSt.camera}>
        {/* Menu fills the camera area exactly as in slide 0 */}
        <View style={[menuSt.container, scanSt.menuBackground]}>
          <MenuCardContent />
        </View>

        {/* OCR highlight bounding boxes — positioned over the real text */}
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          {OCR_BOXES.map((box, i) => (
            <View
              key={i}
              style={[
                scanSt.box,
                {
                  left: `${box.x}%`,
                  top: `${box.y}%`,
                  width: `${box.w}%`,
                  height: `${box.h}%`,
                },
              ]}
            />
          ))}
        </View>

        {/* Live-scan processing indicator */}
        <View style={scanSt.processingDot}>
          <Text style={scanSt.processingText}>●</Text>
        </View>
      </View>
    </View>
  );
}

const scanSt = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark,
    borderRadius: RADIUS,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: Colors.dark,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.dividerDark,
  },
  headerTitle: {
    color: Colors.textOnDark,
    fontFamily: Fonts.bold,
    fontSize: 13,
  },
  headerSub: {
    color: Colors.textOnDark,
    fontFamily: Fonts.regular,
    fontSize: 9,
    opacity: 0.5,
    marginTop: 2,
  },
  camera: {
    flex: 1,
    backgroundColor: MENU_BG,
    overflow: 'hidden',
  },
  // Overrides applied to menuSt.container when used as the camera background:
  // removes the card's own border-radius (the camera view already clips corners)
  menuBackground: {
    borderRadius: 0,
  },
  // OCR highlight boxes — dark ink tint to stand out on the parchment background
  box: {
    position: 'absolute',
    backgroundColor: 'rgba(44,26,14,0.10)',
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: 'rgba(44,26,14,0.45)',
  },
  processingDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(31,41,51,0.55)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  processingText: {
    color: Colors.textOnDark,
    fontFamily: Fonts.regular,
    fontSize: 8,
    opacity: 0.7,
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
