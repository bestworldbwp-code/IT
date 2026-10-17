<#
  เก็บข้อมูลเครื่อง · IT Asset (บริษัท เบสท์เวิลด์ อินเตอร์พลาส จำกัด)

  วิธีใช้: ดับเบิลคลิก "เก็บข้อมูลเครื่อง.bat" บน USB → พิมพ์รหัสเครื่องบนสติกเกอร์ → รอสักครู่
  ผลลัพธ์อยู่ในโฟลเดอร์ data บน USB
    <รหัส>.json      ข้อมูลทั้งหมดของเครื่องนั้น
    inventory.json   สรุปทุกเครื่อง — ใช้นำเข้าที่หน้า "นำเข้าข้อมูลเครื่อง (USB)" ในระบบ
    inventory.csv    สรุปทุกเครื่อง เปิดด้วย Excel
    software.csv     โปรแกรมที่ติดตั้งทุกเครื่อง (ใช้นับลิขสิทธิ์)

  อ่านอย่างเดียว: ไม่แก้ไขเครื่อง ไม่ติดตั้งอะไร ไม่ส่งข้อมูลออกอินเทอร์เน็ต
  ไม่เก็บรหัสผ่าน คีย์ลิขสิทธิ์ (product key) หรือไฟล์ส่วนตัวของผู้ใช้
  คลิกขวา "Run as administrator" จะได้ข้อมูล BitLocker / TPM / Secure Boot เพิ่ม
#>
param(
  [string]$Tag,      # ใส่รหัสมาเลยไม่ต้องถาม (ใช้ทดสอบ)
  [string]$OutDir,   # โฟลเดอร์ผลลัพธ์ (ค่าเริ่มต้น: data ข้างสคริปต์)
  [switch]$NoPause
)

$ErrorActionPreference = 'SilentlyContinue'   # เก็บเท่าที่เก็บได้ ข้อไหนอ่านไม่ได้ก็ข้าม
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $OutDir) { $OutDir = Join-Path $here 'data' }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$utf8 = New-Object Text.UTF8Encoding $false

function Finish([string]$msg) {
  if ($msg) { Write-Host $msg }
  if (-not $NoPause) { [void](Read-Host "`nPress Enter to close / กด Enter เพื่อปิด") }
  exit
}
function Clean($s) { if ($null -eq $s) { return '' }; return ("$s" -replace '\s+', ' ').Trim() }
# ค่าหลอกที่เครื่องประกอบชอบใส่มาแทน S/N / ยี่ห้อ
$JUNK = '^(to be filled.*|default string|system serial number|system product name|system manufacturer|chassis serial number|base board serial number|none|not specified|not applicable|n/?a|invalid|o\.?e\.?m\.?|0+|1234567890?|x+|\.+|-+)$'
function Real($s) { $s = Clean $s; if ($s -match $JUNK) { return '' }; return $s }
function Size($bytes) {
  if (-not $bytes) { return '' }
  $g = [double]$bytes / 1e9   # หน่วยแบบที่พิมพ์บนกล่อง (256GB, 1TB)
  if ($g -ge 1000) { return ('{0}TB' -f [math]::Round($g / 1000, 1)) }
  return ('{0}GB' -f [math]::Round($g))
}
function D($dt, [string]$fmt) { if ($dt) { try { return ([datetime]$dt).ToString($fmt) } catch {} }; return '' }
# "Intel(R) Core(TM) i5-10400 CPU @ 2.90GHz" → "i5-10400"
function CpuShort($n) {
  $s = Clean $n
  $s = $s -replace '\((R|TM)\)', '' -replace '\b\d+(st|nd|rd|th) Gen\b', '' -replace '@.*$', '' -replace '\bCPU\b', ''
  $s = $s -replace '\bIntel\b', '' -replace '\bCore\b', '' -replace '\bProcessor\b', '' -replace '\s+with Radeon.*$', '' -replace ',.*$', '' -replace '\s+Radeon R\d.*$', ''
  return (Clean $s)
}
function WmiText($codes) { if (-not $codes) { return '' }; return (Clean (-join (@($codes) | Where-Object { $_ -ne 0 } | ForEach-Object { [char]$_ }))) }

