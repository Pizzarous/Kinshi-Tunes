#!/bin/bash

cd ..
cd ..
git reset --hard origin/main
git pull --all
npm install
npm run build
npm start