import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    LayoutChangeEvent,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { Button, Colors, Fonts, FontSize, Spacing } from '../constants/DesignSystem';
import { useProfile } from '../contexts/ProfileContext';
import { blackForestLabsService } from '../services/BlackForestLabsService';
import { DishAnalysisResult, geminiService, NutritionFacts, TextBlock } from '../services/GeminiService';

// ─── FDA-style Nutrition Facts Label ─────────────────────────────────────────

function NutritionLabel({ nutrition }: { nutrition: NutritionFacts }) {
  const n = nutrition;
  return (
    <View style={nfStyles.container}>
      <Text style={nfStyles.title}>Nutrition Facts</Text>
      <View style={nfStyles.thickRule} />

      <View style={nfStyles.servingRow}>
        <Text style={nfStyles.servingText}>Serving size</Text>
        <Text style={nfStyles.servingText}>{n.servingSize || '1 serving'}</Text>
      </View>
      <View style={nfStyles.thickRule} />

      {/* Calories */}
      <View style={nfStyles.calorieRow}>
        <Text style={nfStyles.calorieLabel}>Calories</Text>
        <Text style={nfStyles.calorieValue}>{n.calories ?? '—'}</Text>
      </View>
      <View style={nfStyles.mediumRule} />

      <View style={nfStyles.dvHeaderRow}>
        <Text style={nfStyles.dvHeaderText}>% Daily Value*</Text>
      </View>
      <View style={nfStyles.thinRule} />

      {/* Total Fat */}
      <View style={nfStyles.row}>
        <Text style={nfStyles.boldLabel}>Total Fat </Text>
        <Text style={nfStyles.label}>{n.totalFat?.grams ?? 0}g</Text>
        <Text style={nfStyles.dvValue}>{n.totalFat?.dailyValue ?? 0}%</Text>
      </View>
      <View style={nfStyles.thinRule} />

      {/* Saturated Fat */}
      <View style={nfStyles.indentedRow}>
        <Text style={nfStyles.label}>Saturated Fat {n.saturatedFat?.grams ?? 0}g</Text>
        <Text style={nfStyles.dvValue}>{n.saturatedFat?.dailyValue ?? 0}%</Text>
      </View>
      <View style={nfStyles.thinRule} />

      {/* Trans Fat */}
      <View style={nfStyles.indentedRow}>
        <Text style={nfStyles.italicLabel}>Trans Fat {n.transFat?.grams ?? 0}g</Text>
        <View />
      </View>
      <View style={nfStyles.thinRule} />

      {/* Cholesterol */}
      <View style={nfStyles.row}>
        <Text style={nfStyles.boldLabel}>Cholesterol </Text>
        <Text style={nfStyles.label}>{n.cholesterol?.mg ?? 0}mg</Text>
        <Text style={nfStyles.dvValue}>{n.cholesterol?.dailyValue ?? 0}%</Text>
      </View>
      <View style={nfStyles.thinRule} />

      {/* Sodium */}
      <View style={nfStyles.row}>
        <Text style={nfStyles.boldLabel}>Sodium </Text>
        <Text style={nfStyles.label}>{n.sodium?.mg ?? 0}mg</Text>
        <Text style={nfStyles.dvValue}>{n.sodium?.dailyValue ?? 0}%</Text>
      </View>
      <View style={nfStyles.thinRule} />

      {/* Total Carbohydrates */}
      <View style={nfStyles.row}>
        <Text style={nfStyles.boldLabel}>Total Carbohydrate </Text>
        <Text style={nfStyles.label}>{n.totalCarbohydrates?.grams ?? 0}g</Text>
        <Text style={nfStyles.dvValue}>{n.totalCarbohydrates?.dailyValue ?? 0}%</Text>
      </View>
      <View style={nfStyles.thinRule} />

      {/* Dietary Fiber */}
      <View style={nfStyles.indentedRow}>
        <Text style={nfStyles.label}>Dietary Fiber {n.dietaryFiber?.grams ?? 0}g</Text>
        <Text style={nfStyles.dvValue}>{n.dietaryFiber?.dailyValue ?? 0}%</Text>
      </View>
      <View style={nfStyles.thinRule} />

      {/* Total Sugars */}
      <View style={nfStyles.indentedRow}>
        <Text style={nfStyles.label}>Total Sugars {n.totalSugars?.grams ?? 0}g</Text>
        <View />
      </View>
      <View style={nfStyles.thinRule} />

      {/* Added Sugars */}
      <View style={nfStyles.doubleIndentedRow}>
        <Text style={nfStyles.label}>Includes {n.addedSugars?.grams ?? 0}g Added Sugars</Text>
        <Text style={nfStyles.dvValue}>{n.addedSugars?.dailyValue ?? 0}%</Text>
      </View>
      <View style={nfStyles.thinRule} />

      {/* Protein */}
      <View style={nfStyles.row}>
        <Text style={nfStyles.boldLabel}>Protein </Text>
        <Text style={nfStyles.label}>{n.protein?.grams ?? 0}g</Text>
        <Text style={nfStyles.dvValue}>{n.protein?.dailyValue ?? 0}%</Text>
      </View>
      <View style={nfStyles.thickRule} />

      {/* Vitamins & Minerals */}
      {(n.vitaminsAndMinerals ?? []).map((vm, i) => (
        <React.Fragment key={i}>
          <View style={nfStyles.row}>
            <Text style={nfStyles.label}>{vm.name}</Text>
            <Text style={nfStyles.dvValue}>{vm.dailyValue}%</Text>
          </View>
          {i < (n.vitaminsAndMinerals?.length ?? 0) - 1 && <View style={nfStyles.thinRule} />}
        </React.Fragment>
      ))}
      {(n.vitaminsAndMinerals?.length ?? 0) > 0 && <View style={nfStyles.mediumRule} />}

      <Text style={nfStyles.footnote}>
        * Percent Daily Values are based on a 2,000 calorie diet.{'\n'}
        Values are estimated and may vary based on preparation.
      </Text>
    </View>
  );
}

