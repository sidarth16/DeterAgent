const { Indexer } = require('@0gfoundation/0g-ts-sdk');
const { ethers } = require('ethers');
const fs = require('fs');
require('dotenv').config({ path: '../.env' });

// Galileo testnet
const INDEXER_RPC = "https://indexer-storage-testnet-turbo.0g.ai";
const BLOCKCHAIN_RPC = "https://evmrpc-testnet.0g.ai";
const PRIVATE_KEY = process.env.OG_PRIVATE_KEY;

// Initialize provider and signer
const provider = new ethers.JsonRpcProvider(BLOCKCHAIN_RPC);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Initialize indexer
const indexer = new Indexer(INDEXER_RPC);

// Wrap in async function
async function main() {
    try {
        const rootHash = "0x0e2b92067e0618b22ceea5c9bacd64973915adfb0c63d3ed7b84a73591fc9cd7";

        console.log("⬇️ Downloading from 0G...");

        const err = await indexer.download(rootHash, './hello-1.json', true);

        if (err) {
            throw err;
        }

        console.log("✅ File downloaded successfully to ./hello-1.json");

    } catch (e) {
        console.error("❌ Error:", e);
    }
}

// Run
main();