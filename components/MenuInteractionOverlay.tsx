import React, { useState } from 'react';
import {
    ActivityIndicator,
    Button,
    GestureResponderEvent,
    LayoutChangeEvent,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import { DishAnalysisResult, geminiService, TextBlock } from '../app/GeminiService';

interface Props {
  // The actual blocks found by your OCR
  textBlocks: TextBlock[];
  
  // Dimensions of the original image (e.g., from the camera file)
  originalImageWidth: number;
  originalImageHeight: number;
}

export function MenuInteractionOverlay({ 
  textBlocks, 
  originalImageWidth, 
  originalImageHeight 
}: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DishAnalysisResult | null>(null);
  
  // Dimensions of this overlay view on the device screen
  const [viewLayout, setViewLayout] = useState({ width: 0, height: 0 });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setViewLayout({ width, height });
  };

  /**
   * CRITICAL: Maps screen touch coordinates [viewX, viewY] to 
   * original image coordinates [imgX, imgY].
   * Assumes the image is displayed with resizeMode="contain".
   */
  const mapCoordinates = (touchX: number, touchY: number) => {
    if (viewLayout.width === 0 || viewLayout.height === 0) return { x: 0, y: 0 };

    const viewRatio = viewLayout.width / viewLayout.height;
    const imageRatio = originalImageWidth / originalImageHeight;

    let renderWidth, renderHeight, offsetX, offsetY;

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
      console.log("Clicked outside active image area");
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
    if (loading) return;

    const { locationX, locationY } = evt.nativeEvent;
    
    // 1. Triple Check: Ensure coordinates align
    const mappedPoint = mapCoordinates(locationX, locationY);
    
    if (!mappedPoint) {
      // User clicked on the black bars
      return;
    }
    
    console.log("Analyzing Click:", mappedPoint);

    // 2. Show Loading Portal
    setLoading(true);

    try {
      // 3. Call API
      const data = await geminiService.identifyDish(
        mappedPoint.x, 
        mappedPoint.y, 
        textBlocks
      );
      setResult(data);
    } catch (e) {
      console.error(e);
      alert("Failed to analyze dish.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container} onLayout={onLayout}>
      {/* Invisible Touch Layer */}
      <TouchableWithoutFeedback onPress={handlePress}>
        <View style={styles.touchArea} />
      </TouchableWithoutFeedback>

      {/* Portal 1: Loading Spinner */}
      <Modal transparent visible={loading} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#FF6347" />
            <Text style={styles.loadingText}>Identifying Dish...</Text>
          </View>
        </View>
      </Modal>

      {/* Portal 2: Results Display */}
      <Modal transparent visible={!!result} animationType="slide" onRequestClose={() => setResult(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.resultCard}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
              {result && (
                <>
                  <Text style={styles.dishTitle}>{result.dishName}</Text>
                  <View style={styles.divider} />
                  
                  <Text style={styles.sectionHeader}>Description</Text>
                  <Text style={styles.bodyText}>{result.description}</Text>
                  
                  <Text style={styles.sectionHeader}>Estimated Price</Text>
                  <Text style={styles.priceText}>{result.price}</Text>
                  
                  <Text style={styles.sectionHeader}>Nutrition / Info</Text>
                  <Text style={styles.infoText}>{result.nutrients}</Text>
                  
                  <View style={styles.imagePlaceholder}>
                    <Text style={styles.placeholderText}>
                      [AI Image to be generated here]
                    </Text>
                    <Text style={styles.promptDebug}>
                       Prompt: "{result.imagePrompt}"
                    </Text>
                  </View>
                </>
              )}
            </ScrollView>
            <Button title="Close" onPress={() => setResult(null)} />
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
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  resultCard: {
    width: '90%',
    maxHeight: '80%',
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
    marginTop: 20,
    height: 200,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed'
  },
  placeholderText: {
    color: '#999',
    fontWeight: 'bold'
  },
  promptDebug: {
    marginTop: 10,
    fontSize: 10,
    color: '#aaa',
    textAlign: 'center'
  }
});
