import React, { Component } from 'react';
import { View, Text, ScrollView, Pressable, Dimensions, Image, Linking } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Icon2 from 'react-native-vector-icons/Feather';
import HCESession, { NFCContentType, NFCTagType4 } from 'react-native-hce';
import GlobalStyles from '../../styles/styles';
import Footer from '../components/footer';
import Header from '../components/header';
import IconMC from 'react-native-vector-icons/MaterialIcons';
import QRCodeScanner from 'react-native-qrcode-scanner';
import reactAutobind from 'react-autobind';
import ContextModule from '../../utils/contextModule';
import IotReciever from '../../utils/iot-reciever-aws';
import WalletConnect from "@walletconnect/client";
import { abiERC20 } from "../../contracts/erc20"
import Web3 from 'web3';
import CryptoSign from './cryptoSign';
import { Picker } from 'react-native-form-component';
import VirtualKeyboard from 'react-native-virtual-keyboard';

import { NODE_ENV_NETWORK_RCP, NODE_ENV_API_APIKEY, NODE_ENV_EXPLORER, NODE_ENV_ID, native, tokens, tokensContracts, contentColor, headerColor } from "../../../env"

function epsilonRound(num, zeros = 4) {
    return Math.round((num + Number.EPSILON) * Math.pow(10, zeros)) / Math.pow(10, zeros)
}

class WithdrawCrypto extends Component {
    constructor(props) {
        super(props);
        this.state = {
            mount: true,
            stage: 0, // 0 
            publish: {
                message: '',
                topic: '',
            },
            peerMeta: {},
            data: {},
            hash: "",
            wallet: {
                kind: "ethereum",
                address: "0xEE0597c75b01eab0c06F7c22af0389A435A14a7A",
                network: NODE_ENV_ID
            },
            token: {
                label: native,
                value: "0"
            },
            value: "0",
            transaction: null,
        }
        reactAutobind(this)
        this.web3 = new Web3(NODE_ENV_NETWORK_RCP)
        this.scanner = null
        this.simulation = null
        this.mount = true
        this.connector = null
        this.scanFlag = true
        this.abiDecoder = require('abi-decoder')
        this.WalletConnect = false
    }

    static contextType = ContextModule;

    componentDidMount() {
        this.props.navigation.addListener('focus', async () => {
            this.mount = true
            this.WalletConnect = false
            this.scanFlag = true
            this.mount && this.setState({
                mount: true,
            })
            this.abiDecoder.addABI(abiERC20)
            const tag = new NFCTagType4(NFCContentType.Text, this.context.value.account);
            this.simulation = await (new HCESession(tag)).start();
        })
        this.props.navigation.addListener('blur', async () => {
            this.mount = false
            this.WalletConnect = false
            this.scanFlag = false
            this.setState({
                mount: true,
                stage: 0, // 0 
                publish: {
                    message: '',
                    topic: '',
                },
                peerMeta: {},
                data: {},
                hash: "",
                wallet: {
                    kind: "ethereum",
                    address: "0x",
                    network: NODE_ENV_ID
                },
                token: {
                    label: native,
                    value: "0"
                },
                value: "0",
                transaction: null,
            })
            this.connector !== null && this.connector.killSession()
            await this.simulation.terminate();
        })
    }

    async onSuccess(e) {
        if (e.data.substring(0, 3) === "wc:" && this.scanFlag) {
            this.WalletConnect = true
            this.scanFlag = false
            this.setupConnector(e.data)
        }
        else if (e.data.substring(0, 2) === "0x" && this.scanFlag) {
            this.WalletConnect = false
            this.scanFlag = false
            let temp = {
                kind: "ethereum",
                address: e.data,
                network: NODE_ENV_ID
            }
            this.mount && this.setState({
                wallet: temp,
                stage: 0.5
            })
        }
        else if (e.data.substring(0, 9) === "ethereum:" && this.scanFlag) {
            this.WalletConnect = false
            this.scanFlag = false
            let temp = {
                kind: e.data.split(":")[0],
                address: e.data.split(":")[1].split("@")[0],
                network: parseInt(e.data.split(":")[1].split("@")[1])
            }
            this.mount && this.setState({
                wallet: temp,
                stage: 0.5
            })
        }
    }

