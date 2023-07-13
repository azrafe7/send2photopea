"use strict";

let manifest = chrome.runtime.getManifest();
console.log(manifest.name + " v" + manifest.version);

const photopeaUrl = "https://www.photopea.com";

function createContextMenu() {
  chrome.contextMenus.removeAll(function() {
    chrome.contextMenus.create({
      id: "Send2Photopea_onImageContextMenu",
      title: "Send to Photopea",
      contexts: ["image", "video"],
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  createContextMenu();
});

function blobToDataUrl(blob) {
  return new Promise(r => {
    let a = new FileReader();
    a.onload = r;
    a.readAsDataURL(blob)}
  ).then(e => e.target.result);
}

async function waitForPhotopeaInitAndPostMessage(tab, message) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript({
      target: {tabId: tab.id},
      args: [message],
      func: (message) => {

        window.addEventListener("message", (e) => {
          // alert("[Send2Photopea:PP]\n" + e.data);
          console.log("[Send2Photopea:PP]", e);
          if (e.data == "inited") {
            console.log("[Send2Photopea:PP] INITED");
            window._photopeaInited = true;
          }
        });

        if (!window._photopeaInited) {
          console.log("[Send2Photopea:PP] wait for init...");
        }
        
        function tryPostMessage() {
          if (window._photopeaInited) {
            console.log("[Send2Photopea:PP] postMessage\n" + message);
            window.postMessage(message, "*");
          } else {
            window.postMessage("inited", "*");
            setTimeout(tryPostMessage, 100);
          }
        }

        tryPostMessage();
      },
    })
    .then(() => {
      console.log("[Send2Photopea:BG.waitForPhotopeaInitAndPostMessage] script injected");
    });
  });
}

async function focusTab(tab) {
  return new Promise((resolve, reject) => {
    var updateProperties = { 'active': true };
    chrome.tabs.update(tab.id, updateProperties, (tab) => { resolve(tab); });
  });
}

// get first Photopea tab, or open a new one
async function getPhotopeaTab() {
  let queryOptions = {url: "https://www.photopea.com/"};

  // `tab` will either be a `tabs.Tab` instance or `undefined`.
  let [photopeaTab] = await chrome.tabs.query(queryOptions);
  let [activeTab] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
  if (photopeaTab === undefined) {
    console.log(`[Send2Photopea:BG] opening new Photopea tab...`);
    return new Promise((resolve, reject) => {
      chrome.tabs.create({url: photopeaUrl, index: (activeTab.index + 1)}, (tab) => {
        console.log(`[Send2Photopea:BG] opened new Photopea tab (idx: ${tab.index})`);
        resolve({photopeaTab: tab});
      });
    });
  }

  console.log(`[Send2Photopea:BG] found open Photopea tab (idx: ${photopeaTab.index})`);
  return {photopeaTab: photopeaTab};
}

function postMessage(photopeaTab, message) {
  chrome.scripting.executeScript({
    target: {tabId: photopeaTab.id},
    args: [message],
    func: (message) => {
      console.log("[Send2Photopea:PP] postMessage\n" + message);
      window.postMessage(message, "*");
    },
  })
  .then(() => {
    console.log("[Send2Photopea:BG.postMessage] script injected");
  });
}

async function sendAsDataURL(info, tab, dataURL) {
  let {photopeaTab} = await getPhotopeaTab();
  // console.log(photopeaTab);
  await focusTab(photopeaTab);

  let blob = null;
  if (!dataURL) {
    if (info.mediaType === 'image') {
      let img = await fetch(info.srcUrl);
      blob = await img.blob();
    }
  }
  dataURL = dataURL ?? await blobToDataUrl(blob);
  console.log(dataURL);

  let message = `app.open('${dataURL}')`;

  waitForPhotopeaInitAndPostMessage(photopeaTab, message);
}

async function sendAsUrl(info, tab) {
  let {photopeaTab} = await getPhotopeaTab();
  // console.log(photopeaTab);
  await focusTab(photopeaTab);

  let message = `app.open('${info.srcUrl}')`;

  waitForPhotopeaInitAndPostMessage(photopeaTab, message);
}

// open new tab, make Photopea load `info.srcUrl`
function openNewAsUrl(info, tab) {
  let config = {"files":[info.srcUrl], "environment":{}};
  let encodedConfig = encodeURI(JSON.stringify(config));

  chrome.tabs.create({
    url: photopeaUrl + "#" + encodedConfig,
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log("[Send2Photopea:BG] onContextMenuClicked:", [info, tab]);
  console.log(info.mediaType, info.srcUrl);

  if (info.menuItemId === "Send2Photopea_onImageContextMenu") {

      // on the webstore page no content script is injected
      // so we sendAsUrl directly (also for inage dataUrls)
      if (tab.url.startsWith("https://chrome.google.com/webstore") || tab.url.startsWith("data:image")) {
        sendAsUrl(info, tab);
      } else {
        chrome.tabs.sendMessage(
          tab.id,
          {
            event: "sendToPhotopea",
            data: info,
          },
          function(response) {
            if (response == null) {
              response = { sendAs: "asDataURL" };
              console.warn(`[Send2Photopea:BG] response was undefined. Setting sendAs to '${response.sendAs}'.`);
            }
            console.log("[Send2Photopea:BG] send as " + response.sendAs);
            console.log(response);
            if (response.sendAs === "dataURL") {
              sendAsDataURL(info, tab, response.dataURL);
            } else {
              sendAsUrl(info, tab);
            }
          }
        );
      }

  }
});

async function openPhotopea() {
  let {photopeaTab} = await getPhotopeaTab();
  // console.log(photopeaTab);
  await focusTab(photopeaTab);
}

async function takeScreenshot() {
  let dataURL = await chrome.tabs.captureVisibleTab(null, {
      format: 'png'
    },
  );
  return dataURL;
}

// take a screenshot of active tab and 
// open Photopea when clicking the browser action
chrome.action.onClicked.addListener(async (tab) => {
  // openPhotopea();
  let dataURL = await takeScreenshot();
  sendAsDataURL({mediaType: 'image'}, tab, dataURL);
});