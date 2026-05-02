# App Store Review Notes Template

Use this text in App Store Connect > App Review Information > Notes.

---

Hello App Review Team,

Thank you for reviewing MenuPic AI.

**Free Trial Model (Guideline 5.1.1(v) compliance):**
Users can access the core menu-scanning feature without creating an account. A guest trial provides 3 complimentary scans before sign-in is required to purchase additional scans.

How to test the guest trial:
1. Launch the app.
2. On the welcome screen, tap **Try for Free**.
3. You will be taken directly to the Scan tab.
4. Point the camera at a menu and tap detected dish text to run analysis.
5. After the 3rd scan result is viewed and dismissed, an informational dialog explains that the trial has ended. Tapping **Sign In** returns to the welcome screen with Sign in with Apple.

**To test beyond the trial (IAP and account features), use our pre-loaded test account:**
- Sign in with Apple using the Apple Sandbox test account provided in the Review Notes attachment. This account has 10 scan credits pre-loaded and grants access to the in-app purchase paywall.

Account behavior:
- Sign in with Apple is shown on the welcome screen once the guest trial is exhausted.
- Guest scan usage is tracked server-side (tied to the anonymous RevenueCat user ID).
- Signing in with Apple after the trial allows the user to purchase additional scan packs.

If anything is unclear, please let us know and we can provide a short video walkthrough.

Thank you.
