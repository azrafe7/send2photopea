 # CHANGELOG

 ### v0.3.99 (12 Feb 2024)
 - add Element picker (via action contextmenu)
 - rework VIDEO support
 - experimental CANVAS support
 - experimental SVG (inline) support (encoded)
 - change style hoverBoxInfo style on highlighted
 - better handling of dataURL (and more debug.log)
 - update ElementPicker (wire onHighlightChanged)
 - something more I forgot...

 ### v0.3.1 (03 Feb 2024)
 - for playing videos: pause -> draw screenshot -> play

 ### v0.3.0 (02 Feb 2024)
 - move screenshot functionality to action.contextmenu
 - clicking the extension icon opens/focuses Photopea tab

 ### v0.2.0 (27 Jan 2024)
 - add "Use incognito if Photopea isn't open?" feature
 - wire it to contextMenu and storage

 ### v0.1.17 (26 Jan 2024)
 - also focus window when focusTab()

 ### v0.1.16 (18 Oct 2023)
 - update Firefox version of the extension

 ### v0.1.15 (24 Sep 2023)
 - less console noise (only log if DEBUG == true)
 - handle runtime.lastError
 - update/fix behaviour on 'special' pages

 ### v0.1.12 (25 Jul 2023)
 - detect and disable extension's contextmenu on special pages (about:, chrome:)

 ### v0.1.11 (23 Jul 2023)
 - run in all_frames
 - better handle videos (find video at clicked location)
 - only send response if response !== false (no valid target found)
 - [firefox] remove "tabs" permission ("activeTab" should suffice)

 ### v0.1.10 (21 Jul 2023)
 - remove "cross_origin_opener_policy" directive
 - wait for tab to load when opening new Photopea tab
 - split manifest for chrome and firefox
 - add "browser_specific_settings"
 - stick to chrome. API (for firefox too, for the moment)
 - should be ready to be uploaded as a Firefox Add-On

 ### v0.1.9 (18 Jul 2023)
 - remove tabs permission (should work without changes)

 ### v0.1.8 (13 Jul 2023)
 - disable contextMenu on new-tab-page
 - send images with a data:image src directly
 - more reliably detect if Photopea is inited (now should work also when Photopea has been open from outside the extension)

 ### v0.1.7 (11 Jul 2023)
 - send pages with url starting with "data:image"

 ### v0.1.6 (11 Jul 2023)
 - remove "storage" permission (no more used)
 - fill mediaType on screenshot too

 ### v0.1.5 (10 Jul 2023)
 - send active tab screenshot
 - "use strict"

 ### v0.1.4 (09 Jul 2023)
 - experimental: send video screenshot
 - TRY_FETCHING = false: always send dataURL by default
 - open Photopea after active tab
 - browser action: open Photopea

 ### v0.1.3
 - refactor
 - handle "file://" protocol as dataUrls
 - focus or open new Photopea page
 - waitForInit

 ### v0.1.2
 - sendAsFile/sendAsDataUrl

 ### v0.1.1
 - use chrome.scripting
 - change icons

 ### v0.1.0
 - initial version
 - use Photopea API with query params
 - experiment with dataUrls and files
