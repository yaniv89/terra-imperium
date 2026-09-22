# Store listing content

Content-only drafts for App Store Connect and Google Play Console, per plan Phase H ("store
listings"). Actual submission needs real developer accounts (Apple Developer Program, Google Play
Console) neither of which exist in this project yet — see `ios/ExportOptions.plist.template` and
`android/app/build.gradle`'s `keystore.properties` gate for the signing side of that same
dependency. These files are ready to paste in once those accounts exist.

- `app-store.md` — Apple App Store Connect fields and character limits
- `play-store.md` — Google Play Console fields and character limits
- `age-rating.md` — the content-rating questionnaire answers both stores ask for, and why
- `screenshots.md` — what to capture and from where, once there's a build to screenshot

## Before submitting for real

- Bundle ID / package name: `com.terraimperium.app` (`capacitor.config.json`) is a placeholder —
  plan §1 flags this explicitly as "cheap to change now, awkward once stores exist." Confirm it
  before the first real submission; it cannot be changed afterward without publishing as a new app.
- Both stores require a support URL and a privacy policy URL. Neither exists yet — the privacy
  policy in particular needs real content once cloud saves / auth (Phase F) or multiplayer
  (Phase G) go live, since those involve an email address and gameplay data leaving the device.
