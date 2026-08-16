# Global Navigation & Interaction Performance Directive

This is a mandatory, application-wide UX and performance directive. Every page, component, layout, modal, drawer, bottom navigation, sidebar, button, card, form, dialog, and interactive element in the entire application MUST follow these rules.

## 1. Immediate User Feedback (<50–100ms)
- Every user interaction MUST receive visual acknowledgement within **50–100ms**, regardless of network speed.
- Includes: Sidebar, Bottom Nav, Buttons, Cards, List Items, Tabs, Dropdowns, Filters, Search, Modals, Drawers, FABs, Context Menus, etc.
- The UI MUST NEVER wait for Network requests, Firestore, Firebase Auth, Server Components, Route loading, API responses, Permission checks, or Context refreshes before acknowledging the interaction.

## 2. Immediate Navigation State
- When a navigation item is tapped, IMMEDIATELY:
  - Highlight the selected item.
  - Change its active state.
  - Animate its pressed state.
  - Close the sidebar/drawer if applicable.
- Do NOT wait for `router.push()`, `router.replace()`, `router.refresh()`, data loading, rendering, or route completion.

## 3. Optimistic Navigation Flow
- Tap -> Immediate pressed animation -> Selected menu becomes active -> Drawer closes -> Page transition starts immediately -> Skeleton UI appears instantly -> Data loads asynchronously in background -> Skeleton transitions smoothly into real content.
- Never display blank screens.

## 4. Skeleton-First Rendering
- Every page MUST have a dedicated skeleton UI.
- Never wait for API calls before rendering layout/header/placeholders. Replace placeholders progressively as data arrives.

## 5. Keep Previous Data Visible
- Never clear existing content before new content loads. Use silent background refreshes.
- Avoid flashes of white screens, empty lists, disappearing cards, or layout shifts.

## 6. Never Block Route Changes
- Route transitions MUST NEVER wait for Firestore, Firebase, Auth, Permissions, Profile loading, Property loading, or Context initialization. Routes render immediately while background tasks continue independently.

## 7. Persistent Global Context
- Global application data (user profile, property, permissions, auth, realtime listeners) MUST be initialized once and reused across route navigations without recreation/reloading.

## 8. Background Data Refresh
- Render immediately on navigation, then refresh Firestore/APIs/statistics/analytics/notifications silently in the background.

## 9. Route Prefetching
- Automatically prefetch frequently used pages after login so routes are pre-downloaded before user taps.

## 10. Optimistic UI Updates
- For user actions (Add/Delete/Edit Tenant, Pay Rent, Create Complaint, Send Notification, Mark Paid, etc.), IMMEDIATELY update the local UI. Synchronize in the background, rollback only if sync fails.

## 11. Separate UI Thread from Network
- Animations, drawer closings, page transitions, ripples, and button presses MUST execute entirely on the client without waiting for API/Firestore/Route completion.

## 12. Reduce Main Thread Blocking
- Split expensive rendering into smaller tasks. Use memoization, virtualization, lazy rendering, code splitting, and deferred rendering.

## 13. Zero Perceived Latency
- The application MUST feel instant even under Slow 4G, high latency, weak CPU, poor connectivity, or large datasets.

## 14. Global Performance Targets
- Touch acknowledgement: **<50ms**
- Visual feedback: **<100ms**
- Navigation state update: **<100ms**
- Drawer close animation: **<150ms**
- Route transition begins: **<150ms**
- Skeleton visible: **<200ms**
- First meaningful paint after navigation: **<300ms**
- Background data loading: asynchronous
