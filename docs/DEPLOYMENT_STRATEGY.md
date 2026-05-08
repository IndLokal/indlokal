# Deployment Strategy

The current MVP deployment guidance lives in [deployment/](deployment/).

This top-level file is kept as a pointer because older docs and README versions linked here. The deployment approach is intentionally simple for the current stage:

- Vercel for the Next.js web app
- Expo EAS for mobile builds and store submission
- Neon for managed Postgres
- GitHub Actions for optional cron calls
- Resend, PostHog, custom domain, and paid tiers only when the feature or usage justifies them

Start with [deployment/README.md](deployment/README.md), then use [deployment/go-live.md](deployment/go-live.md) when it is time to put the MVP online.
