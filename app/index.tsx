import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import useDailyConversations from '@/hooks/useDailySentences';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { ConversationCard } from '@/components/ConversationCard';
import { SettingsModal } from '@/components/SettingsModal';
import { VoiceChatModal, ChatMode } from '@/components/VoiceChatModal';
import { OnboardingModal } from '@/components/OnboardingModal';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useNavigation } from 'expo-router';
import { CATEGORIES } from '@/constants/categories';
import { conversationData } from '@/constants/conversations';
import { DEFAULT_LANGUAGE } from '@/constants/languages';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/hooks/useAuth';
import { syncUserProfile, syncLessonProgress, loadUserFromCloud } from '@/utils/userSync';

export default function HomeScreen() {
  const [currentLanguage, setCurrentLanguage] = useState(DEFAULT_LANGUAGE);
  const [userName, setUserName] = useState<string | null>(null);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<string>(CATEGORIES[0].id);
  const { user } = useAuth();
  const userId = user?.uid ?? null;

  const [freeformContext, setFreeformContext] = React.useState<{ categoryName: string; dialogueLines: string[] } | undefined>();

  const handleStartFreeformChat = useCallback((categoryId: string) => {
    const categoryData = (conversationData as any)[currentLanguage]?.[categoryId] ?? [];
    const dialogueLines = categoryData.flatMap((lesson: any) =>
      lesson.dialogue.map((line: any) => line[currentLanguage] || line.spanish || line.turkish || '')
    ).filter(Boolean);
    setFreeformContext({
      categoryName: CATEGORIES.find(c => c.id === categoryId)?.name ?? categoryId,
      dialogueLines,
    });
    setModalVisible(false);
    setVoiceChatMode('freeform');
  }, [currentLanguage]);

  const handleProgressUpdate = useCallback((maxIndex: number) => {
    if (userId) {
      syncLessonProgress(userId, currentLanguage, currentCategory, maxIndex);
    }
  }, [userId, currentLanguage, currentCategory]);

  const {
    conversation,
    nextConversation,
    previousConversation,
    currentIndex,
    setConversationIndex,
    isLoading,
    totalLessons,
    completedLessons,
  } = useDailyConversations(currentLanguage as any, currentCategory as any, handleProgressUpdate);
  const [showTranslation, setShowTranslation] = useState(false);
  const [showVocabulary, setShowVocabulary] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [voiceChatMode, setVoiceChatMode] = useState<ChatMode | null>(null);
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

  // Save language when it changes and sync to cloud
  useEffect(() => {
    AsyncStorage.setItem('selectedLanguage', currentLanguage);
    if (userId && userName) {
      syncUserProfile(userId, userName, currentLanguage);
    }
  }, [currentLanguage, userId, userName]);

  // Load user name on mount; restore cloud progress if this is a fresh install
  useEffect(() => {
    AsyncStorage.getItem('userName').then(async (stored) => {
      if (stored) {
        setUserName(stored);
      }
      setOnboardingDone(true);
    });
  }, []);

  // When userId is first available, restore progress from cloud (new device / reinstall)
  useEffect(() => {
    if (!userId) return;
    const restoreFromCloud = async () => {
      const hasLocal = await AsyncStorage.getItem('cloudSynced');
      if (hasLocal) return; // already restored once
      const data = await loadUserFromCloud(userId);
      if (!data?.exists || !data.progress) return;
      const writes: Promise<void>[] = [];
      for (const [key, val] of Object.entries(data.progress)) {
        writes.push(AsyncStorage.setItem(`maxLessonIndex_${key}`, val.maxIndex.toString()));
      }
      await Promise.all(writes);
      await AsyncStorage.setItem('cloudSynced', '1');
    };
    restoreFromCloud();
  }, [userId]);

  const handleOnboardingDone = (name: string) => {
    setUserName(name);
    AsyncStorage.setItem('userName', name);
    if (userId) {
      syncUserProfile(userId, name, currentLanguage);
    }
  };

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
            <ConversationCard conversation={conversation} showTranslation={showTranslation} showVocabulary={showVocabulary} language={currentLanguage} currentIndex={currentIndex} totalLessons={totalLessons} />
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
            <View style={styles.aiButtonRow}>
              <TouchableOpacity
                style={styles.aiButton}
                onPress={() => setVoiceChatMode('lesson')}
              >
                <Ionicons name="chatbubble-outline" size={16} color={Colors[colorScheme ?? 'light'].tint} />
                <ThemedText style={styles.aiButtonText}>AI Tutor</ThemedText>
              </TouchableOpacity>
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

      {voiceChatMode && (
        <VoiceChatModal
          visible={!!voiceChatMode}
          mode={voiceChatMode}
          onClose={() => setVoiceChatMode(null)}
          language={currentLanguage}
          userName={userName ?? undefined}
          lessonContext={{
            lessonTitle: conversation.title,
            lessonLines: conversation.dialogue.map(
              (line: any) => `${line.speaker}: ${line[currentLanguage] || line.spanish || line.turkish || ''}`
            ),
          }}
          freeformContext={freeformContext}
        />
      )}
      <OnboardingModal
        visible={onboardingDone && !userName}
        onDone={handleOnboardingDone}
      />
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
        onStartFreeformChat={handleStartFreeformChat}
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
  aiButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: '#4A90E2',
  },
  aiButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A90E2',
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
