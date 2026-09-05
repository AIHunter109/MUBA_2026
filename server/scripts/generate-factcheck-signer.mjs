// One-time setup: generates a fresh Sui Ed25519 keypair for the fact-checker's
// on-chain recorder (the backend service account that submits `record_claim_check`
// transactions - never a user's own key). Run this yourself and keep the output
// private; RemitGuard's own tooling deliberately never generates or prints this
// for you.
//
// Usage:  node server/scripts/generate-factcheck-signer.mjs
//
// Then:
//   1. Copy the "address" line's value and fund it at:
//      https://faucet.sui.io/?address=<address>
//   2. Copy the "secretKey" line's value into server/.env as:
//      FACTCHECK_SIGNER_SECRET_KEY=<secretKey>

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

const keypair = new Ed25519Keypair();

console.log('address:  ', keypair.toSuiAddress());
console.log('secretKey:', keypair.getSecretKey());
console.log('\nFund the address above at:');
console.log(`https://faucet.sui.io/?address=${keypair.toSuiAddress()}`);
console.log('\nThen add to server/.env:');
console.log(`FACTCHECK_SIGNER_SECRET_KEY=${keypair.getSecretKey()}`);
