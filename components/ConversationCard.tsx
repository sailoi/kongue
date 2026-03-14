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
  language: string;
}

export const ConversationCard: React.FC<ConversationCardProps> = ({ conversation, showTranslation, language }) => {
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
    marginBottom: 24,
    textAlign: 'center',
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
