/**
 * @format
 */

import "react-native-get-random-values"
import "@ethersproject/shims"
import './shim.js'
import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';
import { LogBox } from 'react-native';

// Extra Prototypes Legacy
String.prototype.replaceAll = function (find, replace) {
   var str = this;
   return str.replace(new RegExp(find.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1"), 'g'), replace);
 };

 // Debug Avoid Require Cycle 
LogBox.ignoreLogs(['Require cycle:', "The provided value 'ms-stream' is not a valid 'responseType'.","The provided value 'moz-chunked-arraybuffer' is not a valid 'responseType'." ]);


AppRegistry.registerComponent(appName, () => App);
