"use strict";

(() => {
  let manifest = chrome.runtime.getManifest();
  console.log(manifest.name + " v" + manifest.version);

  const TRY_FETCHING = false;

  const photopeaUrl = "https://www.photopea.com";

  let clickedElement = null;

  document.addEventListener("contextmenu", function(event){
    clickedElement = event.target;
    console.log("[Send2Photopea:CTX] clickedElement:", clickedElement);
  }, true);

  async function fetchData(url, mediaType) {
    let response = {};

    if (mediaType === 'image') {
      if (TRY_FETCHING) {
        try {
          let img = await fetch(url);
          console.log("[Send2Photopea:CTX] can fetch image " + url);
          response = {sendAs: "url"};
        } catch (e) {
          console.log("[Send2Photopea:CTX] cannot fetch image " + url);
          console.log(e);
          response = {sendAs: "dataURL"};
        }
      } else {
        console.log("[Send2Photopea:CTX] don't try to fetch " + url);
        response = {sendAs: "dataURL"};
      }
    } else if (mediaType === 'video') {
      if (clickedElement && clickedElement.tagName.toUpperCase() === 'VIDEO') {
        let canvas = document.createElement('canvas');
        let ctx = canvas.getContext('2d');
        let video = clickedElement;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        let dataURL = await canvas.toDataURL();
        canvas = null;
        ctx = null;
        response = {sendAs: "dataURL", dataURL: dataURL};
      } else {
        console.log("[Send2Photopea:CTX] expected video element, but was ", clickedElement);
      }
    }

    console.log("[Send2Photopea:CTX] send as " + response.sendAs);
    return response;
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log("[Send2Photopea:CTX]", msg);
    const { event, data } = msg;

    if (event === "sendToPhotopea") {
      fetchData(data.srcUrl, data.mediaType).then(sendResponse);
    }

    return true; // keep port alive
  });
})();
