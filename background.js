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
          target: {tabId: tab.id},
          args: [dataURL],
          func: (dataURL) => {
            let photopeaInited = false;
            
            window.addEventListener("message", (e) => {
              // alert(e.data);
              // console.log(e);
              if (e.data?.type === "HelloMessage") {
                console.log("[Send2Photopea:PP] INITED");
                photopeaInited = true;
              };
            });
            
            let message = `app.open("${dataURL}")`;
            // console.log("[Send2Photopea:PP] tryPostMessage\n" + message);
            
            function tryPostMessage() {
              if (photopeaInited) {
                console.log("[Send2Photopea:PP] postMessage\n" + message);
                window.postMessage(message, "*");
              } else {
                setTimeout(tryPostMessage, 100);
              }
            }
            tryPostMessage();
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
