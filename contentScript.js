(() => {
  chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
    console.log("[Send2Photopea:CTX]", msg);
    const { event, data } = msg;

    if (event === "sendToPhotopea") {
      window.open(data, '_blank');
    }
  });
})();
