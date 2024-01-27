"use strict";

let manifest = chrome.runtime.getManifest();
console.log(manifest.name + " v" + manifest.version);

const photopeaUrl = "https://www.photopea.com";

const storage = chrome.storage.local;


function toggleUseIncognito(info, tab) {
  console.log("[Send2Photopea:BG] toggleUseIncognito", info, tab);
  storage.set({ useIncognito:info.checked }, () => {
    updateContextMenuFromSettings();
  });
}

function createContextMenu() {
  chrome.contextMenus.removeAll(function() {
    chrome.contextMenus.create({
      id: "Send2Photopea_onImageContextMenu",
      title: "Send to Photopea",
      contexts: ["image", "video"],
    });
    chrome.contextMenus.create({
      id: "Send2Photopea_onToggleIncognitoContextMenu",
      title: "Open Photopea in incognito window?",
      type: "checkbox",
      checked: false,
      contexts: ["action"],
    }, () => {
      updateContextMenuFromSettings();
    });
  });
}

async function getUseIncognito() {
  let settings = await storage.get(null);
  let useIncognito = settings?.useIncognito ?? false;
  console.log("getUseIncognito", useIncognito);
  return useIncognito;  
}

function updateContextMenuFromSettings() {
  storage.get(null, (settings) => {
    let useIncognito = settings?.useIncognito ?? false;
    console.log("update from settings:", settings, "useIncognito:", useIncognito);
    chrome.contextMenus.update("Send2Photopea_onToggleIncognitoContextMenu", { checked:useIncognito });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  createContextMenu();
});

/*
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // console.log(tabId, changeInfo, tab);

  if (changeInfo.status == 'loading') {
    const enabled = changeInfo.url != null && !changeInfo.url.startsWith("chrome:") && !changeInfo.url.startsWith("about:");
    // console.log(changeInfo, changeInfo.url, (changeInfo.url == null));
    if (!enabled) {
      console.warn(`[Send2Photopea:BG] disabled on this page`);
    }
    // console.log('set to ', enabled);
    chrome.contextMenus.update(
      "Send2Photopea_onImageContextMenu",
      { enabled: enabled },
    );
  }
});
*/

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
    chrome.tabs.update(tab.id, updateProperties, (tab) => { 
      chrome.windows.update(tab.windowId, { focused:true }, (win) => {
        resolve(tab);
      });
    });
  });
}

// get first Photopea tab, or open a new one
async function getPhotopeaTab(options) {
  let queryOptions = {url: "https://www.photopea.com/"};

  // `tab` will either be a `tabs.Tab` instance or `undefined`.
  let [photopeaTab] = await chrome.tabs.query(queryOptions);
  let [activeTab] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
  let openInIncognito = await getUseIncognito();
  if (photopeaTab === undefined || options?.openNew === true) {
    console.log(`[Send2Photopea:BG] opening new Photopea tab...`);
    return new Promise(async (resolve, reject) => {
      let incognitoWindow = null;
      let tab = null;
      if (openInIncognito) {
        let allWindows = await chrome.windows.getAll({ populate:true });
        let allIncognitoWindows = allWindows.filter((win) => win.incognito == true );
        if (allIncognitoWindows.length > 0) {
          incognitoWindow = allIncognitoWindows[allIncognitoWindows.length - 1];
        } else {
          incognitoWindow = await chrome.windows.create({ incognito:true, url:photopeaUrl });
          tab = await incognitoWindow.tabs[0];
        }
      } 
      if (!tab) {
        const windowId = openInIncognito ? incognitoWindow.id : activeTab.windowId;
        const tabIndex = openInIncognito ? incognitoWindow.tabs.length : (activeTab.index + 1);
        tab = await chrome.tabs.create({windowId:windowId, url: photopeaUrl, index: tabIndex});
      }
      chrome.tabs.onUpdated.addListener(function listener (tabId, info) {
        if (info.status === 'complete' && tabId === tab.id) {
          console.log(`[Send2Photopea:BG] opened new Photopea tab (idx: ${tab.index})`);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve({photopeaTab: tab});
        }
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
  let {photopeaTab} = await getPhotopeaTab({openNew:false});
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
  if (info.srcUrl.startsWith('chrome://')) {
    console.log("[Send2Photopea:BG] ignored", info.srcUrl);
    return;
  }
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

  if (info.menuItemId === 'Send2Photopea_onToggleIncognitoContextMenu') {
    toggleUseIncognito(info, tab);
  } else if (info.menuItemId === "Send2Photopea_onImageContextMenu") {
    console.log(info.mediaType, info.srcUrl);
    
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
            if (response === null) {
              response = { sendAs: "asDataURL" };
              console.warn(`[Send2Photopea:BG] response was undefined. Setting sendAs to '${response.sendAs}'.`);
            } else if (response === false) {
              console.warn(`[Send2Photopea:BG] response was false. Meaning no element could be found.`);
              return;
            }
            console.log("[Send2Photopea:BG] response:", response);
            console.log("[Send2Photopea:BG] send as " + response?.sendAs);
            if (chrome.runtime.lastError) {
              console.warn('ERROR', chrome.runtime.lastError);
            } 
            if (response?.sendAs === "dataURL") {
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