import React from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Conversation } from '@/hooks/useDailySentences';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import useTextToSpeech from '@/hooks/useTextToSpeech';
import { ErrorToast } from '@/components/ErrorToast';

interface ConversationCardProps {
  conversation: Conversation;
  showTranslation: boolean;
  showVocabulary: boolean;
  language: string;
  currentIndex: number;
  totalLessons: number;
}

export const ConversationCard: React.FC<ConversationCardProps> = ({ conversation, showTranslation, showVocabulary, language, currentIndex, totalLessons }) => {
  const colorScheme = useColorScheme();
  const { playSpeech, isLoading, error, clearError } = useTextToSpeech();
  const [loadingLine, setLoadingLine] = React.useState<number | null>(null);

  const getTargetText = (line: any) => {
    return line[language] || line.spanish || line.turkish || '';
  };

  const speak = (text: string, speaker: string, index: number) => {
    const gender = speaker === 'A' ? 'female' : 'male';
    setLoadingLine(index);
    playSpeech(text, gender as 'male' | 'female', language);
  };

  React.useEffect(() => {
    if (!isLoading) {
      setLoadingLine(null);
    }
  }, [isLoading]);

  return (
    <ThemedView style={styles.card}>
      <ErrorToast message={error} onDismiss={clearError} />
      <ThemedText type="title" style={styles.title}>{conversation.title}</ThemedText>
      <ThemedText style={styles.lessonPosition}>{currentIndex + 1} / {totalLessons}</ThemedText>
      <View style={styles.dialogueContainer}>
        {conversation.dialogue.map((line, index) => (
          <View key={index} style={styles.line}>
            <ThemedText style={styles.speaker}>{line.speaker}: </ThemedText>
            <View style={styles.textContainer}>
              <ThemedText style={styles.targetLanguage}>{getTargetText(line)}</ThemedText>
              {showTranslation && <ThemedText style={styles.english}>{line.english}</ThemedText>}
            </View>
            <TouchableOpacity
              onPress={() => speak(getTargetText(line), line.speaker, index)}
              style={styles.speakerIcon}
              disabled={isLoading && loadingLine === index}
            >
              {isLoading && loadingLine === index ? (
                <ActivityIndicator size="small" color={Colors[colorScheme ?? 'light'].text} />
              ) : (
                <Ionicons name="volume-medium-outline" size={24} color={Colors[colorScheme ?? 'light'].text} />
              )}
            </TouchableOpacity>
          </View>
        ))}
      </View>
      {showTranslation && (
        <View style={styles.descriptionContainer}>
          <ThemedText style={styles.description}>{conversation.description}</ThemedText>
        </View>
      )}
      {showVocabulary && conversation.vocabulary && conversation.vocabulary.length > 0 && (
        <View style={styles.vocabularyContainer}>
          <ThemedText style={styles.vocabularyTitle}>Vocabulary</ThemedText>
          {conversation.vocabulary.map((item, index) => {
            const targetText = item[language as keyof typeof item] as string || '';
            return (
              <View key={index} style={styles.vocabularyRow}>
                <View style={styles.vocabularyTextContainer}>
                  <ThemedText style={styles.vocabularyTarget}>{targetText}</ThemedText>
                  <ThemedText style={styles.vocabularyEnglish}>{item.english}</ThemedText>
                </View>
                <TouchableOpacity
                  onPress={() => speak(targetText, 'A', index + 1000)}
                  style={styles.speakerIcon}
                  disabled={isLoading && loadingLine === index + 1000}
                >
                  {isLoading && loadingLine === index + 1000 ? (
                    <ActivityIndicator size="small" color={Colors[colorScheme ?? 'light'].text} />
                  ) : (
                    <Ionicons name="volume-medium-outline" size={20} color={Colors[colorScheme ?? 'light'].text} />
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 24,
    borderRadius: 16,
    margin: 16,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    marginBottom: 6,
    textAlign: 'center',
  },
  lessonPosition: {
    fontSize: 12,
    opacity: 0.4,
    textAlign: 'center',
    marginBottom: 20,
  },
  dialogueContainer: {
    gap: 20,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  speaker: {
    fontWeight: 'bold',
    marginRight: 8,
    fontSize: 16,
  },
  textContainer: {
    flex: 1,
  },
  targetLanguage: {
    fontSize: 16,
    marginBottom: 4,
  },
  english: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
  },
  speakerIcon: {
    marginLeft: 16,
  },
  vocabularyContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  vocabularyTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    opacity: 0.5,
    marginBottom: 12,
  },
  vocabularyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  vocabularyTextContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  vocabularyTarget: {
    fontSize: 15,
    fontWeight: '600',
    minWidth: 100,
  },
  vocabularyEnglish: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
    flex: 1,
  },
  descriptionContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  description: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
  },
});
