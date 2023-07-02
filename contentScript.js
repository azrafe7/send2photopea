(() => {
  chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
    console.log(msg);
    const { event, data } = msg;

    if (event === "onUpdated") {
      console.log(event, data);
    } else if (event === "onImageVideoClicked") {
      console.log(event, data);
      let dataURL = await imageToDataURL(data);
      console.log(dataURL);
    } else if (event === "onImageFetched") {
      let bitmap = data;
      let canvas = document.createElement("canvas");
      let ctx = canvas.getContext("2d");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);
      console.log(canvas.toDataURL("image/png"));
    } else if (event === "openPhotopea") {
      window.open(data, '_blank');
    }

    sendResponse(window.location);
  });

})();

async function imageToDataURL(imageUrl) {
  let img = await fetch(imageUrl);
  img = await img.blob();
  let bitmap = await createImageBitmap(img);
  let canvas = document.createElement("canvas");
  let ctx = canvas.getContext("2d");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);
  return canvas.toDataURL("image/png");
  // image compression? 
  // return canvas.toDataURL("image/png", 0.9);
};