# ---------- รหัสเครื่อง ----------
Write-Host ''
Write-Host '  IT Asset - Collect computer info / เก็บข้อมูลเครื่อง' -ForegroundColor Cyan
Write-Host '  Read-only: nothing on this PC is changed / อ่านอย่างเดียว ไม่แก้ไขเครื่อง' -ForegroundColor DarkGray
Write-Host ''
while ($true) {
  if (-not $Tag) { $Tag = Read-Host 'Machine number, e.g. 47 (= COM-IT-47) / เลขเครื่องบนสติกเกอร์ เช่น 47' }
  $Tag = ("$Tag" -replace '\s', '').ToUpper()
  if ($Tag -match '^\d{1,3}$') { $Tag = 'COM-IT-' + $Tag }   # พิมพ์แค่เลข = คอมพิวเตอร์ (โปรแกรมนี้รันบนคอมเท่านั้น)
  $Tag = ($Tag -replace '^PT-', 'PNT-') -replace '-(\d)$', '-0$1'
  if ($Tag -match '^[A-Z]{2,4}-[A-Z]{2,4}-\d{2,3}$') { break }
  Write-Host '  Wrong format, use e.g. COM-IT-05 / รูปแบบไม่ถูก ต้องเป็นแบบ COM-IT-05' -ForegroundColor Yellow
  if ($PSBoundParameters.ContainsKey('Tag')) { exit 1 }   # ส่งรหัสมาทาง parameter (ทดสอบ) → ไม่ถามซ้ำ
  $Tag = ''
}
Write-Host "  Collecting $Tag ... (10-30 sec) / กำลังเก็บข้อมูล..." -ForegroundColor Cyan

# ---------- ตัวเครื่อง ----------
$cs   = Get-CimInstance Win32_ComputerSystem
$csp  = Get-CimInstance Win32_ComputerSystemProduct
$bios = Get-CimInstance Win32_BIOS
$bb   = Get-CimInstance Win32_BaseBoard
$enc  = Get-CimInstance Win32_SystemEnclosure | Select-Object -First 1
$os   = Get-CimInstance Win32_OperatingSystem
$cv   = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
$cpu  = Get-CimInstance Win32_Processor | Select-Object -First 1
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

$ct = @($enc.ChassisTypes)
$type = 'PC'
if (@($ct | Where-Object { $_ -in 8, 9, 10, 14, 30, 31, 32 }).Count) { $type = 'Notebook' }
elseif ($ct -contains 13) { $type = 'All-in-One' }
elseif ($ct -contains 35 -or $ct -contains 36) { $type = 'Mini PC' }

$maker = Real $cs.Manufacturer
$model = Real $cs.Model
$board = ('{0} {1}' -f (Real $bb.Manufacturer), (Real $bb.Product)).Trim()
if ($maker -and $model) { $brandModel = "$maker $model" }
elseif ($board) { $brandModel = "PC ประกอบ ($board)" }
else { $brandModel = $maker }

$serial = Real $bios.SerialNumber
if (-not $serial) { $serial = Real $enc.SerialNumber }
if (-not $serial) { $serial = Real $bb.SerialNumber }

# ---------- RAM ----------
$mods = @(Get-CimInstance Win32_PhysicalMemory)
$ramBytes = ($mods | Measure-Object -Property Capacity -Sum).Sum
if (-not $ramBytes) { $ramBytes = $cs.TotalPhysicalMemory }
$ramGB = [math]::Round([double]$ramBytes / 1GB)
$slotsTotal = (Get-CimInstance Win32_PhysicalMemoryArray | Measure-Object -Property MemoryDevices -Sum).Sum
$ramModules = @($mods | ForEach-Object {
  $speed = $_.ConfiguredClockSpeed; if (-not $speed) { $speed = $_.Speed }
  [ordered]@{ slot = Clean $_.DeviceLocator; size = ('{0}GB' -f [math]::Round([double]$_.Capacity / 1GB)); speed_mhz = $speed; maker = Real $_.Manufacturer; part = Real $_.PartNumber }
})

