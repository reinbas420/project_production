# Hyper Local Cloud Library - Mobile App

The React Native mobile application for the Hyper Local Cloud Library platform, built leveraging Expo and `expo-router`.

A deeply interactive frontend ecosystem delivering discrete roles (Librarians, Admins, Parents, and Children) nested dynamically under a unified authentication framework.

---

## 🏗️ Technical Architecture & Core Libraries

- **Framework**: `React Native` combined with `Expo SDK 52`
- **Navigation**: `expo-router` managing highly complex directory-based nested routes for multi-user context switching.
- **State Management**: `zustand` providing ultra-fast multi-environment syncing (specifically syncing Parent / Child profiles dynamically across the UX).
- **Network Layer**: `axios` with interceptors intercepting every JWT header requirement, seamlessly handling timeouts.
- **Image Caching**: `expo-image` intelligently managing complex cover components (falling back efficiently if a strict 404 is encountered).
- **Styling**: `react-native-safe-area-context` paired with a completely bespoke `Theme` structure. Tailwind is deliberately **excluded** to prioritize native component design.

---

## 🎨 User Interfaces
The application spans widely across four different "Apps":

### 1. **User (Parent) Stack · `/(user)`**
The home view. Highly dynamic, rendering Google Books metadata queries inside the `.tsx` components on the fly (via `components/BookCover.tsx`). Includes:
- `app/(user)/index`: Browse UI featuring personalized recommendation feeds mapped exactly to the active Profile's preferred genres!
- `app/(user)/monitor`: Parent Tracking UI tracking dynamic live issue loops parsed out by every synced child.
- `app/(user)/track`: Progress steppers resolving live `DELIVERED`, `SHIPPED`, or `PENDING` signals natively tracked back from the `circulationService` API endpoints via `DELIVERY` documents.

### 2. **Child Stack · `/(child)`**
- A high-interaction playground optimized distinctly differently than the parent views.
- Includes dynamic quiz endpoints (`/quiz/[id]`), interactive reading interfaces (`/read/[id]`), and a customized avatar dashboard optimized perfectly for their age rating!

### 3. **Librarian Dashboard · `/(librarian)`**
- Full synchronization with Backend MongoDB endpoints `/issues`.
- Live Overdue, Tracking Returns counters natively iterating and filtering statuses locally.
- 1-Click return mechanisms linking the front-end directly into Atomic Mongoose Transactions on the Backend!

### 4. **Admin Dashboard · `/(admin)`**
- Contains active `GET /libraries` hooks rendering real geographic radius components per row.
- **Dynamic Charting**: Analyzes the last 6 months of issues (`app/(admin)/index.tsx`), automatically computing Top Branches and Monthly Issue activity without relying on external UI charting library payloads!

---

## 🚀 Environment Setup

1. **Install Modules:**
   ```bash
   npm install
   ```

2. **Setup the Configuration:**
   Inside `frontend`, place the `.env` variable pointing to your active Backend server:
   ```env
   EXPO_PUBLIC_API_URL=http://localhost:5000/api/v1
   ```

3. **Start the Dev Server (Metro Bundler):**
   ```bash
   npx expo start -c
   ```
   > `-c` forcefully clears the cache. Essential when modifying the directory logic map of `expo-router` architectures!

You can run the environment natively on:
- **`a`**: Android Emulator
- **`i`**: iOS Simulator (Requires MacOS & Xcode)
- **`w`**: Web Browser rendering

---

## 📂 Key Component Patterns
- **`components/BookCover.tsx`**: Dynamic ISBN parsing! If an Image fails via `OpenLibarary API` (e.g. throws a 404), an instantaneous fallback state triggers a bespoke colored spine placeholder.
