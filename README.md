# aidKRIYA Walker — Starter App

A starter Expo (React Native) project for the aidKRIYA Walker challenge. This skeleton provides:

- Step counting (Pedometer)
- GPS route recording and map view
- SOS quick-share button
- Voice guidance (basic)

Quick start (Windows PowerShell):

```powershell
cd "c:/Users/arivu/OneDrive/Desktop/Aidkriya-Walker"
npm install -g expo-cli   ; # optional if you don't have expo installed
npm install
npm run start
```

Open the project in the Expo Go app on your phone or run in an emulator.

Notes:
- This is a starter skeleton. Run `npm install` to fetch dependencies.
- Some features (Pedometer, Maps) require testing on a physical device or proper emulator configuration.

Firebase setup
1. Create a Firebase project at https://console.firebase.google.com.
2. Enable Firestore and (optionally) Authentication (Anonymous sign-in).
3. Copy the config keys into `services/firebase.js` (replace the REPLACE_WITH_ values).
4. The app uses the JS Firebase SDK to save routes under the `routes` collection.


What I can do next:
- Install dependencies and run the app here for you.
- Add Firebase/Backend for storing routes and users.
- Improve UI and add an ML feature (gait/fall detection prototype).
Tell me which next step you want me to take.

Play Store build & submission (how I will prepare a production build)
1. Provide the following to fully test and produce a Play Store AAB:
	- Firebase project config (can be pasted into Onboarding or provided here). Replace the placeholders in `services/firebase.js`.
	- Google Maps SDK API Key (enable Maps SDK for Android) and paste into Onboarding or Settings.
	- Keystore: either provide an existing upload key (recommended) or I can guide you to create one locally using `keytool` and upload to Play Console.
2. I will configure `app.json` with the correct `android.package` (currently `com.aidkriya.walker`) and set versionCode.
3. Use EAS (Expo Application Services) to build a production AAB:

	```powershell
	# install EAS CLI if you don't have it
	npm install -g eas-cli
	# login and configure
	eas login
	# configure EAS build
	eas build:configure
	# build Android AAB
	eas build -p android --profile production
	```

4. Once the AAB is produced, upload to Play Console, complete store listing (images, privacy policy), and submit.

Demo script for judges
- Start the app on a phone with GPS enabled.
- On first run paste Firebase config and Maps API key (or they can be pre-provisioned).
- Start Walk: press Start in Live Tracker, then Start Route and walk ~200-500m.
- Stop Route: press Stop Route to persist the route and distance.
- Show Leaderboard: demonstrate saved route appears in leaderboard.
- Show SOS: press SOS to email your location.

Next steps from me
- If you paste the Firebase config and Maps API key here (or I can walk you through creating them), I'll wire them into the project and run a full end-to-end test.
- I can also prepare an EAS `eas.json` production profile and help generate/upload a keystore for Play Signing.

Native obstacle assist (proximity) — how to enable
------------------------------------------------
The Obstacle Assist feature uses a native proximity sensor module (`react-native-proximity`). Expo Go does NOT include this native module, so to get a working experience you must run the app in a build that contains the native code. Below are two recommended ways:

Option A — quick local native run (requires Android toolchain)
1. Ensure you have Android Studio and the Android SDK installed.
2. Prebuild the native project and run on your device (this links native modules):

```powershell
cd "C:\Users\arivu\OneDrive\Desktop\Aidkriya-Walker"
npx expo prebuild
npx expo run:android
```

Option B — EAS dev client (recommended if you don't want to setup full native toolchain locally)
1. Install and login to EAS CLI:

```powershell
npm install -g eas-cli
eas login
```

2. Build a development client that includes native modules:

```powershell
# create eas.json if needed: eas build:configure
eas build --profile development --platform android
```

3. Install the produced APK on your device, then run the app using the dev client:

```powershell
# on your machine
npx expo start --dev-client
```

Notes
- After installing and running a build that contains `react-native-proximity`, open the app → Perform → Obstacle Assist → Start Assist. When the device's proximity sensor reports near, the app will vibrate and speak an alert.
- If you prefer a camera + ML approach for directional guidance and distance estimation (more accurate), that requires TF Lite / ML Kit and more work—ask me and I can scaffold that next.
