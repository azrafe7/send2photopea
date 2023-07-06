let manifest = chrome.runtime.getManifest();
console.log(manifest.name + " v" + manifest.version);

const photopeaUrl = "https://www.photopea.com";

chrome.runtime.onInstalled.addListener(() => {
	chrome.contextMenus.create({
	  id: "onImageContextMenu",
	  title: "Send to Photopea",
	  contexts: ["image"],
	});
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

async function getPhotopeaTab() {
  let queryOptions = { url: "https://www.photopea.com/" };
  let isInited = true;

  // `tab` will either be a `tabs.Tab` instance or `undefined`.
  let [photopeaTab] = await chrome.tabs.query(queryOptions);
  if (photopeaTab === undefined) {
    console.log(`[Send2Photopea:BG] opening new Photopea tab...`);
    return new Promise((resolve, reject) => {
      isInited = false;
      chrome.tabs.create({url: photopeaUrl}, (tab) => {
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

async function sendAsDataURL(info, tab) {
  let img = await fetch(info.srcUrl);
  let blob = await img.blob();
  let dataURL = await blobToDataUrl(blob);
  console.log(dataURL);

  let {photopeaTab, isInited} = await getPhotopeaTab();
  // console.log(photopeaTab, isInited);
  await focusTab(photopeaTab);

  let message = `app.open("${dataURL}")`;

  if (!isInited) {
    waitForPhotopeaInitAndPostMessage(photopeaTab, message);
  } else {
    postMessage(photopeaTab, message);
  }
}

function sendAsFile(info, tab) {
  let config = {"files":[info.srcUrl], "environment":{}};
  let encodedConfig = encodeURI(JSON.stringify(config));

  chrome.tabs.create({
    url: photopeaUrl + "#" + encodedConfig,
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log("[Send2Photopea:BG] onContextMenuClicked:", [info, tab]);

  if (info.menuItemId === "onImageContextMenu") {
    if (info.mediaType === "image") {

      // on the webstore page no content script is injected
      // so we sendAsFile directly
      if (tab.url.startsWith("https://chrome.google.com/webstore")) {
        sendAsFile(info, tab);
      } else {
        chrome.tabs.sendMessage(
          tab.id,
          {
            event: "sendToPhotopea",
            data: info,
          },
          function(response) {
            console.log("[Send2Photopea:BG] send as " + response?.sendAs);
            if (response.sendAs === "dataURL") {
              sendAsDataURL(info, tab);
            } else {
              sendAsFile(info, tab);
            }
          }
        );
      }
    }
  }
});
