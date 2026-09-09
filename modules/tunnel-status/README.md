# Tunnel status

A local Expo module for iOS development and production builds. Expo autolinking discovers this module under the default `./modules` directory. Rebuild the iOS app after changing Swift source; Expo Go cannot load custom native modules.

`getTunnelStatus()` enumerates interface names using Darwin `getifaddrs`, retains interfaces marked up and not loopback whose names begin with `utun`, `ipsec`, or `ppp`, and frees the allocated list. The check needs no network request or permission prompt and exposes no interface addresses.

An active interface means **a possible tunnel**, not a confirmed VPN. iOS services and enterprise networking can create these interfaces. Their presence cannot establish which traffic uses them, whether a commercial VPN is connected, whether an IP leak exists, or whether traffic is protected. Their absence cannot rule out proxies, Private Relay, or a VPN outside the device.

The TypeScript wrapper returns `available: false` when the module is absent, including Expo Go and non-iOS platforms, or enumeration fails. The interface list must be treated as a local diagnostic hint.

References: [Expo local modules](https://docs.expo.dev/modules/get-started/), [Apple getifaddrs](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man3/getifaddrs.3.html).

## Android

The Android implementation observes VPN transport on this app’s active network using ConnectivityManager. The module declares the normal ACCESS_NETWORK_STATE permission; it does not request a runtime permission or create a VPN. Offline or unavailable network-capability data returns available=false. Split-tunnel policies may differ between apps, so a positive result does not establish device-wide protection or residential IP ownership.
