$ErrorActionPreference = 'Stop'
$appDirectory = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$desktopDirectory = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktopDirectory '知页 · 论文阅读.lnk'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = (Get-Command node.exe -ErrorAction Stop).Source
$shortcut.Arguments = '"' + (Join-Path $PSScriptRoot 'desktop-launch.mjs') + '"'
$shortcut.WorkingDirectory = $appDirectory
$shortcut.IconLocation = (Join-Path $appDirectory 'public\zhiye.ico') + ',0'
$shortcut.Description = '知页 Paperleaf · 上传论文 PDF，中英逐句对照，选中文字和圈选图表解释。'
$shortcut.WindowStyle = 7
$shortcut.Save()
Write-Output $shortcutPath
