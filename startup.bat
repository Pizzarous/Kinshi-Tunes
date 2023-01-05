call git reset --hard origin/main
call git pull --all
call npm install
call npm audit fix --force
call npm run build
call npm start