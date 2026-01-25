/**
 * Oracle of Wit - Deployment Script
 * ==================================
 * 
 * Deploy the Oracle of Wit contract to GenLayer networks.
 * 
 * Usage:
 *   npx ts-node deploy.ts [network]
 * 
 * Networks:
 *   - simulator (default): Local development
 *   - testnet: GenLayer Testnet Bradbury
 * 
 * Prerequisites:
 *   npm install genlayer-js typescript ts-node
 */

import { createClient, createAccount } from 'genlayer-js';
import { simulator, testnet } from 'genlayer-js/chains';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const NETWORKS = {
  simulator: {
    chain: simulator,
    rpcUrl: 'http://localhost:4000/api',
  },
  testnet: {
    chain: testnet,
    rpcUrl: 'https://testnet.genlayer.com/api',
  },
};

async function deploy(networkName: string = 'simulator') {
  console.log(`\n🚀 Deploying Oracle of Wit to ${networkName}...\n`);

  // Get network config
  const network = NETWORKS[networkName as keyof typeof NETWORKS];
  if (!network) {
    throw new Error(`Unknown network: ${networkName}. Use 'simulator' or 'testnet'`);
  }

  // Load private key from environment or generate new account
  const privateKey = process.env.GENLAYER_PRIVATE_KEY;
  const account = privateKey 
    ? createAccount(privateKey)
    : createAccount();

  console.log(`📍 Deployer address: ${account.address}`);

  // Create client
  const client = createClient({
    chain: network.chain,
    account: account,
  });

  // Read contract code
  const contractPath = path.join(__dirname, 'oracle_of_wit.py');
  const contractCode = fs.readFileSync(contractPath, 'utf-8');
  
  console.log(`📄 Contract loaded: ${contractCode.length} bytes`);

  try {
    // Deploy contract (no constructor args needed)
    console.log(`\n⏳ Deploying contract...`);
    
    const deployHash = await client.deployContract({
      code: contractCode,
      args: [],
    });

    console.log(`📝 Deploy transaction hash: ${deployHash}`);

    // Wait for deployment to finalize
    console.log(`⏳ Waiting for finalization...`);
    
    const receipt = await client.waitForTransactionReceipt({
      hash: deployHash,
      status: 'FINALIZED',
    });

    const contractAddress = receipt.contractAddress;
    
    console.log(`\n✅ Contract deployed successfully!`);
    console.log(`📍 Contract address: ${contractAddress}`);
    console.log(`🔗 Transaction hash: ${deployHash}`);

    // Save deployment info
    const deploymentInfo = {
      network: networkName,
      contractAddress,
      deployHash,
      deployedAt: new Date().toISOString(),
      deployerAddress: account.address,
    };

    const deploymentPath = path.join(__dirname, `deployment-${networkName}.json`);
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    
    console.log(`💾 Deployment info saved to: ${deploymentPath}`);

    // Verify deployment by reading contract info
    console.log(`\n🔍 Verifying deployment...`);
    
    const contractInfo = await client.readContract({
      address: contractAddress,
      functionName: 'get_contract_info',
      args: [],
    });

    console.log(`📊 Contract info:`, contractInfo);

    return contractAddress;

  } catch (error) {
    console.error(`\n❌ Deployment failed:`, error);
    throw error;
  }
}

// Main execution
const networkArg = process.argv[2] || 'simulator';

deploy(networkArg)
  .then((address) => {
    console.log(`\n🎉 Deployment complete! Contract address: ${address}\n`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(`\n💥 Deployment error:`, error);
    process.exit(1);
  });