const nfStyles = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderColor: '#000',
    padding: 8,
    marginTop: 4,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontFamily: 'Play-Bold',
    color: '#000',
    letterSpacing: 0.5,
  },
  thickRule: {
    height: 8,
    backgroundColor: '#000',
    marginVertical: 2,
  },
  mediumRule: {
    height: 4,
    backgroundColor: '#000',
    marginVertical: 1,
  },
  thinRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#000',
    marginVertical: 1,
  },
  servingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  servingText: {
    fontSize: 13,
    fontFamily: 'Play-Bold',
    color: '#000',
  },
  calorieRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingVertical: 2,
  },
  calorieLabel: {
    fontSize: 16,
    fontFamily: 'Play-Bold',
    color: '#000',
  },
  calorieValue: {
    fontSize: 22,
    fontFamily: 'Play-Bold',
    color: '#000',
  },
  dvHeaderRow: {
    alignItems: 'flex-end',
    paddingVertical: 1,
  },
  dvHeaderText: {
    fontSize: 11,
    fontFamily: 'Play-Bold',
    color: '#000',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  indentedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
    paddingLeft: 16,
  },
  doubleIndentedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
    paddingLeft: 32,
  },
  boldLabel: {
    fontSize: 13,
    fontFamily: 'Play-Bold',
    color: '#000',
  },
  label: {
    fontSize: 13,
    fontFamily: 'Play-Regular',
    color: '#000',
    flex: 1,
  },
  italicLabel: {
    fontSize: 13,
    fontFamily: 'Play-Regular',
    fontStyle: 'italic',
    color: '#000',
    flex: 1,
  },
  dvValue: {
    fontSize: 13,
    fontFamily: 'Play-Bold',
    color: '#000',
    textAlign: 'right',
    minWidth: 36,
  },
  footnote: {
    fontSize: 10,
    fontFamily: 'Play-Regular',
    color: '#333',
    marginTop: 4,
    lineHeight: 14,
  },
});

interface Props {
  textBlocks: TextBlock[];
  originalImageWidth: number;
  originalImageHeight: number;
  status: 'idle' | 'identifying' | 'generating-image' | 'complete' | 'image-error';
  setStatus: React.Dispatch<React.SetStateAction<'idle' | 'identifying' | 'generating-image' | 'complete' | 'image-error'>>;
}

