#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "===> 1. Installing Frontend Dependencies & Building Vite Distribution..."
cd frontend
npm install
npm run build
cd ..

echo "===> 2. Upgrading Pip & Installing Python Dependencies..."
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt

echo "===> Build complete! Application is ready to launch."