# ---------- ดิสก์ (ไม่นับ USB รวมถึงแฟลชไดรฟ์ที่รันโปรแกรมนี้) ----------
$disks = @(Get-PhysicalDisk | Where-Object { "$($_.BusType)" -ne 'USB' } | Sort-Object DeviceId | ForEach-Object {
  $t = "$($_.MediaType)"
  if ($t -notin 'SSD', 'HDD') { if ("$($_.BusType)" -eq 'NVMe') { $t = 'SSD' } else { $t = '' } }
  [ordered]@{ type = $t; size = Size $_.Size; model = Clean $_.FriendlyName; bus = "$($_.BusType)"; serial = Real $_.SerialNumber; health = "$($_.HealthStatus)" }
})
if (-not $disks.Count) {
  $disks = @(Get-CimInstance Win32_DiskDrive | Where-Object { $_.InterfaceType -ne 'USB' -and "$($_.MediaType)" -notmatch 'Removable' } | ForEach-Object {
    [ordered]@{ type = ''; size = Size $_.Size; model = Clean $_.Model; bus = "$($_.InterfaceType)"; serial = Real $_.SerialNumber; health = "$($_.Status)" }
  })
}
$storage = (@($disks | ForEach-Object { ('{0} {1}' -f $_.type, $_.size).Trim() }) -join ' + ')
# เฉพาะไดรฟ์บนดิสก์ในตัวเครื่อง — ไม่เอาแฟลชไดรฟ์ (บางรุ่นแจ้งตัวเองเป็นดิสก์ถาวร), การ์ด SD, ไดรฟ์จำลองอย่าง Google Drive
$internalLetters = @(Get-Disk | Where-Object { "$($_.BusType)" -notin 'USB', 'SD', 'MMC' } | Get-Partition | Where-Object { $_.DriveLetter } | ForEach-Object { "$($_.DriveLetter):" })
$volumes = @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | Where-Object { -not $internalLetters.Count -or $internalLetters -contains $_.DeviceID } | ForEach-Object {
  $pct = 0; if ($_.Size) { $pct = [math]::Round(100 * [double]$_.FreeSpace / [double]$_.Size) }
  [ordered]@{ drive = $_.DeviceID; fs = $_.FileSystem; size = Size $_.Size; free = Size $_.FreeSpace; free_pct = $pct }
})

# ---------- การ์ดจอ / จอ ----------
$gpus = @(Get-CimInstance Win32_VideoController | Where-Object { $_.Name -notmatch 'basic display|remote|mirage|virtual|parsec|citrix' } | ForEach-Object {
  $vram = ''; if ($_.AdapterRAM -gt 0) { $vram = ('{0}GB' -f [math]::Round([double]$_.AdapterRAM / 1GB, 1)) }
  [ordered]@{ name = Clean $_.Name; driver = Clean $_.DriverVersion; vram = $vram }
})
$monitors = @(Get-CimInstance -Namespace root\wmi -ClassName WmiMonitorID | ForEach-Object {
  [ordered]@{ maker = WmiText $_.ManufacturerName; model = WmiText $_.UserFriendlyName; serial = Real (WmiText $_.SerialNumberID); year = $_.YearOfManufacture }
})

# ---------- เครือข่าย ----------
$nics = @(Get-CimInstance Win32_NetworkAdapterConfiguration -Filter 'IPEnabled=True' | ForEach-Object {
  $ad = Get-CimInstance Win32_NetworkAdapter -Filter "Index=$($_.Index)"
  $kind = 'LAN'; if ("$($ad.Name) $($_.Description)" -match 'wi-?fi|wireless|802\.11|wlan') { $kind = 'Wi-Fi' }
  [ordered]@{
    name = Clean $_.Description; kind = $kind; mac = "$($_.MACAddress)"
    ip = (@($_.IPAddress) | Where-Object { $_ -match '^\d+\.\d+\.\d+\.\d+$' }) -join ', '
    gateway = (@($_.DefaultIPGateway) -join ', '); dns = (@($_.DNSServerSearchOrder) -join ', '); dhcp = [bool]$_.DHCPEnabled
  }
})
$allMacs = @(Get-CimInstance Win32_NetworkAdapter -Filter 'PhysicalAdapter=True' | Where-Object { $_.MACAddress } | ForEach-Object { '{0} ({1})' -f $_.MACAddress, (Clean $_.NetConnectionID) })
$ssid = ''
$w = netsh wlan show interfaces 2>$null | Select-String '^\s*SSID\s*:\s*(.+)$' | Select-Object -First 1
if ($w) { $ssid = $w.Matches[0].Groups[1].Value.Trim() }
$mapped = @(Get-CimInstance Win32_MappedLogicalDisk | ForEach-Object { '{0} {1}' -f $_.Name, $_.ProviderName })

# ไม่เก็บเครื่องพิมพ์: ทุกเครื่องเพิ่มเครื่องพิมพ์ผ่าน IP เหมือนกันหมด ไม่ได้บอกว่าเครื่องพิมพ์อยู่ที่เครื่องไหน

