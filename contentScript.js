"use strict";

(() => {
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
    //console.log(sortedTargets);
    return sortedTargets;
  }

  document.addEventListener("contextmenu", function(event){
    clickedElement = event.target;
    console.log("[Send2Photopea:CTX] clickedElement:", clickedElement);
    targets = findTargetsAt(event.clientX, event.clientY);
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
        let dataURL = url.startsWith("data:image") ? url : null;
        response = {sendAs: "dataURL", dataURL: dataURL};
      }
    } else if (mediaType === 'video') {
      let videoTargets = targets.filter((target) => { target.tagName.toUpperCase() === 'VIDEO'; });
      if (videoTargets.length > 0) {
        clickedElement = videoTargets[0];
        console.log("[Send2Photopea:CTX] change clickedElement to", clickedElement);
      }
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
        console.log(dataURL);
      } else {
        console.log("[Send2Photopea:CTX][WARN] returning 'false': expected video element, but was ", clickedElement);
        return false; // no valid target found
      }
    }

    console.log("[Send2Photopea:CTX] send as " + response.sendAs);
    return response;
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log("[Send2Photopea:CTX]", msg);
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
