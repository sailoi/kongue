import React, { useRef, useEffect } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Pressable,
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { API_KEY, VOICE_CHAT_URL, VOICE_CHAT_INTRO_URL, TRANSLATE_URL } from '@/constants/api';

export type ChatMode = 'lesson' | 'progress';
type Status = 'idle' | 'listening' | 'thinking' | 'speaking';

interface Message {
  role: 'user' | 'ai';
  text: string;
  translation?: string;
}

interface LessonContext {
  lessonTitle: string;
  lessonLines: string[];
}

interface ProgressContext {
  completedLessons: number;
  totalLessons: number;
  currentCategory: string;
}

interface VoiceChatModalProps {
  visible: boolean;
  mode: ChatMode;
  onClose: () => void;
  language: string;
  lessonContext?: LessonContext;
  progressContext?: ProgressContext;
}

const MAX_DURATION = 15; // seconds
const MAX_TURNS = 5;

// Use formats Google STT supports natively:
// iOS → WAV (LINEAR16), Android → WEBM (WEBM_OPUS)
const RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension: '.webm',
    outputFormat: Audio.AndroidOutputFormat.WEBM,
    audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  ios: {
    extension: '.wav',
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm;codecs=opus',
    bitsPerSecond: 64000,
  },
};

const STATUS_LABEL: Record<Status, string> = {
  idle: 'Hold to speak',
  listening: 'Listening...',
  thinking: 'Thinking...',
  speaking: 'Speaking...',
};

const PLACEHOLDER_MESSAGES: Record<ChatMode, Message[]> = {
  lesson: [
    { role: 'ai', text: "Hola! I'm here to help you practice this lesson. What would you like to work on?" },
  ],
  progress: [
    { role: 'ai', text: "Hi! I've reviewed your learning journey. What would you like to know about your progress?" },
  ],
};

