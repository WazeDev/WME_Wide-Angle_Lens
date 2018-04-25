// ==UserScript==
// @name                WME Wide-Angle Lens
// @namespace           https://greasyfork.org/en/users/19861-vtpearce
// @description         Scan a large area
// @author              vtpearce and crazycaveman (progress bar from dummyd2 & seb-d59)
// @include             https://www.waze.com/editor
// @include             /^https:\/\/(www|beta)\.waze\.com\/(?!user\/)(.{2,6}\/)?editor.*$/
// @version             1.4.3b1
// @grant               none
// @copyright           2017 vtpearce
// @license             CC BY-SA 4.0
// @require             https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js
// @updateURL           https://greasyfork.org/scripts/40641-wme-wide-angle-lens/code/WME%20Wide-Angle%20Lens.meta.js
// @downloadURL         https://greasyfork.org/scripts/40641-wme-wide-angle-lens/code/WME%20Wide-Angle%20Lens.user.js
// ==/UserScript==
// ---------------------------------------------------------------------------------------
var WMEWAL;
(function (WMEWAL) {
    var Version = GM_info.script.version;
    var ProgressBar = (function () {
        function ProgressBar(id) {
            this.div = $(id);
        }
        ProgressBar.prototype.isShown = function () {
            return this.div.is(":visible");
        };
        ProgressBar.prototype.show = function () {
            this.div.show();
        };
        ProgressBar.prototype.hide = function () {
            this.div.hide();
        };
        ProgressBar.prototype.update = function (value) {
            logDebug("Percent complete = " + value.toString());
            if (value > 100) {
                value = 100;
            }
            if (value === -1) {
                this.div.children().hide();
                return;
            }
            this.div.children().show();
            this.div.children(".wal-progressBarBG").css("width", value.toString() + "%");
            this.div.children(".wal-progressBarFG").text(value.toString() + "%");
        };
        return ProgressBar;
    }());
    (function (RoadType) {
        RoadType[RoadType["Street"] = 1] = "Street";
        RoadType[RoadType["PrimaryStreet"] = 2] = "PrimaryStreet";
        RoadType[RoadType["MinorHighway"] = 4] = "MinorHighway";
        RoadType[RoadType["MajorHighway"] = 8] = "MajorHighway";
        RoadType[RoadType["Freeway"] = 16] = "Freeway";
        RoadType[RoadType["Ramp"] = 32] = "Ramp";
        RoadType[RoadType["PrivateRoad"] = 64] = "PrivateRoad";
        RoadType[RoadType["WalkingTrail"] = 128] = "WalkingTrail";
        RoadType[RoadType["Unpaved"] = 256] = "Unpaved";
        RoadType[RoadType["PedestrianBoardwalk"] = 512] = "PedestrianBoardwalk";
        RoadType[RoadType["Ferry"] = 1024] = "Ferry";
        RoadType[RoadType["Stairway"] = 2048] = "Stairway";
        RoadType[RoadType["Railroad"] = 4096] = "Railroad";
        RoadType[RoadType["RunwayTaxiway"] = 8192] = "RunwayTaxiway";
        RoadType[RoadType["ParkingLotRoad"] = 16384] = "ParkingLotRoad";
        RoadType[RoadType["Alley"] = 32768] = "Alley";
    })(WMEWAL.RoadType || (WMEWAL.RoadType = {}));
    var RoadType = WMEWAL.RoadType;
    var topLeft = null;
    var bottomRight = null;
    WMEWAL.areaToScan = null;
    var height;
    var width;
    var segments = null;
    var venues = null;
    WMEWAL.areaName = null;
    var currentX;
    var currentY;
    var currentCenter = null;
    var currentZoom = null;
    var layerToggle = null;
    var needSegments = false;
    var needVenues = false;
    var cancelled = false;
    var totalViewports;
    var countViewports;
    var mapReady = false;
    var modelReady = false;
    var settings = null;
    var plugins = [];
    var settingsKey = "WMEWAL_Settings";
    var debug = false;
    var layerName = "WMEWAL_Areas";
    var pb = null;
    var initCount = 0;
    var layerCheckboxAdded = false;
    function bootstrap_WideAngleLens() {
        // let bGreasemonkeyServiceDefined: boolean = false;
        // try {
        //     bGreasemonkeyServiceDefined = (typeof Components.interfaces.gmIGreasemonkeyService === "object");
        // }
        // catch (err) { /* Ignore */ }
        // if (typeof unsafeWindow === "undefined" || !bGreasemonkeyServiceDefined) {
        //     unsafeWindow = (function () {
        //         let dummyElem: HTMLParagraphElement = document.createElement("p");
        //         dummyElem.setAttribute("onclick", "return window;");
        //         return dummyElem.onclick(null);
        //     })();
        // }
        setTimeout(WideAngleLens, 1000);
    }
    function WideAngleLens() {
        console.group("WMEWAL: Initializing");
        initCount++;
        var objectToCheck = ["W.map",
            "W.model.segments",
            "W.model.venues",
            "W.model.states",
            "W.model.events",
            "OL",
            "W.vent",
            "W.controller",
            "W.model.actionManager",
            "WazeWrap.Interface"];
        for (var i = 0; i < objectToCheck.length; i++) {
            var path = objectToCheck[i].split(".");
            var object = window;
            for (var j = 0; j < path.length; j++) {
                object = object[path[j]];
                if (typeof object === "undefined" || object == null) {
                    console.warn(path[j] + " NOT OK");
                    if (initCount < 60) {
                        console.groupEnd();
                        window.setTimeout(WideAngleLens, 1000);
                    }
                    else {
                        console.error("Giving up on initialization");
                        console.groupEnd();
                    }
                    return;
                }
            }
            console.log(objectToCheck[i] + " OK");
        }
        if (typeof (Storage) !== "undefined") {
            if (localStorage[settingsKey]) {
                var upd = false;
                var settingsString = localStorage[settingsKey];
                if (settingsString.substring(0, 1) === "~") {
                    // Compressed value - decompress
                    //console.log("Decompress UTF16 settings");
                    settingsString = WMEWAL.LZString.decompressFromUTF16(settingsString.substring(1));
                }
                try {
                        settings = JSON.parse(settingsString);
                } catch (e) {}
                if (typeof settings === "undefined" || settings === null || settings === "") {
                    settings = "";
                    console.debug("WMEWAL: Using old decompress method");
                    localStorage[settingsKey +"Backup"] = localStorage[settingsKey];
                    settingsString = localStorage[settingsKey];

                    if (settingsString.substring(0, 1) === "~") {
                        // Compressed value - decompress
                        settingsString = WMEWAL.LZString.decompress(settingsString.substring(1));
                    }
                    try {
                        settings = JSON.parse(settingsString);
                    } catch (e) {}
                    if (typeof settings === "undefined" || settings === null || settings === "") {
                        console.warn("WMEWAL: Unable to decompress! Using empty settings");
                        settings = {
                            SavedAreas: [],
                            ActivePlugins: [],
                            Version: Version
                        };
                    }
                    upd = true;
                    //console.log("Parsing JSON after decompress");
                    settings = JSON.parse(settingsString);
                    //console.log("Parsed");
                }

                settings.SavedAreas.sort(function (a, b) {
                    return a.name.localeCompare(b.name);
                });
                delete settingsString;
                if (!settings.hasOwnProperty("Version")) {
                    settings.Version = Version;
                    upd = true;
                }
                for (var ix = 0; ix < settings.SavedAreas.length; ix++) {
                    if (settings.SavedAreas[ix].geometryText) {
                        settings.SavedAreas[ix].geometry = OL.Geometry.fromWKT(settings.SavedAreas[ix].geometryText);
                        while ((settings.SavedAreas[ix].geometry.CLASS_NAME === "OL.Geometry.Collection" ||
                                settings.SavedAreas[ix].geometry.CLASS_NAME === "OpenLayers.Geometry.Collection") &&
                            settings.SavedAreas[ix].geometry.components.length === 1) {
                            settings.SavedAreas[ix].geometry = settings.SavedAreas[ix].geometry.components[0];
                            upd = true;
                        }
                        delete settings.SavedAreas[ix].geometryText;
                    }
                }
                if (upd) {
                    updateSettings();
                }
            }
            else if (localStorage["WMEMSL_areaList"]) {
                // Import settings from old MSL script
                var savedAreas = JSON.parse(localStorage["WMEMSL_areaList"]);
                savedAreas.sort(function (a, b) {
                    return a.name.localeCompare(b.name);
                });
                settings = {
                    SavedAreas: savedAreas,
                    ActivePlugins: [],
                    Version: Version
                };
                for (var ix = 0; ix < settings.SavedAreas.length; ix++) {
                    if (settings.SavedAreas[ix].geometryText) {
                        settings.SavedAreas[ix].geometry = OL.Geometry.fromWKT(settings.SavedAreas[ix].geometryText);
                        delete settings.SavedAreas[ix].geometryText;
                    }
                }
            }
            else {
                settings = {
                    SavedAreas: [],
                    ActivePlugins: [],
                    Version: Version
                };
            }
        }
        if (CompareVersions(settings.Version, Version) < 0) {
            var versionHistory = "WME Wide-Angle Lens\nv" + Version + "\n\nWhat's New\n--------";
            if (CompareVersions(settings.Version, "1.4.1")) {
                versionHistory += "\nv1.4.1: Hotfix for 1.4.0";
            }
            if (CompareVersions(settings.Version, "1.4.0")) {
                versionHistory += "\nv1.4.0: Updates to support Firefox.";
            }
            if (CompareVersions(settings.Version, "1.3.4.1")) {
                versionHistory += "\nv1.3.4.1: ***BACKUP YOUR AREAS NOW!!***\nThe next version of WAL"+
                                  " could potentially cause data loss.\nSee the forum thread for more info";
            }
            if (CompareVersions(settings.Version, "1.3.4")) {
                versionHistory += "\nv1.3.4: Updates to WME URL";
            }
            if (CompareVersions(settings.Version, "1.3.3")) {
                versionHistory += "\nv1.3.3: Updates to support latest version of WME Editor.";
            }
            alert(versionHistory);
            settings.Version = Version;
            updateSettings();
        }
        var style = document.createElement("style");
        style.type = "text/css";
        var css = ".wal-heading { font-size: 1.2em; font-weight: bold }";
        css += ".wal-indent { padding-left: 20px }";
        css += ".wal-label { margin-left: 8px }";
        css += "#wal-progressBarInfo { display: none; width: 90%; float: left; position: absolute; border-top-left-radius: 5px; border-top-right-radius: 5px; border-bottom-right-radius: 5px; border-bottom-left-radius: 5px; margin-bottom: -100%; background-color: #c9e1e9; z-index: 999; margin: 5px; margin-right: 20px; }";
        css += ".wal-progressBarBG { margin-top: 2px; margin-bottom: 2px; margin-left: 2px; margin-right: 2px; padding-bottom: 0px; padding-top: 0px; padding-left: 0px; padding-right: 0px; width: 33%; background-color: #93c4d3; border: 3px rgb(147, 196, 211); border-top-left-radius: 5px; border-top-right-radius: 5px; border-bottom-right-radius: 5px; border-bottom-left-radius: 5px; height: 22px;}";
        css += ".wal-progressBarFG { float: left; position: relative; bottom: 22px; height: 0px; text-align: center; width: 100% }";
        css += ".wal-textbox { width: 100% }";
        style.innerHTML = css;
        document.body.appendChild(style);
        console.log("Initialized");
        console.groupEnd();
        makeTab();
        window["WMEWAL"] = WMEWAL;
    }
    function makeTab() {
        var userTabs = $("#user-info");
        var navTabs = $("ul.nav-tabs", userTabs).filter(":first");
        var tabContent = $(".tab-content", userTabs).filter(":first");
        navTabs.append("<li><a href='#sidepanel-wme-wal' data-toggle='tab'>WAL</a></li>");
        var addon = $("<div id='sidepanel-wme-wal' class='tab-pane'><h3>Wide-Angle Lens <span style='font-size:11px;'>v"+ Version +"</span></h3></div>");
        var pbi = $("<div/>").attr("id", "wal-progressBarInfo").addClass("wal-ProgressBarInfo").appendTo(addon);
        var pb$ = $("<div/>").attr("id", "wal-progressBar").css({ width: "100%", display: "none" }).appendTo(pbi);
        pb$.append($("<div/>").addClass("wal-progressBarBG"));
        pb$.append($("<span/>").addClass("wal-progressBarFG").text("100%"));
        pbi.append("<div id='wal-info'/>");
        var addonTabs = $("<ul id='wmewal-tabs' class='nav nav-tabs'/>").appendTo(addon);
        addonTabs.append("<li class='active'><a data-toggle='tab' href='#sidepanel-wmewal-scan'>Scan</a></li>");
        addonTabs.append("<li><a data-toggle='tab' href='#sidepanel-wmewal-areas'>Areas</a></li>");
        var addonTabContent = $("<div class='tab-content'/>").appendTo(addon);
        var tabScan = $("<div class='tab-pane active' id='sidepanel-wmewal-scan'/>").appendTo(addonTabContent);
        tabScan.append("<div><b>Active Plug-Ins</b><div id='_wmewalPlugins'></div><hr/>");
        tabScan.append("<div><b>Scan</b><div id='_wmewalOptionsSavedAreas' name='_wmewalSavedAreas'/></div>");
        tabScan.append("<hr/>");
        var divButtons = $("<div/>").appendTo(tabScan);
        divButtons.append("<button class='btn btn-primary' id='_wmewalScan' title='Scan' style='margin-right: 8px'>Scan</button>");
        divButtons.append("<button class='btn btn-primary' id='_wmewalCancel' title='Cancel' disabled='disabled'>Cancel</button>");
        var tabAreas = $("<div class='tab-pane' id='sidepanel-wmewal-areas'/>").appendTo(addonTabContent);
        tabAreas.append("<div id='_wmewalAreasSavedAreas' name='_wmewalSavedAreas'/>");
        var divAreaButtons = $("<div/>").appendTo(tabAreas);
        divAreaButtons.append("<button class='btn btn-primary' id='_wmewalDeleteArea' title='Delete' style='margin-right: 4px'>Delete</button>");
        divAreaButtons.append("<button class='btn btn-primary' id='_wmewalExport' title='Export' style='margin-right: 4px'>Export</button>");
        divAreaButtons.append("<button class='btn btn-primary' id='_wmewalRenameArea' title='Rename'>Rename</button>");
        tabAreas.append("<div style='margin-top: 12px'><b>Add custom area</b>");
        tabAreas.append("<div>From an unsaved area place<div>Name area: <input type='text' id='_wmewalNewAreaName'></div><div>Then <button id='_wmewalAddNewArea' class='btn btn-primary' title='Add'>Add</button></div></div></div>");
        var divImportArea = $("<div style='margin-top: 12px'/>").appendTo(tabAreas);
        divImportArea.append("<b>Import area</b>");
        divImportArea.append("<div><input type='file' id='_wmewalImportFileName' accept='.wkt'/></div><div><button class='btn btn-primary' id='_wmewalImportFile' title='Import'>Import</input></div>");
        tabContent.append(addon);
        updateSavedAreasList();
        $("#_wmewalAddNewArea").on("click", addNewArea);
        $("#_wmewalCancel").on("click", cancel);
        $("#_wmewalScan").on("click", scanArea);
        $("#_wmewalExport").on("click", exportArea);
        $("#_wmewalRenameArea").on("click", renameArea);
        $("#_wmewalDeleteArea").on("click", deleteArea);
        $("#_wmewalImportFile").on("click", importFile);
        $("#_wmewalPlugins").on("click", function (e) {
            $("input[name=_wmewalPlugin]").each(function (ix, item) {
                var i = $(item);
                var id = i.attr("data-id");
                for (var index = 0; index < plugins.length; index++) {
                    if (plugins[index].Id === parseInt(id)) {
                        plugins[index].Active = i.prop("checked");
                    }
                }
            });
            settings.ActivePlugins = [];
            for (var ix = 0; ix < plugins.length; ix++) {
                if (plugins[ix].Active) {
                    settings.ActivePlugins.push(plugins[ix].Title);
                }
            }
            updateSettings();
        });
    }
    function info(text) {
        text = (typeof text !== "undefined" ? text : "");
        $("#wal-info").text(text);
    }
    function showPBInfo(show) {
        if (show) {
            $("#wal-progressBarInfo").show();
        }
        else {
            $("#wal-progressBarInfo").hide();
        }
    }
    function addPluginTab(plugin) {
        var sidepanel = $("#sidepanel-wme-wal");
        var tabs = $("#wmewal-tabs", sidepanel);
        tabs.append("<li><a data-toggle='tab' href='#" + plugin.Id + "'>" + plugin.Title + "</a></li>");
        var tabContent = $("div.tab-content", sidepanel);
        var tab = $("<div class='tab-pane' id='" + plugin.Id + "'/>");
        tab.append(plugin.GetTab());
        tabContent.append(tab);
        if (plugin.TabLoaded) {
            plugin.TabLoaded();
        }
    }
    function updatePluginList() {
        var list = $("#_wmewalPlugins");
        list.empty();
        for (var ix = 0; ix < plugins.length; ix++) {
            var id = "_wmewalPlugin_" + plugins[ix].Id.toString();
            if (ix > 0) {
                list.append("<br/>");
            }
            var c = $("<input type='checkbox' name='_wmewalPlugin'/>")
                .attr({ id: id, title: plugins[ix].Title, "data-id": plugins[ix].Id }).appendTo(list);
            if (plugins[ix].Active) {
                c.attr("checked", "checked");
            }
            list.append($("<label/>").attr("for", id).css("margin-left", "8px").text(plugins[ix].Title));
        }
    }
    function RegisterPlugIn(plugin) {
        var p = plugin;
        var found = false;
        var r;
        do {
            r = Math.ceil(Math.random() * 1000);
            for (var ix = 0; ix < plugins.length; ix++) {
                if (plugins[ix].Id === r) {
                    found = true;
                    break;
                }
            }
        } while (found);
        p.Id = r;
        p.Active = (settings.ActivePlugins.indexOf(plugin.Title) !== -1);
        plugins.push(p);
        updatePluginList();
        addPluginTab(p);
    }
    WMEWAL.RegisterPlugIn = RegisterPlugIn;
    function IsSegmentInArea(segment) {
        return WMEWAL.areaToScan.intersects(segment.geometry);
    }
    WMEWAL.IsSegmentInArea = IsSegmentInArea;
    function getVenueGeometry(venue) {
        if (venue.isPoint()) {
            return venue.getPointGeometry();
        }
        else {
            return venue.getPolygonGeometry();
        }
    }
    function IsVenueInArea(venue) {
        return WMEWAL.areaToScan.intersects(getVenueGeometry(venue));
    }
    WMEWAL.IsVenueInArea = IsVenueInArea;
    function getMapCommentGeometry(mapComment) {
        if (mapComment.isPoint()) {
            return mapComment.getPointGeometry();
        }
        else {
            return mapComment.getPolygonGeometry();
        }
    }
    function IsMapCommentInArea(mapComment) {
        return WMEWAL.areaToScan.intersects(getMapCommentGeometry(mapComment));
    }
    WMEWAL.IsMapCommentInArea = IsMapCommentInArea;
    function updateLayer() {
        var features = [];
        var maLayer = W.map.getLayerByUniqueName(layerName);
        if (maLayer === null || typeof maLayer === "undefined") {
            maLayer = new OL.Layer.Vector("Wide-Angle Lens Areas", {
                uniqueName: layerName
            });
            I18n.translations[I18n.currentLocale()].layers.name[layerName] = "Wide-Angle Lens Areas";
            W.map.addUniqueLayer(maLayer);
            maLayer.setVisibility(false);
        }
        maLayer.removeAllFeatures({
            silent: true
        });
        for (var ixA = 0; ixA < settings.SavedAreas.length; ixA++) {
            var style = {
                strokeColor: "#FF6600",
                strokeOpacity: 0.8,
                strokeWidth: 3,
                fillOpacity: 0.00,
                label: settings.SavedAreas[ixA].name,
                labelOutlineColor: "Black",
                labelOutlineWidth: 3,
                fontSize: 14,
                fontColor: "#FF6600",
                fontOpacity: 0.85,
                fontWeight: "bold"
            };
            features.push(new OL.Feature.Vector(settings.SavedAreas[ixA].geometry.clone(), {
                areaName: settings.SavedAreas[ixA].name
            }, style));
        }
        maLayer.addFeatures(features);
        if (!layerCheckboxAdded) {
            WazeWrap.Interface.AddLayerCheckbox("display", "Wide-Angle Lens Areas", false, function (checked) {
                maLayer.setVisibility(checked);
            });
            layerCheckboxAdded = true;
        }
    }
    // function addLatLonArray(latLonArray, arrayName): void
    // {
    //     let points: Array<OL.Geometry> = [];
    //     for (let i = 0; i < latLonArray.length; i++)
    //     {
    //         points.push(new OL.Geometry.Point(latLonArray[i].lon, latLonArray[i].lat).transform(new OL.Projection("EPSG:4326"), W.map.getProjectionObject()));
    //     }
    //     let ring = new OL.Geometry.LinearRing(points);
    //     let polygon = new OL.Geometry.Polygon([ring]);
    //     savedAreas.push({name: arrayName, geometry: polygon});
    // }
    function addNewArea() {
        var theVenue = null;
        var count = 0;
        for (var v in W.model.venues.objects) {
            if (W.model.venues.objects.hasOwnProperty(v) === false) {
                continue;
            }
            var venue = W.model.venues.objects[v];
            if (venue.isPoint() === true) {
                continue;
            }
            if ($.isNumeric(venue.attributes.id) && parseInt(venue.attributes.id) <= 0) {
                theVenue = venue;
                count++;
            }
        }
        if (count > 1) {
            alert("There must be only one unsaved area place.\n" + count + " detected.\nDraw only one area place to scan.");
            return;
        }
        if (count === 0) {
            alert("You must drawn an area place and not save it.");
            return;
        }
        if (theVenue.geometry.components.length !== 1) {
            alert("Can't parse the geometry");
            return;
        }
        var nameBox = $("#_wmewalNewAreaName")[0];
        if (nameBox.value.trim().length === 0) {
            alert("Please provide a name for the new area.");
            return;
        }
        var savedArea = {
            name: nameBox.value.trim(),
            geometry: theVenue.geometry.clone()
        };
        settings.SavedAreas.push(savedArea);
        updateSavedAreasList();
        if (W.model.actionManager.canUndo()) {
            if (confirm("Undo all edits (OK=Yes, Cancel=No)?")) {
                /* tslint:disable:no-empty */
                while (W.model.actionManager.undo()) {
                }
            }
        }
        return;
    }
    function removeSavedArea(index) {
        if (index >= settings.SavedAreas.length) {
            return;
        }
        if (confirm("Removed saved area?")) {
            settings.SavedAreas.splice(index, 1);
            updateSavedAreasList();
        }
    }
    function updateSavedAreasList() {
        function getCenterFunc(index) {
            return function () {
                var center = settings.SavedAreas[index].geometry.getCentroid();
                var lonlat = new OL.LonLat(center.x, center.y);
                W.map.setCenter(lonlat);
            };
        }
        settings.SavedAreas.sort(function (a, b) {
            return a.name.localeCompare(b.name);
        });
        var list = $("div[name=_wmewalSavedAreas]");
        list.empty();
        list.each(function (eIx, e) {
            for (var ix = 0; ix < settings.SavedAreas.length; ix++) {
                var id = "_wmewalScanArea_" + eIx.toString() + "_" + ix.toString();
                var input = $("<input/>").attr({ type: "radio", name: "_wmewalScanArea", id: id, value: ix.toString() });
                e.appendChild(input[0]);
                var label = $("<label/>").attr("for", id).css("margin-left", "8px").text(settings.SavedAreas[ix].name);
                e.appendChild(label[0]);
                var center = $("<i/>").addClass("fa").addClass("fa-crosshairs").css("margin-left", "4px").on("click", getCenterFunc(ix));
                e.appendChild(center[0]);
                // var div = document.createElement('div');
                // var link = document.createElement('a');
                // link.href = '#';
                // link.onclick = (function (index) {
                //     return function() {
                //         scanArea(index);
                //     };
                // })(ix);
                // link.text = savedAreas[ix].name;
                // div.appendChild(link);
                // e.appendChild(document.createTextNode("\u00A0"));
                // e.appendChild(delLink);
                var br = $("<br/>");
                e.appendChild(br[0]);
            }
        });
        updateSettings();
        updateLayer();
    }
    function updateSettings() {
        if (typeof Storage !== "undefined") {
            var newSettings = {
                SavedAreas: [],
                ActivePlugins: settings.ActivePlugins,
                Version: settings.Version
            };
            for (var ix = 0; ix < settings.SavedAreas.length; ix++) {
                newSettings.SavedAreas.push({
                    name: settings.SavedAreas[ix].name,
                    geometryText: settings.SavedAreas[ix].geometry.toString()
                });
            }
            localStorage[settingsKey] = "~" + WMEWAL.LZString.compressToUTF16(JSON.stringify(newSettings));
        }
    }
    function importFile() {
        var input = $("#_wmewalImportFileName")[0];
        if (input.files.length === 0) {
            alert("Select a file to import.");
            return;
        }
        var fileName = input.files[0].name;
        var fileExt = fileName.split(".").pop();
        var name = fileName.replace("." + fileExt, "");
        var reader = new FileReader();
        reader.onload = function (e) {
            var parser = new OL.Format.WKT();
            var features = parser.read(e.target.result);
            var feature;
            while (features instanceof Array && features.length === 1) {
                features = features[0];
            }
            if (features instanceof OL.Feature.Vector) {
                feature = features;
            }
            else {
                alert("Could not parse geometry.");
                return;
            }
            // Assume geometry is in EPSG:4326 and reproject to Spherical Mercator
            var fromProj = new OL.Projection("EPSG:4326");
            var c = feature.geometry.clone();
            c.transform(fromProj, W.map.getProjectionObject());
            var savedArea = {
                name: name,
                geometry: c
            };
            settings.SavedAreas.push(savedArea);
            updateSavedAreasList();
        };
        reader.readAsText(input.files[0]);
    }
    function getBounds() {
        if (WMEWAL.areaToScan == null) {
            return;
        }
        WMEWAL.areaToScan.calculateBounds();
        var bounds = WMEWAL.areaToScan.getBounds();
        topLeft = new OL.Geometry.Point(bounds.left, bounds.top);
        bottomRight = new OL.Geometry.Point(bounds.right, bounds.bottom);
    }
    function scanExtent() {
        if (cancelled) {
            return;
        }
        logDebug("Scan Extent");
        var extentSegments = [];
        var extentVenues = [];
        // Check to see if the current extent is completely within the area being searched
        // let allIn = true;
        // let vertices = W.map.getExtent().toGeometry().getVertices();
        // for (let ix = 0; ix < vertices.length && allIn; ix++) {
        //     allIn = allIn && geoCollection.intersects(vertices[ix]);
        // }
        // logDebug("Extent is " + (!allIn ? "NOT " : "") + "entirely within area");
        if (needSegments && segments != null) {
            logDebug("Collecting segments");
            for (var seg in W.model.segments.objects) {
                if (segments.indexOf(seg) === -1) {
                    var segment = W.model.segments.get(parseInt(seg));
                    if (segment != null) {
                        segments.push(seg);
                        extentSegments.push(segment);
                    }
                }
            }
            logDebug("Done collecting segments");
        }
        if (needVenues && venues != null) {
            logDebug("Collecting venues");
            for (var ven in W.model.venues.objects) {
                if (venues.indexOf(ven) === -1) {
                    var venue = W.model.venues.get(ven);
                    if (venue != null) {
                        venues.push(ven);
                        extentVenues.push(venue);
                    }
                }
            }
            logDebug("Done collecting venues");
        }
        var promises = [];
        for (var ix = 0; ix < plugins.length; ix++) {
            if (plugins[ix].Active) {
                logDebug("Calling plugin " + plugins[ix].Title);
                if (!cancelled) {
                    promises.push(plugins[ix].ScanExtent(extentSegments, extentVenues));
                }
            }
        }
        if (promises.length > 0) {
            $.when(promises);
        }
        logDebug("Finished scanning extent");
    }
    function moveToNextLocation() {
        logDebug("Move To Next Location");
        var done = false;
        var inGeometry = false;
        do {
            if (WMEWAL.areaToScan == null) {
                done = true;
            }
            else {
                countViewports += 1;
                logDebug("Count viewports = " + countViewports.toString());
                currentX += width;
                if (currentX > bottomRight.x + width) {
                    logDebug("New row");
                    // Start at next row
                    currentX = topLeft.x;
                    currentY -= height;
                    if (currentY < bottomRight.y - height) {
                        done = true;
                    }
                }
                if (!done) {
                    // Check to see if the new window would be within the boundaries of the original area
                    // Create a geometry object for the window boundaries
                    var points = [];
                    points.push(new OL.Geometry.Point(currentX - (width / 2), currentY + (height / 2)));
                    points.push(new OL.Geometry.Point(currentX + (width / 2), currentY + (height / 2)));
                    points.push(new OL.Geometry.Point(currentX - (width / 2), currentY - (height / 2)));
                    points.push(new OL.Geometry.Point(currentX + (width / 2), currentY - (height / 2)));
                    var lr = new OL.Geometry.LinearRing(points);
                    var poly = new OL.Geometry.Polygon([lr]);
                    inGeometry = WMEWAL.areaToScan && WMEWAL.areaToScan.intersects(poly);
                }
            }
            if (!inGeometry) {
                var progress = Math.floor(countViewports / totalViewports * 100);
                pb.update(progress);
            }
        } while (!inGeometry && !done);
        if (done) {
            processComplete();
        }
        else {
            onModelReady(onOperationDone, false, null);
            logDebug("Moving map");
            W.map.setCenter(new OL.LonLat(currentX, currentY));
        }
    }
    function onOperationDone(e) {
        if (!cancelled) {
            scanExtent();
            var progress = Math.floor(countViewports / totalViewports * 100);
            pb.update(progress);
            moveToNextLocation();
        }
    }
    function onModelReady(callback, now, context) {
        var deferModelReady;
        var deferMapReady;
        function modelReadyResolve() {
            logDebug("mergeend, unregistering");
            W.model.events.unregister("mergeend", null, modelReadyResolve);
            deferModelReady.resolve();
        }
        function mapReadyResolve(e) {
            if (e.operation.id === "pending.road_data") {
                logDebug("operationDone, unregistering");
                W.vent.off("operationDone", mapReadyResolve);
                deferMapReady.resolve();
            }
        }
        logDebug("On Model Ready");
        if (typeof callback === "function") {
            context = context || callback;
            if (now && mapReady && modelReady) {
                callback.call(context);
            }
            else {
                deferModelReady = $.Deferred();
                logDebug("Registering for mergeend");
                W.model.events.register("mergeend", null, modelReadyResolve);
                // function (dfd) {
                //     let resolve = function () {
                //         logDebug("mergeend, unregistering");
                //         W.model.events.unregister("mergeend", null, resolve);
                //         dfd.resolve();
                //     };
                //     logDebug("Registering for mergeend");
                //     W.model.events.register("mergeend", null, resolve);
                // });
                deferMapReady = $.Deferred();
                logDebug("Registering for operationDone");
                W.vent.on("operationDone", mapReadyResolve);
                // function (dfd) {
                //     let resolve = function (e) {
                //         if (e.operation.id === "pending.road_data") {
                //             logDebug("operationDone, unregistering");
                //             W.vent.off("operationDone", resolve);
                //             dfd.resolve();
                //         }
                //     };
                //     logDebug("Registing for operationDone");
                //     W.vent.on("operationDone", resolve);
                // });
                var timerSet_1 = true;
                var timer_1 = setTimeout(function () {
                    timerSet_1 = false;
                    // Wait a max of 10 seconds to move the map.  If it hasn't happened by then, it won't happen
                    logDebug("Timeout");
                    mapReadyResolve({ operation: { id: "pending.road_data" } });
                    modelReadyResolve();
                }, 10000);
                $.when(deferMapReady, deferModelReady).
                    then(function () {
                    if (timerSet_1) {
                        clearTimeout(timer_1);
                        timerSet_1 = false;
                    }
                    logDebug("Map and Model are ready");
                    callback.call(context);
                });
            }
        }
    }
    function cancel() {
        cancelled = true;
        for (var ix = 0; ix < plugins.length; ix++) {
            if (plugins[ix].Active && plugins[ix].ScanCancelled) {
                plugins[ix].ScanCancelled();
            }
        }
        resetState();
    }
    function processComplete() {
        pb.update(100);
        logDebug("Process Complete");
        for (var ix = 0; ix < plugins.length; ix++) {
            if (plugins[ix].Active && plugins[ix].ScanComplete) {
                plugins[ix].ScanComplete();
            }
        }
        resetState();
    }
    function resetState() {
        pb.hide();
        showPBInfo(false);
        info("");
        logDebug("Reset state");
        WMEWAL.areaToScan = null;
        // Return to previous state
        if (layerToggle != null) {
            while (layerToggle.length > 0) {
                var ln = layerToggle.pop();
                $("#" + ln).trigger("click");
            }
            layerToggle = null;
        }
        if (currentCenter != null) {
            logDebug("Moving back to original location");
            W.map.setCenter(currentCenter);
        }
        if (currentZoom != null) {
            logDebug("Resetting zoom");
            W.map.zoomTo(currentZoom);
        }
        segments = null;
        venues = null;
        $("#_wmewalCancel").attr("disabled", "disabled");
    }
    function exportArea() {
        var index = -1;
        var nodes = $("input[name=_wmewalScanArea]", "#_wmewalAreasSavedAreas");
        for (var ix = 0; ix < nodes.length; ix++) {
            if (nodes[ix].checked) {
                index = ix;
                break;
            }
        }
        if (index === -1) {
            alert("Please select an area to export.");
            return;
        }
        else if (index >= settings.SavedAreas.length) {
            return;
        }
        var c = new OL.Geometry.Collection([settings.SavedAreas[index].geometry.clone()]);
        // Transform the collection to EPSG:4326
        var toProj = new OL.Projection("EPSG:4326");
        c.transform(W.map.getProjectionObject(), toProj);
        var geoText = c.toString();
        var encodedUri = "data:text/plain;charset=utf-8," + encodeURIComponent(geoText);
        var link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", settings.SavedAreas[index].name + ".wkt");
        var node = document.body.appendChild(link);
        link.click();
        document.body.removeChild(node);
    }
    function deleteArea() {
        var index = -1;
        var nodes = $("input[name=_wmewalScanArea]", "#_wmewalAreasSavedAreas");
        for (var ix = 0; ix < nodes.length; ix++) {
            if (nodes[ix].checked) {
                index = ix;
                break;
            }
        }
        if (index === -1) {
            alert("Please select an area to delete.");
            return;
        }
        else if (index >= settings.SavedAreas.length) {
            return;
        }
        removeSavedArea(index);
    }
    function renameArea() {
        var index = -1;
        var nodes = $("input[name=_wmewalScanArea]", "#_wmewalAreasSavedAreas");
        for (var ix = 0; ix < nodes.length; ix++) {
            if (nodes[ix].checked) {
                index = ix;
                break;
            }
        }
        if (index === -1) {
            alert("Please select an area to rename.");
            return;
        }
        else if (index >= settings.SavedAreas.length) {
            return;
        }
        var newName = prompt("Enter a new name");
        if (newName == null) {
            return;
        }
        settings.SavedAreas[index].name = newName;
        updateSavedAreasList();
    }
    function scanArea() {
        var index = -1;
        var nodes = $("input[name=_wmewalScanArea]", "#_wmewalOptionsSavedAreas");
        for (var ix = 0; ix < nodes.length; ix++) {
            if (nodes[ix].checked) {
                index = ix;
                break;
            }
        }
        if (index === -1) {
            alert("Please select an area to scan.");
            return;
        }
        else if (index >= settings.SavedAreas.length) {
            return;
        }
        WMEWAL.areaToScan = settings.SavedAreas[index].geometry;
        scan(settings.SavedAreas[index].name);
    }
    function scan(name) {
        getBounds();
        if (topLeft == null || bottomRight == null) {
            alert("No bounds");
            return;
        }
        var anyActivePlugins = false;
        needSegments = false;
        needVenues = false;
        var needMapComments = false;
        for (var ix = 0; ix < plugins.length; ix++) {
            if (plugins[ix].Active) {
                anyActivePlugins = true;
                needSegments = needSegments || plugins[ix].SupportsSegments;
                needVenues = needVenues || plugins[ix].SupportsVenues;
                if (plugins[ix].Title === "Map Comments") {
                    needMapComments = true;
                }
            }
        }
        if (!anyActivePlugins) {
            alert("Please make sure at least one plug-in is active.");
            return;
        }
        WMEWAL.areaName = name;
        segments = [];
        venues = [];
        var allOk = true;
        pb = new ProgressBar("#wal-progressBar");
        pb.update(0);
        pb.show();
        showPBInfo(true);
        for (var ix = 0; ix < plugins.length; ix++) {
            if (plugins[ix].Active) {
                info("Initializing plugin " + plugins[ix].Title);
                allOk = allOk && plugins[ix].ScanStarted();
            }
        }
        info("");
        if (!allOk) {
            pb.hide();
            showPBInfo(false);
            return;
        }
        info("Please don't touch anything during the scan");
        $("#_wmewalCancel").removeAttr("disabled");
        // Save current state
        currentCenter = W.map.getCenter();
        currentZoom = W.map.zoom;
        layerToggle = [];
        var groups = $("div.layer-switcher li.group");
        groups.each(function (ix, g) {
            var groupToggle = $(g).children("div.toggler").find("input[type=checkbox]");
            switch ($(groupToggle).attr("id")) {
                case "layer-switcher-group_places":
                    if (needVenues) {
                        if (!$(groupToggle).prop("checked")) {
                            $(groupToggle).trigger("click");
                            layerToggle.push($(groupToggle).attr("id"));
                        }
                        // Loop through each child in the group
                        $(g).find("ul.children > li > div.toggler input[type=checkbox]").each(function (ixChild, c) {
                            switch ($(c).attr("id")) {
                                case "layer-switcher-item_venues":
                                case "layer-switcher-item_residential_places":
                                case "layer-switcher-item_parking_places":
                                    if (!$(c).prop("checked")) {
                                        $(c).trigger("click");
                                        layerToggle.push($(c).attr("id"));
                                    }
                                    break;
                                default:
                                    if ($(c).prop("checked")) {
                                        $(c).trigger("click");
                                        layerToggle.push($(c).attr("id"));
                                    }
                                    break;
                            }
                        });
                    }
                    else {
                        if ($(groupToggle).prop("checked")) {
                            $(groupToggle).trigger("click");
                            layerToggle.push($(groupToggle).attr("id"));
                        }
                    }
                    break;
                case "layer-switcher-group_road":
                    if (needSegments) {
                        if (!$(groupToggle).prop("checked")) {
                            $(groupToggle).trigger("click");
                            layerToggle.push($(groupToggle).attr("id"));
                        }
                        // Loop through each child in the group
                        $(g).find("ul.children > li > div.toggler input[type=checkbox]").each(function (ixChild, c) {
                            switch ($(c).attr("id")) {
                                case "layer-switcher-item_road":
                                    if (!$(c).prop("checked")) {
                                        $(c).trigger("click");
                                        layerToggle.push($(c).attr("id"));
                                    }
                                    break;
                                default:
                                    if ($(c).prop("checked")) {
                                        $(c).trigger("click");
                                        layerToggle.push($(c).attr("id"));
                                    }
                                    break;
                            }
                        });
                    }
                    else {
                        if ($(groupToggle).prop("checked")) {
                            $(groupToggle).trigger("click");
                            layerToggle.push($(groupToggle).attr("id"));
                        }
                    }
                    break;
                case "layer-switcher-group_display":
                    if (needMapComments) {
                        if (!$(groupToggle).prop("checked")) {
                            $(groupToggle).trigger("click");
                            layerToggle.push($(groupToggle).attr("id"));
                        }
                        // Loop through each child in the group
                        $(g).find("ul.children > li > div.toggler input[type=checkbox]").each(function (ixChild, c) {
                            switch ($(c).attr("id")) {
                                case "layer-switcher-item_map_comments":
                                    if (!$(c).prop("checked")) {
                                        $(c).trigger("click");
                                        layerToggle.push($(c).attr("id"));
                                    }
                                    break;
                                default:
                                    if ($(c).prop("checked")) {
                                        $(c).trigger("click");
                                        layerToggle.push($(c).attr("id"));
                                    }
                                    break;
                            }
                        });
                    }
                    else {
                        if ($(groupToggle).prop("checked")) {
                            $(groupToggle).trigger("click");
                            layerToggle.push($(groupToggle).attr("id"));
                        }
                    }
                    break;
                default:
                    if ($(groupToggle).prop("checked")) {
                        $(groupToggle).trigger("click");
                        layerToggle.push($(groupToggle).attr("id"));
                    }
                    break;
            }
        });
        // Reload road layers
        if (!W.model.actionManager.canUndo()) {
            for (var ix = 0; ix < W.map.roadLayers.length; ix++) {
                W.map.roadLayers[ix].redraw(true);
            }
            W.controller.reload();
        }
        var minZoomLevel = 1;
        for (var ix = 0; ix < plugins.length; ix++) {
            if (plugins[ix].Active) {
                if (plugins[ix].MinimumZoomLevel > minZoomLevel) {
                    minZoomLevel = plugins[ix].MinimumZoomLevel;
                }
            }
        }
        WMEWAL.zoomLevel = minZoomLevel;
        W.map.zoomTo(WMEWAL.zoomLevel);
        var extent = W.map.getExtent();
        height = extent.getHeight();
        width = extent.getWidth();
        // Figure out how many horizontal and vertical viewports there are
        var horizontalSpan = Math.floor((bottomRight.x - topLeft.x) / width) + 2;
        var verticalSpan = Math.floor((topLeft.y - bottomRight.y) / height) + 2;
        totalViewports = horizontalSpan * verticalSpan + 1;
        countViewports = 0;
        logDebug("Horizontal span = " + horizontalSpan.toString());
        logDebug("Vertical span = " + verticalSpan.toString());
        logDebug("Total viewports = " + totalViewports.toString());
        currentX = topLeft.x - width;
        currentY = topLeft.y;
        pb.show();
        cancelled = false;
        moveToNextLocation();
    }
    function logDebug(message) {
        if (debug) {
            var t = new Date();
            var timeString = t.getHours().toString() + ":" + t.getMinutes().toString() + ":" +
                t.getSeconds().toString() + ":" + t.getMilliseconds().toString();
            console.log(timeString + ": " + message);
        }
    }
    function WazeRoadTypeToRoadTypeBitmask(roadType) {
        switch (roadType) {
            case 1:
                return RoadType.Street;
            case 2:
                return RoadType.PrimaryStreet;
            case 3:
                return RoadType.Freeway;
            case 4:
                return RoadType.Ramp;
            case 5:
                return RoadType.WalkingTrail;
            case 6:
                return RoadType.MajorHighway;
            case 7:
                return RoadType.MinorHighway;
            case 8:
                return RoadType.Unpaved;
            case 10:
                return RoadType.PedestrianBoardwalk;
            case 15:
                return RoadType.Ferry;
            case 16:
                return RoadType.Stairway;
            case 17:
                return RoadType.PrivateRoad;
            case 18:
                return RoadType.Railroad;
            case 19:
                return RoadType.RunwayTaxiway;
            case 20:
                return RoadType.ParkingLotRoad;
            case 22:
                return RoadType.Alley;
            default:
                return 0;
        }
    }
    WMEWAL.WazeRoadTypeToRoadTypeBitmask = WazeRoadTypeToRoadTypeBitmask;
    function RoadTypeBitmaskToWazeRoadType(roadType) {
        switch (roadType) {
            case RoadType.Street:
                return 1;
            case RoadType.PrimaryStreet:
                return 2;
            case RoadType.Freeway:
                return 3;
            case RoadType.Ramp:
                return 4;
            case RoadType.WalkingTrail:
                return 5;
            case RoadType.MajorHighway:
                return 6;
            case RoadType.MinorHighway:
                return 7;
            case RoadType.Unpaved:
                return 8;
            case RoadType.PedestrianBoardwalk:
                return 10;
            case RoadType.Ferry:
                return 15;
            case RoadType.Stairway:
                return 16;
            case RoadType.PrivateRoad:
                return 17;
            case RoadType.Railroad:
                return 18;
            case RoadType.RunwayTaxiway:
                return 19;
            case RoadType.ParkingLotRoad:
                return 20;
            case RoadType.Alley:
                return 22;
            default:
                return 0;
        }
    }
    WMEWAL.RoadTypeBitmaskToWazeRoadType = RoadTypeBitmaskToWazeRoadType;
    function TranslateRoadType(wazeRoadType) {
        return I18n.t("segment.road_types." + wazeRoadType.toString());
    }
    WMEWAL.TranslateRoadType = TranslateRoadType;
    function GenerateBasePL(lat, lon, zoom) {
        return "https://www.waze.com/editor/?env=" + W.location.code + "&lon=" + lon + "&lat=" + lat + "&zoom=" + zoom;
    }
    WMEWAL.GenerateBasePL = GenerateBasePL;
    function CompareVersions(v1, v2) {
        var v1Parts = v1.split(".");
        var v2Parts = v2.split(".");
        for (; v1Parts.length < v2Parts.length;) {
            v1Parts.push(".0");
        }
        for (; v2Parts.length < v1Parts.length;) {
            v2Parts.push(".0");
        }
        for (var ix = 0; ix < v1Parts.length; ix++) {
            var v1Element = parseInt(v1Parts[ix]);
            var v2Element = parseInt(v2Parts[ix]);
            if (v1Element < v2Element) {
                return -1;
            }
            else if (v1Element > v2Element) {
                return 1;
            }
        }
        return 0;
    }
    WMEWAL.CompareVersions = CompareVersions;
    // Copyright (c) 2013 Pieroxy <pieroxy@pieroxy.net>
    // This work is free. You can redistribute it and/or modify it
    // under the terms of the WTFPL, Version 2
    // For more information see LICENSE.txt or http://www.wtfpl.net/
    //
    // For more information, the home page:
    // http://pieroxy.net/blog/pages/lz-string/testing.html
    //
    // LZ-based compression algorithm, version 1.4.4
    /* tslint:disable */
    WMEWAL.LZString = (function () {
        // private property
        var f = String.fromCharCode;
        var keyStrBase64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
        var keyStrUriSafe = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$";
        var baseReverseDic = {};
        function getBaseValue(alphabet, character) {
            if (!baseReverseDic[alphabet]) {
                baseReverseDic[alphabet] = {};
                for (var i = 0; i < alphabet.length; i++) {
                    baseReverseDic[alphabet][alphabet.charAt(i)] = i;
                }
            }
            return baseReverseDic[alphabet][character];
        }
        var LZString = {
            compressToBase64: function (input) {
                if (input == null)
                    return "";
                var res = LZString._compress(input, 6, function (a) { return keyStrBase64.charAt(a); });
                switch (res.length % 4) {
                    default: // When could this happen ?
                    case 0: return res;
                    case 1: return res + "===";
                    case 2: return res + "==";
                    case 3: return res + "=";
                }
            },
            decompressFromBase64: function (input) {
                if (input == null)
                    return "";
                if (input == "")
                    return null;
                return LZString._decompress(input.length, 32, function (index) { return getBaseValue(keyStrBase64, input.charAt(index)); });
            },
            compressToUTF16: function (input) {
                if (input == null)
                    return "";
                return LZString._compress(input, 15, function (a) { return f(a + 32); }) + " ";
            },
            decompressFromUTF16: function (compressed) {
                if (compressed == null)
                    return "";
                if (compressed == "")
                    return null;
                return LZString._decompress(compressed.length, 16384, function (index) { return compressed.charCodeAt(index) - 32; });
            },
            //compress into uint8array (UCS-2 big endian format)
            compressToUint8Array: function (uncompressed) {
                var compressed = LZString.compress(uncompressed);
                var buf = new Uint8Array(compressed.length * 2); // 2 bytes per character
                for (var i = 0, TotalLen = compressed.length; i < TotalLen; i++) {
                    var current_value = compressed.charCodeAt(i);
                    buf[i * 2] = current_value >>> 8;
                    buf[i * 2 + 1] = current_value % 256;
                }
                return buf;
            },
            //decompress from uint8array (UCS-2 big endian format)
            decompressFromUint8Array: function (compressed) {
                if (compressed == null || compressed === undefined) {
                    return LZString.decompress(compressed);
                }
                else {
                    var buf = new Array(compressed.length / 2); // 2 bytes per character
                    for (var i = 0, TotalLen = buf.length; i < TotalLen; i++) {
                        buf[i] = compressed[i * 2] * 256 + compressed[i * 2 + 1];
                    }
                    var result_1 = [];
                    buf.forEach(function (c) {
                        result_1.push(f(c));
                    });
                    return LZString.decompress(result_1.join(''));
                }
            },
            //compress into a string that is already URI encoded
            compressToEncodedURIComponent: function (input) {
                if (input == null)
                    return "";
                return LZString._compress(input, 6, function (a) { return keyStrUriSafe.charAt(a); });
            },
            //decompress from an output of compressToEncodedURIComponent
            decompressFromEncodedURIComponent: function (input) {
                if (input == null)
                    return "";
                if (input == "")
                    return null;
                input = input.replace(/ /g, "+");
                return LZString._decompress(input.length, 32, function (index) { return getBaseValue(keyStrUriSafe, input.charAt(index)); });
            },
            compress: function (uncompressed) {
                return LZString._compress(uncompressed, 16, function (a) { return f(a); });
            },
            _compress: function (uncompressed, bitsPerChar, getCharFromInt) {
                if (uncompressed == null)
                    return "";
                var i, value, context_dictionary = {}, context_dictionaryToCreate = {}, context_c = "", context_wc = "", context_w = "", context_enlargeIn = 2, // Compensate for the first entry which should not count
                context_dictSize = 3, context_numBits = 2, context_data = [], context_data_val = 0, context_data_position = 0, ii;
                for (var ii_1 = 0; ii_1 < uncompressed.length; ii_1 += 1) {
                    context_c = uncompressed.charAt(ii_1);
                    if (!Object.prototype.hasOwnProperty.call(context_dictionary, context_c)) {
                        context_dictionary[context_c] = context_dictSize++;
                        context_dictionaryToCreate[context_c] = true;
                    }
                    context_wc = context_w + context_c;
                    if (Object.prototype.hasOwnProperty.call(context_dictionary, context_wc)) {
                        context_w = context_wc;
                    }
                    else {
                        if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate, context_w)) {
                            if (context_w.charCodeAt(0) < 256) {
                                for (var i_1 = 0; i_1 < context_numBits; i_1++) {
                                    context_data_val = (context_data_val << 1);
                                    if (context_data_position == bitsPerChar - 1) {
                                        context_data_position = 0;
                                        context_data.push(getCharFromInt(context_data_val));
                                        context_data_val = 0;
                                    }
                                    else {
                                        context_data_position++;
                                    }
                                }
                                value = context_w.charCodeAt(0);
                                for (var i_2 = 0; i_2 < 8; i_2++) {
                                    context_data_val = (context_data_val << 1) | (value & 1);
                                    if (context_data_position == bitsPerChar - 1) {
                                        context_data_position = 0;
                                        context_data.push(getCharFromInt(context_data_val));
                                        context_data_val = 0;
                                    }
                                    else {
                                        context_data_position++;
                                    }
                                    value = value >> 1;
                                }
                            }
                            else {
                                value = 1;
                                for (var i_3 = 0; i_3 < context_numBits; i_3++) {
                                    context_data_val = (context_data_val << 1) | value;
                                    if (context_data_position == bitsPerChar - 1) {
                                        context_data_position = 0;
                                        context_data.push(getCharFromInt(context_data_val));
                                        context_data_val = 0;
                                    }
                                    else {
                                        context_data_position++;
                                    }
                                    value = 0;
                                }
                                value = context_w.charCodeAt(0);
                                for (var i_4 = 0; i_4 < 16; i_4++) {
                                    context_data_val = (context_data_val << 1) | (value & 1);
                                    if (context_data_position == bitsPerChar - 1) {
                                        context_data_position = 0;
                                        context_data.push(getCharFromInt(context_data_val));
                                        context_data_val = 0;
                                    }
                                    else {
                                        context_data_position++;
                                    }
                                    value = value >> 1;
                                }
                            }
                            context_enlargeIn--;
                            if (context_enlargeIn == 0) {
                                context_enlargeIn = Math.pow(2, context_numBits);
                                context_numBits++;
                            }
                            delete context_dictionaryToCreate[context_w];
                        }
                        else {
                            value = context_dictionary[context_w];
                            for (var i_5 = 0; i_5 < context_numBits; i_5++) {
                                context_data_val = (context_data_val << 1) | (value & 1);
                                if (context_data_position == bitsPerChar - 1) {
                                    context_data_position = 0;
                                    context_data.push(getCharFromInt(context_data_val));
                                    context_data_val = 0;
                                }
                                else {
                                    context_data_position++;
                                }
                                value = value >> 1;
                            }
                        }
                        context_enlargeIn--;
                        if (context_enlargeIn == 0) {
                            context_enlargeIn = Math.pow(2, context_numBits);
                            context_numBits++;
                        }
                        // Add wc to the dictionary.
                        context_dictionary[context_wc] = context_dictSize++;
                        context_w = String(context_c);
                    }
                }
                // Output the code for w.
                if (context_w !== "") {
                    if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate, context_w)) {
                        if (context_w.charCodeAt(0) < 256) {
                            for (var i_6 = 0; i_6 < context_numBits; i_6++) {
                                context_data_val = (context_data_val << 1);
                                if (context_data_position == bitsPerChar - 1) {
                                    context_data_position = 0;
                                    context_data.push(getCharFromInt(context_data_val));
                                    context_data_val = 0;
                                }
                                else {
                                    context_data_position++;
                                }
                            }
                            value = context_w.charCodeAt(0);
                            for (var i_7 = 0; i_7 < 8; i_7++) {
                                context_data_val = (context_data_val << 1) | (value & 1);
                                if (context_data_position == bitsPerChar - 1) {
                                    context_data_position = 0;
                                    context_data.push(getCharFromInt(context_data_val));
                                    context_data_val = 0;
                                }
                                else {
                                    context_data_position++;
                                }
                                value = value >> 1;
                            }
                        }
                        else {
                            value = 1;
                            for (var i_8 = 0; i_8 < context_numBits; i_8++) {
                                context_data_val = (context_data_val << 1) | value;
                                if (context_data_position == bitsPerChar - 1) {
                                    context_data_position = 0;
                                    context_data.push(getCharFromInt(context_data_val));
                                    context_data_val = 0;
                                }
                                else {
                                    context_data_position++;
                                }
                                value = 0;
                            }
                            value = context_w.charCodeAt(0);
                            for (var i_9 = 0; i_9 < 16; i_9++) {
                                context_data_val = (context_data_val << 1) | (value & 1);
                                if (context_data_position == bitsPerChar - 1) {
                                    context_data_position = 0;
                                    context_data.push(getCharFromInt(context_data_val));
                                    context_data_val = 0;
                                }
                                else {
                                    context_data_position++;
                                }
                                value = value >> 1;
                            }
                        }
                        context_enlargeIn--;
                        if (context_enlargeIn == 0) {
                            context_enlargeIn = Math.pow(2, context_numBits);
                            context_numBits++;
                        }
                        delete context_dictionaryToCreate[context_w];
                    }
                    else {
                        value = context_dictionary[context_w];
                        for (var i_10 = 0; i_10 < context_numBits; i_10++) {
                            context_data_val = (context_data_val << 1) | (value & 1);
                            if (context_data_position == bitsPerChar - 1) {
                                context_data_position = 0;
                                context_data.push(getCharFromInt(context_data_val));
                                context_data_val = 0;
                            }
                            else {
                                context_data_position++;
                            }
                            value = value >> 1;
                        }
                    }
                    context_enlargeIn--;
                    if (context_enlargeIn == 0) {
                        context_enlargeIn = Math.pow(2, context_numBits);
                        context_numBits++;
                    }
                }
                // Mark the end of the stream
                value = 2;
                for (var i_11 = 0; i_11 < context_numBits; i_11++) {
                    context_data_val = (context_data_val << 1) | (value & 1);
                    if (context_data_position == bitsPerChar - 1) {
                        context_data_position = 0;
                        context_data.push(getCharFromInt(context_data_val));
                        context_data_val = 0;
                    }
                    else {
                        context_data_position++;
                    }
                    value = value >> 1;
                }
                // Flush the last char
                while (true) {
                    context_data_val = (context_data_val << 1);
                    if (context_data_position == bitsPerChar - 1) {
                        context_data.push(getCharFromInt(context_data_val));
                        break;
                    }
                    else
                        context_data_position++;
                }
                return context_data.join('');
            },
            decompress: function (compressed) {
                if (compressed == null)
                    return "";
                if (compressed == "")
                    return null;
                return LZString._decompress(compressed.length, 32768, function (index) { return compressed.charCodeAt(index); });
            },
            _decompress: function (length, resetValue, getNextValue) {
                var dictionary = [], next, enlargeIn = 4, dictSize = 4, numBits = 3, entry = "", result = [], i, w, bits, resb, maxpower, power, c, data = { val: getNextValue(0), position: resetValue, index: 1 };
                for (var i_12 = 0; i_12 < 3; i_12 += 1) {
                    dictionary[i_12] = i_12;
                }
                bits = 0;
                maxpower = Math.pow(2, 2);
                power = 1;
                while (power != maxpower) {
                    resb = data.val & data.position;
                    data.position >>= 1;
                    if (data.position == 0) {
                        data.position = resetValue;
                        data.val = getNextValue(data.index++);
                    }
                    bits |= (resb > 0 ? 1 : 0) * power;
                    power <<= 1;
                }
                switch (next = bits) {
                    case 0:
                        bits = 0;
                        maxpower = Math.pow(2, 8);
                        power = 1;
                        while (power != maxpower) {
                            resb = data.val & data.position;
                            data.position >>= 1;
                            if (data.position == 0) {
                                data.position = resetValue;
                                data.val = getNextValue(data.index++);
                            }
                            bits |= (resb > 0 ? 1 : 0) * power;
                            power <<= 1;
                        }
                        c = f(bits);
                        break;
                    case 1:
                        bits = 0;
                        maxpower = Math.pow(2, 16);
                        power = 1;
                        while (power != maxpower) {
                            resb = data.val & data.position;
                            data.position >>= 1;
                            if (data.position == 0) {
                                data.position = resetValue;
                                data.val = getNextValue(data.index++);
                            }
                            bits |= (resb > 0 ? 1 : 0) * power;
                            power <<= 1;
                        }
                        c = f(bits);
                        break;
                    case 2:
                        return "";
                }
                dictionary[3] = c;
                w = c;
                result.push(c);
                while (true) {
                    if (data.index > length) {
                        return "";
                    }
                    bits = 0;
                    maxpower = Math.pow(2, numBits);
                    power = 1;
                    while (power != maxpower) {
                        resb = data.val & data.position;
                        data.position >>= 1;
                        if (data.position == 0) {
                            data.position = resetValue;
                            data.val = getNextValue(data.index++);
                        }
                        bits |= (resb > 0 ? 1 : 0) * power;
                        power <<= 1;
                    }
                    switch (c = bits) {
                        case 0:
                            bits = 0;
                            maxpower = Math.pow(2, 8);
                            power = 1;
                            while (power != maxpower) {
                                resb = data.val & data.position;
                                data.position >>= 1;
                                if (data.position == 0) {
                                    data.position = resetValue;
                                    data.val = getNextValue(data.index++);
                                }
                                bits |= (resb > 0 ? 1 : 0) * power;
                                power <<= 1;
                            }
                            dictionary[dictSize++] = f(bits);
                            c = dictSize - 1;
                            enlargeIn--;
                            break;
                        case 1:
                            bits = 0;
                            maxpower = Math.pow(2, 16);
                            power = 1;
                            while (power != maxpower) {
                                resb = data.val & data.position;
                                data.position >>= 1;
                                if (data.position == 0) {
                                    data.position = resetValue;
                                    data.val = getNextValue(data.index++);
                                }
                                bits |= (resb > 0 ? 1 : 0) * power;
                                power <<= 1;
                            }
                            dictionary[dictSize++] = f(bits);
                            c = dictSize - 1;
                            enlargeIn--;
                            break;
                        case 2:
                            return result.join('');
                    }
                    if (enlargeIn == 0) {
                        enlargeIn = Math.pow(2, numBits);
                        numBits++;
                    }
                    if (dictionary[c]) {
                        entry = dictionary[c];
                    }
                    else {
                        if (c === dictSize) {
                            entry = w + w.charAt(0);
                        }
                        else {
                            return null;
                        }
                    }
                    result.push(entry);
                    // Add w+entry[0] to the dictionary.
                    dictionary[dictSize++] = w + entry.charAt(0);
                    enlargeIn--;
                    w = entry;
                    if (enlargeIn == 0) {
                        enlargeIn = Math.pow(2, numBits);
                        numBits++;
                    }
                }
            }
        };
        return LZString;
    })();
    /* tslint:enable */
    bootstrap_WideAngleLens();
})(WMEWAL || (WMEWAL = {}));