export const MenuInteractionOverlay = forwardRef(function MenuInteractionOverlay({ 
  textBlocks, 
  originalImageWidth, 
  originalImageHeight,
  status,
  setStatus
}: Props, ref: any) {
  const { decrementScan } = useProfile();
  const [result, setResult] = useState<DishAnalysisResult | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [viewLayout, setViewLayout] = useState({ width: 0, height: 0 });
  // Contextual info for loading popups
  const [tappedText, setTappedText] = useState<string>('');
  const [identifiedDishName, setIdentifiedDishName] = useState<string>('');
  // Mounted ref to allow cancelling long-running polling when component unmounts
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Client-side cooldown to avoid retrying after quota errors
  const nextAllowedIdentifyAt = useRef<number>(0);

  // Keep a ref to the latest `status` so long-running async loops
  // can see changes without relying on stale closure values.
  const statusRef = useRef<Props['status']>(status);
  useEffect(() => { statusRef.current = status; }, [status]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setViewLayout({ width, height });
  };

  /**
   * CRITICAL: Maps screen touch coordinates [viewX, viewY] to 
   * original image coordinates [imgX, imgY].
   * Assumes the image is displayed with resizeMode="contain".
   */
  const mapCoordinates = (touchX: number, touchY: number): { x: number; y: number } | null => {
    if (viewLayout.width === 0 || viewLayout.height === 0) return null;

    const viewRatio = viewLayout.width / viewLayout.height;
    const imageRatio = originalImageWidth / originalImageHeight;

    let renderWidth = 0, renderHeight = 0, offsetX = 0, offsetY = 0;

    if (viewRatio > imageRatio) {
      // View is wider than image (pillarboxing / black bars on sides)
      renderHeight = viewLayout.height;
      renderWidth = renderHeight * imageRatio;
      offsetX = (viewLayout.width - renderWidth) / 2;
      offsetY = 0;
    } else {
      // View is taller than image (letterboxing / black bars on top/bottom)
      renderWidth = viewLayout.width;
      renderHeight = renderWidth / imageRatio;
      offsetX = 0;
      offsetY = (viewLayout.height - renderHeight) / 2;
    }

    // Check if click is inside the actual image area (ignoring black bars)
    if (
      touchX < offsetX || 
      touchX > offsetX + renderWidth || 
      touchY < offsetY || 
      touchY > offsetY + renderHeight
    ) {
      return null;
    }

    // Convert to relative position (0 to 1) inside the rendered image
    const relX = (touchX - offsetX) / renderWidth;
    const relY = (touchY - offsetY) / renderHeight;

    // Scale up to original image dimensions
    return {
      x: relX * originalImageWidth,
      y: relY * originalImageHeight
    };
  };

  const detectQuotaError = (err: any): { quota: boolean; waitSecs?: number; raw?: string } => {
    try {
      const raw = String(err?.message || err || '');
      let serialized = '';
      try { serialized = JSON.stringify(err); } catch { serialized = raw; }
      const combined = (raw + ' ' + serialized).toLowerCase();
      const quota = /quota|exceeded|429/.test(combined);
      // look for retryDelay in seconds (e.g. "retryDelay":"15s") or RFC Retry-After
      const retryMatch = combined.match(/retrydelay"?:"?(\d+)s/i) || combined.match(/retry-after"?:"?(\d+)s?/i) || combined.match(/retry-?after\s*[:=]\s*(\d+)/i);
      const waitSecs = retryMatch ? Number(retryMatch[1]) : undefined;
      return { quota, waitSecs, raw: combined };
    } catch {
      return { quota: false, raw: String(err) };
    }
  };

  // Get the device's preferred locale for language-aware responses.
  // Uses the standard Intl API available in modern React Native runtimes.
  const deviceLocale = (() => {
    try {
      // Platform-specific: iOS / Android expose locales via Settings / NativeModules,
      // but the Intl API is the most reliable cross-platform approach.
      const locales =
        Platform.OS === 'ios'
          ? (Intl as any).DateTimeFormat().resolvedOptions().locale
          : (Intl as any).DateTimeFormat().resolvedOptions().locale;
      return locales || 'en-US';
    } catch {
      return 'en-US';
    }
  })();

  // Exposed identify function: accepts image-space coordinates (x,y)
  const identifyAtPoint = async (imgX: number, imgY: number) => {
    // imgX/imgY are expected to be window/view coordinates (same coordinate space as textBlocks)
    console.log('[MenuInteractionOverlay] identifyAtPoint received window coords:', { x: imgX, y: imgY, status: statusRef.current, blocks: textBlocks.length });
    if (Date.now() < nextAllowedIdentifyAt.current) {
      const waitMs = Math.max(0, nextAllowedIdentifyAt.current - Date.now());
      alert(`API quota cooldown in effect. Please retry in ${Math.ceil(waitMs/1000)}s.`);
      return;
    }

    if (statusRef.current !== 'idle') return;

    // Find the nearest text block to the tap point for contextual display
    let nearestText = '';
    let minDist = Infinity;
    for (const block of textBlocks) {
      const centerX = block.frame.x + block.frame.width / 2;
      const centerY = block.frame.y + block.frame.height / 2;
      const dist = Math.hypot(imgX - centerX, imgY - centerY);
      if (dist < minDist) {
        minDist = dist;
        nearestText = block.text;
      }
    }
    setTappedText(nearestText);
    setIdentifiedDishName('');

    try {
      setStatus('identifying');
      // For debugging, also compute mapped image coords (if applicable)
      const mapped = mapCoordinates(imgX, imgY);
      console.log('[MenuInteractionOverlay] mapped point (via mapCoordinates):', mapped);

      let data;
      try {
        data = await geminiService.identifyDish(
          imgX,
          imgY,
          textBlocks,
          deviceLocale
        );
      } catch (err: any) {
        console.error('[MenuInteractionOverlay] identifyDish Error:', err);
        const dq = detectQuotaError(err);
        if (dq.quota) {
          const waitSecs = dq.waitSecs ?? 30;
          alert(`API quota exceeded. Please retry in ${waitSecs} seconds.`);
          nextAllowedIdentifyAt.current = Date.now() + (waitSecs * 1000);
          setStatus('idle');
          return;
        }
        // Non-quota error: rethrow to outer catch
        throw err;
      }

      // If the user cancelled while we were waiting for identifyDish, bail out.
      // NOTE: cast needed because TS narrowed the ref from the early `!== 'idle'` guard,
      // but the ref can be mutated externally (e.g. by cancelCurrentOperation) between awaits.
      if ((statusRef.current as string) !== 'identifying') {
        console.log('[MenuInteractionOverlay] identifyDish returned but user cancelled – aborting.');
        return;
      }

      if (!data) {
        // No dish identified — inform user and reset
        alert('No dish identified');
        setStatus('idle');
        return;
      }

      let generatedImage: string | undefined = undefined;
      if (data.imagePrompt) {
        setIdentifiedDishName(data.dishName || '');
        setStatus('generating-image');
        try {
          // Prepend cultural context so the image model reflects the correct
          // cuisine style even when the imagePrompt Gemini wrote is brief.
          const contextPrefix = data.menuType ? `[${data.menuType}] ` : '';
          const enrichedImagePrompt = `${contextPrefix}${data.imagePrompt}`;
          const pollUrl = await blackForestLabsService.generateDishImage(enrichedImagePrompt);
          if (!pollUrl) {
            setImageError('Image service returned no poll URL');
            setStatus('image-error');
            return;
          }
          let attempts = 0;
          const maxAttempts = 10;
          const pollDelay = 2000;
          let lastPollError: string | null = null;

          while (attempts < maxAttempts) {
            if (!mountedRef.current || String(statusRef.current) !== 'generating-image') {
              lastPollError = 'cancelled';
              break;
            }
            attempts++;
            try {
              const pollResult = await blackForestLabsService.pollForImage(pollUrl);
              if (!mountedRef.current || String(statusRef.current) !== 'generating-image') {
                lastPollError = 'cancelled';
                break;
              }
              if (pollResult) {
                if (pollResult.result?.sample) {
                  generatedImage = pollResult.result.sample;
                  break;
                } else if (pollResult.image_url) {
                  generatedImage = pollResult.image_url;
                  break;
                } else if (pollResult.url) {
                  generatedImage = pollResult.url;
                  break;
                } else if (pollResult.imageUrl) {
                  generatedImage = pollResult.imageUrl;
                  break;
                }
                if (pollResult.error) lastPollError = pollResult.error;
              }
            } catch (pollErr: any) {
              lastPollError = pollErr?.message || 'Unknown polling error';
            }
            await new Promise(res => setTimeout(res, pollDelay));
            if (!mountedRef.current || String(statusRef.current) !== 'generating-image') {
              lastPollError = 'cancelled';
              break;
            }
          }

          if (!generatedImage) {
            if (lastPollError === 'cancelled') {
              setStatus('idle');
              return;
            }
            setImageError(lastPollError || 'Image not ready after polling attempts');
            setStatus('image-error');
            return;
          }
        } catch (err: any) {
          setImageError(err?.message || 'Image generation failed');
          setStatus('image-error');
          return;
        }
      }

      setResult({ ...data, generatedImage });
      setStatus('complete');

      // A scan was successfully consumed — decrement the count optimistically
      // on the client and persist to the DB in the background.
      decrementScan();
    } catch (e) {
      console.error('[MenuInteractionOverlay] Outer identifyAtPoint catch:', e);
      const dq = detectQuotaError(e);
      if (dq.quota) {
        const waitSecs = dq.waitSecs ?? 30;
        alert(`API quota exceeded. Please retry in ${waitSecs} seconds.`);
        nextAllowedIdentifyAt.current = Date.now() + (waitSecs * 1000);
        setStatus('idle');
        return;
      }

      alert('Failed to analyze dish.');
      setStatus('idle');
    }
  };

  useImperativeHandle(ref, () => ({ identifyAtPoint }));

  const closeResult = () => {
    setResult(null);
    setStatus('idle');
    setImageError(null);
  };

  /** Cancel any in-flight identification or image-generation and return to idle. */
  const cancelCurrentOperation = () => {
    setStatus('idle');
    setTappedText('');
    setIdentifiedDishName('');
    setResult(null);
    setImageError(null);
  };

  return (
    <View style={styles.container} onLayout={onLayout} pointerEvents={status === 'idle' ? 'box-none' : 'auto'}>
      {/* Touches are installed on individual bounding boxes in the parent view. */}

      {/* Portal 1: Identification Loading */}
      <Modal transparent visible={status === 'identifying'} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.loadingBox}>
            <Pressable
              style={styles.cancelButton}
              onPress={cancelCurrentOperation}
              hitSlop={10}
              accessibilityLabel="Cancel identification"
              accessibilityRole="button"
            >
              <Text style={styles.cancelButtonText}>✕</Text>
            </Pressable>
            <ActivityIndicator size="large" color={Colors.dark} />
            <Text style={styles.loadingText}>Identifying Dish…</Text>
            {tappedText ? (
              <View style={styles.contextBadge}>
                <Text style={styles.contextLabel}>Looking up</Text>
                <Text style={styles.contextValue} numberOfLines={3}>
                  {`"${tappedText}"`}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Portal 2: Image Generation Loading */}
      <Modal transparent visible={status === 'generating-image'} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.loadingBox}>
            <Pressable
              style={styles.cancelButton}
              onPress={cancelCurrentOperation}
              hitSlop={10}
              accessibilityLabel="Cancel image generation"
              accessibilityRole="button"
            >
              <Text style={styles.cancelButtonText}>✕</Text>
            </Pressable>
            <ActivityIndicator size="large" color={Colors.dark} />
            <Text style={styles.loadingText}>Generating Dish Image…</Text>
            {identifiedDishName ? (
              <View style={styles.contextBadge}>
                <Text style={styles.contextLabel}>Creating a photo of</Text>
                <Text style={styles.contextValue} numberOfLines={2}>
                  {`"${identifiedDishName}"`}
                </Text>
              </View>
            ) : (
              <Text style={styles.subLoadingText}>Using AI Imagination</Text>
            )}
          </View>
        </View>
      </Modal>

      {/* Portal 3: Results Display */}
      <Modal transparent visible={status === 'complete' && !!result} animationType="slide" onRequestClose={closeResult}>
        <View style={styles.modalOverlay}>
          <View style={styles.resultCard}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {result && (
                <>
                  {/* Generated Image at the top */}
                   {result.generatedImage ? (
                      <Image 
                        source={{ uri: result.generatedImage }} 
                        style={styles.generatedDishImage} 
                        resizeMode="cover"
                      />
                   ) : (
                      <View style={styles.imagePlaceholder}>
                        <Text style={styles.placeholderText}>No AI Image Generated</Text>
                      </View>
                   )}

                  <Text style={styles.dishTitle}>{result.dishName}</Text>
                  <View style={styles.divider} />

                  {/* ─── Nutrition Facts Label ─── */}
                  {result.nutrition && <NutritionLabel nutrition={result.nutrition} />}

                  <Text style={styles.sectionHeader}>Description</Text>
                  <Text style={styles.bodyText}>{result.description}</Text>
                </>
              )}
            </ScrollView>
            <Pressable style={styles.doneButton} onPress={closeResult} accessibilityLabel="Done" accessibilityRole="button">
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Portal 4: Image Generation Error */}
      <Modal transparent visible={status === 'image-error'} animationType="fade" onRequestClose={closeResult}>
        <View style={styles.modalOverlay}>
          <View style={styles.loadingBox}>
            <Pressable style={styles.cancelButton} onPress={closeResult} hitSlop={10} accessibilityLabel="Close error" accessibilityRole="button">
              <Text style={styles.cancelButtonText}>✕</Text>
            </Pressable>
            <Text style={styles.loadingText}>Image Generation Failed</Text>
            <Text style={styles.subLoadingText}>{imageError || 'An error occurred while generating the image.'}</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

);

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  touchArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  // ─── Shared modal infrastructure ───────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.sm,
  },
  // ─── Loading popup (identifying / generating) ──────────────────────────────
  loadingBox: {
    backgroundColor: Colors.light,
    padding: Spacing.md,
    borderRadius: Spacing.md,
    alignItems: 'center',
    minWidth: 240,
    maxWidth: 320,
    width: '100%',
  },
  // Cancel "X" — no background, icon only
  cancelButton: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  cancelButtonText: {
    fontSize: FontSize.normal,
    fontFamily: Fonts.bold,
    color: Colors.textOnLight,
    opacity: 0.5,
  },
  loadingText: {
    marginTop: Spacing.xs,
    fontSize: FontSize.normal,
    fontFamily: Fonts.bold,
    color: Colors.textOnLight,
    textAlign: 'center',
  },
  subLoadingText: {
    marginTop: Spacing.xs / 2,
    fontSize: FontSize.small,
    fontFamily: Fonts.regular,
    color: Colors.textOnLight,
    opacity: 0.55,
    textAlign: 'center',
  },
  contextBadge: {
    marginTop: Spacing.sm,
    backgroundColor: 'rgba(31,41,51,0.06)',
    borderRadius: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    maxWidth: 280,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dividerLight,
  },
  contextLabel: {
    fontSize: FontSize.small,
    fontFamily: Fonts.bold,
    color: Colors.textOnLight,
    opacity: 0.55,
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  contextValue: {
    fontSize: FontSize.normal,
    fontFamily: Fonts.regular,
    color: Colors.textOnLight,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 22,
  },
  // ─── Result card ───────────────────────────────────────────────────────────
  resultCard: {
    width: '100%',
    maxHeight: '88%',
    backgroundColor: Colors.light,
    borderRadius: Spacing.md,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  scrollContent: {
    paddingBottom: Spacing.sm,
  },
  doneButton: {
    height: Button.height,
    borderRadius: Button.borderRadius,
    backgroundColor: Colors.dark,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  doneButtonText: {
    fontSize: FontSize.normal,
    fontFamily: Fonts.bold,
    color: Colors.textOnDark,
  },
  generatedDishImage: {
    width: '100%',
    height: 240,
    borderRadius: Spacing.xs,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.dividerLight,
  },
  dishTitle: {
    fontSize: FontSize.normal,
    fontFamily: Fonts.bold,
    marginBottom: Spacing.xs / 2,
    color: Colors.textOnLight,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dividerLight,
    marginVertical: Spacing.xs,
  },
  sectionHeader: {
    fontSize: FontSize.small,
    fontFamily: Fonts.bold,
    color: Colors.textOnLight,
    opacity: 0.5,
    marginTop: Spacing.sm,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bodyText: {
    fontSize: FontSize.normal,
    fontFamily: Fonts.regular,
    lineHeight: 24,
    color: Colors.textOnLight,
  },
  imagePlaceholder: {
    height: 144,
    backgroundColor: Colors.dividerLight,
    borderRadius: Spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.dividerLight,
    borderStyle: 'dashed',
  },
  placeholderText: {
    color: Colors.textOnLight,
    fontFamily: Fonts.regular,
    fontSize: FontSize.small,
    opacity: 0.4,
  },
});
