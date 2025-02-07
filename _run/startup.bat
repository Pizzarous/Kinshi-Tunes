cd ..
call git reset --hard origin/main
call git pull --all
call npm install -g npm
call npm install
call npm run build
call npm start