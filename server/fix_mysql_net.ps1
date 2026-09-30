# Adds firewall rules, restarts mysqld and tests TCP connections
Write-Output 'Adding firewall rules for TCP 3306 (in/out)'
netsh advfirewall firewall add rule name="Allow MySQL 3306 In" dir=in action=allow protocol=TCP localport=3306 | Out-Null
netsh advfirewall firewall add rule name="Allow MySQL 3306 Out" dir=out action=allow protocol=TCP remoteport=3306 | Out-Null

Write-Output 'Stopping mysqld if running'
Get-Process mysqld -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

$mysqld = 'C:\xampp\mysql\bin\mysqld.exe'
$myini = 'C:\xampp\mysql\bin\my.ini'
Write-Output "Starting mysqld ($mysqld) with $myini"
Start-Process -FilePath $mysqld -ArgumentList "--defaults-file=$myini","--standalone" -NoNewWindow
Start-Sleep -Seconds 2

Write-Output 'Netstat snapshot for :3306'
netstat -ano | findstr "3306"

Write-Output 'mysql client (TCP) version check'
& 'C:\xampp\mysql\bin\mysql.exe' --% --protocol=TCP -h 127.0.0.1 -P 3306 -u root -e "SELECT VERSION();"

Write-Output 'Node low-level TCP test'
node tcp_test.js 127.0.0.1 3306

Write-Output 'Node mysql2 test (promise)'
node test_mysql_connect.js
