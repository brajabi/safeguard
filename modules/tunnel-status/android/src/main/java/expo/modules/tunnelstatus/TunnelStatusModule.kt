package expo.modules.tunnelstatus

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TunnelStatusModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TunnelStatus")

    Function("getTunnelStatus") {
      getTunnelStatus()
    }
  }

  private fun getTunnelStatus(): Map<String, Any> {
    val unavailable = status(available = false, active = false)
    val context = appContext.reactContext ?: return unavailable
    val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE)
      as? ConnectivityManager ?: return unavailable

    return try {
      val network = connectivityManager.activeNetwork ?: return unavailable
      val capabilities = connectivityManager.getNetworkCapabilities(network)
        ?: return unavailable
      // Observes this app's active network only. Split tunnels may differ for
      // other apps; VPN transport says nothing about residential IP ownership.
      status(
        available = true,
        active = capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN)
      )
    } catch (_: SecurityException) {
      unavailable
    }
  }

  private fun status(available: Boolean, active: Boolean): Map<String, Any> = mapOf(
    "available" to available,
    "active" to active,
    "interfaces" to emptyList<String>()
  )
}
