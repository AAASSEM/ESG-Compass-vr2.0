#!/usr/bin/env bash
# build.sh - Place this in your backend directory

set -o errexit

# Install Python dependencies
pip install -r requirements.txt

# Build the frontend
cd ../frontend-react
npm install
npm run build

# Copy built files to Django's staticfiles directory
cd ../backend
rm -rf staticfiles
mkdir -p staticfiles

# Copy the entire dist folder contents to staticfiles
cp -r ../frontend-react/dist/* staticfiles/

# Collect static files (this will gather all static files including admin)
python manage.py collectstatic --noinput

# Run migrations
python manage.py migrate