(() => {
  chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
    console.log("[Send2Photopea:CTX]", msg);
    const { event, data } = msg;

	const photopeaUrl = "https://www.photopea.com";
	
	if (event === "sendToPhotopea") {
      window.open(photopeaUrl + "#" + data, '_blank');
    }
  });
})();
