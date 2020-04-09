wget -O app.zip https://github.com/molszews/lgtvapi/releases/latest/download/app.zip
unzip -p app.zip package.json >package.json
unzip -p app.zip package-lock.json >package-lock.json
npm install --production
unzip -o app.zip