# ---------- โปรแกรมที่ติดตั้ง (อ่านจาก registry — ไม่ใช้ Win32_Product เพราะไปกระตุ้นให้ตัวติดตั้งซ่อมตัวเอง) ----------
$seen = @{}
$apps = @(Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*' |
  Where-Object { $_.DisplayName -and -not $_.SystemComponent -and -not $_.ParentKeyName -and $_.DisplayName -notmatch '^(Update for|Security Update|Hotfix)|\(KB\d+\)' } |
  ForEach-Object {
    $k = '{0}|{1}' -f $_.DisplayName, $_.DisplayVersion
    if (-not $seen.ContainsKey($k)) { $seen[$k] = 1; [ordered]@{ name = Clean $_.DisplayName; version = Clean $_.DisplayVersion; publisher = Clean $_.Publisher; installed = Clean $_.InstallDate } }
  } | Sort-Object { $_.name })
$office = @($apps | Where-Object { $_.name -match '^Microsoft (Office|365)' -and $_.name -notmatch 'language|proof|mui|licens|shared|component|tools|click-to-run|update|runtime|connector|interop' } |
  ForEach-Object { ('{0} {1}' -f ($_.name -replace '\s+-\s+[a-z]{2}-[a-z]{2}$', ''), $_.version).Trim() } | Select-Object -Unique)  # ตัด " - en-us" / " - th-th" ไม่ให้นับซ้ำตามภาษา
$av = @(Get-CimInstance -Namespace root\SecurityCenter2 -ClassName AntiVirusProduct | ForEach-Object { Clean $_.displayName } | Select-Object -Unique)

# ---------- Windows ----------
$activated = ''
$lp = Get-CimInstance SoftwareLicensingProduct -Filter "ApplicationID='55c92734-d682-4d71-983e-d6ec3f16059f' AND PartialProductKey IS NOT NULL" | Select-Object -First 1
if ($lp) { if ($lp.LicenseStatus -eq 1) { $activated = 'แท้ (Activated)' } else { $activated = "ยังไม่ activate (สถานะ $($lp.LicenseStatus))" } }
$lastUpdate = ''
$hf = Get-HotFix | Where-Object { $_.InstalledOn } | Sort-Object InstalledOn -Descending | Select-Object -First 1
if ($hf) { $lastUpdate = D $hf.InstalledOn 'yyyy-MM-dd' }
$osName = Clean ('{0} {1}' -f $os.Caption, $cv.DisplayVersion)

# ---------- ผู้ใช้ ----------
$profiles = @(Get-CimInstance Win32_UserProfile | Where-Object { -not $_.Special -and $_.LocalPath -like 'C:\Users\*' } | Sort-Object LastUseTime -Descending | ForEach-Object {
  [ordered]@{ user = Split-Path $_.LocalPath -Leaf; last_used = D $_.LastUseTime 'yyyy-MM-dd' }
})
$localUsers = @(Get-LocalUser | ForEach-Object { [ordered]@{ name = $_.Name; enabled = [bool]$_.Enabled; last_logon = D $_.LastLogon 'yyyy-MM-dd' } })
$admins = @(Get-LocalGroupMember -SID 'S-1-5-32-544' | ForEach-Object { Clean $_.Name })
if (-not $admins.Count) {
  # Get-LocalGroupMember พังเมื่อในกลุ่มมีบัญชีที่ถูกลบไปแล้ว → อ่านผ่าน ADSI แทน (ชื่อกลุ่มอาจเป็นภาษาไทย จึงหาจาก SID)
  try {
    $grp = ((New-Object Security.Principal.SecurityIdentifier 'S-1-5-32-544').Translate([Security.Principal.NTAccount]).Value -split '\\')[-1]
    $admins = @(([ADSI]"WinNT://$env:COMPUTERNAME/$grp,group").psbase.Invoke('Members') | ForEach-Object { $_.GetType().InvokeMember('Name', 'GetProperty', $null, $_, $null) })
  } catch {}
}

# ---------- ความปลอดภัย (บางข้อต้อง Run as administrator) ----------
$security = [ordered]@{ run_as_admin = $isAdmin; bitlocker = ''; tpm = ''; secure_boot = ''; firewall = '' }
$security.firewall = (@(Get-NetFirewallProfile | ForEach-Object { '{0}:{1}' -f $_.Name, $(if ($_.Enabled) { 'on' } else { 'off' }) }) -join ' ')
if ($isAdmin) {
  $security.bitlocker = (@(Get-BitLockerVolume | ForEach-Object { '{0} {1}' -f $_.MountPoint, $_.ProtectionStatus }) -join ', ')
  $t = Get-Tpm; if ($t) { if ($t.TpmPresent) { $security.tpm = "มี (พร้อมใช้: $($t.TpmReady))" } else { $security.tpm = 'ไม่มี' } }
  try { if (Confirm-SecureBootUEFI -ErrorAction Stop) { $security.secure_boot = 'เปิด' } else { $security.secure_boot = 'ปิด' } } catch { $security.secure_boot = 'ไม่รองรับ (Legacy BIOS)' }
} else { $security.bitlocker = $security.tpm = $security.secure_boot = 'ต้อง Run as administrator' }

