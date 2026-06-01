/**
 * ImagePickerField - PRD/TDD-0040.
 *
 * Reusable submission image picker. Lets the user choose a photo from their
 * library or camera, uploads it to S3 via the presign flow, and reports back
 * the resulting storage `imageKey` to attach to the submission. Shows a local
 * preview while keeping all upload mechanics in the Expo wrapper.
 */

import { useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  pickAndUploadImage,
  ImageUploadError,
  type PickSource,
} from '@/lib/uploads/image-upload.expo';
import { track } from '@/lib/analytics/track.expo';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { palette, radius, spacing, typography } from '@/constants/theme';

interface ImagePickerFieldProps {
  label?: string;
  /** Called with the uploaded storage key (or null when cleared). */
  onChange: (imageKey: string | null) => void;
  disabled?: boolean;
}

export function ImagePickerField({ label = 'Image', onChange, disabled }: ImagePickerFieldProps) {
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function run(source: PickSource) {
    setUploading(true);
    try {
      const result = await pickAndUploadImage(source);
      if (!result) return; // cancelled
      setPreviewUri(result.previewUri);
      onChange(result.imageKey);
      track({ event: ANALYTICS_EVENTS.submissionImageAdded });
    } catch (err) {
      const message =
        err instanceof ImageUploadError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not upload the image.';
      Alert.alert('Image upload failed', message);
    } finally {
      setUploading(false);
    }
  }

  function choose() {
    if (disabled || uploading) return;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take photo', 'Choose from library'],
          cancelButtonIndex: 0,
        },
        (index) => {
          if (index === 1) void run('camera');
          else if (index === 2) void run('library');
        },
      );
    } else {
      Alert.alert(label, undefined, [
        { text: 'Take photo', onPress: () => void run('camera') },
        { text: 'Choose from library', onPress: () => void run('library') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  function clear() {
    setPreviewUri(null);
    onChange(null);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {previewUri ? (
        <View>
          <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="cover" />
          <View style={styles.actions}>
            <Pressable onPress={choose} disabled={uploading}>
              <Text style={styles.link}>Replace</Text>
            </Pressable>
            <Pressable onPress={clear} disabled={uploading}>
              <Text style={[styles.link, styles.remove]}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={choose}
          disabled={disabled || uploading}
          style={[styles.dropzone, (disabled || uploading) && styles.dropzoneDisabled]}
        >
          {uploading ? (
            <ActivityIndicator color={palette.brand[600]} />
          ) : (
            <Text style={styles.dropzoneText}>Add a photo (optional)</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: {
    fontSize: typography.small,
    fontWeight: '700',
    color: palette.neutral.foreground,
    marginTop: spacing.md,
  },
  dropzone: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: palette.neutral.border,
    borderRadius: radius.card,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    backgroundColor: palette.neutral.surface,
  },
  dropzoneDisabled: { opacity: 0.5 },
  dropzoneText: { color: palette.neutral.muted, fontSize: typography.body, fontWeight: '600' },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: radius.card,
    backgroundColor: palette.neutral.mutedBg,
  },
  actions: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm },
  link: { color: palette.brand[600], fontWeight: '700', fontSize: typography.small },
  remove: { color: palette.status.destructive },
});
