import fetch from 'node-fetch';
import Web3 from 'web3';
import InputDataDecoder from 'ethereum-input-data-decoder';
import * as dotenv from 'dotenv';

import ABI from "./ABI.js";

//Initial instantiations
dotenv.config();

const web3 = new Web3();

var BN = web3.utils.BN;

const decoder = new InputDataDecoder(ABI);

//Keys and constants
const ETHSCAN_KEY = process.env.ETHSCAN_KEY;
const OPTSCAN_KEY = process.env.OPTSCAN_KEY;

//Relevant bridge addresses
const L1_ADDRESS = "0x99c9fc46f92e8a1c0dec1b1747d010903e884be1"
const L2_ADDRESS = "0x4200000000000000000000000000000000000010";

//Global block number variables to control transactions verifications
let previousL1BlockNumber = 0;
let previousL2BlockNumber = 0;

/**
 * This function retrieves ETH balance of an account at L1
 * - account param stands for the address of the account being targeted
 *   by default, this function retrieves the Optmistic Gateway L1 Contract ETC Balance
 */
async function getL1EthBalance(account = L1_ADDRESS) {

  const response = await fetch(`https://api.etherscan.io/api?module=account&action=balance&address=${account}&tag=latest&apikey=${ETHSCAN_KEY}`);
  const data = await response.json();

  let result = data.result;
  
  return BN(result);
}

/**
 * This function retrieves ETH balance of an account at L2
 * - account param stands for the address of the account being targeted
 */
async function getL2EthBalance(account) {

  const response = await fetch(`https://api-optimistic.etherscan.io/api?module=account&action=balance&address=${account}&tag=latest&apikey=${OPTSCAN_KEY}`)

  const data = await response.json();

  let result = data.result;
  
  return BN(result);
}

/**
 * This function finds the Epoch UNIX like timestamp in seconds
 * - _period param stands for backwards timeshift needed when one needs to 
 *   find a past timestamp 
 */
function getCurrentTimestampInSeconds(_period = 0) {
  return Math.floor(Date.now() / 1000) - _period
}

/**
 * This function retrieves a L1 block number based in a timestamp
 * - _period param stands for backwards timeshift needed when one needs to 
 *   find a past block 
 */
async function getL1BlockNumber(_period = 0){

  const timestampInSecods = getCurrentTimestampInSeconds(_period);

  const getBlockCountdownResponse = await fetch(`https://api.etherscan.io/api?module=block&action=getblocknobytime&timestamp=${timestampInSecods}&closest=before&apikey=${ETHSCAN_KEY}`)
  
  const getBlockCountdownData = await getBlockCountdownResponse.json();

  return parseInt(getBlockCountdownData.result);
}

/**
 * This function retrieves a L2 block number based in a timestamp
 * - _period param stands for backwards timeshift needed when one needs to 
 *   find a past block 
 */
async function getL2BlockNumber(_period = 0){

  const timestampInSecods = getCurrentTimestampInSeconds(_period);

  const getBlockCountdownResponse = await fetch(`https://api-optimistic.etherscan.io/api?module=block&action=getblocknobytime&timestamp=${timestampInSecods}&closest=before&apikey=${OPTSCAN_KEY}`)
  
  const getBlockCountdownData = await getBlockCountdownResponse.json();

  return parseInt(getBlockCountdownData.result);
}

/**
 * This function retrieves the list of L1 trasactions that has not been
 * checked yet, since last consult
 */
async function getLatestL1Transactions() {

  const currentBlockNumber = await getL1BlockNumber(0)

  //Is current block number lower than previous checked block number?
  const previousBlockNumberIsHigher =  previousL1BlockNumber > currentBlockNumber

  //If no new block was produced, then nothing to do
  if(previousBlockNumberIsHigher){
    return []
  } 

  //Is it the first time this function?
  const isFirstCheck = previousL1BlockNumber == 0

  //If first time, 
  if(isFirstCheck){
    previousL1BlockNumber = currentBlockNumber;
  }

  const getTxList = await fetch(`https://api.etherscan.io/api?module=account&action=txlist&address=${L1_ADDRESS}&startblock=${previousL1BlockNumber}&endblock=${currentBlockNumber}&page=1&offset=1000&sort=asc&apikey=${ETHSCAN_KEY}`)

  previousL1BlockNumber = currentBlockNumber + 1

  const getTxListData = await getTxList.json();

  return   getTxListData.result
}

/**
 * This function retrieves the list of L2 trasactions that has not been
 * checked yet, since last consult
 */