    callBackIoT = (data) => {
        if (JSON.parse(data[1]).token.substring(0, 3) === "wc:" && this.scanFlag) {
            this.WalletConnect = true
            this.scanFlag = false
            this.setupConnector(JSON.parse(data[1]).token)
        }
        else if (JSON.parse(data[1]).token.substring(0, 2) === "0x" && this.scanFlag) {
            this.WalletConnect = false
            this.scanFlag = false
            let temp = {
                kind: "ethereum",
                address: JSON.parse(data[1]).token,
                network: NODE_ENV_ID
            }
            this.mount && this.setState({
                wallet: temp,
                stage: 0.5
            })
        }
        else if (JSON.parse(data[1]).token.substring(0, 9) === "ethereum:" && this.scanFlag) {
            this.WalletConnect = false
            this.scanFlag = false
            let temp = {
                kind: JSON.parse(data[1]).token.split(":")[0],
                address: JSON.parse(data[1]).token.split(":")[1].split("@")[0],
                network: parseInt(JSON.parse(data[1]).token.split(":")[1].split("@")[1])
            }
            this.mount && this.setState({
                wallet: temp,
                stage: 0.5
            })
        }
    }

    async getBalanceToken(address, tokenAddress) {
        return new Promise(async (resolve, reject) => {
            const contract = new this.web3.eth.Contract(abiERC20, tokenAddress)
            let res = await contract.methods.balanceOf(address).call()
            let decimals = await contract.methods.decimals().call()
            resolve(res / (Math.pow(10, decimals)))
        })
    }

    async acceptAndSign(signedTx) {
        this.mount && this.setState({
            stage: 4
        })
        this.web3.eth.sendSignedTransaction(signedTx.rawTransaction, (error, hash) => {
            if (!error) {
                this.WalletConnect && this.connector.approveRequest({
                    id: this.state.data.id,
                    result: hash
                })
                this.mount && this.setState({
                    hash
                })
                let interval = null
                interval = setInterval(() => {
                    this.web3.eth.getTransactionReceipt(hash, async (err, rec) => {
                        if (rec) {
                            this.mount && this.setState({
                                stage: 5
                            })
                            clearInterval(interval)
                        }
                        else {
                            console.log(".")
                        }
                    });
                }, 1000);
            } else {
                console.log("❗Something went wrong while submitting your transaction:", error)
            }
        })
    }

    async maxSelected(token) {
        if (token.label === native) {
            this.mount && this.setState({
                value: this.context.value.ethBalance.toString()
            })
        }
        tokens.forEach((item, index) => {
            if (item === token.label) {
                this.mount && this.setState({
                    value: this.context.value.tokenBalances[item].toString()
                })
            }
        })
    }

    async transfer() {
        let transaction = {
            from: this.context.value.account,
            to: this.state.wallet.address,
            data: "0x",
            value: this.web3.utils.toHex(this.web3.utils.toWei(this.state.value, "ether")),
        }
        const gas = await this.web3.eth.estimateGas(transaction)
        const gasPrice = await this.web3.eth.getGasPrice()
        if (parseFloat(this.web3.utils.toHex(this.web3.utils.toWei(this.state.value, "ether"))) === parseFloat(this.context.value.ethBalance)) {
            transaction = { ...transaction, gas, value: value - (gas * gasPrice) }
        }
        else {
            transaction = { ...transaction, gas }
        }
        console.log({ value: this.state.value, balance: this.context.value.ethBalance })
        if (parseFloat(this.web3.utils.toHex(this.web3.utils.toWei(this.state.value, "ether") + gas * gasPrice)) > parseFloat(this.context.value.ethBalance)) {
            console.log("insufficient funds")
        }
        else {
            this.mount && this.setState({
                transaction,
                stage: 3,
                data: {
                    gas: gas * gasPrice,
                    amount: parseFloat(this.state.value)
                }
            })
        }
    }

