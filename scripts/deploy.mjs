#!/usr/bin/env node
// Deploy Oracle of Wit contract to GenLayer Testnet Bradbury
// Usage: node scripts/deploy.mjs

import { createClient, createAccount } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRIVATE_KEY = process.env.GENLAYER_PRIVATE_KEY || '0x0f883d273e46b26406225846060d50e491dbc75f628a23d51356ed9b6f7f2f17';

async function main() {
    console.log('=== Oracle of Wit — Deploying to GenLayer Testnet Bradbury ===\n');

    // Setup account
    const account = createAccount(PRIVATE_KEY);
    console.log('Account:', account.address);

    // Create client
    const client = createClient({ chain: testnetBradbury, account });

    // Check balance
    const balanceHex = await client.request({ method: 'eth_getBalance', params: [account.address, 'latest'] });
    const balanceWei = BigInt(balanceHex);
    const balanceGEN = Number(balanceWei) / 1e18;
    console.log(`Balance: ${balanceGEN.toFixed(4)} GEN`);

    if (balanceGEN < 0.01) {
        console.error('\n!!! Insufficient balance. Go to https://testnet-faucet.genlayer.foundation/');
        console.error(`    Enter address: ${account.address}`);
        console.error('    Select: Testnet Bradbury');
        console.error('    Claim 100 GEN, then re-run this script.\n');
        process.exit(1);
    }

    // Read contract
    const contractPath = resolve(__dirname, '..', 'contracts', 'oracle_of_wit.py');
    const contractCode = readFileSync(contractPath, 'utf8');
    console.log(`Contract: ${contractPath} (${contractCode.length} bytes)`);

    // Deploy
    console.log('\nDeploying to Testnet Bradbury...');
    console.log('(This sends a tx to the consensus main contract, validators will process it)\n');

    try {
        const txHash = await client.deployContract({
            code: contractCode,
            args: [],
            value: 0n,
        });
        console.log('Deploy tx hash:', txHash);

        // Wait for receipt
        console.log('Waiting for consensus (this may take 30-120s)...');
        const { TransactionStatus } = await import('genlayer-js/types');
        const receipt = await client.waitForTransactionReceipt({
            hash: txHash,
            status: TransactionStatus.ACCEPTED,
            retries: 60,
            interval: 3000,
        });

        console.log('\n=== DEPLOYMENT SUCCESSFUL ===');
        console.log('Receipt:', JSON.stringify(receipt, null, 2));

        // The contract address should be in the receipt
        const contractAddress = receipt?.contractAddress || receipt?.contract_address || receipt?.data?.contractAddress;
        if (contractAddress) {
            console.log(`\nContract Address: ${contractAddress}`);
            console.log(`Explorer: https://explorer-bradbury.genlayer.com/contracts/${contractAddress}`);
            console.log(`\nNext steps:`);
            console.log(`  1. Update .env.local: GENLAYER_CONTRACT_ADDRESS="${contractAddress}"`);
            console.log(`  2. Set Vercel env: npx vercel env add GENLAYER_CONTRACT_ADDRESS`);
            console.log(`  3. Redeploy: git push`);
        } else {
            console.log('\nContract address not found in receipt. Check the explorer:');
            console.log(`  https://explorer-bradbury.genlayer.com/transactions/${txHash}`);
        }
    } catch (error) {
        console.error('Deployment failed:', error.message);
        if (error.message.includes('reverted')) {
            console.error('Transaction reverted — contract may have an error or insufficient gas.');
        }
        process.exit(1);
    }
}

main().catch(e => { console.error(e); process.exit(1); });