export const VoiceChatModal: React.FC<VoiceChatModalProps> = ({
  visible,
  mode,
  onClose,
  language,
  lessonContext,
  progressContext,
}) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [status, setStatus] = React.useState<Status>('idle');
  const [messages, setMessages] = React.useState<Message[]>(PLACEHOLDER_MESSAGES[mode]);
  const [timeLeft, setTimeLeft] = React.useState(MAX_DURATION);
  const [turnCount, setTurnCount] = React.useState(0);
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(null);
  const [translatingIndex, setTranslatingIndex] = React.useState<number | null>(null);
  const [showHint, setShowHint] = React.useState(false);
  const hintOpacity = useRef(new Animated.Value(0)).current;

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Reset state and fetch AI intro when modal opens
  useEffect(() => {
    if (visible) {
      setStatus('thinking');
      setMessages([]);
      setTimeLeft(MAX_DURATION);
      setTurnCount(0);
      setExpandedIndex(null);
      setShowHint(false);
      hintOpacity.setValue(0);
      progressAnim.setValue(0);
      fetchIntro();
    } else {
      // Cleanup on close
      stopRecording();
      soundRef.current?.unloadAsync();
    }
  }, [visible, mode]);

  // Pulse animation while listening
  useEffect(() => {
    if (status === 'listening') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [status]);

  // Auto-stop when countdown reaches zero
  useEffect(() => {
    if (timeLeft === 0 && status === 'listening') {
      stopRecording();
    }
  }, [timeLeft, status]);

  // Scroll to bottom when messages change
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  const fetchIntro = async () => {
    try {
      const ctx = mode === 'lesson'
        ? JSON.stringify(lessonContext ?? {})
        : JSON.stringify(progressContext ?? {});

      const formData = new FormData();
      formData.append('language', language);
      formData.append('mode', mode);
      formData.append('context', ctx);

      const response = await fetch(VOICE_CHAT_INTRO_URL, {
        method: 'POST',
        headers: { 'X-Api-Key': API_KEY },
        body: formData,
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const data = await response.json();
      setMessages([{ role: 'ai', text: data.response }]);
      setStatus('speaking');
      await playBase64Audio(data.audio);
      setStatus('idle');
      setShowHint(true);
      Animated.sequence([
        Animated.timing(hintOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.delay(5000),
        Animated.timing(hintOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start(() => setShowHint(false));
    } catch (err) {
      console.error('Intro fetch error:', err);
      setMessages([{ role: 'ai', text: PLACEHOLDER_MESSAGES[mode][0].text }]);
      setStatus('idle');
    }
  };

  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        setMessages(prev => [...prev, { role: 'ai', text: 'Microphone permission is required.' }]);
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
      recordingRef.current = recording;

      setTimeLeft(MAX_DURATION);
      progressAnim.setValue(0);

      Animated.timing(progressAnim, {
        toValue: 1,
        duration: MAX_DURATION * 1000,
        useNativeDriver: false,
      }).start();

      timerRef.current = setInterval(() => {
        setTimeLeft(prev => Math.max(0, prev - 1));
      }, 1000);

      setStatus('listening');
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    progressAnim.stopAnimation();
    progressAnim.setValue(0);
    setTimeLeft(MAX_DURATION);

    const recording = recordingRef.current;
    if (!recording) return;
    recordingRef.current = null;

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch (err) {
      console.error('Failed to stop recording:', err);
      return;
    }

    const uri = recording.getURI();
    if (!uri) return;

    setStatus('thinking');
    await callVoiceChatAPI(uri);
  };

  const callVoiceChatAPI = async (audioUri: string) => {
    try {
      const ctx = mode === 'lesson'
        ? JSON.stringify(lessonContext ?? {})
        : JSON.stringify(progressContext ?? {});

      const formData = new FormData();
      const isAndroid = Platform.OS === 'android';
      formData.append('audio', {
        uri: audioUri,
        type: isAndroid ? 'audio/webm' : 'audio/wav',
        name: isAndroid ? 'recording.webm' : 'recording.wav',
      } as any);
      formData.append('language', language);
      formData.append('mode', mode);
      formData.append('context', ctx);

      const response = await fetch(VOICE_CHAT_URL, {
        method: 'POST',
        headers: { 'X-Api-Key': API_KEY },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      const { transcript, response: aiText, audio: audioBase64 } = data;

      setMessages(prev => [...prev, { role: 'user', text: transcript }]);

      const nextTurn = turnCount + 1;
      setTurnCount(nextTurn);
      setMessages(prev => [
        ...prev,
        { role: 'ai' as const, text: aiText },
        ...(nextTurn >= MAX_TURNS
          ? [{ role: 'ai' as const, text: `That's our ${MAX_TURNS} exchanges for this session! Close and reopen to start a new conversation.` }]
          : []),
      ]);
      setStatus('speaking');
      await playBase64Audio(audioBase64);
      setStatus('idle');
    } catch (err) {
      console.error('Voice chat API error:', err);
      setMessages(prev => [...prev, { role: 'ai', text: 'Sorry, something went wrong. Please try again.' }]);
      setStatus('idle');
    }
  };

  const playBase64Audio = async (base64: string) => {
    try {
      soundRef.current?.unloadAsync();
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/mp3;base64,${base64}` }
      );
      soundRef.current = sound;
      await sound.playAsync();
      await new Promise<void>((resolve) => {
        sound.setOnPlaybackStatusUpdate((s) => {
          if (s.isLoaded && 'didJustFinish' in s && s.didJustFinish) {
            resolve();
          }
        });
      });
    } catch (err) {
      console.error('Failed to play audio response:', err);
    }
  };

  const handleLongPress = async (i: number) => {
    // Toggle off if already expanded
    if (expandedIndex === i) {
      setExpandedIndex(null);
      return;
    }
    setExpandedIndex(i);
    // Already cached
    if (messages[i].translation) return;
    // Fetch translation
    setTranslatingIndex(i);
    try {
      const response = await fetch(TRANSLATE_URL, {
        method: 'POST',
        headers: { 'X-Api-Key': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: messages[i].text }),
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setMessages(prev => prev.map((m, idx) =>
        idx === i ? { ...m, translation: data.translation } : m
      ));
    } catch {
      setMessages(prev => prev.map((m, idx) =>
        idx === i ? { ...m, translation: 'Translation unavailable.' } : m
      ));
    } finally {
      setTranslatingIndex(null);
    }
  };

  const handlePressIn = () => {
    if (status !== 'idle') return;
    startRecording();
  };

  const handlePressOut = () => {
    if (status !== 'listening') return;
    stopRecording();
  };

  const isLimitReached = turnCount >= MAX_TURNS;
  const isDisabled = status === 'thinking' || status === 'speaking' || isLimitReached;
  const isWarning = timeLeft <= 5 && status === 'listening';
  const micColor = status === 'listening'
    ? '#E53E3E'
    : isDisabled ? '#999' : colors.tint;
  const progressColor = '#E53E3E';

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>
            {mode === 'lesson' ? 'Lesson Chat' : 'My Progress Chat'}
          </ThemedText>
          <View style={styles.closeButton} />
        </View>

        {/* Transcript */}
        <ScrollView
          ref={scrollRef}
          style={styles.transcript}
          contentContainerStyle={styles.transcriptContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg, i) => (
            <TouchableOpacity
              key={i}
              activeOpacity={0.7}
              onLongPress={() => handleLongPress(i)}
              style={[
                styles.bubble,
                msg.role === 'user' ? styles.userBubble : styles.aiBubble,
                { backgroundColor: msg.role === 'user' ? colors.tint : colorScheme === 'dark' ? '#2D2D2D' : '#F0F0F0' },
              ]}
            >
              <ThemedText style={[
                styles.bubbleText,
                msg.role === 'user' && styles.userBubbleText,
              ]}>
                {msg.text}
              </ThemedText>
              {expandedIndex === i && (
                translatingIndex === i
                  ? <ThemedText style={[styles.translationText, msg.role === 'user' && styles.userTranslationText]}>Translating...</ThemedText>
                  : msg.translation
                    ? <ThemedText style={[styles.translationText, msg.role === 'user' && styles.userTranslationText]}>{msg.translation}</ThemedText>
                    : null
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Long-press hint */}
        {showHint && (
          <Animated.View style={[styles.hintBanner, { opacity: hintOpacity }]}>
            <ThemedText style={styles.hintText}>Long press any message to see the English translation</ThemedText>
          </Animated.View>
        )}

        {/* Status + Mic */}
        <View style={styles.controls}>
          <ThemedText style={[styles.statusLabel, isWarning && styles.warningText]}>
            {status === 'listening' ? `${timeLeft}s` : STATUS_LABEL[status]}
          </ThemedText>

          {status === 'thinking' && (
            <ThemedText style={styles.thinkingDots}>···</ThemedText>
          )}

          {/* Progress bar — only visible while listening */}
          {status === 'listening' && (
            <View style={styles.progressBarTrack}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    backgroundColor: progressColor,
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
          )}

          <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={isDisabled}
          >
            <Animated.View style={[
              styles.micRing,
              { borderColor: micColor, transform: [{ scale: pulseAnim }], opacity: isDisabled ? 0.4 : 1 },
            ]}>
              <View style={[styles.micButton, { backgroundColor: micColor }]}>
                <Ionicons
                  name={status === 'listening' ? 'stop' : 'mic'}
                  size={36}
                  color="#fff"
                />
              </View>
            </Animated.View>
          </Pressable>
        </View>
      </ThemedView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  closeButton: {
    width: 44,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  transcript: {
    flex: 1,
  },
  transcriptContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    padding: 16,
    gap: 12,
  },
  bubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userBubbleText: {
    color: '#fff',
  },
  translationText: {
    fontSize: 13,
    fontStyle: 'italic',
    opacity: 0.6,
    marginTop: 6,
  },
  userTranslationText: {
    color: '#fff',
  },
  hintBanner: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  hintText: {
    fontSize: 12,
    opacity: 0.5,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  controls: {
    alignItems: 'center',
    paddingBottom: 56,
    paddingTop: 24,
    gap: 12,
  },
  statusLabel: {
    fontSize: 14,
    opacity: 0.5,
  },
  warningText: {
    opacity: 1,
    color: '#E53E3E',
    fontWeight: '600',
  },
  thinkingDots: {
    fontSize: 28,
    opacity: 0.4,
    letterSpacing: 4,
  },
  progressBarTrack: {
    width: '60%',
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.2)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  micRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
