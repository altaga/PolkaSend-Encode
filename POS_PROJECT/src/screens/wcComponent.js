// Basic Imports
import React, { Component } from 'react';
import { Text, View, Pressable, Dimensions, Image, TextInput, ScrollView, Linking } from 'react-native';
// Contracts
import { abiERC20 } from "../contracts/erc20"
// Crypto
import Web3 from "web3";
import WalletConnect from "@walletconnect/client";
// Components
import { Picker } from 'react-native-form-component';
import QRCode from 'react-native-qrcode-svg';
// Components Local
import Footer from './components/footer';
import Header from './components/header';
// Utils
import NfcManager, { Ndef, NfcEvents } from 'react-native-nfc-manager';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import RNPrint from 'react-native-print';
import reactAutobind from 'react-autobind';
// Utils Local
import IotReciever from "../utils/iot-reciever-aws"
import ContextModule from '../utils/contextModule';
// Assets
import Icon from 'react-native-vector-icons/FontAwesome5';
import Icon2 from 'react-native-vector-icons/Feather';
import IconMCI from 'react-native-vector-icons/MaterialIcons';
import { logo } from "../assets/logo"
// Styles
import GlobalStyles from '../styles/styles';

import {NODE_ENV_NETWORK_APPNAME, contentColor, native, NODE_ENV_NETWORK_NAME, NODE_ENV_EXPLORER, NODE_ENV_NETWORK_RCP, tokens, tokensContracts, headerColor} from "../../env"

const networks = [
    {
        name: NODE_ENV_NETWORK_NAME,
        rpc: NODE_ENV_NETWORK_RCP
    }
]

class MyWalletConnect extends Component {
    constructor(props) {
        super(props);
        this.state = {
            qr: null,
            account: "",
            stage: 0,
            network: {
                label: NODE_ENV_NETWORK_NAME,
                value: NODE_ENV_NETWORK_RCP
            },
            token: {
                label: native,
                value: ""
            },
            place: "",
            articles: "",
            amount: 0,
            signature: "",
            publish: {
                message: '',
                topic: '',
            },
            mount:true
        };
        reactAutobind(this)
        this.mount = true
        this.web3 = new Web3(NODE_ENV_NETWORK_RCP)
        this.NfcManager = NfcManager
        this.svg = null
        this.connector = new WalletConnect({
            bridge: "https://bridge.walletconnect.org",
            clientMeta: {
                description: "Payment",
                url: `https://${NODE_ENV_NETWORK_APPNAME}.com`,
                icons: ["https://general-bucket-android.s3.amazonaws.com/miniLogoPolkas.png"], // Pending to REPO
                name: `${NODE_ENV_NETWORK_APPNAME}\nPOS System`,
            }
        })
    }

    static contextType = ContextModule;

    async getDataURL() {
        return new Promise(async (resolve, reject) => {
            this.svg.toDataURL(async (data) => {
                this.mount && this.setState({
                    printData: "data:image/png;base64," + data
                }, () => resolve("ok"))
            });
        })
    }

    callBackIoT = (data) => {
        console.log(data)
    }

    async transfer(amount, from, to) {
        let transaction = {
            from,
            to,
            data: "0x",
            value: this.web3.utils.toHex(this.web3.utils.toWei((amount).toString(), "ether")),
        }
        console.log(transaction)
        this.connector.sendTransaction(transaction)
            .then((result) => {
                this.mount && this.setState({
                    signature: result,
                    stage: 3
                }, () => { this.connector.killSession() })
            })
            .catch((error) => {
                console.error(error);
            });
    }

    async transferToken(amount, from, to, tokenAddress) {
        console.log("transfer Token")
        const contract = new this.web3.eth.Contract(abiERC20, tokenAddress, { from })
        let decimals = await contract.methods.decimals().call()
        let transaction = {
            to: tokenAddress,
            from,
            data: contract.methods.transfer(to, this.web3.utils.toHex(amount * Math.pow(10, decimals))).encodeABI()
        }
        console.log(transaction)
        this.connector.sendTransaction(transaction)
            .then((result) => {
                this.mount && this.setState({
                    signature: result,
                    stage: 3
                }, () => { this.connector.killSession() })
            })
            .catch((error) => {
                console.error(error);
            });
    }

