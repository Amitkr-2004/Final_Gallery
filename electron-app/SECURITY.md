# Security Architecture & Best Practices

This document outlines the security model, credential management, and best practices implemented in the Image Processor Electron application.

---

## Table of Contents

1. [Security Principles](#security-principles)
2. [Authentication Architecture](#authentication-architecture)
3. [Credential Storage](#credential-storage)
4. [Signed URL Workflow](#signed-url-workflow)
5. [Data Protection](#data-protection)
6. [Security Best Practices](#security-best-practices)
7. [Threat Model](#threat-model)
8. [Security Checklist](#security-checklist)

---

## Security Principles

### Core Principles

1. **Zero Trust**: Never trust data from renderer process
2. **Least Privilege**: Minimal permissions for each component
3. **Defense in Depth**: Multiple layers of security
4. **Secure by Default**: Security measures enabled out-of-box
5. **No Hardcoded Secrets**: All credentials stored securely

### Data Classification

- **Critical**: GCP service account keys (NEVER in Electron app)
- **Sensitive**: Backend API keys, session tokens
- **Confidential**: Signed URLs (short-lived)
- **Public**: Application configuration, UI state

---

## Authentication Architecture

### Overall Flow

```
┌────────────────────────────────────────────────────────┐
│                  SECURITY LAYERS                       │
└────────────────────────────────────────────────────────┘

Layer 1: OS-Level Security
├─ Windows: DPAPI (Data Protection API)
├─ macOS: Keychain Access
└─ Linux: libsecret (GNOME Keyring)

Layer 2: Application-Level Encryption
├─ electron-store with AES-256 encryption
├─ Unique encryption key per installation
└─ Stored in OS keychain

Layer 3: Process Isolation
├─ Main Process: Has access to credentials
├─ Renderer Process: Sandboxed, NO access
└─ Preload Script: Context bridge (whitelisted APIs)

Layer 4: Network Security
├─ HTTPS only
├─ Certificate validation
└─ Signed URL authentication
```

### Credential Types

| Credential | Storage | Lifetime | Access |
|------------|---------|----------|--------|
| Backend API Key | OS Keychain | Indefinite | Main Process Only |
| Session Token | Encrypted Store | Hours/Days | Main Process Only |
| Signed URLs | Encrypted Store (cache) | 15 minutes | Main Process Only |
| Encryption Key | OS Keychain | Indefinite | electron-store |

---

## Credential Storage

### OS Keychain (via keytar)

**What's Stored:**
- Backend API key
- Store encryption key

**Security Features:**
- OS-managed encryption
- User authentication required (on some OS)
- Encrypted at rest
- Process isolation

**Example:**
```javascript
// SECURE: Store in OS keychain
await setBackendApiKey('your-api-key');

// SECURE: Retrieve from keychain
const apiKey = await getBackendApiKey();
```

**Platform Details:**

**Windows:**
- Uses Windows Credential Manager
- DPAPI encryption
- User-scoped credentials

**macOS:**
- Uses Keychain Access
- Hardware encryption (if available)
- Can require user password

**Linux:**
- Uses libsecret
- GNOME Keyring or KWallet
- User session encryption

### Encrypted Store (via electron-store)

**What's Stored:**
- Signed URL cache
- Session tokens
- User preferences

**Security Features:**
- AES-256 encryption
- Unique key per installation
- Encryption key stored in OS keychain
- Automatic expiration tracking

**Example:**
```javascript
// SECURE: Encrypted storage
cacheSignedUrl(gcsPath, signedUrl, expiresAt);

// SECURE: Auto-expires
const url = getCachedSignedUrl(gcsPath); // null if expired
```

---

## Signed URL Workflow

### Why Signed URLs?

✅ **Service account keys NEVER leave backend**
✅ **Short-lived credentials (15 minutes)**
✅ **Fine-grained access control**
✅ **Automatic expiration**
✅ **No credential rotation needed in Electron**

### Request Flow

```
1. Electron App                  Backend API
   │                                │
   │  POST /get-signed-url          │
   │  Authorization: Bearer <KEY>   │
   │─────────────────────────────>  │
   │                                │
   │                                │ ← Uses service account
   │                                │   (server-side only)
   │                                │
   │  { signedUrl, expiresAt }      │
   │ <─────────────────────────────────│
   │                                │
   │  Store in encrypted cache      │
   │  (expires in 15 min)           │
   │                                │
   │                                │
   │  GET <signedUrl>               │  Google Cloud Storage
   │───────────────────────────────────────────────>
   │                                │
   │  File content                  │
   │ <───────────────────────────────────────────────
```

### Expiration Handling

```javascript
// Automatic expiration with 5-minute buffer
function getCachedSignedUrl(gcsPath) {
  const entry = cache[gcsPath];

  if (!entry) return null;

  const now = Math.floor(Date.now() / 1000);
  const bufferSeconds = 5 * 60; // Safety buffer

  if (now >= (entry.expiresAt - bufferSeconds)) {
    // Expired - remove from cache
    delete cache[gcsPath];
    return null;
  }

  return entry.url;
}
```

### Batch Optimization

For efficiency, request multiple signed URLs at once:

```javascript
// GOOD: Batch request (1 API call)
const urls = await requestSignedDownloadUrlsBatch([
  'file1.jpg',
  'file2.jpg',
  'file3.jpg'
]);

// BAD: Individual requests (3 API calls)
const url1 = await requestSignedDownloadUrl('file1.jpg');
const url2 = await requestSignedDownloadUrl('file2.jpg');
const url3 = await requestSignedDownloadUrl('file3.jpg');
```

---

## Data Protection

### Process Isolation

**Main Process (Trusted):**
- ✅ Can access OS keychain
- ✅ Can decrypt encrypted store
- ✅ Can make backend API requests
- ✅ Can download files using signed URLs

**Renderer Process (Untrusted/Sandboxed):**
- ❌ No Node.js integration
- ❌ No access to credentials
- ❌ No access to file system (direct)
- ✅ Can request operations via IPC

**Preload Script (Bridge):**
- Limited API exposure via contextBridge
- Whitelisted functions only
- No credential leakage

### IPC Security

**SECURE Pattern:**
```javascript
// Preload.js - Expose ONLY safe APIs
contextBridge.exposeInMainWorld('electronAPI', {
  startDownload: () => ipcRenderer.invoke('download:start'),
  // NO access to credentials!
});

// Main process - Handle request
ipcMain.handle('download:start', async () => {
  const apiKey = await getBackendApiKey(); // Secure
  // ... use apiKey to request signed URLs
});
```

**INSECURE Pattern (NEVER DO THIS):**
```javascript
// ❌ NEVER expose credentials to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  getApiKey: () => getBackendApiKey() // DANGEROUS!
});
```

### Network Security

**HTTPS Only:**
- All backend API calls use HTTPS
- Certificate validation enabled
- No self-signed certificates in production

**Request Headers:**
```javascript
{
  'Authorization': 'Bearer <API_KEY>',  // Never logged
  'Content-Type': 'application/json',
  'X-Client': 'electron-app',
  'X-Client-Version': '1.0.0'
}
```

**Response Handling:**
```javascript
// Validate response before caching
if (response.data.signedUrl && response.data.expiresAt) {
  cacheSignedUrl(gcsPath, response.data.signedUrl, response.data.expiresAt);
}
```

---

## Security Best Practices

### For Developers

1. **Never Log Credentials**
   ```javascript
   // ❌ BAD
   console.log('API Key:', apiKey);

   // ✅ GOOD
   logger.info('API key configured', { keyLength: apiKey.length });
   ```

2. **Sanitize Errors**
   ```javascript
   // ❌ BAD
   logger.error('Request failed', { error, config });

   // ✅ GOOD
   logger.error('Request failed', {
     message: error.message,
     url: error.config?.url // Don't log headers!
   });
   ```

3. **Validate Inputs**
   ```javascript
   // Always validate before storing
   if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 10) {
     throw new Error('Invalid API key');
   }
   ```

4. **Clear Sensitive Data**
   ```javascript
   // Clear on logout
   await clearAllCredentials();
   ```

5. **Use HTTPS**
   ```javascript
   // ❌ BAD
   baseURL: 'http://api.example.com'

   // ✅ GOOD
   baseURL: 'https://api.example.com'
   ```

### For Users

1. **Protect Your API Key**
   - Never share your backend API key
   - Rotate keys if compromised
   - Use separate keys for dev/prod

2. **Secure Your Device**
   - Use full-disk encryption
   - Lock screen when away
   - Keep OS updated

3. **Review Permissions**
   - Verify backend API permissions
   - Use read-only service accounts when possible

4. **Monitor Activity**
   - Review logs regularly
   - Check for suspicious downloads

---

## Threat Model

### Threats Mitigated

| Threat | Mitigation |
|--------|------------|
| Credential theft from renderer | Process isolation, no credentials in renderer |
| Credential theft from disk | OS keychain + AES-256 encryption |
| Man-in-the-middle attacks | HTTPS with certificate validation |
| Unauthorized GCS access | Signed URLs with 15-min expiration |
| Service account exposure | Keys stored on backend only |
| XSS attacks | Context isolation, no eval() |
| Session hijacking | Short-lived tokens, secure storage |

### Residual Risks

| Risk | Severity | Notes |
|------|----------|-------|
| Compromised backend server | High | Backend holds service account keys |
| Malware on user device | High | Can access OS keychain if user logged in |
| Physical device theft | Medium | Mitigated by OS encryption |
| Expired URL caching bug | Low | 5-minute buffer + auto-expiration |

---

## Security Checklist

### Before Deployment

- [ ] Service account keys stored on backend only
- [ ] Backend API uses HTTPS
- [ ] API key authentication implemented
- [ ] Signed URLs expire in 15 minutes or less
- [ ] electron-store encryption enabled
- [ ] OS keychain integration working
- [ ] No credentials in source code
- [ ] No credentials in logs
- [ ] Context isolation enabled in Electron
- [ ] Node integration disabled in renderer
- [ ] Preload script uses contextBridge
- [ ] CSP headers configured (if applicable)
- [ ] Certificate validation enabled
- [ ] Error messages don't leak credentials

### During Development

- [ ] .gitignore includes credential files
- [ ] No API keys in environment variables (use .env.local)
- [ ] Test credential rotation
- [ ] Test expired URL handling
- [ ] Test authentication failures
- [ ] Review IPC handlers for security
- [ ] Validate all user inputs
- [ ] Sanitize error logs

### For Production

- [ ] Use separate API keys for prod
- [ ] Enable rate limiting on backend
- [ ] Monitor for failed auth attempts
- [ ] Implement credential rotation policy
- [ ] Set up security alerts
- [ ] Regular security audits
- [ ] Keep dependencies updated
- [ ] Code signing certificates configured

---

## Reporting Security Issues

If you discover a security vulnerability, please:

1. **Do NOT** create a public GitHub issue
2. Email security@yourapp.com with:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
3. Allow 48 hours for initial response
4. Coordinate disclosure timeline

---

## References

- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Google Cloud Security](https://cloud.google.com/security)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

---

**Last Updated:** 2026-01-28
**Version:** 1.0.0
