$lines = Get-Content 'c:\ABU-MAFHAL-HUB\app\manage\users.tsx' -Encoding UTF8
$newLines = @()
for ($i=0; $i -lt 5; $i++) { $newLines += $lines[$i] }
for ($i=805; $i -lt $lines.Length; $i++) { $newLines += $lines[$i] }
$newLines | Set-Content 'c:\ABU-MAFHAL-HUB\app\manage\users.tsx' -Encoding UTF8
