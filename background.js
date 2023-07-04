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

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log("[Send2Photopea:BG] onContextMenuClicked:", [info, tab]);

  if (info.menuItemId === "onImageContextMenu") {
    if (info.mediaType === "image") {
      let img = await fetch(info.srcUrl);
      let blob = await img.blob();
      let dataURL = await blobToDataUrl(blob);
      console.log(dataURL);

      let config = {"files":[dataURL], "environment":{}};
      let encodedConfig = encodeURI(JSON.stringify(config));

      const photopeaUrl = "https://www.photopea.com";

      chrome.tabs.create({url: photopeaUrl}, (tab) => {
        chrome.scripting.executeScript({
          target: {tabId: tab.id, allFrames: true,},
          args: [dataURL],
          func: (dataURL) => {
            let firstTime = true;
            
            function openDataURL() {
              console.log(window.onmessage);
              if (window.onmessage) {
                console.log("[Send2Photopea:PP] open dataURL", dataURL);
                console.log("[Send2Photopea:PP]", window.onmessage);
                window.postMessage(`puppa`, "*");
                window.postMessage(`app.open('${dataURL}')`, "*");
              } else {
                if (firstTime) {
                  console.log("[Send2Photopea:PP] waiting for window.onMessage handler");
                }
                window.setTimeout(openDataURL, 100);
              }
            }
              
            openDataURL();
          },
        })
        .then(() => {
          console.log("[Send2Photopea:BG] script injected");
        });
      });


      // chrome.tabs.create({
      //  url: photopeaUrl + "#" + encodedConfig,
      // });
      
      // chrome.tabs.sendMessage(
      //   tab.id,
      //   {
      //     event: "sendToPhotopea",
      //     data: photopeaUrl + "#" + encodedConfig,
      //   }
      // );
    }
  }
});
