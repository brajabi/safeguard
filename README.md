# Safeguard

A minimal iOS connection inspector built with **Expo SDK 57, React Native, TypeScript, and HeroUI Native**. Ivory surfaces, emerald accents, native Apple Maps, and no account or backend.

## What it does

- Public IP, approximate city/country, network, ASN, and IPv6 reachability.
- Optional device coordinates, accuracy, and distance from the IP location.
- A compact interactive Apple map with separate IP and device pins.
- Device and IP time zones, live clocks, UTC offsets, and mismatch detection.
- Local iOS tunnel observation as a **possible VPN signal**.
- Pull to refresh, copy address, foreground refresh after switching VPNs, haptics, and permission/error states.

Time-zone names describe representative regions, not GPS locations. IP locations may be many kilometres from the device. Neither a distance nor time-zone mismatch proves VPN use.

## App checker profiles

Home opens with a five-row checklist and country flags. Header refresh buttons rerun checks on Home and App checker. Opening App checker or an app profile refreshes the readings automatically, including GPS when location permission is already granted. The **App checker** tab has an **Add app (+)** button above a grid of saved apps. Tap an app for its compact checklist; use Back to return to the grid. The picker includes bundled logos for PayPal, Revolut, N26, Wise, Binance, Bybit, Wirex, RedotPay, and Custom. Select an app, enable the requirements you want, and choose yes/no or a country for each. Edit or delete profiles at any time.

The editable N26 example uses the user's requested Ireland IP/time-zone/GPS and VPN/residential requirements; these are personal preferences, not N26's published rules. A profile shows ✅ only when every enabled reading is verified and matches, ❎ for a known mismatch, and ⚠️ for missing/unverified/older readings. Results expire after five minutes. GPS has an independent timestamp. A profile with no requirements is never marked ready.

Profile names and requirements persist in AsyncStorage on this device. Observed IPs, GPS coordinates and check history are never persisted. Country lookup for GPS uses the device's native reverse geocoder and transmits coordinates to that service; it is separate from IP geolocation. Shared time zones that cannot identify one country show unknown. Open the target app separately after reviewing your results; Safeguard does not intercept or prevent another app from opening.

Residential requirements use a live, exact-IP classification from Blackbox (ipinfo.app), based on positive network/rDNS evidence. Residential VPNs can satisfy both requirements; a VPN or proxy flag alone never makes the IP non-residential. Datacenter evidence produces a negative residential result, and missing/conflicting data stays unknown. An active iOS tunnel alone never counts as a confirmed VPN.

## Run on iOS

Use Node 24 (`nvm use`), Xcode 26.4+, and CocoaPods on macOS. Minimum iOS version is 16.4.

```sh
npm ci
npm run ios
```

This creates the native project, compiles the local Swift module, installs the development app in the simulator, and starts Metro. To choose a physical iPhone:

```sh
npx expo run:ios --device
```

Physical devices require Apple signing configured in Xcode. Subsequent JavaScript work only needs `npm start`. Expo Go can run the JavaScript features but cannot include the local tunnel module; use a development build for the full app.

## TestFlight releases

