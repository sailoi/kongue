import React, { useState } from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ visible, onClose }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { signInWithGoogle, signInWithApple, isAppleAvailable } = useAuth();
  const [loading, setLoading] = useState<'google' | 'apple' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    setError(null);
    setLoading('google');
    try {
      await signInWithGoogle();
      onClose();
    } catch (e: any) {
      if (e.code !== 'SIGN_IN_CANCELLED') {
        setError('Google sign-in failed. Please try again.');
      }
    } finally {
      setLoading(null);
    }
  };

  const handleApple = async () => {
    setError(null);
    setLoading('apple');
    try {
      await signInWithApple();
      onClose();
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        setError('Apple sign-in failed. Please try again.');
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <ThemedView style={styles.sheet}>
          <View style={styles.header}>
            <ThemedText type="subtitle" style={styles.title}>Sign in</ThemedText>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ThemedText style={styles.subtitle}>
            Sign in to sync your progress across devices and unlock premium features.
          </ThemedText>

          {error && (
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          )}

          {isAppleAvailable && (
            <TouchableOpacity
              style={[styles.button, styles.appleButton]}
              onPress={handleApple}
              disabled={!!loading}
            >
              {loading === 'apple' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="logo-apple" size={20} color="#fff" />
                  <ThemedText style={styles.appleButtonText}>Continue with Apple</ThemedText>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.button, styles.googleButton, { borderColor: colorScheme === 'dark' ? '#444' : '#ddd' }]}
            onPress={handleGoogle}
            disabled={!!loading}
          >
            {loading === 'google' ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#4285F4" />
                <ThemedText style={[styles.googleButtonText, { color: colors.text }]}>
                  Continue with Google
                </ThemedText>
              </>
            )}
          </TouchableOpacity>
        </ThemedView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.6,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 13,
    color: '#E53935',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
  },
  appleButton: {
    backgroundColor: '#000',
  },
  appleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  googleButton: {
    borderWidth: 1.5,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
