import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import NodeManager from './nodemanager';
let logger = require('@suku/suku-logging')(require('../package.json'));

const connectionString = process.env.CONNECTION_STRING;
const privateKey = process.env.PRIVATE_KEY;

if (privateKey === undefined) {
	logger.warning('PRIVATE_KEY env variable not found. The process will stop now.');
	process.exit(1);
}

if (connectionString === undefined) {
	logger.error('CONNECTION_STRING env variable not found. The process will stop now.');
	process.exit(1);
} else {
	logger.info('Server started with connection string: ' + connectionString);
}

let nodeManager = new NodeManager(connectionString, privateKey);

// Configure Webserver
let app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Use this variable to configure a root path
// e.g. const rootPath = '/api'
const rootPath = '';

app.post(rootPath + '/sendTx', async (request, response) => {
	if (request.body.to == undefined && request.body.data == undefined) {
		let msg = 'No TO address and no DATA specified in request body. Returning 400 - Bad Request';
		logger.error(msg);
		response.status(400).send(msg);
		return;
	}

	logger.info('sendTx request received from ' + request.hostname);
	try {
		let signedTransaction = await nodeManager.signAndSendTx(request.body);
		response.status(200).send(signedTransaction.transactionHash);
	} catch (e) {
		logger.error('Error during sendTx request: ' + e);
		response.status(500).send(e);
	}
});

app.post(rootPath + '/sendPreSignedTx', async (request, response) => {
	logger.info('sendPreSignedTx request received from ' + request.hostname);
	try {
		let txReceipt = await nodeManager.sendTx(request.body);
		response.status(200).send(txReceipt);
	} catch (e) {
		logger.error('Error during sendTx request: ' + e);
		response.status(500).send(e);
	}
});

app.post(rootPath + '/callFunction', async (request, response) => {
	if (request.body.to == undefined && request.body.data == undefined) {
		let msg = 'No TO address and no DATA specified in request body. Returning 400 - Bad Request';
		logger.error(msg);
		response.status(400).send(msg);
		return;
	}

	logger.info('callFunction request received from ' + request.hostname);
	let result = await nodeManager.callFunction(request.body);

	response.statusCode = 200;
	response.send(result);
});

app.get(rootPath + '/waitForTx/:tx', async (request, response) => {
	let txReceipt = await nodeManager.waitForTxReceipt(request.params.tx);
	response.statusCode = 200;
	response.send(txReceipt);
});

app.get(
	rootPath + '/checkIfContractExists/:address',
	async (request, response) => {
		let exists = await nodeManager.checkIfContractExists(
			request.params.address
		);
		response.statusCode = 200;
		response.send(exists);
	}
);

app.get(rootPath + '/getAccountAddress', async (request, response) => {
	logger.info('/getAccountAddress called.');
	let address = await nodeManager.getAccountAddress();
	logger.info('/getAccountAddress returning: ' + address);
	response.statusCode = 200;
	response.send(address);
});

let port = process.env.PORT || 3000;
app.listen(port);
logger.info('API listening on port ' + port);

