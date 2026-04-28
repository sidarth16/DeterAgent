const { ZgFile, Indexer, MemData } = require('@0gfoundation/0g-ts-sdk');
const { ethers } = require('ethers');

const fs = require('fs');
require('dotenv').config({path: '../.env'});

// Galileo testnet
const INDEXER_RPC = "https://indexer-storage-testnet-turbo.0g.ai";
const BLOCKCHAIN_RPC = "https://evmrpc-testnet.0g.ai";
const PRIVATE_KEY = process.env.OG_PRIVATE_KEY;


// Initialize provider and signer
const provider = new ethers.JsonRpcProvider(BLOCKCHAIN_RPC);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Initialize indexer — flow contract is auto-discovered
const indexer = new Indexer(INDEXER_RPC);

async function upload(filePath) {
    const file = await ZgFile.fromFilePath(filePath);

    // Must call merkleTree() before upload — populates internal state
    const [tree, treeErr] = await file.merkleTree();

    if (treeErr) {
        console.error(`MerkleTreeError: ${treeErr.message}`);
        process.exit(1);
    }

    const rootHash = tree.rootHash();
    console.log("Root Hash:", tree?.rootHash());

    const balance = await provider.getBalance(wallet.address);
    console.log("Wallet balance:", balance.toString());

    const [txHash, uploadErr] = await indexer.upload(
        file,
        BLOCKCHAIN_RPC,
        wallet
    );

    if (uploadErr) {
        console.error(`UploadError: ${uploadErr.message}`);
        process.exit(1);
    }

    console.log(JSON.stringify({
        rootHash: rootHash,
        txHash: txHash
    }));

    await file.close();
}

const filePath = process.argv[2];
if (!filePath) {
    console.error(JSON.stringify({error: "No file path provided"}));
    process.exit(1);
}

upload(filePath).catch(e => {
    console.error(JSON.stringify({error: e.message}));
    process.exit(1);
});