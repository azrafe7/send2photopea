(() => {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log(msg);
    const { event, data } = msg;

    if (event === "onUpdated") {
      console.log(data);
    }

    sendResponse(window.location);
  });

})();