    async transferToken(tokenAddress) {
        const contract = new this.web3.eth.Contract(abiERC20, tokenAddress, { from: this.context.value.account })
        let decimals = await contract.methods.decimals().call()
        let transaction = {
            to: tokenAddress,
            from: this.context.value.account,
            data: contract.methods.transfer(this.state.wallet.address, this.web3.utils.toHex(parseInt(parseFloat(this.state.value) * Math.pow(10, decimals)))).encodeABI()
        }
        const decodedData = this.abiDecoder.decodeMethod(transaction.data);
        const gas = await contract.methods.transfer(decodedData.params[0].value, this.web3.utils.toHex(decodedData.params[1].value)).estimateGas({ 'from': this.context.value.account })
        const gasPrice = await this.web3.eth.getGasPrice()
        transaction = { ...transaction, gas }
        console.log({ gas: (gas * gasPrice), balance: this.web3.utils.toWei(this.context.value.ethBalance, "ether") })
        if ((gas * gasPrice) > this.web3.utils.toWei(this.context.value.ethBalance, "ether")) {
            console.log("insufficient funds")
        }
        else {
            this.mount && this.setState({
                transaction,
                stage: 3,
                data: {
                    gas: gas * gasPrice,
                    amount: parseFloat(this.state.value)
                }
            })
        }
        this.mount && this.setState({
            loading: false
        })
    }

    clearKeyboard() {
        this.mount && this.setState({
            clear: true
        }, () => {
            this.mount && this.setState({
                clear: false
            })
        })
    }

    setupConnector(token) {
        this.connector = new WalletConnect({
            uri: token,
            clientMeta: {
                description: "Effisend App",
                url: "https://walletconnect.org",
                icons: ["https://walletconnect.org/walletconnect-logo.png"],
                name: "Effisend App",
            }
        })
        this.connector.on("session_request", (error, payload) => {
            if (error) {
                throw error;
            }
            this.mount && this.setState({
                peerMeta: payload.params[0].peerMeta,
                stage: 1
            })
        })
        this.connector.on("call_request", async (error, payload) => {
            if (error) {
                throw error;
            }
            if (payload.method === "eth_sendTransaction") {
                let ethBalance = await this.web3.eth.getBalance(this.context.value.account)
                const gasPrice = await this.web3.eth.getGasPrice()
                let transaction = payload.params[0]
                if (tokensContracts.map((item) => payload.params[0].to === item).some(element => element === true)) {
                    const contract = new this.web3.eth.Contract(abiERC20, payload.params[0].to)
                    let res = await contract.methods.balanceOf(this.context.value.account).call()
                    const decodedData = this.abiDecoder.decodeMethod(transaction.data);
                    const decimals = await contract.methods.decimals().call()
                    const name = await contract.methods.name().call()
                    if (decodedData.params[1].value > res) {
                        this.mount && this.setState({
                            transaction,
                            data: {
                                id: payload.id,
                                amount: (decodedData.params[1].value / (Math.pow(10, decimals))),
                                gas: 0.0,
                                token: name,
                                except: "Insufficient Funds",
                            },
                            stage: 2
                        })
                    }
                    else {
                        const gas = await contract.methods.transfer(decodedData.params[0].value, this.web3.utils.toHex(decodedData.params[1].value)).estimateGas({ 'from': this.context.value.account })
                        transaction = { ...transaction, gas }
                        this.mount && this.setState({
                            transaction,
                            data: {
                                id: payload.id,
                                gas: gas * gasPrice,
                                amount: (decodedData.params[1].value / (Math.pow(10, decimals))),
                                token: name,
                                except: "",
                            },
                            stage: 2
                        })
                    }
                }
                else {
                    if (parseInt(transaction.value, 16) > ethBalance) {
                        const gas = await this.web3.eth.estimateGas(transaction)
                        transaction = { ...transaction, gas }
                        this.mount && this.setState({
                            transaction,
                            data: {
                                id: payload.id,
                                gas: gas * gasPrice,
                                amount: (parseInt(transaction.value, 16) / (Math.pow(10, 18))),
                                token: native,
                                except: "Insufficient Funds",
                            },
                            stage: 2
                        })
                    }
                    else {
                        const gas = await this.web3.eth.estimateGas(transaction)
                        transaction = { ...transaction, gas }
                        this.mount && this.setState({
                            transaction,
                            data: {
                                id: payload.id,
                                gas: gas * gasPrice,
                                amount: (parseInt(transaction.value, 16) / (Math.pow(10, 18))),
                                token: native,
                            },
                            stage: 2
                        })
                    }
                }
            }
        })
        this.connector.on("wc_sessionRequest", (error, payload) => {
            if (error) {
                throw error;
            }
            // Get updated accounts and chainId
            console.log(payload)
        });
        this.connector.on("wc_sessionUpdate", (error, payload) => {
            if (error) {
                throw error;
            }
            // Get updated accounts and chainId
            console.log(payload)
        });
        this.connector.on("disconnect", (error, payload) => {
            if (error) {
                throw error;
            }
            console.log("goodbye")
        })

    }

