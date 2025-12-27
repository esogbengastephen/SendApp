#!/bin/bash
# Load environment and run recovery

cd "/Users/user/Documents/Softwaer development /Send Xino"

# Export all variables from .env.local
export $(grep -v '^#' .env.local | xargs)

# Run the recovery script
npx tsx scripts/recover-all-offramp-wallets.ts "$@"
