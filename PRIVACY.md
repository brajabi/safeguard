# Safeguard privacy information

Last updated: 9 September 2026

Safeguard is a connection and location checker by brajabi. It compares public IP information, the device time zone, optional device location, and app requirements you save on your device.

## Information used

- **Public IP:** Safeguard contacts [ipwho.is](https://ipwhois.io/) for approximate IP location and network information, [Blackbox](https://blackbox.ipinfo.app/) for network-type and VPN classification of the observed address, and [ipify](https://www.ipify.org/) for IPv6 reachability. These providers receive the public IP and normal request information. Their own privacy policies and retention practices apply.
- **Device location:** Location permission is requested when you choose a location check. Once granted, location also refreshes when you open App checker, open an app profile, return to App checker, or use a refresh button. The device's geocoding service receives coordinates to resolve the country. Apple Maps on iOS and OpenStreetMap on Android receive the selected coordinates and map-area requests. Coordinates are not sent to the IP lookup providers. Safeguard does not track your location in the background.
- **Time zone and tunnel indicators:** These are read from the device and compared locally. Local tunnel interface names are not sent to the IP providers.
- **App profiles:** App names and selected requirements are saved locally. They are not uploaded to a Safeguard account or server. Device backups may contain these preferences, depending on your device settings.

IP lookup results, GPS coordinates, and scan history are not saved by Safeguard; current results are held in memory. External services may retain their own request logs. Apple and your device platform may process diagnostics according to your platform settings and their policies.

## Accounts, advertising, and analytics

Safeguard has no account system, advertising, or developer-operated analytics service. It does not sell personal information. The source code is available in the [Safeguard repository](https://github.com/brajabi/safeguard).

## Your controls

You can decline or revoke location permission in device Settings and still use IP and time-zone checks. You can delete saved app profiles inside App checker. Removing the app removes its local app data; manage any device backups separately through your device settings.

## Questions

Contact the developer through [Safeguard's GitHub issues](https://github.com/brajabi/safeguard/issues). Avoid posting your IP address, precise coordinates, credentials, or other private information in a public issue.
