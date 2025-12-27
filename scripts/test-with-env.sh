#!/bin/bash

# Export environment variables from .env.local
export $(grep -v '^#' .env.local | sed 's/^"//' | sed 's/"$//' | xargs)

# Now run the TypeScript script
npx tsx scripts/test-actual-generation.ts
