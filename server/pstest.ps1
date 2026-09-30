Test-NetConnection -ComputerName 127.0.0.1 -Port 3306 -InformationLevel Detailed
try {
  $c = New-Object System.Net.Sockets.TcpClient('127.0.0.1',3306)
  $s = $c.GetStream()
  $s.ReadTimeout = 3000
  $b = New-Object byte[] 1024
  $n = $s.Read($b,0,$b.Length)
  if ($n -gt 0) {
    Write-Output ("Read $n bytes:")
    Write-Output ([System.BitConverter]::ToString($b,0,$n))
  } else {
    Write-Output "Read 0 bytes"
  }
  $s.Close()
  $c.Close()
} catch {
  Write-Output ("TCP read error: " + $_.Exception.Message)
}