async function getLatestL2Transactions() {

  const currentBlockNumber = await getL2BlockNumber(0)

  //Is current block number lower than previous checked block number?
  const previousBlockNumberIsHigher =  previousL2BlockNumber > currentBlockNumber

  //If no new block was produced, then nothing to do
  if(previousBlockNumberIsHigher){
    return []
  } 

  //Is it the first time this function?
  const isFirstCheck = previousL2BlockNumber == 0

  //If first time, 
  if(isFirstCheck){
    previousL2BlockNumber = currentBlockNumber;
  }

  const getTxList = await fetch(`https://api-optimistic.etherscan.io/api?module=account&action=txlist&address=${L2_ADDRESS}&startblock=${previousL2BlockNumber}&endblock=${currentBlockNumber}&page=1&offset=10&sort=asc&apikey=${OPTSCAN_KEY}`)

  previousL2BlockNumber = currentBlockNumber + 1

  const getTxListData = await getTxList.json();

  return   getTxListData.result
}

/**
 * This function retrieves all L1 bridge trasactions
 * - _period param stands for the period in seconds in which we want
 *   to retrieve the recpective tx list
 */
async function getL1TxListByLastPeriodInSeconds(_period = 60) {


  const initialBlockNumber = await getL1BlockNumber(_period)

  const currentBlockNumber = await getL1BlockNumber()

  const getTxList = await fetch(`https://api.etherscan.io/api?module=account&action=txlist&address=${L1_ADDRESS}&startblock=${initialBlockNumber}&endblock=${currentBlockNumber}&page=1&offset=1000&sort=asc&apikey=${ETHSCAN_KEY}`)

  const getTxListData = await getTxList.json();

  return getTxListData.result
}

/**
 * This function retrieves all L2 bridge trasactions
 * - _period param stands for the period in seconds in which we want
 *   to retrieve the recpective tx list
 */
async function getL2TxListByLastPeriodInSeconds(_period = 60) {

  const initialBlockNumber = await getL2BlockNumber(_period)

  const currentBlockNumber = await getL2BlockNumber()

  const getTxList = await fetch(`https://api-optimistic.etherscan.io/api?module=account&action=txlist&address=${L2_ADDRESS}&startblock=${initialBlockNumber}&endblock=${currentBlockNumber}&page=1&offset=100&sort=asc&apikey=${OPTSCAN_KEY}`)

  const getTxListData = await getTxList.json();

  return getTxListData.result
}

/**
 * This function filters a list of transactions in order to return a list of
 * deposit transactions only (l1)
 * - latestTransactions param is the list of original transactions to be filtered
 */
async function getEthDepositsFromTxList(latestTransactions){

  const addressToAmountDeposited = new Map()

  if(latestTransactions){
    latestTransactions.map((tx) => {
      if(tx.functionName === 'depositETH(uint32 _l2Gas, bytes _data)'){
        const ethDepositedAmount = new BN(addressToAmountDeposited.get(tx.from))
  
        let increment = new BN(ethDepositedAmount.add(BN(tx.value)))
  
        addressToAmountDeposited.set(tx.from, increment)
        
      }
    })
    return addressToAmountDeposited
  } else {
    return undefined
  }

  

}

/**
 * This function filters a list of transactions in order to return a list of
 * withdraw transactions only (l2)
 * - latestTransactions param is the list of original transactions to be filtered
 */
async function getEthWithdrawsFromTxList(latestTransactions){

  const addressToAmountWithdrown = new Map()

  if(latestTransactions){
    latestTransactions.map((tx) => {
      if(tx.functionName === 'withdraw(address _l2Token, uint256 _amount, uint32 _l1Gas, bytes _data)'){
        const ethWithdrownAmount = new BN(addressToAmountWithdrown.get(tx.from))
  
        const decodedInput = decoder.decodeData(tx.input)
  
        if(decodedInput.inputs[0] == "DeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000"){
          const amount = web3.utils.hexToNumberString(decodedInput.inputs[1]._hex)
  
          let increment = new BN(ethWithdrownAmount.add(BN(amount)))
  
          addressToAmountWithdrown.set(tx.from, increment)
        }
      }
    })
  
    return addressToAmountWithdrown
  } else {
    return undefined
  }
}

/**
 * This function checks if there is any suspect deposit transaction
 * - _treshold param is an arbitrary value that represents the limit in which
 *   a deposit can be considered, or not, a suspect one
 */
async function checkIfSingleEthDepositExceedTreshold(_treshold){
  const latestTransactions = await getLatestL1Transactions()

  if(latestTransactions){
  
    const addressToAmountDeposited = await getEthDepositsFromTxList(latestTransactions)

    let foundSuspectDeposit = false;
  
    addressToAmountDeposited.forEach((value, key) => {
      const isSuspectDeposit = BN(value).gte(BN(_treshold)) 
  
      if(isSuspectDeposit) {
        foundSuspectDeposit = true;
        console.log(`[L1 Single Deposit] Possibly Suspect ETH Deposit: {${key} => ${web3.utils.fromWei(value)}}`)
        return false
      }
    })
  
    if(!foundSuspectDeposit){
      console.log(`[L1 Single Deposit] No suspect ETH deposits for now...`)
      return true
    }
  } else {
    console.log("[Unexpected Error]")
  }
}

