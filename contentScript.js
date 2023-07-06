(() => {
  let manifest = chrome.runtime.getManifest();
  console.log(manifest.name + " v" + manifest.version);

  async function fetchData(url) {
    let response = {};

    try {
      let img = await fetch(url);
      console.log("[Send2Photopea:CTX] can fetch image " + url);
      response = {sendAs: "url"};
    } catch (e) {
      console.log("[Send2Photopea:CTX] cannot fetch image " + url);
      console.log(e);
      response = {sendAs: "dataURL"};
    }

    console.log("[Send2Photopea:CTX] send as " + response?.sendAs);
    return response;
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log("[Send2Photopea:CTX]", msg);
    const { event, data } = msg;

    const photopeaUrl = "https://www.photopea.com";


    if (event === "sendToPhotopea") {
      fetchData(data.srcUrl).then(sendResponse);
    }

    return true; // keep port alive
  });
})();