    async componentWillUnmount() {
        this.mount = false
        await this.simulation.terminate();
        this.connector !== null && this.connector.killSession()
    }

    render() {
        return (
            <View style={GlobalStyles.container} >
                <Header />
                {
                    <View style={{ position: "absolute", top: 9, left: 18 }} >
                        <Pressable onPress={() => this.props.navigation.navigate('CryptoAccount')}>
                            <IconMC name="arrow-back-ios" size={36} color={headerColor} />
                        </Pressable>
                    </View >
                }
                {
                    this.state.mount && this.state.stage === 0 &&
                    <View style={{ position: "absolute", top: 18, right: 18 }}>
                        <IotReciever publish={this.state.publish} sub_topics={[`/EffiSend/WalletConnect/${this.context.value.account}`]} callback={this.callBackIoT} callbackPublish={() => this.mount && this.setState({ publish: { message: '', topic: '', } })} />
                    </View>
                }
                {
                    this.state.stage === 0 &&
                    <View style={[GlobalStyles.mainSub, { flexDirection: "column", alignItems: "center", paddingTop: 20 }]}>
                        <View>
                            <Text style={{ textAlign: "center", color: "white", fontSize: 30, width: "80%" }}>
                                Scan QR or NFC
                            </Text>
                        </View>
                        <View>
                            <QRCodeScanner
                                containerStyle={{ marginTop: -40 }}
                                showMarker={false}
                                reactivate={true}
                                ref={(node) => { this.scanner = node }}
                                onRead={this.onSuccess}
                                topContent={<></>}
                                bottomContent={<></>}
                            />
                        </View>
                    </View>
                }
                {
                    this.state.stage === 0.5 &&
                    <View style={[GlobalStyles.mainSub, { flexDirection: "column", justifyContent: "space-evenly", alignItems: "center" }]}>
                        <Text style={{ textAlign: "center", width: "100%", fontSize: 26, fontFamily: "Helvetica", color: "white" }}>
                            To Address:
                            {"\n"}
                            {
                                this.state.wallet.address.substring(0, 21)
                            }
                            {"\n"}
                            {
                                this.state.wallet.address.substring(21, 42)
                            }
                        </Text>
                        <View style={{ borderBottomWidth: 2, borderColor: contentColor, width: "90%" }} />
                        <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%" }}>
                            <Picker
                                isRequired
                                buttonStyle={{ fontSize: 20, textAlign: "center", backgroundColor: "black" }}
                                itemLabelStyle={[{ fontSize: 20, textAlign: "center", color: "white" }]}
                                selectedValueStyle={[{ fontSize: 20, textAlign: "center", color: "white" }]}
                                iconWrapperStyle={{ backgroundColor: "black" }}
                                items={[{ label: native, value: "0" }].concat(tokens.map((item, index) => ({ label: item, value: tokensContracts[index] })))}
                                selectedValue={this.state.token.value}
                                onSelection={
                                    (item) => {
                                        if (JSON.stringify(item) !== JSON.stringify(this.state.token)) {
                                            this.mount && this.setState({
                                                token: item,
                                                value: "0"
                                            });
                                        }

                                    }
                                }
                            />
                            <Text style={{ fontSize: 36, fontFamily: "Helvetica", color: "white" }}>
                                {
                                    this.state.value.substring(0, this.state.value.indexOf(".") === -1 ? this.state.value.length : this.state.value.indexOf(".") + 6)
                                }
                            </Text>
                            <Pressable style={{ paddingTop: 6 }} onPress={() => this.maxSelected(this.state.token)}>
                                <Text style={{ fontSize: 24, fontFamily: "Helvetica", color: "white" }}>
                                    max{"   "}
                                </Text>
                            </Pressable>
                        </View>
                        <VirtualKeyboard
                            style={{ marginTop: -20 }}
                            rowStyle={{
                                width: Dimensions.get('window').width,
                            }}
                            cellStyle={
                                {
                                    height: Dimensions.get('window').width / 8,
                                    borderWidth: 1,
                                    margin: 1,
                                }
                            }
                            colorBack={'black'}
                            color='white'
                            pressMode='string'
                            decimal
                            onPress={(val) => this.mount && this.setState({ value: val })}
                            clear={this.state.clear}
                        />
                        <Pressable disabled={this.state.loading} style={[GlobalStyles.button, { marginTop: 10 }]} onPress={async () => {
                            if (this.state.token.label === native) {
                                this.mount && this.setState({
                                    loading: true
                                })
                                this.transfer()
                            }
                            else {
                                this.mount && this.setState({
                                    loading: true
                                })
                                this.transferToken(this.state.token.value)
                            }
                        }}>
                            <Text style={[GlobalStyles.buttonText]}>
                                {
                                    this.state.loading ? "Checking..." : "Send"
                                }
                            </Text>
                        </Pressable>
                    </View>
                }
                {
                    this.state.stage === 1 &&
                    <View style={[GlobalStyles.mainSub, { flexDirection: "column", justifyContent: "space-evenly", alignItems: "center", paddingTop: 20 }]}>
                        <View>
                            <Text style={{ textAlign: "center", color: "white", fontSize: 30, width: "80%" }}>
                                Connect to Dapp
                            </Text>
                        </View>
                        <View style={{ borderRadius: 500, borderWidth: 10, borderColor: contentColor }}>
                            <Image
                                style={{
                                    width: Dimensions.get("window").width / 1.5,
                                    height: Dimensions.get("window").width / 1.5
                                }}
                                source={{
                                    uri: this.state.peerMeta.icons[0]
                                }}
                            />
                        </View>
                        <Text style={{ textAlign: "center", color: "white", fontSize: 30, width: "80%" }}>
                            {this.state.peerMeta.name}
                        </Text>
                        <Text style={{ textAlign: "center", color: "white", fontSize: 30, width: "80%" }}>
                            {this.state.peerMeta.description}
                        </Text>
                        <Pressable style={[GlobalStyles.button]} onPress={() => {
                            this.connector.approveSession({
                                accounts: [this.context.value.account],
                                chainId: NODE_ENV_ID
                            })
                        }}>
                            <Text style={[GlobalStyles.buttonText]}>
                                Accept
                            </Text>
                        </Pressable>
                        <Pressable style={[GlobalStyles.button]} onPress={() => {
                            this.connector.rejectSession()
                            this.props.navigation.navigate('CryptoAccount')
                        }}>
                            <Text style={[GlobalStyles.buttonText]}>
                                Reject
                            </Text>
                        </Pressable>
                    </View>
                }
                {
                    this.state.stage === 2 &&
                    <View style={[GlobalStyles.mainSub, { flexDirection: "column", justifyContent: "space-evenly", alignItems: "center", paddingTop: 20 }]}>
                        <View>
                            <Text style={{ textAlign: "center", color: "white", fontSize: 30, width: "80%" }}>
                                Connected to Dapp
                            </Text>
                        </View>
                        <View style={{ borderRadius: 500, borderWidth: 10, borderColor: contentColor }}>
                            <Image
                                style={{
                                    width: Dimensions.get("window").width / 1.5,
                                    height: Dimensions.get("window").width / 1.5
                                }}
                                source={{
                                    uri: this.state.peerMeta.icons[0]
                                }}
                            />
                        </View>
                        <Text style={{ textAlign: "center", color: "white", fontSize: 30, width: "80%" }}>
                            Transaction
                        </Text>
                        <Text style={{ textAlign: "center", color: "white", fontSize: 30, width: "80%" }}>
                            Amount: {epsilonRound(this.state.data.amount).toString()}{"\n"}{this.state.data.token}
                        </Text>
                        <Text style={{ textAlign: "center", color: "white", fontSize: 30, width: "80%" }}>
                            Gas: {epsilonRound((this.state.data.gas / (Math.pow(10, 18))), 6).toString()}{" "}{native}
                        </Text>
                        <Pressable style={[GlobalStyles.button]} onPress={() => {
                            this.mount && this.setState({
                                stage: 3
                            })
                        }}>
                            <Text style={[GlobalStyles.buttonText]}>
                                Accept
                            </Text>
                        </Pressable>
                        <Pressable style={[GlobalStyles.button]} onPress={() => {
                            this.props.navigation.navigate('CryptoAccount')
                        }}>
                            <Text style={[GlobalStyles.buttonText]}>
                                Reject
                            </Text>
                        </Pressable>
                    </View>
                }
                {
                    this.state.stage === 3 &&
                    <CryptoSign transaction={this.state.transaction} signTrans={(e) => this.acceptAndSign(e)} cancelTrans={(e) => console.log(e)} />
                }
                {
                    this.state.stage === 4 &&
                    <View style={[GlobalStyles.mainSub, { flexDirection: "column", justifyContent: "space-evenly", alignItems: "center", paddingTop: 20 }]}>
                        <Icon name="timer-sand" size={240} color={contentColor} />
                        <Text style={{ textAlign: "center", color: "white", fontSize: 30, width: "80%" }}>
                            Waiting Confirmation...
                        </Text>
                        <Text style={{ textAlign: "center", color: "white", fontSize: 30, width: "80%" }}>
                            Amount: {epsilonRound(this.state.data.amount).toString()}{"\n"}{this.state.data.token}
                        </Text>
                        <Text style={{ textAlign: "center", color: "white", fontSize: 30, width: "80%" }}>
                            Gas: {epsilonRound((this.state.data.gas / (Math.pow(10, 18))), 6).toString()}{" "}{native}
                        </Text>
                    </View>
                }
                {
                    this.state.stage === 5 &&
                    <View style={[GlobalStyles.mainSub, { flexDirection: "column", justifyContent: "space-evenly", alignItems: "center" }]}>
                        <Icon2 name="check-circle" size={240} color={contentColor} />
                        <Text style={{
                            textShadowRadius: 1,
                            fontSize: 28, fontWeight: "bold", color: "white"
                        }}>
                            Completed
                        </Text>
                        <Pressable style={{ marginVertical: 30 }} onPress={() => Linking.openURL(NODE_ENV_EXPLORER + "tx/" + this.state.hash)}>
                            <Text style={{
                                fontSize: 24, fontWeight: "bold", color: "white", textAlign: "center"
                            }}>
                                View on Explorer
                            </Text>
                        </Pressable>
                        <Pressable style={[GlobalStyles.button]} onPress={() => {
                            this.props.navigation.navigate('CryptoAccount')
                        }}>
                            <Text style={[GlobalStyles.buttonText]}>
                                Done
                            </Text>
                        </Pressable>
                    </View>
                }
            </View >
        );
    }
}

export default WithdrawCrypto;