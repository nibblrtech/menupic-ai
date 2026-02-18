import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Button,
    Image,
    LayoutChangeEvent,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { blackForestLabsService } from '../app/BlackForestLabsService';
import { DishAnalysisResult, geminiService, TextBlock } from '../app/GeminiService';

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
      try { serialized = JSON.stringify(err); } catch (_) { serialized = raw; }
      const combined = (raw + ' ' + serialized).toLowerCase();
      const quota = /quota|exceeded|429/.test(combined);
      // look for retryDelay in seconds (e.g. "retryDelay":"15s") or RFC Retry-After
      const retryMatch = combined.match(/retrydelay"?:"?(\d+)s/i) || combined.match(/retry-after"?:"?(\d+)s?/i) || combined.match(/retry-?after\s*[:=]\s*(\d+)/i);
      const waitSecs = retryMatch ? Number(retryMatch[1]) : undefined;
      return { quota, waitSecs, raw: combined };
    } catch (e) {
      return { quota: false, raw: String(err) };
    }
  };

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
          textBlocks
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
          const pollUrl = await blackForestLabsService.generateDishImage(data.imagePrompt);
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
            <ActivityIndicator size="large" color="#FF6347" />
            <Text style={styles.loadingText}>Identifying Dish…</Text>
            {tappedText ? (
              <View style={styles.contextBadge}>
                <Text style={styles.contextLabel}>🔍 Looking up</Text>
                <Text style={styles.contextValue} numberOfLines={3}>
                  "{tappedText}"
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
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Generating Dish Image…</Text>
            {identifiedDishName ? (
              <View style={styles.contextBadge}>
                <Text style={styles.contextLabel}>🎨 Creating a photo of</Text>
                <Text style={styles.contextValue} numberOfLines={2}>
                  "{identifiedDishName}"
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
            <ScrollView contentContainerStyle={styles.scrollContent}>
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
                        <Text style={styles.placeholderText}>[No AI Image Generated]</Text>
                      </View>
                   )}

                  <Text style={styles.dishTitle}>{result.dishName}</Text>
                  <View style={styles.divider} />
                  
                  <Text style={styles.sectionHeader}>Description</Text>
                  <Text style={styles.bodyText}>{result.description}</Text>
                  
                  <View style={styles.debugSection}>
                    <Text style={styles.promptDebug}>
                       Prompt: "{result.imagePrompt}"
                    </Text>
                  </View>
                </>
              )}
            </ScrollView>
            <Button title="Close" onPress={closeResult} />
          </View>
        </View>
      </Modal>

      {/* Portal 4: Image Generation Error */}
      <Modal transparent visible={status === 'image-error'} animationType="fade" onRequestClose={closeResult}>
        <View style={styles.modalOverlay}>
          <View style={styles.loadingBox}>
            <Text style={styles.loadingText}>Image Generation Failed</Text>
            <Text style={styles.subLoadingText}>{imageError || 'An error occurred while generating the image.'}</Text>
            <Button title="Close" onPress={closeResult} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

);

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject, // Covers the parent view
    zIndex: 10,
  },
  touchArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBox: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 200,
  },
  cancelButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#888',
    lineHeight: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center'
  },
  subLoadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#888',
    textAlign: 'center'
  },
  contextBadge: {
    marginTop: 16,
    backgroundColor: '#F7F7FA',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    maxWidth: 260,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8EE',
  },
  contextLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    letterSpacing: 0.3,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  contextValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 21,
  },
  resultCard: {
    width: '90%',
    maxHeight: '85%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  generatedDishImage: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    marginBottom: 15,
    backgroundColor: '#eee',
  },
  dishTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 10,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#888',
    marginTop: 15,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  bodyText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#444',
  },
  priceText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2e7d32',
  },
  infoText: {
    fontSize: 15,
    color: '#555',
    fontStyle: 'italic',
  },
  imagePlaceholder: {
    height: 150,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed'
  },
  placeholderText: {
    color: '#999',
    fontWeight: 'bold'
  },
  debugSection: {
    marginTop: 20, 
    borderTopWidth: 1, 
    borderTopColor: '#eee', 
    paddingTop: 10
  },
  promptDebug: {
    fontSize: 10,
    color: '#aaa',
    textAlign: 'center'
  }
});
