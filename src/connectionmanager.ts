import Web3 from "web3";
let logger = require('@suku/suku-logging')(require('../package.json'));

class ConnectionManager {

    private connectionString : string;
    private connection : Web3;
    private reconnectInProgress : boolean = false;
    private provider;

    public constructor(connectionString : string) {
        this.connectionString = connectionString;
        if (this.connectionString.includes('http')) {
            this.provider = new Web3.providers.HttpProvider(this.connectionString);
        } else if (this.connectionString.includes('ws')) {
            this.provider = new Web3.providers.WebsocketProvider(this.connectionString);
        }
        this.connection = new Web3(this.provider);
    }

    public async getConnection() : Promise<Web3> {
        logger.info("Trying to establish connection to " + this.connectionString);
        if (await this.isConnected()) {
            return this.connection;
        } else {
            if (this.reconnectInProgress) {
                logger.warning("Reconnect in progress. Waiting 10 seconds and trying again.");
                await ConnectionManager.getTimeoutPromise(10);
                return await this.getConnection();
            } else {
                logger.warning("Node is not connected and no reconnect in progress... Starting reconnect.");
                return this.reconnect();
            }
        }
    }

    public getWeb3() : Web3 {
        return this.connection;
    }

    public async reconnect(i = 0) : Promise<Web3> { // if i is not set, default value = 0
        this.reconnectInProgress = true;
        logger.warning("Reconnect try #" + i++ + " Trying to reconnect in 10 seconds...");  
        let provider = new Web3.providers.WebsocketProvider(this.connectionString);
        this.connection = new Web3(provider);

        // Wait 10 seconds and check connection again
        await ConnectionManager.getTimeoutPromise(10);
        if (await this.isConnected()) {
            // if it's connected, return the connection
            this.reconnectInProgress = false;
            return this.connection;
        } else {
            // if it's not connected after 10 seconds, try again
            return await this.reconnect(i);
        }
    }

    public async isConnected() : Promise<boolean> {
        return new Promise<boolean>( (resolve, reject ) => {
            this.connection.eth.net.isListening().then((s) => {
                logger.debug('Node is connected to: ' + this.connectionString);
                resolve(true);
            }).catch( e => {
                logger.error("Quorum node connection error. Connection check returned: " + e);
                resolve(false);
            });
        });
    }

    private static getTimeoutPromise(seconds : number) {
        return new Promise<void> ( resolve => {
            setTimeout(() => {
                resolve();
            }, seconds * 1000);
        });
    }

}

export default ConnectionManager;
