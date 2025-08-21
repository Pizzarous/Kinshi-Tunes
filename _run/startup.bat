cd ..
call git reset --hard origin/main
call git pull --all
call pnpm install
call pnpm run build
call pnpm start