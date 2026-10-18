$ErrorActionPreference = 'Stop'
$name = 'Raahi-Phone-API-LocalSubnet'
$existing = Get-NetFirewallRule -Name $name -ErrorAction SilentlyContinue
if ($existing) {
    Enable-NetFirewallRule -Name $name | Out-Null
} else {
    New-NetFirewallRule -Name $name -DisplayName 'Raahi phone API (local Wi-Fi only)' -Direction Inbound -Protocol TCP -LocalPort 4000 -Program 'C:\Program Files\nodejs\node.exe' -RemoteAddress LocalSubnet -Profile Private,Public -Action Allow | Out-Null
}
Get-NetFirewallRule -Name $name | Select-Object DisplayName, Enabled, Profile, Action
