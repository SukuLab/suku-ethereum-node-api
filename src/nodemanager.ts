import { Transaction, TransactionReceipt, Account, AddAccount, TransactionConfig, SignedTransaction } from 'web3-core/types';
import ConnectionManager from './connectionmanager';
import Web3 from 'web3';

let logger = require('@suku/suku-logging')(require('../package.json'));

/** 
 * Last Nonce variable to keep track of the transaction count.
 * Declare this outside of the class to make this a global variable.
 * Nonce should be the same across all instances of the class.
 * This is useful if multiple transactions are being sent at the
 * same time. If the nonce is not managed externally, the web3 
 * object might return the same value for multiple transactions
 * which will cause some transaction to fail.
 */
let lastNonce: number;

class NodeManager {

    // Node
    public connectionManager :  ConnectionManager;
    public connectionString : string;
    public chainId: number = -1;

    // Account
    public account : AddAccount;  

    /**
     * Creates a new NodeManager instance
     * @param {string} connectionString 
     * @param {string} privateKey 
     */
    constructor(connectionString : string, privateKey? : string) {
        logger.info("NodeManager created with connection string " + connectionString);
        
        this.connectionString = connectionString; 
        this.connectionManager = new ConnectionManager(this.connectionString);             
        this.account = { privateKey : "", address : "" };

        // Wait for connection and start account setup
        this.connectionManager.getConnection()
        .then(() => this.setupAccount(privateKey))
        .then(() => this.initalizeChainId())
        .then(() => this.initalizeNonce());
    }

    /**
     * Can be used to retrieve the current nonce from the network.
     * It sets the nonce for all transactions as a global variable. 
     * This is useful when someone tries to send hundreds of 
     * transactions at the same time from the same accout.
     */
    public async initalizeNonce() : Promise<any> {
        logger.info("Initiating nonce... ChainId: " + this.chainId);
        lastNonce = await this.getNonce();
        logger.info("Nonce has been initiated: " + lastNonce);
    }

    /**
     * Can be used to get the address of the configured Ethereum account
     * @returns Ethereum account address
     */
    public getAccountAddress() : string {
        return this.account.address;
    }

    /**
     * Can be used to get a transaction object based on a transaction hash.
     * @param {string} txHash - transaction address
     * @returns a promise with the Transaction object
     */
    public async getTransaction(txHash : string) : Promise<Transaction> {
        let connection = await this.connectionManager.getConnection();
        return connection.eth.getTransaction(txHash)
        .then( (tx : Transaction) => {
            logger.info("Transaction retrieved from chain: "+tx.hash);
            return tx;
        });
    }

    /**
     * Can be used to check if a given address contains a smart contract.
     * @param contractAddress - the contract address to check (string)
     * @returns true if the contract exists
     */
    public async checkIfContractExists(contractAddress : string) : Promise<boolean> {
        let connection = await this.connectionManager.getConnection();
        let code = await connection.eth.getCode(contractAddress);
        if (code.length > 10) {
            return true;
        } else {
            let msg = "Error: Contract does not exist: " + contractAddress + " on network ID: " + this.chainId
            logger.error(msg);
            return false;
        }
    }

    /**
     * Initializes the chain id.
     */
    private async initalizeChainId() : Promise<void> {
        let connection = await this.connectionManager.getConnection();
        this.chainId = await connection.eth.net.getId();
    }

    /**
     * Get the Ethereum balance of a given address
     * @param address - Ethereum address as string
     * @returns a promise with the balance as a string
     */
    protected async getEthereumBalance(address) : Promise<string> {
        let connection = await this.connectionManager.getConnection();
        return connection.eth.getBalance(address)
        .then( balance => {
            let ether = connection.utils.fromWei(balance, 'ether');
            logger.debug("getEthereumBalance("+address+") returned "+ether);
            return ether;
        });
    }

    public async signAndSendTx(tx : TransactionConfig): Promise<SignedTransaction> {
        let signedTransaction = await this.signTx(tx);
		this.sendTx(signedTransaction)
        .catch(async e => {
            if (e.message.includes("known transaction") || e.message.includes("transaction underpriced")) {
                let oldNonce = tx.nonce;
                tx.nonce = await this.getNonce() + 1;
                logger.warning("Nonce error... " +e.message+ " - Increasing nonce... Sending again... OldNonce: " + oldNonce + " NewNonce: " + tx.nonce);
                this.signAndSendTx(tx);
            } else {
                logger.error("error during signAndSendTx() - AccAddr: " + this.account.address + "PrivKey: " + this.account.privateKey + " To: " + tx.to + " From: " + tx.from + " Error: " +e);
            }
        });
        return signedTransaction;
    }

    public async signTx(tx : TransactionConfig) : Promise<SignedTransaction> {
        let web3 = this.connectionManager.getWeb3();
        // if (tx.to == undefined || !this.isAddress(tx.to)) {
        //     return Promise.reject(tx.to + " is not a valid address.");
        // }
        tx.from = this.getAccountAddress();
        tx.chainId = this.chainId;
        tx.nonce = lastNonce++;
        tx.gas = await web3.eth.estimateGas(tx);
        logger.info("Sending transaction to: " + tx.to + " with data: " + tx.data + " from address: " + tx.from + " network id: " + tx.chainId + " nonce: " + tx.nonce + " gas: " + tx.gas);
        if (this.chainId == 3) {
            // Ugly workaround to make sure that ropsten does not run out of gas
            logger.info("Ropsten network detected. Increasing gas.");
            tx.gas = +tx.gas + 0xFFFFF; 
        }
        
        let signedTx = await web3.eth.accounts.signTransaction(tx, this.account.privateKey);
        if (signedTx.rawTransaction == undefined) {
            return Promise.reject("Signing Error - rawTransaction is undefined.")
        }

        return signedTx;
    }

