import Darwin
import ExpoModulesCore

public class TunnelStatusModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TunnelStatus")

    Function("getTunnelStatus") { () -> [String: Any] in
      var head: UnsafeMutablePointer<ifaddrs>?
      guard getifaddrs(&head) == 0 else {
        return ["available": false, "active": false, "interfaces": [String]()]
      }
      defer {
        if let head = head { freeifaddrs(head) }
      }

      var interfaces = Set<String>()
      var cursor = head
      while let pointer = cursor {
        let interface = pointer.pointee
        cursor = interface.ifa_next
        let flags = interface.ifa_flags
        guard (flags & UInt32(IFF_UP)) != 0,
              (flags & UInt32(IFF_LOOPBACK)) == 0,
              let namePointer = interface.ifa_name else { continue }

        let name = String(cString: namePointer)
        // These interfaces also serve system services and enterprise networking.
        // Presence is a tunnel hint, not proof of a VPN or of traffic protection.
        if ["utun", "ipsec", "ppp"].contains(where: { name.hasPrefix($0) }) {
          interfaces.insert(name)
        }
      }

      let names = interfaces.sorted()
      return ["available": true, "active": !names.isEmpty, "interfaces": names]
    }
  }
}
