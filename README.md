### Development Build

Build iOS development app:
```bash
npx eas build --platform ios --profile development

android:
npx eas build --platform android --profile development
```

### Run Development Build

Build iOS development app:
```bash
npx expo start --dev-client


### API Routes Deployment

The app uses Expo Router API Routes which are deployed separately from the mobile app.
Mobile app makes `fetch('/api/profile')` calls which are routed to the deployed API server.

#### 1. Export the web/API build
```bash
npx expo export --platform web --no-ssg
```

#### 2. Deploy API routes to preview
```bash
npx eas deploy
```
> Note: May not be necessary since origin is set to production routes

#### 3. Deploy API routes to production
```bash
npx eas deploy --prod
```

### iOS App Build

#### 1. Build production iOS app
```bash
npx eas build --platform ios --profile production
```
This creates a `.ipa` file with `distribution: store` for App Store/TestFlight.

#### 2. Upload via Transporter
1. Navigate to [expo.dev](https://expo.dev) to inspect the build and download the `.ipa` file
2. Open **Transporter** app
3. Sign in with: `benevolent.overlord@icloud.com`
4. Drag and drop the `.ipa` file
5. Click **"Deliver"**

### Testing via TestFlight

Once a production build has been uploaded via Transporter, test it on a physical device:

#### 1. Prepare the device
- Delete the app if it's already installed on your device
- This ensures a clean install and avoids conflicts with previous versions

#### 2. Install via TestFlight
1. Open the **TestFlight** app on your iOS device
2. Check that the newly uploaded version is ready for testing
3. Tap **Install** on the new version
4. Once installed, tap **Open** to launch the app from TestFlight

#### 3. Verify the build
- Test critical functionality
- Verify that new features or fixes are working as expected

---

## 📝 Todo List

### Token Purchase System
- [ ] Deduct tokens when virtual try-ons are performed
- [ ] Check minimum balance before allowing fittings
- [ ] Record deduction transactions in `TokenTransactions` table with `transaction_type: 'deduct'`


how to deploy android app to production:

