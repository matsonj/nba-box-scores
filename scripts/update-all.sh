#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e
# Exit if any command in a pipeline fails
set -o pipefail

echo "Starting data update process..."

# Run fetch schedule
echo "Fetching schedule..."
npm run fetch-schedule
if [ $? -ne 0 ]; then
    echo "Error fetching schedule"
    exit 1
fi

# Load schedule
echo "Loading schedule..."
bash scripts/load-schedule.sh
if [ $? -ne 0 ]; then
    echo "Error loading schedule"
    exit 1
fi

# Fetch box scores
echo "Fetching box scores..."
npm run fetch-box-scores
if [ $? -ne 0 ]; then
    echo "Error fetching box scores"
    exit 1
fi

# Load box scores
echo "Loading box scores..."
bash scripts/load-box-scores.sh
if [ $? -ne 0 ]; then
    echo "Error loading box scores"
    exit 1
fi

echo "Data update process completed successfully!"
