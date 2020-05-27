import Web3 from 'web3';
import { TransactionConfig, SignedTransaction, TransactionReceipt } from 'web3-core/types';
import axios from 'axios';

const erc721abi = require('../contract-abis/ERC721');
const erc721bytecode = require('../contract-abis/ERC721-bytecode');
const nodeApi = 'http://localhost:3000';

const web3 = new Web3(new Web3.providers.HttpProvider(''));

test();

async function test() {
    // 1. We will deploy an ERC721 and let the node manager handle the deployment
    let txAddress = await deployERC721();
    // 2. We need to wait for the transaction receipt in order to get the contract address
    let txReceipt = await waitForTx(txAddress);
    // 3. Get the contract address from the txReceipt once the transaction is mined
    let contractAddress = txReceipt.contractAddress;
    // 4. Get account address from Node Manager
    let accountAddress = await getAccountAddress();
    // 5. Call smart contract function of ERC721 contract
    mint(contractAddress, accountAddress);
}

async function waitForTx(txAddress) {
    let response = await axios.get<TransactionReceipt>(nodeApi + '/waitForTx/' + txAddress);
    return response.data;
}

async function getAccountAddress() {
    let response = await axios.get(nodeApi + '/getAccountAddress');
    return response.data;
}

async function deployERC721() {
    const ERC721contract = new web3.eth.Contract(erc721abi);
    let deployTx : any = ERC721contract.deploy({
        data: '0x' + erc721bytecode.object,
        arguments: []
    });
    let tx : any = {
        data: deployTx.encodeABI(),
        value : 0
    };
    let response = await axios.post(nodeApi + '/sendTx', tx);
    console.log(response);
    return response.data;
}

async function mint(contractAddress, toAddress) {
    const ERC721contract = new web3.eth.Contract(erc721abi);
    ERC721contract.options.address = contractAddress;
    const encodedABI = await ERC721contract.methods.mint(toAddress).encodeABI();
    let txConfig: TransactionConfig = {
        data: encodedABI,
        to: ERC721contract.options.address
    };
    txConfig.gas = await web3.eth.estimateGas(txConfig);

    /**
     * Use the following line to have the NodeJS application sign this tx.
     */
    let httpResponse = await axios.post(nodeApi + '/sendTx', txConfig);

    /**
     * The following example shows how to send the same transaction as a pre-signed tx
     * let signedTransaction: SignedTransaction = await web3.eth.accounts.signTransaction(txConfig, privateKey);
     * let httpResponse = await axios.post(nodeApi + '/sendPreSignedTx', signedTransaction);
     */ 
    
    console.log(httpResponse);
}

