
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  console.log("onUpdated:", tabId, changeInfo, tab);
  
  if (tab && tab.url && changeInfo.status === 'complete') {
    chrome.tabs.sendMessage(
      tabId, 
      {
        event: "onUpdated",
        data: tab.url,
      },
      (response) => console.log("Received:", response)
    );
  }
});

chrome.contextMenus.create({
  id: "onImageVideoClicked",
  title: "Send to Photopea",
  contexts: ["image", "video"],
});


function blobToDataUrl(blob) {
  return new Promise(r => {let a=new FileReader(); a.onload=r; a.readAsDataURL(blob)}).then(e => e.target.result);
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log("onClicked:", [info, tab]);
  
  if (true || info.mediaType === "image") {
    let img = await fetch(info.srcUrl);
    let blob = await img.blob();
    // let bitmap = await createImageBitmap(blob);
    // console.log(bitmap);
    let dataURL = await blobToDataUrl(blob);
    console.log(dataURL);
    let config = {"files":[dataURL], "environment":{}};
    let encodedConfig = encodeURI(JSON.stringify(config));
   
    const photopeaUrl = "https://www.photopea.com";
    chrome.tabs.sendMessage(
      tab.id, 
      {
        event: "openPhotopea",
        data: photopeaUrl + "#" + encodedConfig,
      }
    );
    
    // chrome.tabs.sendMessage(
      // tab.id, 
      // {
        // event: "onImageFetched",
        // data: bitmap,
      // }
      // (response) => console.log("Received:", response)
    // );
  } else if (info.mediaType === "video") {
    
  }
  
  let msg = {
    event: "onImageVideoClicked",
    data: info.srcUrl,
  };
  chrome.tabs.sendMessage(tab.id, msg);
  console.log(msg);
  
  // chrome.tabs.create({
    // url: redir
  // });
});