# ---------- แบตเตอรี่ (โน้ตบุ๊ก) ----------
$battery = ''
if (Get-CimInstance Win32_Battery) {
  $design = (Get-CimInstance -Namespace root\wmi -ClassName BatteryStaticData | Select-Object -First 1).DesignedCapacity
  $full = (Get-CimInstance -Namespace root\wmi -ClassName BatteryFullChargedCapacity | Select-Object -First 1).FullChargedCapacity
  if ($design -and $full) { $battery = 'สุขภาพแบต {0}%' -f [math]::Round(100 * $full / $design) } else { $battery = 'มีแบตเตอรี่' }
}

# ---------- รวมเป็นข้อมูลเครื่อง ----------
$rec = [ordered]@{
  asset_tag      = $Tag
  collected_at   = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  computer_name  = $env:COMPUTERNAME
  domain         = Clean $cs.Domain
  logged_in_user = Clean $cs.UserName
  run_by         = "$env:USERDOMAIN\$env:USERNAME"
  type           = $type
  brand_model    = $brandModel
  serial         = $serial
  cpu            = CpuShort $cpu.Name
  ram            = "$($ramGB)GB"
  storage        = $storage
  os             = $osName
  activated      = $activated
  last_update    = $lastUpdate
  office         = ($office -join ' | ')
  antivirus      = ($av -join ' | ')
  ip             = (@($nics | ForEach-Object { $_.ip } | Where-Object { $_ }) -join ', ')
  mac            = (@($nics | ForEach-Object { $_.mac } | Where-Object { $_ }) -join ', ')
  monitors       = (@($monitors | ForEach-Object { ('{0} {1}' -f $_.maker, $_.model).Trim() } | Where-Object { $_ }) -join ' | ')
  details        = [ordered]@{
    system   = [ordered]@{ manufacturer = $maker; model = $model; board = $board; board_serial = Real $bb.SerialNumber; bios = ('{0} {1}' -f (Clean $bios.SMBIOSBIOSVersion), (D $bios.ReleaseDate 'yyyy-MM-dd')).Trim(); uuid = "$($csp.UUID)"; chassis = $ct -join ',' }
    cpu      = [ordered]@{ name = Clean $cpu.Name; cores = $cpu.NumberOfCores; threads = $cpu.NumberOfLogicalProcessors; max_mhz = $cpu.MaxClockSpeed }
    ram      = [ordered]@{ total = "$($ramGB)GB"; slots_used = $mods.Count; slots_total = $slotsTotal; modules = $ramModules }
    disks    = $disks
    volumes  = $volumes
    gpus     = $gpus
    monitors = $monitors
    network  = [ordered]@{ adapters = $nics; all_macs = $allMacs; wifi_ssid = $ssid; mapped_drives = $mapped }
    windows  = [ordered]@{ name = $osName; build = ('{0}.{1}' -f $os.Version, $cv.UBR); arch = "$($os.OSArchitecture)"; installed = D $os.InstallDate 'yyyy-MM-dd'; last_boot = D $os.LastBootUpTime 'yyyy-MM-dd HH:mm'; activated = $activated; last_update = $lastUpdate }
    users    = [ordered]@{ logged_in = Clean $cs.UserName; profiles = $profiles; local_accounts = $localUsers; administrators = $admins }
    security = $security
    battery  = $battery
    apps     = $apps
  }
}

