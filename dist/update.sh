echo 'UPDATE!!!'
echo `uptime` >update.log
echo 'wget'
wget -O app.zip https://github.com/molszews/lgtvapi/releases/latest/download/app.zip >>update.log
echo 'unzip'
unzip -p app.zip package.json >package.json
echo 'unzip'
unzip -p app.zip package-lock.json >package-lock.json
echo 'npm'
npm install --production >>update.log
echo 'unzip'
unzip -o app.zip >>update.log
echo `uptime` >update.log
echo 'DONE'