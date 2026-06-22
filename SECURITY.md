# 🔐 Security Notice

## Firebase Configuration

**⚠️ IMPORTANT:** The file `js/firebase-config.js` contains Firebase API keys and should **NEVER** be committed to Git.

### Setup Instructions

1. **Create your configuration file:**
   ```bash
   cp js/firebase-config.template.js js/firebase-config.js
   ```

2. **Fill in your Firebase values:**
   - Open `js/firebase-config.js`
   - Get your Firebase configuration from: [Firebase Console](https://console.firebase.google.com/) → Project Settings → Your apps → Web
   - Replace placeholder values (YOUR_API_KEY_HERE, etc.) with actual values

3. **Verify .gitignore:**
   - File `.gitignore` should contain `js/firebase-config.js`
   - Run `git status` to verify it's not tracked

### If API Key Was Already Leaked

If `firebase-config.js` was pushed to GitHub before creating `.gitignore`:

1. **Rotate the API key** (Firebase will rate-limit the old key)
2. **Delete the file from Git history:**
   ```bash
   git rm --cached js/firebase-config.js
   git commit -m "Remove firebase-config.js from history"
   git push origin main
   ```

3. **Use `git-filter-branch` to remove from all commits:**
   ```bash
   git filter-branch --tree-filter 'rm -f js/firebase-config.js' -- --all
   git push --force-with-lease origin main
   ```

### Firestore Security Rules

Ensure Firestore rules properly restrict access:
- Authentication required for writes
- Role-based access control enforced
- Admin operations limited to administrators

See `firestore.rules` for current rules.

### Environment Best Practices

- Never hardcode secrets in client-side code
- Use `.gitignore` for all config files with credentials
- Rotate keys if compromised
- Use Firebase Admin SDK only on server-side (not in browser)

