/**
 * Submit type chooser — PRD-0009.
 * Three entry points: Event, Community, Suggest a community.
 */

import { Link, Stack } from 'expo-router';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { palette, radius, spacing, typography } from '@/constants/theme';

const TILES: Array<{
  href: '/submit/event' | '/submit/community' | '/submit/suggest';
  title: string;
  body: string;
}> = [
  {
    href: '/submit/event',
    title: 'Submit an event',
    body: 'Add a community event so others can find it.',
  },
  {
    href: '/submit/community',
    title: 'Add a community',
    body: 'Register an organized group, association, or recurring meetup.',
  },
  {
    href: '/submit/suggest',
    title: 'Suggest a community',
    body: 'Know one we should add? Tell us in 30 seconds.',
  },
];

export default function SubmitChooserScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'Submit' }} />
      <View style={styles.container}>
        <Text style={styles.title}>What would you like to add?</Text>
        <Text style={styles.sub}>Submissions are reviewed before going live.</Text>
        {TILES.map((tile) => (
          <Link key={tile.href} href={tile.href} asChild>
            <Pressable style={styles.tile}>
              <Text style={styles.tileTitle}>{tile.title}</Text>
              <Text style={styles.tileBody}>{tile.body}</Text>
            </Pressable>
          </Link>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.neutral.background },
  container: { flex: 1, padding: spacing.xl, gap: spacing.md },
  title: { fontSize: typography.h2, fontWeight: '800', color: palette.neutral.foreground },
  sub: { fontSize: typography.body, color: palette.neutral.muted, marginBottom: spacing.md },
  tile: {
    padding: spacing.lg,
    backgroundColor: palette.neutral.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.neutral.border,
    gap: spacing.xs,
  },
  tileTitle: { fontSize: typography.h4, fontWeight: '700', color: palette.neutral.foreground },
  tileBody: { fontSize: typography.small, color: palette.neutral.muted },
});
