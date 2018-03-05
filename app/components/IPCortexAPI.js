import WebRTC from 'react-native-webrtc';
const {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
  MediaStreamTrack,
  getUserMedia,
} = WebRTC;

// We use this variable within the module closure to provide a single load
// of the API state for effciency.
var PBX = null,
  host = null,
  server = null;
var IPCortex = { PBX };

/**
 * Class to load IPCortex API dynamically in a React [Native] environment
 * Uses the Fetch API.
 */
class IPCortexAPI {

  /**
   * New instance of the IPCortex PBX API. May posess a valid, useable
   * API under the .PBX property from the get go if singleInstance = true (default)
   * AND someone has called serServer before on a valid hostname. If not then caller
   * will need to do this.
   *
   * @method constructor
   * @param  {Boolean}   [singleInstance=true] Unless set to false then only one
   * instance of the API will be mounted globally for all instantitaions. This
   * behaviour is usually what is needed unless instaces are used against different
   * PBXs or different users
   */
  constructor(singleInstance = true) {
    // By default we use one instance of the API for all
    //  instantiations of this class, as this is what we mostly want.
    if(singleInstance)
      this.PBX = PBX;
  }
  /**
   * Load the API from a specific PBX
   *
   * @method setServer
   * @param  {string}  hostname PBX hostname
   * @return {Promise}
   */
  async setServer(hostname) {
    try {
      // If we had an API, invalidate it now
      this.PBX = null;
      this.hostname = host = hostname;
      this.server = server = `https://${hostname}`
      let response = await fetch(`${this.server}/api/api.js`);
      if(response.status == 200) {
        // get the api.js sourcecode text
        let code = await response.text();
        // The API is loaded as an anonymous function which tests for node
        // module style module.exports and attaches it's payload as a property
        // if it exists as an alternative to creating an IPCortex.PBX global
        // Also throw the WebRTC entrypoints in as params.
        let exports = {};
        let module = { exports };
        execParams = Object.assign({}, { module, exports }, WebRTC);
        // We fool this by executing it in a function with module, exports & WebRTC APIs as params
        let api = Function(...Object.keys(execParams), code);
        api(...Object.values(execParams))
        //foo();
        // Cache the PBX API in our module closure
        PBX = module.exports.PBX
        // stash the created API plus the WebRTC object it references in our closure
        Object.assign(this, { PBX }, WebRTC);
      } else {
        throw `bad status ${response.status} ${response.statusText} loading api/api.js`
      }
      if(typeof this.PBX === 'object') {
        // Got a PBX obj, resolve to the hostname
        return hostname;
      } else {
        throw `loaded PBX but typeof PBX is ${typeof PBX}`;
      }

    } catch(error) {

      throw `${error.toString()} reading from ${hostname}`
    }
  }
  get isLoaded() {
    return this.PBX && typeof this.PBX === 'object'
  }

}

export {
  IPCortexAPI,
  IPCortex,
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
  MediaStreamTrack,
  getUserMedia
}