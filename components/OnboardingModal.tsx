import React, { useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

interface OnboardingModalProps {
  visible: boolean;
  onDone: (name: string) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ visible, onDone }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [name, setName] = useState('');

  const handleContinue = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onDone(trimmed);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={false}>
      <ThemedView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.inner}
        >
          <ThemedText type="title" style={styles.appName}>Kongue</ThemedText>
          <ThemedText style={styles.tagline}>Your personal language tutor</ThemedText>

          <View style={styles.form}>
            <ThemedText style={styles.question}>What's your name?</ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: colors.tint,
                  backgroundColor: colorScheme === 'dark' ? '#2D2D2D' : '#F5F5F5',
                },
              ]}
              placeholder="Enter your name"
              placeholderTextColor={colorScheme === 'dark' ? '#888' : '#aaa'}
              value={name}
              onChangeText={setName}
              onSubmitEditing={handleContinue}
              returnKeyType="done"
              autoFocus
              autoCapitalize="words"
            />
            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: colors.tint, opacity: name.trim() ? 1 : 0.4 },
              ]}
              onPress={handleContinue}
              disabled={!name.trim()}
            >
              <ThemedText style={styles.buttonText}>Let's go</ThemedText>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </ThemedView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  appName: {
    fontSize: 48,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    opacity: 0.5,
    marginBottom: 64,
  },
  form: {
    width: '100%',
    gap: 16,
  },
  question: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    fontSize: 18,
    textAlign: 'center',
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
