let manifest = chrome.runtime.getManifest();
console.log(manifest.name + " v" + manifest.version);

const photopeaUrl = "https://www.photopea.com";

function createContextMenu() {
  chrome.contextMenus.removeAll(function() {
    chrome.contextMenus.create({
      id: "onImageContextMenu",
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
        let photopeaInited = false;

        window.addEventListener("message", (e) => {
          // alert("[Send2Photopea:PP]\n" + e.data);
          console.log("[Send2Photopea:PP]", e);
          if (e.data?.type === "HelloMessage") {
            console.log("[Send2Photopea:PP] INITED");
            photopeaInited = true;
          }
        });

        function tryPostMessage() {
          if (photopeaInited) {
            console.log("[Send2Photopea:PP] wait and postMessage\n" + message);
            window.postMessage(message, "*");
          } else {
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
  let queryOptions = { url: "https://www.photopea.com/" };
  let isInited = true;

  // `tab` will either be a `tabs.Tab` instance or `undefined`.
  let [photopeaTab] = await chrome.tabs.query(queryOptions);
  let [activeTab] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
  if (photopeaTab === undefined) {
    console.log(`[Send2Photopea:BG] opening new Photopea tab...`);
    return new Promise((resolve, reject) => {
      isInited = false;
      chrome.tabs.create({url: photopeaUrl, index: (activeTab.index + 1)}, (tab) => {
        console.log(`[Send2Photopea:BG] opened new Photopea tab (idx: ${tab.index})`);
        resolve({photopeaTab: tab, isInited: isInited});
      });
    });
  }

  console.log(`[Send2Photopea:BG] found open Photopea tab (idx: ${photopeaTab.index})`);
  return {photopeaTab: photopeaTab, isInited: isInited};
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
  let {photopeaTab, isInited} = await getPhotopeaTab();
  // console.log(photopeaTab, isInited);
  await focusTab(photopeaTab);

  let blob = null;
  if (!dataURL) {
    let img = await fetch(info.srcUrl);
    blob = await img.blob();
  }
  dataURL = dataURL ?? await blobToDataUrl(blob);
  console.log(dataURL);

  let message = `app.open('${dataURL}')`;

  if (!isInited) {
    waitForPhotopeaInitAndPostMessage(photopeaTab, message);
  } else {
    postMessage(photopeaTab, message);
  }
}

async function sendAsUrl(info, tab) {
  let {photopeaTab, isInited} = await getPhotopeaTab();
  // console.log(photopeaTab, isInited);
  await focusTab(photopeaTab);

  let message = `app.open('${info.srcUrl}')`;

  if (!isInited) {
    waitForPhotopeaInitAndPostMessage(photopeaTab, message);
  } else {
    postMessage(photopeaTab, message);
  }
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

  if (info.menuItemId === "onImageContextMenu") {

      // on the webstore page no content script is injected
      // so we sendAsUrl directly
      if (tab.url.startsWith("https://chrome.google.com/webstore")) {
        sendAsUrl(info, tab);
      } else {
        chrome.tabs.sendMessage(
          tab.id,
          {
            event: "sendToPhotopea",
            data: info,
          },
          function(response) {
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
  let {photopeaTab, isInited} = await getPhotopeaTab();
  // console.log(photopeaTab, isInited);
  await focusTab(photopeaTab);
}

// open Photopea when clicking the browser action
chrome.action.onClicked.addListener((tab) => {
  openPhotopea();
});