/**
 * This function checks if there is any suspect withdraw transaction
 * - _treshold param is an arbitrary value that represents the limit in which
 *   a withdraw can be considered, or not, a suspect one
 */
async function checkIfSingleEthWithdrawExceedTreshold(_treshold){

  const latestTransactions = await getLatestL2Transactions()

  if(latestTransactions){
    const addressToAmountWithdrown = await getEthWithdrawsFromTxList(latestTransactions)
  
    let foundSuspectWithdraw = false;
  
    addressToAmountWithdrown.forEach((value, key) => {
      const isSuspectDeposit = BN(value).gte(BN(_treshold)) 
  
      if(isSuspectDeposit) {
        foundSuspectWithdraw = true;
        console.log(`[L2 Single Withdraw] Possibly suspect ETH withdraw: {${key} => ${web3.utils.fromWei(value)}}`)
        return false
      }
    })
  
    if(!foundSuspectWithdraw){
      console.log(`[L2 Single Withdraw] No suspect ETH withdraw for now...`)
      return true
    }
  } else {
    console.log("[Unexpected Error]")
  }
}

/**
 * This function checks if there any suspect deposit volume happening
 * - _treshold param is an arbitrary value that represents the limit in which
 *   a deposit volume can be considered, or not, a suspect one
 * - _period param refers to the period (in seconds) that we want to monitor,
 *   default value is "last hour" (3600 seconds)
 */
async function checkIfDepositsVolumeExceedTreshold(_treshold, _period = 3600){

  const latestTransactions = await getL1TxListByLastPeriodInSeconds(_period)

  if(latestTransactions){
    const addressToAmountWithdrown = await getEthDepositsFromTxList(latestTransactions)
  
    let volumeCounter = new BN(0);
  
    addressToAmountWithdrown.forEach((value, key) => {
      volumeCounter = BN(value).add(volumeCounter)
    })
  
    const isVolumeSuspect = BN(volumeCounter).gte(BN(_treshold)) 
  
    if(isVolumeSuspect) {
      console.log(`[L1 Deposits Volume] Possibly suspect ETH deposit volume: ${web3.utils.fromWei(volumeCounter)} ETH within selected period`)
    } else {
      console.log(`[L1 Deposits Volume] No suspect ETH deposit volume for now...`)
    }
  } else {
    console.log("[Unexpected Error]")
  }
}

/**
 * This function checks if there any suspect withdraw volume happening
 * - _treshold param is an arbitrary value that represents the limit in which
 *   a withdraw volume can be considered, or not, a suspect one
 * - _period param refers to the period (in seconds) that we want to monitor,
 *   default value is "last hour" (3600 seconds)
 */
async function checkIfWithdrowsVolumeExceedTreshold(_treshold, _period = 3600){

  const latestTransactions = await getL2TxListByLastPeriodInSeconds(_period)

  if(latestTransactions){
    const addressToAmountWithdrown = await getEthWithdrawsFromTxList(latestTransactions)

    let volumeCounter = new BN(0);

    addressToAmountWithdrown.forEach((value, key) => {
      volumeCounter = BN(value).add(volumeCounter)
    })

    const isVolumeSuspect = BN(volumeCounter).gte(BN(_treshold)) 

    if(isVolumeSuspect) {
      console.log(`[L2 Withdrawals Volume] Possibly suspect ETH withdraw volume: ${web3.utils.fromWei(volumeCounter)} ETH within selected period`)
    } else {
      console.log(`[L2 Withdrawals Volume] No suspect ETH withdraw volume for now...`)
    }
  } else {
    console.log("[Unexpected Error]")
  }
}

async function checkageWrapper(){
  const oneDayPeriodInSeconds = 86400 //One day in seconds: 24 h * 60 m * 60 s
  const singleTransactionThreshold = new BN('10000000') //arbitrary value just for testing
  const volumeThreshold = new BN('10000000000000000000') //arbitrary value just for testing

  await checkIfSingleEthDepositExceedTreshold(singleTransactionThreshold)
  await checkIfSingleEthWithdrawExceedTreshold(singleTransactionThreshold)
  await checkIfWithdrowsVolumeExceedTreshold(volumeThreshold, oneDayPeriodInSeconds)
  await checkIfDepositsVolumeExceedTreshold(volumeThreshold, oneDayPeriodInSeconds)
}

async function main() {
  console.log("Total ETH amount locked util now:", web3.utils.fromWei(web3.utils.hexToNumberString(await getL1EthBalance())))
  setInterval(checkageWrapper, 5000)
}

main()