Safeguard is linked to [@brajabi/safeguard on Expo](https://expo.dev/accounts/brajabi/projects/safeguard) and [App Store Connect app 6810145614](https://appstoreconnect.apple.com/apps/6810145614/testflight/ios). Signing uses the Apple team configured in EAS; certificates and private keys are not stored in this repository.

```sh
npm run testflight
```

The `testflight` profile produces a signed Release build for store distribution and submits it to App Store Connect. EAS manages build numbers remotely and increments them for each build. Development and simulator profiles remain separate. The app bundle ID is `com.brajabi.safeguard`.

The minimal store metadata is in `store.config.json`; the privacy information is in [PRIVACY.md](PRIVACY.md). TestFlight uploads do not submit the app for public App Store review.

## VPN limitations

The Swift module enumerates active `utun`, `ipsec`, and `ppp` interfaces. These can belong to VPNs, enterprise networking, or iOS services. Presence does **not** establish that internet traffic is protected; absence does not rule out a VPN. It does not change network settings or inspect traffic. Test with actual VPN apps on a physical iPhone before relying on observations; simulator networking is the host's networking.

Blackbox v3beta supplies network-type and VPN/proxy/Tor/hosting evidence where available. It is a public beta without guaranteed schema stability or continued free access; a failed lookup leaves the classification unknown while preserving IP/location results. These are provider classifications, not guarantees. This is not a DNS or WebRTC leak tester. Safari Private Relay and split tunneling may cause Safari to use a different public address from the native app.

## Data and privacy

- [ipwho.is](https://ipwhois.io/documentation) receives the public IP for geolocation. Its free service is rate-limited and has no availability guarantee.
- [Blackbox v3beta](https://blackbox.ipinfo.app/) receives the observed public IP to classify the exact address. Its results may be cached upstream for a day and can be inaccurate or incomplete. This service is ipinfo.app, not ipinfo.io.
- [ipify's IPv6-only endpoint](https://www.ipify.org/) tests IPv6 connectivity. Failure is inconclusive, not evidence of a leak.
- GPS is foreground-only and requested after an explicit tap. Coordinates are not sent to either IP provider; the native reverse geocoder receives them to resolve the GPS country.
- Apple Maps receives map-view requests when displaying a map.
- No account, backend, analytics, saved scan history, or background tracking. Results live in memory; only app preference profiles persist locally.
- External services have their own logging and privacy policies. A VPN address shared by many people can hit their rate limits.

iOS uses Apple Maps and interface-based tunnel observation. Android uses an OpenStreetMap embed without a Google Maps key, and Android’s VPN transport API for this app’s active network. A small web map fallback is included, but HeroUI Native and the chosen IP provider target native use; web is not the supported release target.

## Validation

```sh
npm run check                 # TypeScript + deterministic unit tests
npx expo-doctor               # Expo configuration/dependency checks
npx expo export --platform ios # Production JavaScript bundle
```

Verified locally: iPhone 17 Pro simulator native build, live IP lookup, copy feedback, native tunnel bridge, device-location permission and successful fix, Apple map, privacy sheet, and UTC+01:00 rendering on Hermes. Unit tests cover validation, network failures, timezone aliases, DST, calendar rollovers, and distances.

Manual physical-iPhone checklist: run with VPN off/on and refresh; grant/deny location; turn off Location Services; switch IP/device map tabs; copy the IP; check offline and recovery states; compare a different device time zone; verify VoiceOver and larger text. Location and VPN results in a simulator do not establish physical-device accuracy.

## Structure

- `App.tsx`: native dashboard, permission flow, refresh lifecycle, privacy sheet.
- `src/lib/ip.ts`: bounded HTTP requests and defensive response validation.
- `src/lib/classification.ts`: optional, evidence-based residential and VPN classification.
- `src/lib/comparison.ts`: timezone and geographic comparison logic.
- `src/lib/tunnel.ts`: optional native module bridge.
- `src/components/LocationMap.tsx`: native map.
- `modules/tunnel-status/`: autolinked local Swift Expo module.

Native build folders are generated by Expo and ignored. The local module's Swift source is checked in. GitHub Actions runs types, tests, Expo Doctor, and an iOS bundle export on pushes and pull requests.

Dependency note: npm currently reports moderate advisories through Expo's transitive `xcode`/`uuid` build tooling. Its suggested automatic fix downgrades Expo to SDK 46 and is not applied. The pinned SDK 57 dependencies pass Expo Doctor; track upstream fixes before release.

## Android APK

```sh
npm run apk
```

The `apk` profile creates a signed, standalone Release APK for direct installation, not a Play Store AAB. It includes the same checklists and profiles, an OpenStreetMap embed, and native Android VPN-transport observation. EAS manages the Android signing key and version code. Android maps send the selected map coordinates to OpenStreetMap. Split-tunnel configurations can differ between apps.
