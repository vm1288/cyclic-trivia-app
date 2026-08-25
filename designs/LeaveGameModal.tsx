import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * LeaveGameModal — neon confirm dialog.
 * Deps: expo-linear-gradient
 *   npx expo install expo-linear-gradient
 *
 *   <LeaveGameModal
 *     visible={open}
 *     onClose={() => setOpen(false)}
 *     onCancel={() => setOpen(false)}
 *     onLeave={handleLeave}
 *   />
 */

type Props = {
  visible: boolean;
  title?: string;
  message?: string;
  cancelLabel?: string;
  leaveLabel?: string;
  onClose?: () => void;
  onCancel?: () => void;
  onLeave?: () => void;
};

export default function LeaveGameModal({
  visible,
  title = 'Leave the current Game?',
  message = 'Lorem ipsum dolor sit amet, lorem ipsum dolor sit amet.',
  cancelLabel = 'CANCEL',
  leaveLabel = 'LEAVE',
  onClose,
  onCancel,
  onLeave,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* gradient rim */}
        <LinearGradient
          colors={['#3aa5ff', '#7b5cff', '#e05cff']}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.rim}
        >
          <View style={styles.card}>
            {/* soft interior wash — stands in for the halftone dot field */}
            <LinearGradient
              colors={['rgba(24,16,56,0.95)', 'rgba(11,7,36,0.98)', 'rgba(7,5,26,1)']}
              start={{ x: 0.15, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />

            <Pressable onPress={onClose} style={styles.close} hitSlop={8}>
              <Text style={styles.closeGlyph}>✕</Text>
            </Pressable>

            <View style={styles.copy}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>
            </View>

            <View style={styles.actions}>
              <Pressable
                onPress={onCancel}
                style={({ pressed }) => [styles.action, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}
              >
                <View style={styles.cancel}>
                  <Text style={styles.actionLabel}>{cancelLabel}</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={onLeave}
                style={({ pressed }) => [styles.action, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}
              >
                <LinearGradient
                  colors={['#c00f2a', '#ff2d2d']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.leave}
                >
                  <Text style={styles.actionLabel}>{leaveLabel}</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(3,3,14,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },

  rim: {
    width: '100%',
    maxWidth: 392,
    padding: 2.5,
    borderRadius: 24,
    shadowColor: '#6a5cff',
    shadowOpacity: 0.5,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    ...Platform.select({ android: { elevation: 16 } }),
  },
  card: {
    borderRadius: 22,
    paddingHorizontal: 26,
    paddingTop: 26,
    paddingBottom: 24,
    overflow: 'hidden',
  },

  close: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(190,205,255,0.55)',
    backgroundColor: 'rgba(12,10,34,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: { color: '#e6ecff', fontSize: 17 },

  copy: { paddingRight: 44, gap: 12 },
  title: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
    // fontFamily: 'Saira_700Bold',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(186,198,226,0.78)',
    maxWidth: 300,
  },

  actions: { marginTop: 26, flexDirection: 'row', gap: 14 },
  action: { flex: 1 },
  cancel: {
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: '#35b7ff',
    backgroundColor: 'rgba(8,12,30,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#35b7ff',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    ...Platform.select({ android: { elevation: 6 } }),
  },
  leave: {
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff2d2d',
    shadowOpacity: 0.55,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    ...Platform.select({ android: { elevation: 10 } }),
  },
  actionLabel: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: '#fff',
  },
});
