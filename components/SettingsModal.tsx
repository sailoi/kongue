import React from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { CATEGORIES, STAGES } from '@/constants/categories';
import useProgress from '@/hooks/useProgress';
import { LANGUAGES } from '@/constants/languages';
import { useAuth } from '@/hooks/useAuth';
import { AuthModal } from '@/components/AuthModal';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectLesson: (index: number) => void;
  currentLesson: number;
  totalLessons: number;
  onSelectCategory: (category: string) => void;
  currentCategory: string;
  onSelectLanguage: (language: string) => void;
  currentLanguage: string;
  onStartFreeformChat: (categoryId: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  onSelectLesson,
  currentLesson,
  totalLessons,
  onSelectCategory,
  currentCategory,
  onSelectLanguage,
  currentLanguage,
  onStartFreeformChat,
}) => {
  const colorScheme = useColorScheme();
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  const { categoryProgress, stageProgress } = useProgress(currentLanguage, refreshKey);
  const { user, isSignedIn, signOut } = useAuth();

  React.useEffect(() => {
    if (visible) setRefreshKey(k => k + 1);
  }, [visible]);

  const handleSelectCategory = (category: string) => {
    onSelectCategory(category);
    onSelectLesson(0); // Reset to first lesson of new category
    onClose(); // Close menu after selection
  };

  const handleSelectLanguage = (language: string) => {
    onSelectLanguage(language);
    onSelectLesson(0); // Reset to first lesson of new language
    onClose(); // Close menu after selection
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <ThemedView style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <ThemedText type="title" style={styles.modalTitle}>Menu</ThemedText>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color={Colors[colorScheme ?? 'light'].text} />
            </TouchableOpacity>
          </View>

          {/* Category Section */}
          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>Categories</ThemedText>
            <ScrollView style={styles.categoryScrollView} showsVerticalScrollIndicator={false}>
              {STAGES.map((stage) => {
                const stageCategories = CATEGORIES.filter(c => c.stage === stage.id);
                return (
                  <View key={stage.id} style={styles.stageGroup}>
                    <View style={styles.stageLabelRow}>
                      <ThemedText style={styles.stageLabel}>{stage.name}</ThemedText>
                      {stageProgress[stage.id]?.allDone && (
                        <Ionicons name="checkmark-circle" size={14} color={Colors[colorScheme ?? 'light'].tint} />
                      )}
                    </View>
                    {stageCategories.map((category) => {
                      const isSelected = currentCategory === category.id;
                      return (
                        <React.Fragment key={category.id}>
                          <TouchableOpacity
                            style={[
                              styles.categoryButton,
                              {
                                backgroundColor: isSelected
                                  ? Colors[colorScheme ?? 'light'].tint
                                  : colorScheme === 'dark'
                                    ? 'rgba(255, 255, 255, 0.1)'
                                    : 'rgba(0, 0, 0, 0.05)',
                              },
                            ]}
                            onPress={() => handleSelectCategory(category.id)}
                          >
                            <ThemedText style={[
                              styles.categoryText,
                              isSelected && styles.selectedCategoryText,
                            ]}>
                              {category.name}
                            </ThemedText>
                            {!isSelected && categoryProgress[category.id] && (
                              <ThemedText style={styles.progressCount}>
                                {categoryProgress[category.id].completed}/{categoryProgress[category.id].total}
                              </ThemedText>
                            )}
                            {isSelected && (
                              <Ionicons name="checkmark-circle" size={20} color="#fff" style={styles.checkmark} />
                            )}
                          </TouchableOpacity>
                          {categoryProgress[category.id]?.completed >= categoryProgress[category.id]?.total &&
                            categoryProgress[category.id]?.total > 0 && (
                            <TouchableOpacity
                              style={styles.freeformButton}
                              onPress={() => onStartFreeformChat(category.id)}
                            >
                              <Ionicons name="globe-outline" size={14} color={Colors[colorScheme ?? 'light'].tint} />
                              <ThemedText style={[styles.freeformButtonText, { color: Colors[colorScheme ?? 'light'].tint }]}>
                                Real World Chat
                              </ThemedText>
                            </TouchableOpacity>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </View>
                );
              })}
            </ScrollView>
          </View>


          {/* Account Section */}
          <View style={styles.accountSection}>
            {isSignedIn ? (
              <View style={styles.accountRow}>
                <View style={styles.accountInfo}>
                  <Ionicons name="person-circle-outline" size={22} color={Colors[colorScheme ?? 'light'].tint} />
                  <ThemedText style={styles.accountEmail} numberOfLines={1}>
                    {user?.email ?? user?.displayName ?? 'Signed in'}
                  </ThemedText>
                </View>
                <TouchableOpacity onPress={signOut}>
                  <ThemedText style={styles.signOutText}>Sign out</ThemedText>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.signInButton, { borderColor: Colors[colorScheme ?? 'light'].tint }]}
                onPress={() => setShowAuthModal(true)}
              >
                <Ionicons name="person-outline" size={18} color={Colors[colorScheme ?? 'light'].tint} />
                <ThemedText style={[styles.signInText, { color: Colors[colorScheme ?? 'light'].tint }]}>
                  Sign in to sync progress
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>

          {/* Language Selector */}
          <View style={styles.languageSection}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>Language</ThemedText>
            <View style={styles.languageContainer}>
              {LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.id}
                  style={[
                    styles.languageButton,
                    currentLanguage === lang.id && {
                      borderColor: Colors[colorScheme ?? 'light'].tint,
                      borderWidth: 3,
                    },
                  ]}
                  onPress={() => handleSelectLanguage(lang.id)}
                >
                  <ThemedText style={styles.flagText}>{lang.flag}</ThemedText>
                  <ThemedText style={styles.languageName}>{lang.name}</ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ThemedView>
      </View>
      <AuthModal visible={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
  },
  categoryScrollView: {
    maxHeight: 350,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 12,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.8,
  },
  stageGroup: {
    marginBottom: 12,
  },
  stageLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    marginLeft: 4,
  },
  stageLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    opacity: 0.5,
  },
  progressCount: {
    fontSize: 12,
    opacity: 0.4,
    marginLeft: 'auto',
    marginRight: 4,
  },
  freeformButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.08)',
    marginTop: -4,
    marginBottom: 6,
    alignSelf: 'flex-start',
    marginLeft: 4,
  },
  freeformButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  categoryText: {
    fontSize: 16,
  },
  selectedCategoryText: {
    color: '#fff',
    fontWeight: '600',
  },
  checkmark: {
    marginLeft: 8,
  },
  accountSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    marginBottom: 4,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  accountEmail: {
    fontSize: 14,
    flex: 1,
  },
  signOutText: {
    fontSize: 14,
    color: '#E53935',
    fontWeight: '500',
  },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  signInText: {
    fontSize: 15,
    fontWeight: '600',
  },
  languageSection: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  languageContainer: {
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
  },
  languageButton: {
    alignItems: 'center',
    padding: 3,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    minWidth: 28,
  },
  flagText: {
    fontSize: 14,
    marginBottom: 1,
  },
  languageName: {
    fontSize: 7,
    fontWeight: '500',
  },
});