# ---------- กันพิมพ์รหัสผิด ----------
$file = Join-Path $OutDir "$Tag.json"
if (Test-Path $file) {
  $old = Get-Content $file -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($old.computer_name -and $old.computer_name -ne $env:COMPUTERNAME) {
    $ans = Read-Host "  $Tag was saved from PC '$($old.computer_name)' / รหัสนี้เคยเก็บจากเครื่องอื่น — overwrite? เขียนทับ (Y/N)"
    if ($ans -notmatch '^[Yy]') { Finish '  Cancelled / ยกเลิก ไม่ได้บันทึก' }
  }
}
foreach ($f in @(Get-ChildItem $OutDir -Filter '*.json' | Where-Object { $_.Name -ne 'inventory.json' -and $_.Name -ne "$Tag.json" })) {
  $o = Get-Content $f.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($o.computer_name -eq $env:COMPUTERNAME -and $o.details.system.uuid -eq "$($csp.UUID)") {
    $ans = Read-Host "  This PC was saved as $($o.asset_tag) / เครื่องนี้เคยบันทึกเป็น $($o.asset_tag) — change to $Tag? เปลี่ยน (Y/N)"
    if ($ans -match '^[Yy]') { Remove-Item $f.FullName } else { Finish '  Cancelled / ยกเลิก ไม่ได้บันทึก' }
  }
}

# ---------- บันทึก ----------
[IO.File]::WriteAllText($file, ($rec | ConvertTo-Json -Depth 8), $utf8)

$all = @(Get-ChildItem $OutDir -Filter '*.json' | Where-Object { $_.Name -ne 'inventory.json' } |
  ForEach-Object { Get-Content $_.FullName -Raw -Encoding UTF8 | ConvertFrom-Json } | Sort-Object asset_tag)
$summary = @($all | Select-Object -Property * -ExcludeProperty details)
[IO.File]::WriteAllText((Join-Path $OutDir 'inventory.json'), (ConvertTo-Json -InputObject $summary -Depth 4), $utf8)

$csvOk = $true
try {
  $summary | Select-Object @{n = 'รหัสเครื่อง'; e = { $_.asset_tag } }, @{n = 'วันที่เก็บ'; e = { $_.collected_at } }, @{n = 'ชื่อเครื่อง'; e = { $_.computer_name } },
    @{n = 'ผู้ใช้ที่ล็อกอิน'; e = { $_.logged_in_user } }, @{n = 'ประเภท'; e = { $_.type } }, @{n = 'ยี่ห้อ/รุ่น'; e = { $_.brand_model } }, @{n = 'S/N'; e = { $_.serial } },
    @{n = 'CPU'; e = { $_.cpu } }, @{n = 'RAM'; e = { $_.ram } }, @{n = 'Disk'; e = { $_.storage } }, @{n = 'Windows'; e = { $_.os } }, @{n = 'Windows แท้'; e = { $_.activated } },
    @{n = 'อัปเดตล่าสุด'; e = { $_.last_update } }, @{n = 'Office'; e = { $_.office } }, @{n = 'Antivirus'; e = { $_.antivirus } }, @{n = 'IP'; e = { $_.ip } },
    @{n = 'MAC'; e = { $_.mac } }, @{n = 'จอ'; e = { $_.monitors } } |
    Export-Csv (Join-Path $OutDir 'inventory.csv') -NoTypeInformation -Encoding UTF8 -ErrorAction Stop
  @($all | ForEach-Object {
    $t = $_.asset_tag; $c = $_.computer_name
    foreach ($a in @($_.details.apps)) { [pscustomobject][ordered]@{ 'รหัสเครื่อง' = $t; 'ชื่อเครื่อง' = $c; 'โปรแกรม' = $a.name; 'เวอร์ชัน' = $a.version; 'ผู้ผลิต' = $a.publisher; 'วันที่ติดตั้ง' = $a.installed } }
  }) | Export-Csv (Join-Path $OutDir 'software.csv') -NoTypeInformation -Encoding UTF8 -ErrorAction Stop
} catch { $csvOk = $false }

# ---------- แสดงผล ----------
Write-Host ''
Write-Host "  Saved / บันทึกแล้ว: $Tag" -ForegroundColor Green
Write-Host ("  PC name : {0}    User : {1}" -f $rec.computer_name, $rec.logged_in_user)
Write-Host ("  Model   : {0}    S/N : {1}" -f $rec.brand_model, $rec.serial)
Write-Host ("  CPU/RAM : {0} / {1}    Disk : {2}" -f $rec.cpu, $rec.ram, $rec.storage)
Write-Host ("  Windows : {0}  {1}" -f $rec.os, $rec.activated)
Write-Host ("  Apps    : {0} programs" -f $apps.Count)
if (-not $csvOk) { Write-Host '  ! Close inventory.csv / software.csv in Excel, then run again / ปิดไฟล์ CSV ใน Excel แล้วรันใหม่' -ForegroundColor Yellow }
Write-Host ("  USB now has {0} computers / ใน USB มีข้อมูลแล้ว {0} เครื่อง" -f $all.Count) -ForegroundColor Cyan
Finish ''
