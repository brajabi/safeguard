Pod::Spec.new do |s|
  s.name = 'TunnelStatus'
  s.version = '1.0.0'
  s.summary = 'Observe local iOS tunnel interfaces for Safeguard'
  s.description = 'Reports active tunnel interface names without claiming VPN protection.'
  s.license = { :type => 'MIT' }
  s.author = 'Safeguard'
  s.homepage = 'https://github.com/brajabi/safeguard'
  s.source = { :git => 'https://github.com/brajabi/safeguard.git' }
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
