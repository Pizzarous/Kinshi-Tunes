for %%f in (*) do (
  echo Checking file: %%f
  git checkout -- %%f
)
call git pull origin main
call npm install
call npm run build
call npm start