"use strict";

(() => {

  const DEBUG = true;
  let debug = {
    log: DEBUG ? console.log.bind(console) : () => {} // log or NO_OP
  }

  let manifest = chrome.runtime.getManifest();
  console.log(manifest.name + " v" + manifest.version);

  const TRY_FETCHING = false;

  const photopeaUrl = "https://www.photopea.com";

  let clickedElement = null;
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

  let lastTriggeredElement = null;

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
        }
        
        elementPicker.enabled = continuePicking && event.triggered;
        
        if (!elementPicker.enabled) closePicker();
      })
    }
  }
  
  function findTargetsAt(x, y) {
    var elementsAtPoint = document.elementsFromPoint(x, y);
    var videos = [];
    var images = [];
    var others = [];
    for (const el of elementsAtPoint) {
      const tag = el.tagName.toUpperCase();
      if (tag === 'VIDEO') {
        videos.push(el);
      } else if (tag === 'IMG' || tag === 'SVG' || tag === 'CANVAS') {
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
    clickedElement = event.target;
    debug.log("[Send2Photopea:CTX] clickedElement:", clickedElement);
    if (event.clientX != null && event.clientY != null) {
      targets = findTargetsAt(event.clientX, event.clientY);
    }
  }, true);

  async function fetchData(url, mediaType) {
    let response = {};

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
      /*let videoTargets = targets.filter((target) => { return target.tagName.toUpperCase() === 'VIDEO'; });
      if (videoTargets.length > 0) {
        clickedElement = videoTargets[0];
        debug.log("[Send2Photopea:CTX] change clickedElement to", clickedElement);
      }*/
      if (clickedElement && clickedElement.tagName.toUpperCase() === 'VIDEO') {
        let canvas = document.createElement('canvas');
        let ctx = canvas.getContext('2d');
        let video = clickedElement;
        // video.setAttribute('crossOrigin', 'anonymous');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        let dataURL = null;
        let sendAnyway = true;
        try {
          const wasPaused = video.paused;
          if (!wasPaused) video.pause();
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          dataURL = await canvas.toDataURL();
          if (!wasPaused) video.play();
        } catch(error) {
          console.log('[Send2Photopea:CTX] ERROR:', error);
          sendAnyway = confirm(`[Send2Photopea] Unable to fetch video frame data.\nTry opening the whole video?`);
        }
        canvas = null;
        ctx = null;
        response = sendAnyway ? {sendAs: "dataURL", dataURL: dataURL} : false;
        debug.log(dataURL);
      } else {
        debug.log("[Send2Photopea:CTX][WARN] returning 'false': expected video element, but was ", clickedElement);
        response = false; // no valid target found
      }
    }

    debug.log("[Send2Photopea:CTX] send as " + response?.sendAs);
    return response;
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    debug.log("[Send2Photopea:CTX]", msg);
    const { event, data } = msg;

    if (event === "sendToPhotopea") {
      fetchData(data.srcUrl, data.mediaType).then((response) => {
        if (response !== false) { // only sendResponse if valid target found (response !== false)
          sendResponse(response);
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

  // change picker cursor when holding SHIFT
  function updateCursor(eventInfo) {
    let {keyUp, event} = eventInfo;
    if (elementPicker?.enabled) {
      let cursorIdx = +event.shiftKey;
      if (elementPicker.hoverBox.style.cursor != CURSORS[cursorIdx]) {
        debug.log('[Send2Photopea:CTX] change cursor to ' + CURSORS[cursorIdx]);
        elementPicker.hoverBox.style.cursor = CURSORS[cursorIdx];
      }
    }
  }
  
  keyEventContainer.addEventListener('keyup', (e) => updateCursor({keyUp: true, event: e}), true);
  keyEventContainer.addEventListener('keydown', (e) => updateCursor({keyUp: false, event: e}), true);  
  
})();
