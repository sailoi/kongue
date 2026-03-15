import { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import useDailyConversations from '@/hooks/useDailySentences';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { ConversationCard } from '@/components/ConversationCard';
import { SettingsModal } from '@/components/SettingsModal';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useNavigation } from 'expo-router';
import { CATEGORIES } from '@/constants/categories';
import { conversationData } from '@/constants/conversations';
import { DEFAULT_LANGUAGE } from '@/constants/languages';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function HomeScreen() {
  const [currentLanguage, setCurrentLanguage] = useState(DEFAULT_LANGUAGE);
  const [currentCategory, setCurrentCategory] = useState<string>(CATEGORIES[0].id);
  const {
    conversation,
    nextConversation,
    previousConversation,
    currentIndex,
    setConversationIndex,
    isLoading,
    totalLessons,
  } = useDailyConversations(currentLanguage as any, currentCategory as any);
  const [showTranslation, setShowTranslation] = useState(false);
  const [showVocabulary, setShowVocabulary] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const colorScheme = useColorScheme();
  const navigation = useNavigation();

  // Load saved language on mount
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem('selectedLanguage');
        if (savedLanguage) {
          setCurrentLanguage(savedLanguage);
        }
      } catch (error) {
        console.error('Failed to load language', error);
      }
    };
    loadLanguage();
  }, []);

  // Save language when it changes
  useEffect(() => {
    AsyncStorage.setItem('selectedLanguage', currentLanguage);
  }, [currentLanguage]);

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <Ionicons
            name="menu"
            size={28}
            color={Colors[colorScheme ?? 'light'].text}
            style={{ marginLeft: 15 }}
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, colorScheme]);

  if (isLoading || !conversation) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Loading conversation...</ThemedText>
      </ThemedView>
    );
  }

  const resetCardState = () => {
    setShowTranslation(false);
    setShowVocabulary(false);
  };

  const flingNext = Gesture.Fling()
    .direction(1)
    .onEnd(() => {
      resetCardState();
      nextConversation();
    });

  const flingPrev = Gesture.Fling()
    .direction(2)
    .onEnd(() => {
      resetCardState();
      previousConversation();
    });

  const handlePrevious = () => {
    resetCardState();
    previousConversation();
  };

  const handleNext = () => {
    resetCardState();
    nextConversation();
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={Gesture.Race(flingNext, flingPrev)}>
        <ThemedView style={styles.container}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <ConversationCard conversation={conversation} showTranslation={showTranslation} showVocabulary={showVocabulary} language={currentLanguage} />
            <View style={styles.buttonRow}>
              <TouchableOpacity onPress={() => setShowTranslation(!showTranslation)} style={styles.actionButton}>
                <ThemedText style={styles.actionButtonText}>{showTranslation ? 'Hide Explain' : 'Explain'}</ThemedText>
              </TouchableOpacity>
              {conversation.vocabulary && conversation.vocabulary.length > 0 && (
                <TouchableOpacity onPress={() => setShowVocabulary(!showVocabulary)} style={[styles.actionButton, styles.vocabularyButton]}>
                  <ThemedText style={styles.actionButtonText}>{showVocabulary ? 'Hide Vocab' : 'Vocabulary'}</ThemedText>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.navigationContainer}>
              <TouchableOpacity onPress={handlePrevious} style={styles.navButton}>
                <Ionicons name="arrow-back" size={24} color={Colors[colorScheme ?? 'light'].text} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleNext} style={styles.navButton}>
                <Ionicons name="arrow-forward" size={24} color={Colors[colorScheme ?? 'light'].text} />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </ThemedView>
      </GestureDetector>

      <SettingsModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSelectLesson={setConversationIndex}
        currentLesson={currentIndex}
        totalLessons={totalLessons}
        onSelectCategory={setCurrentCategory}
        currentCategory={currentCategory}
        onSelectLanguage={setCurrentLanguage}
        currentLanguage={currentLanguage}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    backgroundColor: '#4A90E2',
  },
  vocabularyButton: {
    backgroundColor: '#7B68EE',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '60%',
    marginTop: 30,
  },
  navButton: {
    padding: 20,
    borderRadius: 50,
  },
});
