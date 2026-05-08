# Mobile Deployment

Mobile is part of the MVP. IndLokal needs recall: members should be able to keep the app on their phone, come back to events, follow communities, and eventually receive useful reminders.

Keep it lightweight. The mobile app should use the same Vercel web backend and the same Neon database. Do not add a separate mobile backend.

## Release path

Use Expo EAS for builds:

```bash
cd apps/mobile
pnpm dlx eas-cli login
pnpm dlx eas-cli init
```

The repo includes [../../apps/mobile/eas.json](../../apps/mobile/eas.json) with three profiles:

- `development` — development client, only when Expo Go is not enough
- `preview` — internal founder/member testing
- `production` — app-store builds

Required accounts:

- Apple Developer account for iOS
- Google Play Console account for Android
- Expo account for EAS builds

## API URL

Production mobile builds should point to the production web deployment:

```bash
cd apps/mobile
pnpm dlx eas-cli secret:create --scope project --name EXPO_PUBLIC_API_BASE_URL --value https://indlokal.com
```

Local development can keep using [../../apps/mobile/.env](../../apps/mobile/.env), which points at `http://localhost:3001` and is adapted for Expo Go by the app.

## Internal preview builds

Use preview builds before store submission:

```bash
cd apps/mobile
pnpm dlx eas-cli build --profile preview --platform ios
pnpm dlx eas-cli build --profile preview --platform android
```

Use these with founders and a small set of trusted members. The goal is not polish theater; the goal is to prove people come back on mobile.

Preview checklist:

- [ ] Home/discovery screen loads production content.
- [ ] Event detail opens.
- [ ] Community detail opens.
- [ ] Resources screen opens.
- [ ] Deep links use the production domain.
- [ ] Sign-in works if enabled.
- [ ] Push notification pre-prompt does not appear too early.

## Store builds

When preview builds are stable enough for member recall testing:

```bash
cd apps/mobile
pnpm dlx eas-cli build --profile production --platform ios
pnpm dlx eas-cli build --profile production --platform android
```

Before app-store submission:

- [ ] Production API URL points to the web deployment.
- [ ] Google / Apple sign-in works on real devices.
- [ ] Push notification prompt is tested.
- [ ] App privacy labels match the data actually collected.
- [ ] App Store / Play Store description matches the current MVP scope.
- [ ] Support email and privacy URL are live.
- [ ] The first release does not promise unsupported cities or features.

## What not to add yet

- No separate mobile backend.
- No custom mobile CI/CD before store traction.
- No complex release trains.
- No broad push-notification campaigns before users save, follow, or RSVP.
- No waiting for every web feature before shipping mobile.

The first mobile release can be small, but it must be real enough to create habit.
