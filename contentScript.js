"use strict";

(() => {

  const DEBUG = false;
  let debug = {
    log: DEBUG ? console.log.bind(console) : () => {} // log or NO_OP
  }

  let manifest = chrome.runtime.getManifest();
  console.log(manifest.name + " v" + manifest.version + (DEBUG ? ' [DEBUG]' : ''));

  const TRY_FETCHING = false;

  const photopeaUrl = "https://www.photopea.com";

  let lastTriggeredElement = null;
  let targets = [];

  const HIGHLIGHT_RED = "rgba(250, 70, 60, 0.5)";
  const HIGHLIGHT_GREEN = "rgba(17, 193, 12, 0.5)";
  const HIGHLIGHT_PEA = "rgba(164, 191, 32, 0.5)"; //"rgba(24, 164, 151, 0.5)";
  const HIGHLIGHT_ORANGE = "rgba(255, 175, 12, 0.5)";
  const HIGHLIGHT_BLUE = "rgba(20, 80, 250, 0.5)";
  const HIGHLIGHT_BG_COLOR = HIGHLIGHT_PEA;

  const OUTLINE_RED = "rgba(250, 70, 60, 0.75)";
  const OUTLINE_GREEN = "rgba(17, 193, 12, 0.90)";
  const OUTLINE_PEA = "rgba(164, 191, 32, 0.9)"; // "rgba(24, 164, 151, 0.90)";
  const OUTLINE_ORANGE = "rgba(255, 175, 0, 0.9)";
  const OUTLINE_BLUE = "rgba(20, 140, 200, 0.9)";
  const OUTLINE_COLOR = OUTLINE_PEA;

  const CURSORS = ["crosshair", "copy"];

  let options = {
    container: null,
    iFrameId: 'Send2Photopea Element Picker Frame',
    enabled: false,
    selectors: "*",
    background: HIGHLIGHT_BG_COLOR,
    borderWidth: 0,
    outlineWidth: 1,
    outlineColor: OUTLINE_COLOR,
    transition: "",
    ignoreElements: [],
    action: {},
    onHighlightedChanged: onHighlightedChanged,
    hoverBoxInfoId: 'send2photopea_picker_info',
  }

  let elementPicker = null;

  // close picker and set var to null
  function closePicker() {
    debug.log("[Send2Photopea:CTX] closePicker()");
    if (elementPicker) {
      elementPicker.enabled = false;
      elementPicker.close();
      elementPicker = null;
    }
  }

  function createPicker() {
    debug.log("[Send2Photopea:CTX] createPicker()");

    elementPicker = new ElementPicker(options);

    // elementPicker.hoverBox.style.cursor = CURSORS[0];
    elementPicker.action = {
      trigger: "mouseup",
      
      callback: ((event, target) => {
        debug.log("[Send2Photopea:CTX] event:", event);
        let continuePicking = event.shiftKey;
        event.triggered = event.triggered ?? event.button == 0; // only proceed if left mouse button was pressed or "event.triggered" was set
        if (event.triggered) {
          debug.log("[Send2Photopea:CTX] triggered:", target);
          lastTriggeredElement = target;
          
          let srcUrl = target?.src;
          let tag = target.tagName.toLowerCase();
          let mediaType = null;
          
          if (isActionableElement(target)) {
            if (tag === 'img') mediaType = 'image';
            else if (tag === 'video') mediaType = 'video';
            else if (tag === 'svg') {
              mediaType = 'svg';
              srcUrl = 'inline';
            } else if (tag === 'canvas') {
              mediaType = 'canvas';
              srcUrl = 'tryToDataURL';
            }
          }
          
          if (srcUrl && mediaType) {
            let msg = { event:'sendToPhotopea', data:{ tag:tag, srcUrl:srcUrl, mediaType:mediaType }};
            chrome.runtime.sendMessage(msg);
          }          
        }
        
        elementPicker.enabled = !event.triggered;
        
        closePicker();
      })
    }
  }
  
  function isActionableElement(element) {
    return ['video', 'img', 'svg', 'canvas'].includes(element.tagName.toLowerCase());
  }
  
  function onHighlightedChanged(changeInfo) {
    debug.log("[Send2Photopea:CTX] onHighlightedChanged:", changeInfo);
    const { oldElement, newElement } = changeInfo;
    if (isActionableElement(newElement)) {
      elementPicker.background = HIGHLIGHT_BG_COLOR;
      elementPicker.outlineColor = OUTLINE_COLOR;
      elementPicker.hoverBox.style.cursor = CURSORS[0];
      elementPicker.hoverBoxInfo.style.fontWeight = 'bold';
      elementPicker.hoverBoxInfo.style.background = 'rgba(0,0,0,.75)';
    } else {
      elementPicker.background = HIGHLIGHT_ORANGE;
      elementPicker.outlineColor = OUTLINE_ORANGE;
      elementPicker.hoverBox.style.cursor = 'not-allowed';
      elementPicker.hoverBoxInfo.style.fontWeight = 'normal';
      elementPicker.hoverBoxInfo.style.background = 'rgba(0,0,0,.5)';
    }
  }
  
  function findTargetsAt(x, y) {
    var elementsAtPoint = document.elementsFromPoint(x, y);
    var videos = [];
    var images = [];
    var others = [];
    for (const el of elementsAtPoint) {
      const tag = el.tagName.toLowerCase();
      if (tag === 'video') {
        videos.push(el);
      } else if (tag === 'img' || tag === 'svg' || tag === 'canvas') {
        images.push(el);
      } else {
        others.push(el);
      }
    }

    var sortedTargets = [].concat(videos).concat(images).concat(others)
    //debug.log(sortedTargets);
    return sortedTargets;
  }

  document.addEventListener("contextmenu", function(event){
    lastTriggeredElement = event.target;
    debug.log("[Send2Photopea:CTX] [onContextMenu] lastTriggeredElement:", lastTriggeredElement);
    if (event.clientX != null && event.clientY != null) {
      targets = findTargetsAt(event.clientX, event.clientY);
    }
  }, true);

  async function tryToDataURL(element, canvasOptions={}) {
    const { offsetX, offsetY, width, height } = canvasOptions;
    let dataURL = null;
    let canvas = document.createElement('canvas');
    let ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;
    debug.log("[Send2Photopea:CTX] tryToDataURL element:", element, 'canvasOptions:', canvasOptions);
    try {
      ctx.drawImage(element, offsetX, offsetY, canvas.width, canvas.height);
      dataURL = await canvas.toDataURL();
      return dataURL;
    } catch(error) {
      console.log('[Send2Photopea:CTX] tryToDataURL ERROR:', error);
      throw error;
    }
  }
  
  async function fetchData(url, mediaType) {
    let response = {};
    debug.log("[Send2Photopea:CTX] fetchData:", { url:url, mediaType:mediaType });
  
    if (mediaType === 'image') {
      if (TRY_FETCHING) {
        try {
          let img = await fetch(url);
          debug.log("[Send2Photopea:CTX] can fetch image " + url);
          response = {sendAs: "url"};
        } catch (e) {
          debug.log("[Send2Photopea:CTX] cannot fetch image " + url);
          debug.log(e);
          response = {sendAs: "dataURL"};
        }
      } else {
        debug.log("[Send2Photopea:CTX] don't try to fetch " + url);
        let dataURL = url.startsWith("data:image") ? url : null;
        response = {sendAs: "dataURL", dataURL: dataURL};
      }
    } else if (mediaType === 'video') {
      let videoTargets = targets.filter((target) => { return target.tagName.toLowerCase() === 'video'; });
      if (videoTargets.length > 0) {
        lastTriggeredElement = videoTargets[0];
        debug.log("[Send2Photopea:CTX] change lastTriggeredElement to", lastTriggeredElement);
      }
      if (lastTriggeredElement && lastTriggeredElement.tagName.toLowerCase() === 'video') {
        let video = lastTriggeredElement;
        // video.setAttribute('crossOrigin', 'anonymous');
        let dataURL = null;
        let sendAnyway = true;
        try {
          const wasPaused = video.paused;
          if (!wasPaused) video.pause();
          const canvasOptions = { offsetX:0, offsetY:0, width:video.videoWidth, height:video.videoHeight };
          dataURL = await tryToDataURL(video, canvasOptions);
          if (!wasPaused) video.play();
        } catch(error) {
          console.log('[Send2Photopea:CTX] ERROR:', error);
          sendAnyway = confirm(`[Send2Photopea] Unable to fetch video frame data.\nTry opening the whole video (this may take a while)?`);
        }
        response = sendAnyway ? {sendAs: "dataURL", dataURL: dataURL} : false;
        debug.log(dataURL);
      } else {
        debug.log("[Send2Photopea:CTX][WARN] returning 'false': expected video element, but was", lastTriggeredElement);
        response = false; // no valid target found
        alert("[Send2Photopea] Unable to fetch video frame.");
        /*let dataURL = null;
        let sendAnyway = confirm(`[Send2Photopea] Unable to fetch video frame data.\nTry opening the whole video (this may take a while)?`);
        response = sendAnyway ? {sendAs: "dataURL", dataURL: dataURL} : false;
        debug.log(dataURL);*/
      }
    } else if (mediaType === 'svg' && url === 'inline') {
      if (lastTriggeredElement) {
        // for better compatibility: send encoded instead of plain, to dodge errors with some files
        let encodedDataURL = 'data:image/svg+xml;utf8,' + encodeURIComponent(lastTriggeredElement.outerHTML);
        let dataURL = 'data:image/svg+xml;utf8,' + lastTriggeredElement.outerHTML;
        response = {sendAs: "dataURL", dataURL: encodedDataURL};
        debug.log('SVG', { dataURL:dataURL, encodedDataURL:encodedDataURL });
      }
    } else if (mediaType === 'canvas' && url === 'tryToDataURL') {
      if (lastTriggeredElement && lastTriggeredElement.tagName.toLowerCase() === 'canvas') {
        let canvas = lastTriggeredElement;
        debug.log("[Send2Photopea:CTX] EXPERIMENTAL canvas:", canvas);
        let dataURL = null;
        const width = canvas.width;
        const height = canvas.height;
        response = false;
        try {
          const canvasOptions = { offsetX:0, offsetY:0, width:canvas.width, height:canvas.height };
          response = false;
          dataURL = await tryToDataURL(canvas, canvasOptions);
          response = dataURL?.length > 0 ? {sendAs: "dataURL", dataURL: dataURL} : false;
        } catch(error) {
          console.log('[Send2Photopea:CTX] ERROR:', error);
          alert(`[Send2Photopea] Unable to fetch canvas data.\n\nERROR: ${error}`);
          response = false;
        }
        debug.log(dataURL);
      }
    }

    debug.log("[Send2Photopea:CTX] send response:", response);
    return response;
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    const isTopWindow = window == window.top;
    const { event, data } = msg;
    debug.log("[Send2Photopea:CTX] onMessage event:", event, "data:", data);

    if (event === "togglePicker" && !isTopWindow) {
      debug.log("[Send2Photopea:CTX] DISCARDED event:", event);
      sendResponse(null);
      return false;
    }

    if (event === "sendToPhotopea") {
      fetchData(data.srcUrl, data.mediaType).then((response) => {
        if (response !== false) { // only sendResponse if valid target found (response !== false)
          sendResponse(response);
        } else {
          sendResponse(false);
        }
      });
    } else if (event === "togglePicker") {

      let enabled = elementPicker?.enabled ?? false;
      let toggledEnable = !enabled;
      if (toggledEnable) {
        createPicker();
        elementPicker.enabled = true;
        elementPicker.hoverBox.style.cursor = CURSORS[0];
      } else {
        closePicker();
      }
      sendResponse({ event:'pickerEnabled', data:toggledEnable });
    }

    return true; // keep port alive
  });

  const keyEventContainer = window; // elementPicker.iframe ? elementPicker.iframe : window;

  // close picker when pressing ESC
  keyEventContainer.addEventListener('keyup', function(e) {
    if (elementPicker?.enabled && ['Escape', 'Space', 'KeyA', 'KeyQ'].includes(e.code)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
    if (e.code === 'Escape' && elementPicker?.enabled) {
      closePicker();
      debug.log("[Send2Photopea:CTX] user aborted");
    }
  }, true);

  keyEventContainer.addEventListener('keydown', function(e) {
    if (elementPicker?.enabled && ['Escape', 'Space', 'KeyA', 'KeyQ'].includes(e.code)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
    let target = null;
    let newTarget = null;
    let newTargetIdx = null;
    if (e.code === 'Space' && elementPicker?.enabled) {
      target = elementPicker.hoverInfo.element;
      debug.log("[Send2Photopea:CTX] space-clicked target:", target);
      e.triggered = true; // checked inside action callback
      elementPicker.trigger(e);
    } else if (elementPicker?.enabled && (e.code === 'KeyQ' || e.code === 'KeyA')) {
      target = elementPicker.hoverInfo.element;

      // temporarily set pointer-events:all for all videos
      // (as pointer-events:none will prevent elements to be returned by elementsFromPoint())
      let videos = Array.from(document.querySelectorAll('video'));
      let fixedVideosMap = new Map(); // [element: { prop, value, priority }]
      const POINTER_EVENTS = 'pointer-events';
      for (let video of videos) {
        let computedStyle = getComputedStyle(video);
        // console.log('video:', video, 'computedStyle', POINTER_EVENTS + ':', computedStyle[POINTER_EVENTS]);
        if (computedStyle[POINTER_EVENTS] === 'none') {
          let value = video.style.getPropertyValue(POINTER_EVENTS);
          let priority = video.style.getPropertyPriority(POINTER_EVENTS);
          fixedVideosMap.set(video, { prop:POINTER_EVENTS, value:value, priority:priority });
          video.style.setProperty(POINTER_EVENTS, 'all', 'important');
        }
      }
      debug.log(`fixedVideosMap (${fixedVideosMap}):`, fixedVideosMap)
      
      let innermostTargetAtPoint = null; // first non-picker-iframe element
      
      // get elements at point
      let elementsAtPoint = document.elementsFromPoint(elementPicker._lastClientX, elementPicker._lastClientY);
      for (let el of elementsAtPoint) {
        if (el != elementPicker.iframe) {
          innermostTargetAtPoint = el;
          break;
        }
      }
      // remove iframe from array (if present)
      const pickerIFrameIdx = elementsAtPoint.indexOf(elementPicker.iframe);
      if (pickerIFrameIdx >= 0) elementsAtPoint.splice(pickerIFrameIdx, 1);
      
      // restore saved pointer-events prop of fixedVideosMap
      for (let [video, style] of fixedVideosMap.entries()) {
        video.style.setProperty(style.prop, style.value, style.priority);
      }
      fixedVideosMap.clear();

      // build ancestors array
      let ancestorsAndSelf = [];
      for (let el=innermostTargetAtPoint; el != null; el = el.parentElement) {
        ancestorsAndSelf.push(el);
      }
      
      debug.log('ancestors:', ancestorsAndSelf);
      debug.log('elementsAtPoint:', [elementPicker._lastClientX, elementPicker._lastClientY], elementsAtPoint);
      
      let elementsToMerge = elementsAtPoint;
      
      // merge ancestors with elementsToMerge
      let mergeAtIndices = [];
      let ancestorsSet = new Set(ancestorsAndSelf);
      for (let el of elementsToMerge) {
        if (ancestorsSet.has(el)) {
          continue;
        }
        for (let [idx, ancestor] of Object.entries(ancestorsAndSelf)) {
          if (ancestor.contains(el)) {
            mergeAtIndices.push({ element:el, index:idx });
            ancestorsSet.add(el);
            break;
          }
        }
      }
      debug.log('mergeAtIndices:', mergeAtIndices);
      for (let mergeInfo of mergeAtIndices.toReversed()) {
        const {element, index} = mergeInfo;
        if (index == -1) {
          ancestorsAndSelf.push(element);
        } else {
          ancestorsAndSelf.splice(index, 0, element);
        }
      }
      
      const ancestorsAndSelfLength = ancestorsAndSelf.length;
      const targetIdx = ancestorsAndSelf.indexOf(target);
      newTargetIdx = targetIdx;
      const targetHasNext = targetIdx <= (ancestorsAndSelfLength - 2);
      const targetHasPrev = targetIdx > 0;
      if (e.code === 'KeyQ' && targetHasNext) { // drill up
        newTargetIdx = targetIdx + 1;
        newTarget = ancestorsAndSelf[newTargetIdx];
        /*if (newTarget.contains(elementPicker.iframe)) {
          newTarget = target;
        }*/
        debug.log("[Send2Photopea:CTX] Q-pressed new ↑ target:", newTarget);
      } else if (e.code === 'KeyA' && targetHasPrev) { // drill down
        newTargetIdx = targetIdx - 1;
        newTarget = ancestorsAndSelf[newTargetIdx];
        /*if (newTarget.contains(elementPicker.iframe)) {
          newTarget = target;
        }*/
        debug.log("[Send2Photopea:CTX] A-pressed new ↓ target:", newTarget);
      }
      debug.log(`${newTargetIdx}/${ancestorsAndSelfLength - 1}`, 'newTarget', targetHasPrev, targetHasNext, newTarget, ancestorsAndSelf);
      if (newTarget && newTarget != target) {
        elementPicker.highlight(newTarget);
      }
    }
  }, true);

})();
