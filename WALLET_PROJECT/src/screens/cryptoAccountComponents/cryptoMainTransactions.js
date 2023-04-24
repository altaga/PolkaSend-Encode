// Basic Imports
import React, { Component } from 'react';
import { Pressable, Text, View } from 'react-native';
// Components Local
import Header from '../components/header';
// Utils 
import reactAutobind from 'react-autobind';
// Utils Local
import ContextModule from '../../utils/contextModule';
// Styles
import GlobalStyles from '../../styles/styles';
// Assets
import IconMC from 'react-native-vector-icons/MaterialIcons';

import { contentColor, headerColor, NODE_ENV_API_APIKEY, NODE_ENV_API_EXPLORER } from "../../../env"
import Ctransactions from './cryptoTransactions';
import axios from 'axios';

class CryptoMainTransactions extends Component {
    constructor(props) {
        super(props);
        this.state = {
            transactions: []
        };
        reactAutobind(this)
        this.mount = true
    }

    static contextType = ContextModule;

componentDidMount() {
    this.mount = true;
    let data = JSON.stringify({
      query: `query{
        address(hash: "${this.context.value.account}") {
          transactions(last:10, count:10, order:DESC) {
            edges {
              node {
                  from:fromAddressHash 
                  to:toAddressHash
                  gasPrice
                  value
                  blockNumber
                  gas
                  hash
              }
            }
          }
        }
      }`,
      variables: {},
    });

    let config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://blockscout.acala.network/graphiql',
      headers: {
        'Content-Type': 'application/json',
      },
      data: data,
    };
    axios
      .request(config)
      .then(response => {
        let temp = response.data.data.address.transactions.edges.map(
          item => item.node,
        );
        this.mount &&
          this.setState({
            transactions: temp,
          });
      })
      .catch(error => {
        console.log(error);
      });
  }

    componentWillUnmount() {
        this.mount = false
        clearInterval(this.interval)
    }

    render() {
        return (
            <View style={GlobalStyles.container}>
                <Header />
                {
                    <View style={{ position: "absolute", top: 9, left: 18, width: 36, height: 36 }}>
                        <Pressable onPress={() => this.props.navigation.navigate('CryptoAccount')}>
                            <IconMC name="arrow-back-ios" size={36} color={headerColor} />
                        </Pressable>
                    </View>
                }
                <View style={[GlobalStyles.mainSub, { flexDirection: "column", justifyContent: "space-evenly", alignItems: "center" }]}>
                    <Text style={{ textAlign: "center", fontSize: 24, color: "white" }}>
                        {"\n"}Transactions:{"\n"}
                    </Text>
                    <Ctransactions transactions={this.state.transactions} from={this.context.value.account} />
                </View>
            </View>
        );
    }
}

export default CryptoMainTransactions;