    public async sendTx(signedTx: SignedTransaction): Promise<TransactionReceipt> {
        // NOTE: Connections to quorum may take longer than the established http timeout which is why 
        // we are using the the web3 object to sign and return the transaction hash before the transaction has been sent successfully.
        let connection = await this.connectionManager.getConnection();
        return connection.eth.sendSignedTransaction(signedTx.rawTransaction || '1')
        .on("transactionHash", (txHash : string) => { 
            logger.info("signAndSendTx() TxHash: " + txHash);
        })
        .on('confirmation', (confirmationNumber : number, receipt : TransactionReceipt) => {})
        .on('receipt', (txReceipt : TransactionReceipt) => { 
            logger.info("signAndSendTx txReceipt. Tx Address: " + txReceipt.transactionHash);
            return txReceipt;
        });
    }

    public async callFunction(tx : TransactionConfig) : Promise<string> {
        let connection = await this.connectionManager.getConnection();
        return connection.eth.call(tx);
    }

    public async waitForTxReceipt(txHash : string, tries? : number) : Promise<TransactionReceipt> {

        // Set the number of tries to 0 if this is the first try
        if (tries == undefined) tries = 0;

        logger.info("Waiting for txReceipt of tx " + txHash + " Try: #" + tries);

        try {
            let connection = await this.connectionManager.getConnection();
            let txReceipt = await connection.eth.getTransactionReceipt(txHash);
            if (txReceipt == null) {
                if (tries > 9) { // Cancel after 9 tries
                    logger.error("Canceling waitForTxReceipt() after 10 tries...");
                    return Promise.reject("Transaction has not been mined after 50 seconds... CANCEL");
                }
                logger.info("Transaction has not been mined yet. Checking again in 4 seconds ... ");
                tries++;
                await new Promise( resolve => {
                    setTimeout( () => resolve(), 4000); // wait 4 seconds
                });
                return this.waitForTxReceipt(txHash, tries);
            } else {
                logger.info("waitForTxReceipt has found the receipt for tx " + txHash);
                return txReceipt;
            }
        } catch (e) {
            logger.error(e);
            return Promise.reject(e);
        }
    }

    /**
     * checks if a given transaction exists
     * @param txHash - transaction address (string)
     * @returns a promise with a boolean - true if the transaction exists
     */
    public async transactionExists(txHash) : Promise<boolean> {
        let connection = await this.connectionManager.getConnection();
        let txReceipt = await connection.eth.getTransactionReceipt(txHash);
        if (txReceipt == null) {
            return false;
        } else {
            return true;
        }
    }

    /**
     * checks if a given string is an Ethereum address
     * @param {string} address - address (string)
     * @returns a promise with a boolean - true if the string is a valid address
     */
    public async isAddress(address : string) : Promise<boolean> {
        let connection = await this.connectionManager.getConnection();
        return connection.utils.isAddress(address);
    }

    /**
     * get the current network nonce
     * @returns a promise with the nonce (number)
     */
    public async getNonce() : Promise<number> {
        logger.debug("getNonce() called");
        let connection = await this.connectionManager.getConnection();
        return connection.eth.getTransactionCount(this.account.address, "pending")
        .then( nonce => {
            logger.info("Nonce returned from blockchain: " + nonce);
            return nonce; 
        }); 
    }

    /**
     * Initializes an account and configures the 
     * account object for transaction signing
     * @param privateKey 
     */
    private async setupAccount(privateKey? : string) : Promise<void> {
        logger.debug("setupAccount function called");
        let account;
        if (privateKey == undefined) {
            logger.info("No privateKey specified in config. Trying to access default account...")
            account = await this.getDefaultNodeAccount();
        } else {
            logger.info("Private key specified in config file. Trying to get balance...")
            account = await this.getPrivateKeyAccount(privateKey);
        } 
        let ether = await this.getEthereumBalance(account.address)
        .catch(e => logger.error("Error getting ETH balance for account " + account.address + " Error: " +e));
        logger.info("Ethereum Account initialized. Address: " + account.address + " Balance: " + ether + "ETH");
        this.account = account;
    }

    /**
     * Converts a privateKey into an Account object
     * @param privateKey - string
     * @returns Web3.Account object
     */
    private async getPrivateKeyAccount(privateKey) : Promise<Account> {
        try {
            let connection = await this.connectionManager.getConnection();
            if (privateKey.substring(0,2) != "0x") {
                privateKey = "0x" + privateKey;
            }
            let account = connection.eth.accounts.privateKeyToAccount(privateKey);
            return account;
        } catch (e) {
            console.log(e);
            throw new Error('invalid private key specified: ' + privateKey);
        }
    }

    /**
     * Checks if there is a default account configured in the node. 
     * If a default account exists the account can be used for transaction signing. 
     * If not, the user needs to specify a privateKey. 
     */
    private async getDefaultNodeAccount() : Promise<AddAccount> {
        let connection = await this.connectionManager.getConnection();
        let accounts = await connection.eth.getAccounts();
        logger.info("Address of default account is "+accounts[0]);
        let account : AddAccount = {
            address : accounts[0],
            privateKey : ""
        };
        return account;
    }

    public static createNewEthereumAccount() : Account {
        return new Web3("").eth.accounts.create();
    }

}

export default NodeManager;
