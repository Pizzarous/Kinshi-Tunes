#!/bin/bash

# Get the directory where the script is located
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Change to the grandparent directory of the script
cd "$script_dir"/../../

# Continue with the rest of your commands
git reset --hard origin/main
git pull --all
pnpm install
pnpm run build
pnpm start