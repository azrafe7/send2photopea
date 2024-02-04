"use strict";

(() => {

  const DEBUG = true;
  let debug = {
    log: DEBUG ? console.log.bind(console) : () => {} // log or NO_OP
  }

  let manifest = chrome.runtime.getManifest();
  console.log(manifest.name + " v" + manifest.version);

  const TRY_FETCHING = false;

  const photopeaUrl = "https://www.photopea.com";

  let clickedElement = null;
  let targets = [];

  function findTargetsAt(x, y) {
    var elementsAtPoint = document.elementsFromPoint(x, y);
    var videos = [];
    var images = [];
    var others = [];
    for (const el of elementsAtPoint) {
      const tag = el.tagName.toUpperCase();
      if (tag === 'VIDEO') {
        videos.push(el);
      } else if (tag === 'IMG' || tag === 'SVG' || tag === 'CANVAS') {
        images.push(el);
      } else {
        others.push(el);
      }
    }

    var sortedTargets = [].concat(videos).concat(images).concat(others)
    //debug.log(sortedTargets);
    return sortedTargets;
  }

  document.addEventListener("contextmenu", function(event){
    clickedElement = event.target;
    debug.log("[Send2Photopea:CTX] clickedElement:", clickedElement);
    if (event.clientX != null && event.clientY != null) {
      targets = findTargetsAt(event.clientX, event.clientY);
    }
  }, true);

  async function fetchData(url, mediaType) {
    let response = {};

    if (mediaType === 'image') {
      if (TRY_FETCHING) {
        try {
          let img = await fetch(url);
          debug.log("[Send2Photopea:CTX] can fetch image " + url);
          response = {sendAs: "url"};
        } catch (e) {
          debug.log("[Send2Photopea:CTX] cannot fetch image " + url);
          debug.log(e);
          response = {sendAs: "dataURL"};
        }
      } else {
        debug.log("[Send2Photopea:CTX] don't try to fetch " + url);
        let dataURL = url.startsWith("data:image") ? url : null;
        response = {sendAs: "dataURL", dataURL: dataURL};
      }
    } else if (mediaType === 'video') {
      /*let videoTargets = targets.filter((target) => { return target.tagName.toUpperCase() === 'VIDEO'; });
      if (videoTargets.length > 0) {
        clickedElement = videoTargets[0];
        debug.log("[Send2Photopea:CTX] change clickedElement to", clickedElement);
      }*/
      if (clickedElement && clickedElement.tagName.toUpperCase() === 'VIDEO') {
        let canvas = document.createElement('canvas');
        let ctx = canvas.getContext('2d');
        let video = clickedElement;
        // video.setAttribute('crossOrigin', 'anonymous');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        let dataURL = null;
        let sendAnyway = true;
        try {
          const wasPaused = video.paused;
          if (!wasPaused) video.pause();
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          dataURL = await canvas.toDataURL();
          if (!wasPaused) video.play();
        } catch(error) {
          console.log('[Send2Photopea:CTX] ERROR:', error);
          sendAnyway = confirm(`[Send2Photopea] Unable to fetch video frame data.\nTry opening the whole video?`);
        }
        canvas = null;
        ctx = null;
        response = sendAnyway ? {sendAs: "dataURL", dataURL: dataURL} : false;
        debug.log(dataURL);
      } else {
        debug.log("[Send2Photopea:CTX][WARN] returning 'false': expected video element, but was ", clickedElement);
        response = false; // no valid target found
      }
    }

    debug.log("[Send2Photopea:CTX] send as " + response?.sendAs);
    return response;
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    debug.log("[Send2Photopea:CTX]", msg);
    const { event, data } = msg;

    if (event === "sendToPhotopea") {
      fetchData(data.srcUrl, data.mediaType).then((response) => {
        if (response !== false) { // only sendResponse if valid target found (response !== false)
          sendResponse(response);
        }
      });
    }

    return true; // keep port alive
  });
})();
