
chrome.tabs.onUpdated.addListener(async (tabId, tab) => {
  if (tab.url) {
    let response = await chrome.tabs.sendMessage(tabId, {
      event: "onUpdated",
      data: tab.url,
    });
    
    console.log("Received:", response);
  }
});

chrome.contextMenus.create({
  id: "onImageVideoClicked",
  title: "Send to Photopea",
  contexts: ["image", "video"],
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log("onClicked:", [info, tab]);
  // chrome.tabs.create({
    // url: redir
  // });
});
