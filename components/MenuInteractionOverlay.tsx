import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Button,
    GestureResponderEvent,
    Image,
    LayoutChangeEvent,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableWithoutFeedback,
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

export function MenuInteractionOverlay({ 
  textBlocks, 
  originalImageWidth, 
  originalImageHeight,
  status,
  setStatus
}: Props) {
  const [result, setResult] = useState<DishAnalysisResult | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [viewLayout, setViewLayout] = useState({ width: 0, height: 0 });
  // Mounted ref to allow cancelling long-running polling when component unmounts
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Keep a ref to the latest `status` so long-running async loops
  // can see changes without relying on stale closure values.
  const statusRef = useRef(status);
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

  const handlePress = async (evt: GestureResponderEvent) => {
    if (status !== 'idle') return;

    const { locationX, locationY } = evt.nativeEvent;
    const mappedPoint = mapCoordinates(locationX, locationY);
    if (!mappedPoint) return;

    try {
      setStatus('identifying');
      const data = await geminiService.identifyDish(
        mappedPoint.x,
        mappedPoint.y,
        textBlocks
      );

      if (!data) {
        throw new Error('No dish identified');
      }

      let generatedImage: string | undefined = undefined;
      if (data.imagePrompt) {
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
            if (!mountedRef.current || statusRef.current !== 'generating-image') {
              lastPollError = 'cancelled';
              break;
            }
            attempts++;
            try {
              const pollResult = await blackForestLabsService.pollForImage(pollUrl);
              if (!mountedRef.current || statusRef.current !== 'generating-image') {
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
            if (!mountedRef.current || statusRef.current !== 'generating-image') {
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
      console.error(e);
      alert('Failed to analyze dish.');
      setStatus('idle');
    }
  };

  const closeResult = () => {
    setResult(null);
    setStatus('idle');
    setImageError(null);
  };

  return (
    <View style={styles.container} onLayout={onLayout}>
      {/* Invisible Touch Layer */}
      <TouchableWithoutFeedback onPress={handlePress}>
        <View style={styles.touchArea} />
      </TouchableWithoutFeedback>

      {/* Portal 1: Identification Loading */}
      <Modal transparent visible={status === 'identifying'} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#FF6347" />
            <Text style={styles.loadingText}>Identifying Dish...</Text>
          </View>
        </View>
      </Modal>

      {/* Portal 2: Image Generation Loading */}
      <Modal transparent visible={status === 'generating-image'} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Generating Dish Image...</Text>
            <Text style={styles.subLoadingText}>Using AI Imagination</Text>
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
