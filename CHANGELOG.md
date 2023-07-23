 # CHANGELOG

 ### v0.1.11 (23 Aug 2023)
 - run in all_frames
 - better handle videos (find video at clicked location)
 - only send response if response !== false (no valid target found)
 - [firefox] remove "tabs" permission ("activeTab" should suffice)
 
 ### v0.1.10 (21 Aug 2023)
 - remove "cross_origin_opener_policy" directive
 - wait for tab to load when opening new Photopea tab
 - split manifest for chrome and firefox
 - add "browser_specific_settings"
 - stick to chrome. API (for firefox too, for the moment)
 - should be ready to be uploaded as a Firefox Add-On

 ### v0.1.9 (18 Aug 2023)
 - remove tabs permission (should work without changes)

 ### v0.1.8 (13 Aug 2023)
 - disable contextMenu on new-tab-page
 - send images with a data:image src directly
 - more reliably detect if Photopea is inited (now should work also when Photopea has been open from outside the extension)

 ### v0.1.7 (11 Aug 2023)
 - send pages with url starting with "data:image"

 ### v0.1.6 (11 Aug 2023)
 - remove "storage" permission (no more used)
 - fill mediaType on screenshot too

 ### v0.1.5 (10 Aug 2023)
 - send active tab screenshot
 - "use strict"

 ### v0.1.4 (09 Aug 2023)
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