    componentDidMount() {
        this.props.navigation.addListener('focus', () => {
            this.mount = true
            this.setState({
                mount:true
            })
            this.setupNFC()
            if (!this.connector.connected) {
                this.connector.createSession().then(() => {
                    this.mount && this.setState({
                        qr: this.connector.uri
                    })
                })
            }
            this.connector.on("connect", async (error, payload) => {
                if (error) {
                    throw error;
                }
                this.NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
                this.NfcManager.unregisterTagEvent();
                // Get provided accounts and chainId
                const { accounts, chainId } = payload.params[0];
                console.log({ accounts, chainId })
                this.mount && this.setState({
                    account: accounts[0],
                    stage: 2
                }, () => {
                    if (this.state.token.label === native) {
                        this.transfer(this.state.amount, this.state.account, this.context.value.account)
                    }
                    else {
                        this.transferToken(this.state.amount, this.state.account, this.context.value.account, this.state.token.value)
                    }
                })
            });
            this.connector.on("session_update", (error, payload) => {
                if (error) {
                    throw error;
                }
                // Get updated accounts and chainId
                const { accounts, chainId } = payload.params[0];
                console.log({ accounts, chainId })
            });
            this.connector.on("session_request", (error, payload) => {
                if (error) {
                    throw error;
                }
                console.log(payload)
            });
            this.connector.on("call_request", (error, payload) => {
                if (error) {
                    throw error;
                }
                // Get updated accounts and chainId
                console.log(payload)
            });
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
                // Refresh
                if (!this.connector.connected && payload.params[0].message === "Session Rejected") {
                    console.log("Refreshing QR")
                    this.connector.createSession().then(() => {
                        this.mount && this.setState({
                            qr: this.connector.uri
                        })
                    })
                }
            })
        })
        this.props.navigation.addListener('blur', () => {
            this.connector.killSession()
            this.setState({
                mount:false,
                qr: null,
                account: "",
                stage: 0,
                network: {
                    label: NODE_ENV_NETWORK_NAME,
                    value: NODE_ENV_NETWORK_RCP
                },
                token: {
                    label: native,
                    value: ""
                },
                place: "",
                articles: "",
                amount: 0,
                signature: "",
                publish: {
                    message: '',
                    topic: '',
                }
            })
            this.mount = false
            this.NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
            this.NfcManager.unregisterTagEvent();
        })
    }

    setupNFC() {
        this.NfcManager.start()
        this.NfcManager.setEventListener(NfcEvents.DiscoverTag, this.NFCreadData);
        this.NfcManager.registerTagEvent()
    }

    NFCreadData(data) {
        let decoded = Ndef.text.decodePayload(data.ndefMessage[0].payload)
        if (decoded.length === 42) {
            this.mount && this.setState({
                publish: {
                    message: `{ "token": "${this.state.qr}" }`,
                    topic: `/EffiSend/WalletConnect/${decoded}`,
                }
            })
        }
    }

    componentWillUnmount() {
        this.NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
        this.NfcManager.unregisterTagEvent();
        this.connector.killSession();
    }

    render() {
        return (
            <>
                <View style={GlobalStyles.container}>
                    <Header />
                    {
                        <View style={{ position: "absolute", top: 9, left: 18 }}>
                            <Pressable onPress={() => this.props.navigation.navigate('Payments')}>
                                <IconMCI name="arrow-back-ios" size={36} color={headerColor} />
                            </Pressable>
                        </View>
                    }
                    {
                        ((this.state.stage === 0 || this.state.stage === 1) && this.state.mount) &&
                        <View style={{ position: "absolute", top: 18, right: 18 }}>
                            <IotReciever publish={this.state.publish} sub_topics={[]} callback={this.callBackIoT} callbackPublish={() => this.mount && this.setState({ publish: { message: '', topic: '', } })} />
                        </View>
                    }
                    {
                        this.state.stage === 0 &&
                        <ScrollView style={[GlobalStyles.mainSub]}>
                            <View style={{ width: "90%", textAlign: "center", alignSelf: "center" }}>
                                <Picker
                                    isRequired
                                    buttonStyle={{ fontSize: 28, textAlign: "center", borderWidth: 1, borderColor: "black" }}
                                    itemLabelStyle={[{ fontSize: 24, textAlign: "center" }]}
                                    labelStyle={[{ fontSize: 28, textAlign: "center", color: "white" }]}
                                    selectedValueStyle={[{ fontSize: 28, textAlign: "center" }]}
                                    items={networks.map((item, index) => ({ label: item.name, value: item.rpc }))}
                                    label="Network"
                                    selectedValue={this.state.network.value}
                                    onSelection={
                                        (item) => {
                                            this.mount && this.setState({
                                                network: item
                                            });
                                        }
                                    }
                                />
                            </View>
                            <View style={{ width: "90%", textAlign: "center", alignSelf: "center" }}>
                                <Picker
                                    isRequired
                                    buttonStyle={{ fontSize: 28, textAlign: "center", borderWidth: 1, borderColor: "black" }}
                                    itemLabelStyle={[{ fontSize: 24, textAlign: "center" }]}
                                    labelStyle={[{ fontSize: 28, textAlign: "center", color: "white" }]}
                                    selectedValueStyle={[{ fontSize: 28, textAlign: "center" }]}
                                    items={[{ label: native, value: "0" }].concat(tokens.map((item, index) => ({ label: item, value: tokensContracts[index] })))}
                                    label="Token"
                                    selectedValue={this.state.token.value}
                                    onSelection={
                                        (item) => {
                                            this.mount && this.setState({
                                                token: item
                                            });
                                        }
                                    }
                                />
                            </View>
                            <View style={{ width: "90%", textAlign: "center", alignSelf: "center", paddingBottom: 20 }}>
                                <Text style={{ fontSize: 28, fontWeight: "bold", color: "white" }}>
                                    Amount
                                </Text>
                                <TextInput
                                    style={{ fontSize: 24, textAlign: "center", borderRadius: 6, backgroundColor: 'white', color: "black" }}
                                    keyboardType="number-pad"
                                    value={this.state.amount.toString()}
                                    onChangeText={(value) => this.mount && this.setState({ amount: value })}
                                />
                            </View>
                            <View style={{ width: "90%", textAlign: "center", alignSelf: "center", paddingBottom: 20 }}>
                                <Text style={{ fontSize: 28, fontWeight: "bold", color: "white" }}>
                                    Place
                                </Text>
                                <TextInput
                                    style={{ fontSize: 24, textAlign: "center", borderRadius: 6, backgroundColor: 'white', color: "black" }}
                                    keyboardType="default"
                                    value={this.state.place}
                                    onChangeText={(value) => this.mount && this.setState({ place: value })}
                                />
                            </View>
                            <View style={{ width: "90%", textAlign: "center", alignSelf: "center", paddingBottom: 30 }}>
                                <Text style={{ fontSize: 28, fontWeight: "bold", color: "white" }}>
                                    Articles
                                </Text>
                                <TextInput
                                    style={{ fontSize: 24, textAlign: "center", borderRadius: 6, backgroundColor: 'white', color: "black" }}
                                    keyboardType="default"
                                    value={this.state.articles}
                                    onChangeText={(value) => this.mount && this.setState({ articles: value })}
                                />
                            </View>
                            <Pressable style={[GlobalStyles.button, { alignSelf: "center", marginBottom: 20 }]} onPress={() => {
                                this.setupNFC()
                                this.setState({ stage: 1 })
                            }}>
                                <Text style={[GlobalStyles.buttonText]}>
                                    Pay
                                </Text>
                            </Pressable>
                        </ScrollView>
                    }
                    {
                        this.state.stage === 1 &&
                        <View style={[GlobalStyles.mainSub, {}]}>
                            {
                                this.state.qr &&
                                <View style={{ flexDirection: "column", justifyContent: "space-between", alignItems: "center" }}>
                                    <Text style={[{ fontSize: 24, color: "white", marginVertical: 4 }]}>
                                        NFC or Scan
                                    </Text>
                                    <View style={{ borderColor: contentColor, borderWidth: 2 }}>
                                        <QRCode
                                            value={this.state.qr}
                                            size={Dimensions.get("window").height / 1.8}
                                            quietZone={10}
                                            ecl="H"
                                        />
                                    </View>
                                    <View style={{ flexDirection: "column", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: contentColor, borderRadius: 10, width: "90%", marginTop: 10 }}>
                                        <Text style={[{ fontSize: 24, color: "white", marginVertical: 10 }]}>
                                            Amount: {this.state.amount.toString()}{" "}{this.state.token.label}
                                        </Text>
                                    </View>
                                </View>
                            }
                        </View>
                    }
                    {
                        this.state.stage === 2 &&
                        <View style={[GlobalStyles.mainSub, { flexDirection: "column", justifyContent: "space-evenly", alignItems: "center" }]}>
                            <Icon name="wallet" size={128} color={contentColor} />
                            <Text style={{
                                textShadowRadius: 1,
                                fontSize: 28, fontWeight: "bold", color: "white"
                            }}>
                                Wallet Connected
                            </Text>
                            <Text style={{
                                textShadowRadius: 1,
                                fontSize: 18,
                                color: '#AAA',
                                paddingTop: 10,
                                textAlign: "center",
                                width: "60%"
                            }}>
                                Review and sign the transaction to complete...
                            </Text>
                            <View style={{ flexDirection: "column", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: contentColor, borderRadius: 10, width: "90%", height: "30%", marginTop: 20 }}>
                                <Text style={[{ fontSize: 24, color: "white" }]}>
                                    Amount: {this.state.amount.toString()}{" "}{this.state.token.label}
                                </Text>
                                <Text style={[{ fontSize: 24, color: "white" }]}>
                                    Place: {this.state.place}
                                </Text>
                                <Text style={[{ fontSize: 24, color: "white" }]}>
                                    Articles: {this.state.articles}
                                </Text>
                            </View>
                        </View>
                    }
                    {
                        this.state.stage === 3 &&
                        <View style={[GlobalStyles.mainSub, { flexDirection: "column", justifyContent: "space-evenly", alignItems: "center" }]}>
                            <Icon2 name="check-circle" size={160} color={contentColor} />
                            <Text style={{
                                textShadowRadius: 1,
                                fontSize: 28, fontWeight: "bold", color: "white"
                            }}>
                                Completed
                            </Text>
                            <Pressable style={{ marginVertical: 30 }} onPress={() => Linking.openURL(`${NODE_ENV_EXPLORER}tx/` + this.state.signature)}>
                                <Text style={{
                                    fontSize: 24, fontWeight: "bold", color: "white", textAlign: "center"
                                }}>
                                    View on Explorer
                                </Text>
                            </Pressable>
                            <Pressable style={[GlobalStyles.button, { alignSelf: "center", marginBottom: 20 }]} onPress={async () => {
                                await this.getDataURL()
                                const results = await RNHTMLtoPDF.convert({
                                    html: (`
                                        <div style="text-align: center;">
                                        <img src='${logo}' width="450px"></img>
                                            <h1 style="font-size: 3rem;">--------- Original Reciept ---------</h1>
                                            <h1 style="font-size: 3rem;">Date: ${new Date().toLocaleDateString()}</h1>
                                            <h1 style="font-size: 3rem;">------------------ • ------------------</h1>
                                            <h1 style="font-size: 3rem;">WalletConnect Transfer</h1>
                                            <h1 style="font-size: 3rem;">Amount: ${this.state.amount.toString() + " "}${this.state.token.label}</h1>
                                            <h1 style="font-size: 3rem;">Place: ${this.state.place}</h1>
                                            <h1 style="font-size: 3rem;">Articles: ${this.state.articles}</h1>
                                            <h1 style="font-size: 3rem;">------------------ • ------------------</h1>
                                            <img src='${this.state.printData}'></img>
                                        </div>
                                        `),
                                    fileName: 'print',
                                    base64: true,
                                })
                                await RNPrint.print({ filePath: results.filePath })
                            }}>
                                <Text style={[GlobalStyles.buttonText]}>
                                    Print Receipt
                                </Text>
                            </Pressable>
                            <Pressable style={[GlobalStyles.button, { alignSelf: "center", marginBottom: 20 }]} onPress={() => {
                                this.props.navigation.navigate('Payments')
                            }}>
                                <Text style={[GlobalStyles.buttonText]}>
                                    Done
                                </Text>
                            </Pressable>
                        </View>
                    }
                </View>
                <View style={{ position: "absolute", bottom: -500 }}>
                    <QRCode
                        value={NODE_ENV_EXPLORER+"tx/" + this.state.signature}
                        size={Dimensions.get("window").width * 0.7}
                        ecl="L"
                        getRef={(c) => (this.svg = c)}
                    />
                </View>
            </>
        );
    }
}

export default MyWalletConnect;