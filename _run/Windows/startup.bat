cd ..
cd ..
call git reset --hard origin/main
call git pull --all
call npm install
call npm run build
call npm start