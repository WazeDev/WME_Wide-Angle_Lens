/// <reference path="../typescript-typings/globals/openlayers/index.d.ts" />
/// <reference path="../typescript-typings/I18n.d.ts" />
/// <reference path="../typescript-typings/waze.d.ts" />
/// <reference path="../typescript-typings/globals/jquery/index.d.ts" />
/// <reference path="../typescript-typings/globals/geojson/index.d.ts" />
/// <reference path="../typescript-typings/wazewrap.d.ts" />
/// <reference path="../typescript-typings/greasyfork.d.ts" />
// ==UserScript==
// @name                WME Wide-Angle Lens
// @namespace           https://greasyfork.org/en/users/19861-vtpearce
// @description         Scan a large area
// @author              vtpearce and crazycaveman (progress bar from dummyd2 & seb-d59)
// @match               *://*.waze.com/*editor*
// @exclude             *://*.waze.com/user/editor*
// @grant               GM_xmlhttpRequest
// @version             2024.05.17.002
// @copyright           2020 vtpearce
// @license             CC BY-SA 4.0
// @require             https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js
// @updateURL           https://greasyfork.org/scripts/40641-wme-wide-angle-lens/code/WME%20Wide-Angle%20Lens.meta.js
// @downloadURL         https://greasyfork.org/scripts/40641-wme-wide-angle-lens/code/WME%20Wide-Angle%20Lens.user.js
// @connect             https://greasyfork.org
// ==/UserScript==
// @updateURL           https://greasyfork.org/scripts/418291-wme-wide-angle-lens-beta/code/WME%20Wide-Angle%20Lens.meta.js
// @downloadURL         https://greasyfork.org/scripts/418291-wme-wide-angle-lens-beta/code/WME%20Wide-Angle%20Lens.user.js

/* global W, OL, $, WazeWrap, OpenLayers, I18n */
declare var unsafeWindow: Window & typeof globalThis;

namespace WMEWAL {
    const SCRIPT_NAME = GM_info.script.name;
    const SCRIPT_VERSION = GM_info.script.version.toString();
    const DOWNLOAD_URL = GM_info.script.downloadURL;

    const updateText = '<ul>'
        + '<li>Fixes for latest WME release</li>'
        + '</ul>';

    const greasyForkPage = 'https://greasyfork.org/scripts/40641';
    const wazeForumThread = 'https://www.waze.com/forum/viewtopic.php?t=206376';

    const debug = false;

    class ProgressBar {
        private root: JQuery;
        private div: JQuery;
        private information: JQuery;
        private counts: JQuery;
        private streets: number;
        private places: number;
        private mapComments: number;

        constructor(id: string) {
            this.root = $(id);
            this.div = this.root.children('#wal-progressBar')
            this.information = this.root.children("#wal-info");
            this.counts = this.root.children("#wal-counts");
            this.streets = null;
            this.places = null;
            this.mapComments = null;
            this.div.children().hide();
            this.root.children().hide();
        }

        public isShown(): boolean {
            return this.root.is(":visible");
        }

        public show(): void {
            this.root.show();
        }

        public hide(): void {
            this.root.hide();
            this.root.children().hide();
        }

        public update(value: number): void {
            log("debug", "Percent complete = " + value.toString());
            if (value > 100) {
                value = 100;
            }
            if (value === -1) {
                this.div.hide();
                this.div.children().hide();
                return;
            }

            this.div.children(".wal-progressBarBG").css("width", value.toString() + "%");
            this.div.children(".wal-progressBarFG").text(value.toString() + "%");
            this.div.children().show();
            this.div.show();
        }

        public setCount(streets: number, places: number, mapComments: number): void {
            if (streets != null) {
                this.streets = streets;
            }
            if (places != null) {
                this.places = places;
            }
            if (mapComments != null) {
                this.mapComments = mapComments;
            }

            this.updateCounts();
        }

        public addCount(streets: number, places: number, mapComments: number): void {
            if (streets != null) {
                if (this.streets != null) {
                    this.streets += streets;
                } else {
                    this.streets = streets;
                }
            }
            if (places != null) {
                if (this.places != null) {
                    this.places += places;
                } else {
                    this.places = places;
                }
            }
            if (mapComments != null) {
                if (this.mapComments != null) {
                    this.mapComments += mapComments;
                } else {
                    this.mapComments = mapComments;
                }
            }

            this.updateCounts();
        }

        public showInfo(show: boolean): void {
            if (show) {
                this.information.show();
            } else {
                this.information.hide();
            }
        }

        public info(text: string): void {
            text = (typeof text !== "undefined" ? text : "");
            this.information.text(text);
        }

        private updateCounts() : void {
            let outputText = "";
            if (this.streets != null) {
                outputText += `S: ${this.streets.toLocaleString()}`;
            }
            if (this.places != null) {
                outputText += (outputText.length > 0 ? ' ' : '') + `P: ${this.places.toLocaleString()}`;
            }
            if (this.mapComments != null) {
                outputText += (outputText.length > 0 ? ' ' : '') + `MC: ${this.mapComments.toLocaleString()}`;
            }

            this.counts.text(outputText);
            this.counts.show();
        }
    }

    export enum RoadType {
        Unknown = 0,
        Street = 1,
        PrimaryStreet = 2,
        MinorHighway = 4,
        MajorHighway = 8,
        Freeway = 16,
        Ramp = 32,
        PrivateRoad = 64,
        WalkingTrail = 128,
        Unpaved = 256,
        PedestrianBoardwalk = 512,
        Ferry = 1024,
        Stairway = 2048,
        Railroad = 4096,
        RunwayTaxiway = 8192,
        ParkingLotRoad = 16384,
        Alley = 32768
    }

    export enum OutputTo {
        CSV = 1,
        Tab = 2
    }

    enum ScanStatus {
        Continue = 1,
        Complete = 2,
        Abort = 3
    }

    export interface IResults {
        Streets: number;
        Places: number;
        MapComments: number;
    }

    export interface IPlugIn {
        Title: string;
        MinimumZoomLevel: number;
        SupportsSegments: boolean;
        SupportsSuggestedSegments?: boolean;
        SupportsVenues: boolean;
        GetTab(): string;
        TabLoaded(): void;
        ScanExtent(segments: Array<WazeNS.Model.Object.Segment>,
            venues: Array<WazeNS.Model.Object.Venue>,
            suggestedSegments?: Array<WazeNS.Model.Object.SegmentSuggestion>): Promise<IResults>;
        ScanStarted(): boolean;
        ScanComplete(): void;
        ScanCancelled(): void;
    }

    interface ISettings {
        SavedAreas: Array<IArea>;
        ActivePlugins: Array<string>;
        OutputTo: string;
        Version: string;
        showLayer: boolean;
        AddBOM: boolean;
        OutputFields: Array<string>;
    }

    interface IPrivatePlugin extends IPlugIn {
        Active?: boolean;
        Id?: number;
    }

    interface ILayerState {
        layer: string;
        visibility: boolean;
    }

    interface IArea {
        name: string;
        geometry?: OpenLayers.Geometry;
        geometryText?: string;
    }

    let topLeft: OpenLayers.Geometry.Point = null;
    let bottomRight: OpenLayers.Geometry.Point = null;

    export let areaToScan: OpenLayers.Geometry.Collection = null;

    let height: number;
    let width: number;

    // let segments: Array<string> = null;
    // let venues: Array<string> = null;

    export let areaName: string = null;
    export let zoomLevel: number;
    export let outputTo: OutputTo;
    export let addBOM: boolean;
    export let outputFields: Array<string>;
    const defaultOutputFields = ['CreatedEditor','LastEditor','LockLevel','Lat','Lon'];

    let currentLon: number;
    let currentLat: number;
    let currentCenter: OpenLayers.LonLat = null;
    let currentZoom: number = null;
    let layerToggle: Array<string> = null;
    let needSegments = false;
    let needVenues = false;
    let needSuggestedSegments = false;
    let cancelled = false;
    let totalViewports: number;
    let countViewports: number;
    let mapReady = false;
    let modelReady = false;
    let settings: ISettings = null;
    let plugins: Array<IPrivatePlugin> = [];
    const settingsKey = "WMEWAL_Settings";
    const layerName = "WMEWAL_Areas";
    let pb: ProgressBar = null;
    let initCount = 0;
    let layerCheckboxAdded = false;
    let WALMap: OpenLayers.Map;

    function onWmeReady() {
        initCount++;
        if (WazeWrap && WazeWrap.Ready) {
            log('debug','WazeWrap ready.');
            init();
        } else {
            if (initCount < 60) {
                log('debug','WazeWrap not ready. Trying again...');
                setTimeout(onWmeReady, 1000);
            } else {
                log('error', 'WazeWrap not ready. Giving up.');
            }
        }
    }

    function bootstrap() {
        if (W?.userscripts?.state.isReady) {
            onWmeReady();
        } else {
            document.addEventListener('wme-ready', onWmeReady, { once: true });
        }
    }

    function loadScriptUpdateMonitor() {
        let updateMonitor: WazeWrap.Alerts.ScriptUpdateMonitor;
        try {
            updateMonitor = new WazeWrap.Alerts.ScriptUpdateMonitor(SCRIPT_NAME, SCRIPT_VERSION, DOWNLOAD_URL, GM_xmlhttpRequest);
            updateMonitor.start();
        } catch (ex) {
            log('error', ex);
        }
    }

    async function init(): Promise<void> {
        const sandboxed = typeof unsafeWindow !== 'undefined';
        const pageWindow = sandboxed ? unsafeWindow : window;
        const walAvailable = pageWindow.WMEWAL;

        loadScriptUpdateMonitor();

        if (typeof (Storage) !== "undefined") {
            if (localStorage[settingsKey]) {
                let settingsString = localStorage[settingsKey];
                if (settingsString.substring(0, 1) === "~") {
                    // Compressed value - decompress
                    //console.log("Decompress UTF16 settings");
                    settingsString = LZString.decompressFromUTF16(settingsString.substring(1));
                }
                try {
                    settings = JSON.parse(settingsString);
                } catch (e) {}

                if (typeof settings === "undefined" || settings === null) {
                    settings = null;
                    log("debug", "Using old decompress method");
                    localStorage[settingsKey + "Backup"] = localStorage[settingsKey]
                    settingsString = localStorage[settingsKey];

                    if (settingsString.substring(0, 1) === "~") {
                        // Compressed value - decompress
                        settingsString = LZString.decompress(settingsString.substring(1));
                    }
                    try {
                        settings = JSON.parse(settingsString);
                    } catch (e) {}
                    if (typeof settings === "undefined" || settings === null) {
                        log("warning", "Unable to decompress! Using empty settings");
                        outputTo = OutputTo.CSV;
                        addBOM = false;
                        settings = {
                            SavedAreas: [],
                            ActivePlugins: [],
                            OutputTo: "csv",
                            Version: SCRIPT_VERSION,
                            showLayer: false,
                            AddBOM: addBOM,
                            OutputFields: defaultOutputFields
                        };
                    }
                }

                settings.SavedAreas.sort(function (a, b) {
                    return a.name.localeCompare(b.name);
                });

                delete this.settingsString;
                if (!Object.prototype.hasOwnProperty.call(settings, 'AddBOM')) {
                    settings.AddBOM = false;
                }
                if (!Object.prototype.hasOwnProperty.call(settings, 'Version')) {
                    settings.Version = SCRIPT_VERSION;
                }
                if (!Object.prototype.hasOwnProperty.call(settings, 'showLayer')) {
                    settings.showLayer = false;
                }
                if (!Object.prototype.hasOwnProperty.call(settings, 'OutputFields')) {
                    settings.OutputFields = defaultOutputFields;
                }

                for (let ix = 0; ix < settings.SavedAreas.length; ix++) {
                    if (settings.SavedAreas[ix].geometryText) {
                        settings.SavedAreas[ix].geometry = <OpenLayers.Geometry> OpenLayers.Geometry.fromWKT(settings.SavedAreas[ix].geometryText);
                        while ((settings.SavedAreas[ix].geometry.CLASS_NAME === "OL.Geometry.Collection" ||
                                settings.SavedAreas[ix].geometry.CLASS_NAME === "OpenLayers.Geometry.Collection") &&
                                (<OpenLayers.Geometry.Collection> settings.SavedAreas[ix].geometry).components.length === 1) {
                            settings.SavedAreas[ix].geometry = (<OpenLayers.Geometry.Collection> settings.SavedAreas[ix].geometry).components[0];
                        }
                        delete settings.SavedAreas[ix].geometryText;
                    }
                }
            } else if (localStorage["WMEMSL_areaList"]) {
                // Import settings from old MSL script
                const savedAreas = JSON.parse(localStorage["WMEMSL_areaList"]);
                savedAreas.sort(function (a, b) {
                    return a.name.localeCompare(b.name);
                });
                outputTo = OutputTo.CSV;
                addBOM = false;
                settings = {
                    SavedAreas: savedAreas,
                    ActivePlugins: [],
                    OutputTo: "csv",
                    Version: SCRIPT_VERSION,
                    showLayer: false,
                    AddBOM: addBOM,
                    OutputFields: defaultOutputFields
                };
                for (let ix = 0; ix < settings.SavedAreas.length; ix++) {
                    if (settings.SavedAreas[ix].geometryText) {
                        settings.SavedAreas[ix].geometry = <OpenLayers.Geometry> OpenLayers.Geometry.fromWKT(settings.SavedAreas[ix].geometryText);
                        delete settings.SavedAreas[ix].geometryText;
                    }
                }

            } else {
                outputTo = OutputTo.CSV;
                addBOM = false;
                settings = {
                    SavedAreas: [],
                    ActivePlugins: [],
                    OutputTo: "csv",
                    Version: SCRIPT_VERSION,
                    showLayer: false,
                    AddBOM: false,
                    OutputFields: defaultOutputFields
                };
            }
        }

        WazeWrap.Interface.ShowScriptUpdate(SCRIPT_NAME, SCRIPT_VERSION, updateText, greasyForkPage, wazeForumThread);

        let style = document.createElement("style");
        //style.type = "text/css";
        let css = ".wal-heading { font-size: 1.2em; font-weight: bold }";
        css += ".wal-indent { padding-left: 20px }";
        css += ".wal-label { margin-left: 8px; font-weight: normal; margin-bottom: 0px }";
        css += '.wal-check { margin-top: 0px }';
        css += "#wal-progressBarInfo { display: none; width: 90%; float: left; position: absolute; border-top-left-radius: 5px; border-top-right-radius: 5px; border-bottom-right-radius: 5px; border-bottom-left-radius: 5px; margin-bottom: -100%; background-color: #c9e1e9; z-index: 999; margin: 5px; margin-right: 20px; }";
        css += ".wal-progressBarBG { margin-top: 2px; margin-bottom: 2px; margin-left: 2px; margin-right: 2px; padding-bottom: 0px; padding-top: 0px; padding-left: 0px; padding-right: 0px; width: 33%; background-color: #93c4d3; border: 3px rgb(147, 196, 211); border-top-left-radius: 5px; border-top-right-radius: 5px; border-bottom-right-radius: 5px; border-bottom-left-radius: 5px; height: 22px;}";
        css += ".wal-progressBarFG { float: left; position: relative; bottom: 22px; height: 0px; text-align: center; width: 100% }";
        css += ".wal-textbox { width: 100% }";
        css += '#wal-info { text-align: center }';
        css += '#wal-counts { text-align: center }';
        css += '#wal-tabPane { font-size: 10pt }';
        css += "#wal-tabPane hr { border: 1px inset; margin-top: 10px; margin-bottom: 10px }";
        css += "#wal-tabPane .tab-pane { margin-left: -15px }";
        css += '#wal-tabPane .tab-pane table { width: 100%; table-layout: fixed }';
        style.innerHTML = css;
        document.body.appendChild(style);

        log('log', 'Initialized');

        await makeTab();

        //recreate tab here
        // Editing mode changed to/from event mode

        if (W.app.modeController) {
            W.app.modeController.model.bind("change:mode", function (model, modeId) {
                if (modeId === 0 && $("#wal-tabPane").length === 0) {
                    log("debug", "Mode changed");
                    recreateTab();
                }
            });
        }

        // Unit switched (imperial/metric)
        if (W.prefs) {
            W.prefs.on("change:isImperial", recreateTab);
        }

        // Create map object
        WALMap = W.map.getOLMap();

        if (!walAvailable) {
            pageWindow.WMEWAL = WMEWAL;
        }
        if (sandboxed) window.WMEWAL = WMEWAL;
    }

    async function makeTab(): Promise<void> {
        const { tabLabel, tabPane } = W.userscripts.registerSidebarTab('WMEWAL');

        tabLabel.innerText = 'WAL';
        tabLabel.title = 'Wide-Angle Lens';

        // const userTabs = $("#user-info");
        // const navTabs = $("ul.nav-tabs", userTabs).filter(":first");
        // const tabContent = $(".tab-content", userTabs).filter(":first");

        // navTabs.append("<li><a href='#sidepanel-wme-wal' data-toggle='tab'>WAL</a></li>");

        const tab = $("<div id='wal-tabPane'><h4>Wide-Angle Lens <span style='font-size:11px;'>v"+ SCRIPT_VERSION +"</span></h4></div>");

        // const addon = $("").appendTo(tab);

        const pbi = $("<div/>").attr("id", "wal-progressBarInfo").addClass("wal-ProgressBarInfo").appendTo(tab);

        const pb$ = $("<div/>").attr("id", "wal-progressBar").css({ width: "100%", display: "none" }).appendTo(pbi);
        pb$.append($("<div/>").addClass("wal-progressBarBG"));
        pb$.append($("<span/>").addClass("wal-progressBarFG").text("100%"));
        pbi.append("<div id='wal-info'/>");
        pbi.append("<div id='wal-counts'/>");

        const addonTabs = $("<ul id='wmewal-tabs' class='nav nav-tabs' style='width: 95%;'/>").appendTo(tab);
        addonTabs.append("<li class='active'><a data-toggle='tab' href='#sidepanel-wmewal-scan'>Scan</a></li>");
        addonTabs.append("<li><a data-toggle='tab' href='#sidepanel-wmewal-areas'>Areas</a></li>");
        addonTabs.append("<li><a data-toggle='tab' href='#sidepanel-wmewal-output'>Output</a></li>");

        const addonTabContent = $("<div class='tab-content'/>").appendTo(tab);
        const tabScan = $("<div class='tab-pane active' id='sidepanel-wmewal-scan'/>").appendTo(addonTabContent);
        tabScan.append("<div><b>Output to: </b><select class='form-control' id='_wmewalScanOutputTo'><option value='csv'>CSV File</option><option value='tab'>Browser Tab</option>" +
        "<option value='both'>Both CSV File and Browser Tab</option></select></div>");
        tabScan.append("<div><input type='checkbox' id='_wmewalAddBOM'><label for='_wmewalAddBOM' class='wal-label'>Add Byte Order Mark to CSV</label></div><hr/>")
        tabScan.append("<div><b>Active Plug-Ins</b><div id='_wmewalPlugins'></div>");
        tabScan.append("<div><b>Scan</b><div id='_wmewalOptionsSavedAreas' name='_wmewalSavedAreas'/></div>");
        tabScan.append("<hr/>");

        const divButtons = $("<div/>").appendTo(tabScan);
        divButtons.append("<button class='btn btn-primary' id='_wmewalScan' title='Scan' style='margin-right: 8px'>Scan</button>");
        divButtons.append("<button class='btn btn-primary' id='_wmewalCancel' title='Cancel' disabled='disabled'>Cancel</button>");

        const tabAreas = $("<div class='tab-pane' id='sidepanel-wmewal-areas'/>").appendTo(addonTabContent);
        tabAreas.append("<div id='_wmewalAreasSavedAreas' name='_wmewalSavedAreas'/>");

        const divAreaButtons = $("<div/>").appendTo(tabAreas);
        divAreaButtons.append("<button class='btn btn-primary' id='_wmewalDeleteArea' title='Delete' style='margin-right: 4px'>Delete</button>");
        divAreaButtons.append("<button class='btn btn-primary' id='_wmewalExport' title='Export' style='margin-right: 4px'>Export</button>");
        divAreaButtons.append("<button class='btn btn-primary' id='_wmewalRenameArea' title='Rename'>Rename</button>");

        tabAreas.append("<div style='margin-top: 12px'><b>Add custom area</b>");
        tabAreas.append("<div>From an unsaved area place<div>Name area: <input type='text' id='_wmewalNewAreaName'></div><div>Then <button id='_wmewalAddNewArea' class='btn btn-primary' title='Add'>Add</button></div></div></div>");

        const divImportArea = $("<div style='margin-top: 12px'/>").appendTo(tabAreas);
        divImportArea.append("<b>Import area</b>");
        divImportArea.append("<div><input type='file' id='_wmewalImportFileName' accept='.wkt'/></div><div><button class='btn btn-primary' id='_wmewalImportFile' title='Import'>Import</input></div>");

        const tabOutput = $("<div class='tab-pane' id='sidepanel-wmewal-output'/>").appendTo(addonTabContent);
        tabOutput.append('<div>Select optional fields to include in the output. Fewer fields may result in fewer lines of output as segments can be combined. Note that some fields will automatically be included if they are specified in filters.</div>');
        const divFields = $('<div/>').appendTo(tabOutput);
        const selectFields = $("<select name='outputFields' id='_wmewalOutputFields' multiple style='width: 100%; height: 10em'/>").appendTo(divFields);
        let outputField = $("<option value='CreatedEditor'>Created By</option>").appendTo(selectFields);
        if (settings.OutputFields.indexOf('CreatedEditor') > -1) {
            outputField.attr('selected', 'selected');
        }
        outputField = $("<option value='LastEditor'>Updated By</option>").appendTo(selectFields);
        if (settings.OutputFields.indexOf('LastEditor') > -1) {
            outputField.attr('selected', 'selected');
        }
        outputField = $("<option value='LockLevel'>Lock Level</option>").appendTo(selectFields);
        if (settings.OutputFields.indexOf('LockLevel') > -1) {
            outputField.attr('selected', 'selected');
        }
        outputField = $("<option value='Lat'>Latitude</option>").appendTo(selectFields);
        if (settings.OutputFields.indexOf('Lat') > -1) {
            outputField.attr('selected', 'selected');
        }
        outputField = $("<option value='Lon'>Longitude</option>").appendTo(selectFields);
        if (settings.OutputFields.indexOf('Lon') > -1) {
            outputField.attr('selected', 'selected');
        }

        tabPane.innerHTML = $(tab)[0].outerHTML;

        await W.userscripts.waitForElementConnected(tabPane);

        $("#_wmewalScanOutputTo").val(settings.OutputTo || "csv");
        outputTo = parseOutputTo(settings.OutputTo || "csv");

        $('#_wmewalAddBOM').prop('checked', settings.AddBOM);
        addBOM = settings.AddBOM;

        updateSavedAreasList();

        $("#_wmewalScanOutputTo").on("change", updateSettings);
        $('#_wmewalAddBOM').on('change', updateSettings);
        $("#_wmewalAddNewArea").on("click", addNewArea);
        $("#_wmewalCancel").on("click", cancelScan);
        $("#_wmewalScan").on("click", scanArea);
        $("#_wmewalExport").on("click", exportArea);
        $("#_wmewalRenameArea").on("click", renameArea);
        $("#_wmewalDeleteArea").on("click", deleteArea);
        $("#_wmewalImportFile").on("click", importFile);
        $('#_wmewalOutputFields').on('change', updateSettings);
        $("#_wmewalPlugins").on("click", function (e) {
            $("input[name=_wmewalPlugin]").each(function (ix, item) {
                const i = $(item);
                const id = i.attr("data-id");
                for (let index = 0; index < plugins.length; index++) {
                    if (plugins[index].Id === parseInt(id)) {
                        plugins[index].Active = i.prop("checked");
                    }
                }
            });
            settings.ActivePlugins = [];
            for (let ix = 0; ix < plugins.length; ix++) {
                if (plugins[ix].Active) {
                    settings.ActivePlugins.push(plugins[ix].Title);
                }
            }
            updateSettings();
        });
    }

    async function recreateTab(): Promise<void> {
        log("Debug","Tab stuff");
        W.userscripts.removeSidebarTab('WMEWAL');
        await makeTab();
        plugins.forEach(function (plugin) {
            log("Debug","Running for plugin: " + plugin.Title);
            updatePluginList();
            addPluginTab(plugin);
        });
    }

    function info(text: string): void {
        text = (typeof text !== "undefined" ? text : "");
        $("#wal-info").text(text);
    }

    function showPBInfo(show: boolean): void {
        if (show) {
            $("#wal-progressBarInfo").show();
        } else {
            $("#wal-progressBarInfo").hide();
        }
    }

    function addPluginTab(plugin: IPrivatePlugin): void {
        const sidepanel = $("#wal-tabPane");

        const tabs = $("#wmewal-tabs", sidepanel);

        tabs.append("<li><a data-toggle='tab' href='#" + plugin.Id + "'>" + plugin.Title + "</a></li>");

        const tabContent = $("div.tab-content", sidepanel);
        const tab = $("<div class='tab-pane' id='" + plugin.Id + "'/>");
        tab.append(plugin.GetTab());
        tabContent.append(tab);
        if (plugin.TabLoaded) {
            plugin.TabLoaded();
        }
    }

    function updatePluginList(): void {
        const list = $("#_wmewalPlugins");
        list.empty();

        for (let ix = 0; ix < plugins.length; ix++) {
            const id = "_wmewalPlugin_" + plugins[ix].Id.toString();
            if (ix > 0) {
                list.append("<br/>");
            }
            const c = $("<input type='checkbox' name='_wmewalPlugin'/>")
                .attr({ id: id, title: plugins[ix].Title, "data-id": plugins[ix].Id }).appendTo(list);
            if (plugins[ix].Active) {
                c.attr("checked", "checked");
            }
            list.append($("<label/>").attr("for", id).addClass('wal-label').text(plugins[ix].Title));
        }
    }

    export function RegisterPlugIn(plugin: IPlugIn): void {
        const p: IPrivatePlugin = plugin;

        let found = false;
        let r: number;
        do {
            r = Math.ceil(Math.random() * 1000);
            for (let ix = 0; ix < plugins.length; ix++) {
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

    export function IsSegmentInArea(segment: WazeNS.Model.Object.Segment | WazeNS.Model.Object.SegmentSuggestion): boolean {
        return areaToScan.intersects(segment.getAttribute('geometry'));
    }

    function getVenueGeometry(venue: WazeNS.Model.Object.Venue): OpenLayers.Geometry {
        if (venue.isPoint()) {
            return venue.getOLGeometry();
        } else {
            return venue.getOLGeometry();
        }
    }

    export function IsVenueInArea(venue: WazeNS.Model.Object.Venue): boolean {
            return areaToScan.intersects(getVenueGeometry(venue));
    }

    function getMapCommentGeometry(mapComment: WazeNS.Model.Object.MapComment): OpenLayers.Geometry {
        if (mapComment.isPoint()) {
            return mapComment.getOLGeometry();
        } else {
            return mapComment.getOLGeometry();
        }
    }

    export function IsMapCommentInArea(mapComment: WazeNS.Model.Object.MapComment): boolean {
        return areaToScan.intersects(getMapCommentGeometry(mapComment));
    }

    function updateLayer(): void {
        const features: Array<OpenLayers.Feature.Vector> = [];

        let maLayer = W.map.getLayerByName(layerName);
        if (maLayer === null || typeof maLayer === "undefined") {
            maLayer = new OpenLayers.Layer.Vector(layerName, {});
            I18n.translations[I18n.currentLocale()].layers.name[layerName] = "Wide-Angle Lens Areas";
            W.map.addLayer(maLayer);
            // W.map.addUniqueLayer(maLayer);
            maLayer.setVisibility(settings.showLayer);
        }

        maLayer.removeAllFeatures({
            silent: true
        });

        for (let ixA = 0; ixA < settings.SavedAreas.length; ixA++) {
            const style = {
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
            features.push(new OpenLayers.Feature.Vector(settings.SavedAreas[ixA].geometry.clone(), {
                areaName: settings.SavedAreas[ixA].name,
            }, style));
        }

        maLayer.addFeatures(features);

        if (!layerCheckboxAdded) {
            WazeWrap.Interface.AddLayerCheckbox("display", "Wide-Angle Lens Areas", settings.showLayer, function (checked) {
                maLayer.setVisibility(checked);
                settings.showLayer = checked;
                updateSettings();
            });
            layerCheckboxAdded = true;
        }
    }

    // function addLatLonArray(latLonArray, arrayName): void
    // {
    //     let points: Array<OpenLayers.Geometry> = [];
    //     for (let i = 0; i < latLonArray.length; i++)
    //     {
    //         points.push(new OpenLayers.Geometry.Point(latLonArray[i].lon, latLonArray[i].lat).transform(new OpenLayers.Projection("EPSG:4326"), W.map.getProjectionObject()));
    //     }

    //     let ring = new OpenLayers.Geometry.LinearRing(points);
    //     let polygon = new OpenLayers.Geometry.Polygon([ring]);

    //     savedAreas.push({name: arrayName, geometry: polygon});
    // }

    function addNewArea(): void {
        let theVenue: WazeNS.Model.Object.Venue = null;
        let count = 0;
        for (let v in W.model.venues.objects) {
            if (W.model.venues.objects.hasOwnProperty(v) === false) {
                continue;
            }
            const venue = W.model.venues.objects[v];
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

        if (theVenue.getAttribute('geometry').components.length !== 1) {
            alert("Can't parse the geometry");
            return;
        }

        const nameBox = <HTMLInputElement> $("#_wmewalNewAreaName")[0];

        if (nameBox.value.trim().length === 0) {
            alert("Please provide a name for the new area.");
            return;
        }

        const savedArea: IArea = {
            name: nameBox.value.trim(),
            geometry: theVenue.getAttribute('geometry').clone()
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

    function removeSavedArea(index: number): void {
        if (index >= settings.SavedAreas.length) {
            return;
        }

        if (confirm("Removed saved area?")) {
            settings.SavedAreas.splice(index, 1);

            updateSavedAreasList();
        }
    }

    function updateSavedAreasList(): void {
        function getCenterFunc(index: number): any {
            return function () {
                const center = settings.SavedAreas[index].geometry.getCentroid();
                const lonlat = new OpenLayers.LonLat(center.x, center.y);
                W.map.moveTo(lonlat);
                // W.map.setCenter(lonlat);
            };
        }

        settings.SavedAreas.sort(function (a, b) {
            return a.name.localeCompare(b.name);
        });

        const list = $("div[name=_wmewalSavedAreas]");
        list.empty();

        list.each(function (eIx, e) {
            for (let ix = 0; ix < settings.SavedAreas.length; ix++) {
                const id = "_wmewalScanArea_" + eIx.toString() + "_" + ix.toString();
                const input = $("<input/>").attr({ type: "radio", name: "_wmewalScanArea", id: id, value: ix.toString() });
                e.appendChild(input[0]);

                const label = $("<label/>").attr("for", id).addClass('wal-label').text(settings.SavedAreas[ix].name);
                e.appendChild(label[0]);

                const center = $("<i/>").addClass("fa").addClass("fa-crosshairs").css("margin-left", "4px").on("click", getCenterFunc(ix));
                e.appendChild(center[0]);

                // const div = document.createElement('div');
                // const link = document.createElement('a');
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

                const br = $("<br/>");
                e.appendChild(br[0]);
            }
            if (e.id != '_wmewalAreasSavedAreas') {
                const ix = 999;
                const id = `wmewalScanArea_${eIx}_${ix}`;
                const input = $("<input/>").attr({ type: "radio", name: "_wmewalScanArea", id: id, value: ix.toString() });
                e.appendChild(input[0]);
                const label = $("<label/>").attr("for", id).addClass('wal-label').text('Current window');
                e.appendChild(label[0]);
            }
        });

        updateSettings();
        updateLayer();
    }

    function updateSettings(): void {
        if (typeof Storage !== "undefined") {
            outputTo = parseOutputTo($("#_wmewalScanOutputTo").val());
            addBOM = $('#_wmewalAddBOM').prop('checked');

            // Get optional fields to include in output
            outputFields = $('#_wmewalOutputFields option:selected').map(function () { return $(this).attr('value')}).get();

            const newSettings: ISettings = {
                SavedAreas: [],
                ActivePlugins: settings.ActivePlugins,
                OutputTo: $("#_wmewalScanOutputTo").val(),
                Version: settings.Version,
                showLayer: settings.showLayer,
                AddBOM: addBOM,
                OutputFields: outputFields
            };
            for (let ix = 0; ix < settings.SavedAreas.length; ix++) {
                newSettings.SavedAreas.push({
                    name: settings.SavedAreas[ix].name,
                    geometryText: settings.SavedAreas[ix].geometry.toString()
                });
            }
            localStorage[settingsKey] = "~" + LZString.compressToUTF16(JSON.stringify(newSettings));
        }
    }

    function importFile(): void {
        const input = <HTMLInputElement> $("#_wmewalImportFileName")[0];
        if (input.files.length === 0) {
            alert("Select a file to import.");
            return;
        }

        const fileName = input.files[0].name;
        const fileExt = fileName.split(".").pop();
        const name = fileName.replace("." + fileExt, "");

        const reader = new FileReader();
        reader.onload = function (e) {
            const parser = new OpenLayers.Format.WKT();
            let features = parser.read(<string>(<FileReader> e.target).result);

            let feature: OpenLayers.Feature.Vector;
            while (features instanceof Array && (<OpenLayers.Feature.Vector[]> features).length === 1) {
                features = features[0];
            }
            if (features instanceof OpenLayers.Feature.Vector) {
                feature = <OpenLayers.Feature.Vector> features;
            } else {
                alert("Could not parse geometry.");
                return;
            }
            // Assume geometry is in EPSG:4326 and reproject to Spherical Mercator
            const fromProj = new OpenLayers.Projection("EPSG:4326");
            const c = <OpenLayers.Geometry.Collection> feature.geometry.clone();
            c.transform(fromProj, W.map.getProjectionObject());

            const savedArea: IArea = {
                name: name,
                geometry: c
            };
            settings.SavedAreas.push(savedArea);
            updateSavedAreasList();
        };

        reader.readAsText(input.files[0]);
    }

    function getBounds(): void {
        if (areaToScan == null) {
            return;
        }

        areaToScan.calculateBounds();
        const bounds = areaToScan.getBounds();
        topLeft = new OpenLayers.Geometry.Point(bounds.left, bounds.top);
        bottomRight = new OpenLayers.Geometry.Point(bounds.right, bounds.bottom);
    }

    // function onOperationDone(context: any): void {
    //     log("Debug","onOperationDone started");
    //     // Handle situation where onOperationDone is triggered twice.
    //     if (!cancelled) {
    //         scanExtent()
    //             .done(function () {
    //                 log("Debug","scanExtent deferred done.");
    //                 let progress = Math.floor(countViewports / totalViewports * 100);
    //                 pb.update(progress);

    //                 moveToNextLocation();
    //             })
    //             .fail(function() {
    //                 log("Debug","scanExtent deferred failed.");
    //                 alert("There was a problem with one of the plugins and the scan is being canceled.");
    //                 cancel();
    //             });
    //     }
    // }

    function onModelReadyWW(): Promise<void> {
        return new Promise<void>(resolve => {
            WazeWrap.Model.onModelReady(function () {
                resolve();
            }, false, null);
        });
    }

    function onModelReady(now: boolean): Promise<any> {
        const modelPromise: Promise<void> = new Promise(resolve => {
            const mergeend = function () {
                resolve();
                W.model.events.unregister("mergeend", null, mergeend);
            };
            W.model.events.register("mergeend", null, mergeend);
        });

        const mapPromise : Promise<void> = new Promise(resolve => {
            const operationDone = function () {
                resolve();
                W.app.layout.model.off('operationDone', operationDone);
            };
            W.app.layout.model.on('operationDone', operationDone);
        });

        // const featuresPromise : Promise<void> = new Promise(resolve => {
        //     const loadingFeatures = function () {
        //         resolve();
        //         W.app.layout.model.off('loadingFeatures', loadingFeatures);
        //     };
        //     W.app.layout.model.on('loadingFeatures', loadingFeatures);
        // });

        if (now && WazeWrap.Util.mapReady() && WazeWrap.Util.modelReady()) {
            return Promise.resolve();
        } else {
            return Promise.all([modelPromise, mapPromise]).then(() => {
                console.log('All promises resolved');
            });
        }
    };

    async function waitFeaturesLoaded() {
         var ldf;
         for (let j=0; j<100; j++) {
             ldf = W.app.layout.model.attributes.loadingFeatures;
             if (!ldf) break;
             //log("debug", "wait for features " + j);
             await new Promise(r => setTimeout(r,200));
             }
         if (!ldf) {
             await new Promise(r => setTimeout(r,50));
             //log("debug", "features loaded" );
         }
     }
 
    function cancelScan(): void {
        cancelled = true;
    }

    function cancel(): void {
        for (let ix = 0; ix < plugins.length; ix++) {
            if (plugins[ix].Active && plugins[ix].ScanCancelled) {
                try {
                    plugins[ix].ScanCancelled();
                } catch (e) {
                    log("warning",`Trouble cancelling plugin ${plugins[ix].Title}\n${e.message}`);
                }
            }
        }

        resetState();
    }

    function processComplete(): void {
        pb.update(100);

        for (let ix = 0; ix < plugins.length; ix++) {
            if (plugins[ix].Active && plugins[ix].ScanComplete) {
                plugins[ix].ScanComplete();
            }
        }

        resetState();
    }

    function alertBeforeClose(e: any): boolean {
        if (areaToScan !== null) {
            log("Debug",'Alerting user before closing page');
            e.preventDefault();
            e.returnValue = 'Scan running. Cancel and leave the page?';
            return e.returnValue;
        } else {
            return false;
        }
    }

    function resetState() {
        pb.hide();
        pb.showInfo(false);
        pb.info("");

        areaToScan = null;

        // Return to previous state
        if (layerToggle != null) {
            while (layerToggle.length > 0) {
                const ln = layerToggle.pop();
                $("#" + ln).trigger("click");
            }

            layerToggle = null;
        }
        if (currentCenter != null) {
            log("Debug","Moving back to original location");
            W.map.moveTo(currentCenter);
            // W.map.setCenter(currentCenter);
        }
        if (currentZoom != null) {
            log("Debug","Resetting zoom");
            WALMap.zoomTo(currentZoom);
        }

        // segments = null;
        // venues = null;

        $("#_wmewalCancel").attr("disabled", "disabled");
        // Remove listeners for unloading page
        window.removeEventListener('beforeunload', alertBeforeClose);
        window.removeEventListener('unload', cancel);

    }

    function exportArea() {
        let index = -1;
        const nodes = $("input[name=_wmewalScanArea]", "#_wmewalAreasSavedAreas");
        for (let ix = 0; ix < nodes.length; ix++) {
            if ((<HTMLInputElement> nodes[ix]).checked) {
                index = ix;
                break;
            }
        }

        if (index === -1) {
            alert("Please select an area to export.");
            return;
        } else if (index >= settings.SavedAreas.length) {
            return;
        }

        const c = new OpenLayers.Geometry.Collection([settings.SavedAreas[index].geometry.clone()]);
        // Transform the collection to EPSG:4326
        const toProj = new OpenLayers.Projection("EPSG:4326");
        c.transform(W.map.getProjectionObject(), toProj);

        const geoText = c.toString();
        const encodedUri = "data:text/plain;charset=utf-8," + encodeURIComponent(geoText);
        const link = <HTMLAnchorElement> document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", settings.SavedAreas[index].name + ".wkt");
        const node = document.body.appendChild(link);
        link.click();
        document.body.removeChild(node);
    }

    function deleteArea() {
        let index = -1;
        const nodes = $("input[name=_wmewalScanArea]", "#_wmewalAreasSavedAreas");
        for (let ix = 0; ix < nodes.length; ix++) {
            if ((<HTMLInputElement> nodes[ix]).checked) {
                index = ix;
                break;
            }
        }

        if (index === -1) {
            alert("Please select an area to delete.");
            return;
        } else if (index >= settings.SavedAreas.length) {
            return;
        }

        removeSavedArea(index);
    }

    function renameArea() {
        let index = -1;
        const nodes = $("input[name=_wmewalScanArea]", "#_wmewalAreasSavedAreas");
        for (let ix = 0; ix < nodes.length; ix++) {
            if ((<HTMLInputElement> nodes[ix]).checked) {
                index = ix;
                break;
            }
        }

        if (index === -1) {
            alert("Please select an area to rename.");
            return;
        } else if (index >= settings.SavedAreas.length) {
            return;
        }

        const newName = prompt("Enter a new name");
        if (newName == null) {
            return;
        }

        settings.SavedAreas[index].name = newName;
        updateSavedAreasList();
    }

    async function scanArea(): Promise<void> {
        let index = -1;
        const nodes = $("input[name=_wmewalScanArea]", "#_wmewalOptionsSavedAreas");
        for (let ix = 0; ix < nodes.length; ix++) {
            if ((<HTMLInputElement> nodes[ix]).checked) {
                index = ix;
                break;
            }
        }

        if (index === -1) {
            alert("Please select an area to scan.");
            return;
        } else if (index > settings.SavedAreas.length) {
            return;
        }

        let name: string;
        if (index == settings.SavedAreas.length) {
            // Scanning current window
            areaToScan = <OpenLayers.Geometry.Collection> W.map.getExtent().toGeometry();
            name = 'Current window';
        } else {
            areaToScan = <OpenLayers.Geometry.Collection> settings.SavedAreas[index].geometry;
            name = settings.SavedAreas[index].name;
        }

        await scan(name);
    }

    async function scan(name: string): Promise<void> {
        getBounds();

        if (topLeft == null || bottomRight == null) {
            alert("No bounds");
            return;
        }

        let anyActivePlugins = false;
        for (let ix = 0; ix < plugins.length; ix++) {
            if (plugins[ix].Active) {
                anyActivePlugins = true;
                break;
            }
        }

        if (!anyActivePlugins) {
            alert("Please make sure at least one plug-in is active.");
            return;
        }

        areaName = name;

        // segments = [];
        // venues = [];

        let allOk = true;

        pb = new ProgressBar("#wal-progressBarInfo");
        pb.update(0);
        pb.show();
        pb.showInfo(true);

        for (let ix = 0; ix < plugins.length; ix++) {
            if (plugins[ix].Active) {
                pb.info("Initializing plugin " + plugins[ix].Title);
                allOk = allOk && plugins[ix].ScanStarted();
            }
        }

        pb.info("");

        if (!allOk) {
            pb.hide();
            return;
        }

        needSegments = false;
        needVenues = false;
        needSuggestedSegments = false;
        let needMapComments = false;
        for (let ix = 0; ix < plugins.length; ix++) {
            if (plugins[ix].Active) {
                needSegments = needSegments || plugins[ix].SupportsSegments;
                needVenues = needVenues || plugins[ix].SupportsVenues;
                needSuggestedSegments = needSuggestedSegments || plugins[ix].SupportsSuggestedSegments;
                if (plugins[ix].Title === "Map Comments") {
                    needMapComments = true;
                }
            }
        }

        pb.info("Please don't touch anything during the scan");

        $("#_wmewalCancel").removeAttr("disabled");

        // Alert user if they try to leave the page before scan is finished
        window.addEventListener('beforeunload', alertBeforeClose);
        //Cleanup when closing page
        window.addEventListener('unload', cancel);

        // Save current state
        currentCenter = W.map.getCenter();
        currentZoom = W.map.zoom;
        layerToggle = [];

        const groups = $("div.layer-switcher li.group");
        groups.each(function (ix, g) {
            const groupToggle = $(g).find("wz-toggle-switch");
            if (groupToggle.length > 0) {
                switch ($(groupToggle).attr("id")) {
                    case "layer-switcher-group_places":
                        if (needVenues) {
                            if (!$(groupToggle).prop("checked")) {
                                $(groupToggle).trigger("click");
                                layerToggle.push($(groupToggle).attr("id"));
                            }
                            // Loop through each child in the group
                            $(g).find("ul > li > wz-checkbox").each(function (ixChild, c) {
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
                        } else {
                            if ($(groupToggle).prop("checked")) {
                                $(groupToggle).trigger("click");
                                layerToggle.push($(groupToggle).attr("id"));
                            }
                        }
                        break;
                    case "layer-switcher-group_road":
                        if ($(groupToggle).prop("checked")) {
                            $(groupToggle).trigger("click");
                            layerToggle.push($(groupToggle).attr("id"));
                        }
                        break;
                    case "layer-switcher-group_display":
                        if (needMapComments) {
                            if (!$(groupToggle).prop("checked")) {
                                $(groupToggle).trigger("click");
                                layerToggle.push($(groupToggle).attr("id"));
                            }
                            // Loop through each child in the group
                            $(g).find("ul > li > wz-checkbox").each(function (ixChild, c) {
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
                        } else {
                            if ($(groupToggle).prop("checked")) {
                                $(groupToggle).trigger("click");
                                layerToggle.push($(groupToggle).attr("id"));
                            }
                            $(g).find("ul > li > wz-checkbox").each(function (ixChild, c) {
                                if (!$(c).prop("checked")) {
                                    $(c).trigger("click");
                                    layerToggle.push($(c).attr("id"));
                                }
                            });
                        }
                        break;
                    case "layer-switcher-group_map_suggestions":
                        if (needSuggestedSegments) {
                            if (!$(groupToggle).prop("checked")) {
                                $(groupToggle).trigger("click");
                                layerToggle.push($(groupToggle).attr("id"));
                            }
                        } else {
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
            }
        });

        // Turn off Issue Tracker //
        if ($('#layer-switcher-group_issues_tracker').prop('checked')) {
            $('#layer-switcher-group_issues_tracker').trigger('click');
            layerToggle.push('layer-switcher-group_issues_tracker');
        }
        // Turn off Road Shield Assistant if currently enabled
        if ($('#rsa-enableScript').prop('checked')) {
            $('#rsa-enableScript').trigger('click');
            layerToggle.push('rsa-enableScript');
        }

        // Turn off Lane Tools if currently enabled
        if ($('#lt-ScriptEnabled').prop('checked')) {
            $('#lt-ScriptEnabled').trigger('click');
            layerToggle.push('lt-ScriptEnabled');
        }

        // Turn off WMEPH Highlighting if currently enabled
        if ($('#WMEPH-ColorHighlighting').prop('checked')) {
            $('#WMEPH-ColorHighlighting').trigger('click');
            layerToggle.push('WMEPH-ColorHighlighting');
        }

        // Turn off Magic if currently enabled because it doesn't respect the overall Display group toggle
        if ($('#layer-switcher-item_magic').prop('checked')) {
            $('#layer-switcher-item_magic').trigger('click');
            layerToggle.push('layer-switcher-item_magic');
        }

        // Reload road layers
        if (!W.model.actionManager.canUndo()) {
            for (let ix = 0; ix < W.map.roadLayers.length; ix++) {
                W.map.roadLayers[ix].redraw(true);
            }
            if (typeof W.controller.reloadData === "function") {
                W.controller.reloadData();
            } else {
                W.controller.reload();
            }
        }

        let minZoomLevel = 0;
        for (let ix = 0; ix < plugins.length; ix++) {
            if (plugins[ix].Active) {
                if (plugins[ix].MinimumZoomLevel > minZoomLevel) {
                    minZoomLevel = plugins[ix].MinimumZoomLevel;
                }
            }
        }

        zoomLevel = minZoomLevel;
        log('info', `Zooming to ${zoomLevel}`);
        WALMap.zoomTo(zoomLevel);

        const extent = W.map.getExtent();
        height = extent.getHeight();
        width = extent.getWidth();

        // Figure out how many horizontal and vertical viewports there are
        const horizontalSpan = Math.floor((bottomRight.x - topLeft.x) / width) + 2;
        const verticalSpan = Math.floor((topLeft.y - bottomRight.y) / height) + 2;
        totalViewports = horizontalSpan * verticalSpan + 1;
        countViewports = 0;

        log("Debug","Horizontal span = " + horizontalSpan.toString());
        log("Debug","Vertical span = " + verticalSpan.toString());
        log("Debug","Total viewports = " + totalViewports.toString());

        currentLon = topLeft.x - width;
        currentLat = topLeft.y;

        pb.show();

        cancelled = false;

        let status: ScanStatus;
        do {
            status = await moveToNextLocation();
            if (!cancelled && status === ScanStatus.Continue) {
                status = await scanExtent();
            }
            if (!cancelled && status === ScanStatus.Continue) {
                const progress = Math.floor(countViewports / totalViewports * 100);
                pb.update(progress);
            }
        } while (status === ScanStatus.Continue && !cancelled);

        if (status === ScanStatus.Abort || cancelled) {
            log("Debug","scan: scan aborted or canceled");
            cancel();
        } else {
            processComplete();
        }
    }

    async function moveToNextLocation(): Promise<ScanStatus> {
        let done = false;
        let inGeometry = false;

        do {
            if (areaToScan == null) {
                done = true;
            } else {
                countViewports += 1;
                log("Debug","Count viewports = " + countViewports.toString());

                currentLon += width;
                if (currentLon > bottomRight.x + width) {
                    log("Debug","New row");
                    // Start at next row
                    currentLon = topLeft.x;
                    currentLat -= height;
                    if (currentLat < bottomRight.y - height) {
                        done = true;
                    }
                }

                if (!done) {
                    // Check to see if the new window would be within the boundaries of the original area
                    // Create a geometry object for the window boundaries
                    const points: Array<OpenLayers.Geometry.Point> = [];
                    points.push(new OpenLayers.Geometry.Point(currentLon - (width / 2), currentLat + (height / 2)));
                    points.push(new OpenLayers.Geometry.Point(currentLon + (width / 2), currentLat + (height / 2)));
                    points.push(new OpenLayers.Geometry.Point(currentLon - (width / 2), currentLat - (height / 2)));
                    points.push(new OpenLayers.Geometry.Point(currentLon + (width / 2), currentLat - (height / 2)));
                    const lr = new OpenLayers.Geometry.LinearRing(points);
                    const poly = new OpenLayers.Geometry.Polygon([lr]);
                    inGeometry = areaToScan && areaToScan.intersects(poly);
                }
            }

            if (!inGeometry) {
                const progress = Math.floor(countViewports / totalViewports * 100);
                pb.update(progress);
            }
        } while (!inGeometry && !done);

        if (!done) {
            return await moveMap();
        } else {
            return ScanStatus.Complete;
        }
    }

    async function moveMap(): Promise<ScanStatus> {
        let abort: boolean;
        let retry: boolean;
        let abortOnFailure: boolean;

        do {
            abort = false;
            abortOnFailure = true;
            let retryCount = 0;
            do {
                retry = false;
                if (!cancelled) {
                    try {
                        var p = onModelReady(false);
                        W.map.moveTo({lon: currentLon, lat: currentLat});
                        // W.map.setCenter(new OpenLayers.LonLat(currentLon, currentLat));
                        try {
                            await promiseTimeout(10000, p);
                            waitFeaturesLoaded();
                            const ven = W.model.venues.getObjectArray();
                            const cityc = W.model.cities.getObjectArray().length;
                            const cntryc = W.model.countries.getObjectArray().length;
                            const segc = W.model.segments.getObjectArray().length;
                            const usrc = W.model.users.getObjectArray().length;
                            log("debug", "venues " + ven.length + " segs " + segc + " cntry " + cntryc + " users " + usrc);
                            if (usrc < 2 || cntryc == 0) {
                                log("debug", "user or countries not loaded, retry" );
                                retryCount++;
                                retry = true;
                                abortOnFailure = false;
                            }
                            /*
                            // Check to see if there's anything in segments. If not, try moving the map again
                            if (needSegments && W.model.segments.getObjectArray().length == 0) {
                                retryCount++;
                                retry = true;
                                abortOnFailure = false;
                            }
                            if (needVenues && W.model.venues.getObjectArray().length == 0) {
                                retryCount++;
                                retry = true;
                                abortOnFailure = false;
                            }

                            if (needSuggestedSegments && W.model.segmentSuggestions.getObjectArray().length == 0) {
                                retryCount++;
                                retry = true;
                                abortOnFailure = false;
                            }
                            */
                        } catch (e) {
                            log("warning","moveMap: Timer triggered after map not successfully moved within 10 seconds");
                            retryCount++;
                            retry = true;
                            abortOnFailure = true;
                        }
                    } catch (e) {
                        log("warning","moveMap: Exception thrown trying to move map.  Will retry up to 5 times (with a 1-second delay).");
                        log("error",e);
                        await new Promise<void>(resolve => {
                            setTimeout(function () {
                                resolve();
                            }, 1000);
                        });
                        retry = true;
                        retryCount++;
                        abortOnFailure = true;
                    }
                }
            } while (retry && retryCount < 5);

            if (retry && abortOnFailure) {
                abort = !confirm("Exceeded maximum allowable attempts to move the map. Do you want to continue trying?");
            }
        } while (retry && !abort);

        if (abort) {
            return ScanStatus.Abort;
        } else {
            return ScanStatus.Continue;
        }
    }

    async function scanExtent(): Promise<ScanStatus> {
        let keepScanning = true;
        if (!cancelled) {
            let extentSegments: Array<WazeNS.Model.Object.Segment> = [];
            let extentVenues: Array<WazeNS.Model.Object.Venue> = [];
            let extentSuggestedSegments: Array<WazeNS.Model.Object.SegmentSuggestion> = [];

            // Check to see if the current extent is completely within the area being searched
            // let allIn = true;
            // let vertices = W.map.getExtent().toGeometry().getVertices();
            // for (let ix = 0; ix < vertices.length && allIn; ix++) {
            //     allIn = allIn && geoCollection.intersects(vertices[ix]);
            // }
            // log("Debug","Extent is " + (!allIn ? "NOT " : "") + "entirely within area");

            if (needSegments) { // && segments != null) {
                log("Debug","scanExtent: Collecting segments");
                extentSegments = W.model.segments.getObjectArray();
                // for (let seg in W.model.segments.objects) {
                //     // if (segments.indexOf(seg) === -1) {
                //         const segment = W.model.segments.getObjectById(parseInt(seg));
                //         if (segment != null) {
                //             // segments.push(seg);
                //             extentSegments.push(segment);
                //         }
                //     // }
                // }
                log("Debug",`scanExtent: Done collecting segments (${extentSegments.length})`);
            }

            if (needVenues) { //} && venues != null) {
                log("Debug","scanExtent: Collecting venues");
                extentVenues = W.model.venues.getObjectArray();
                // for (let ven in W.model.venues.objects) {
                //     // if (venues.indexOf(ven) === -1) {
                //         const venue = W.model.venues.getObjectById(ven);
                //         if (venue != null) {
                //             // venues.push(ven);
                //             extentVenues.push(venue);
                //         }
                //     // }
                // }
                log("Debug",`scanExtent: Done collecting venues (${extentVenues.length})`);
            }

            if (needSuggestedSegments) { // && segments != null) {
                log("Debug","scanExtent: Collecting suggested segments");
                extentSuggestedSegments = W.model.segmentSuggestions.getObjectArray();
                // for (let seg in W.model.segmentSuggestions.objects) {
                //     // if (segments.indexOf(seg) === -1) {
                //         const segment = W.model.segmentSuggestions.getObjectById(parseInt(seg));
                //         if (segment != null) {
                //             // segments.push(seg);
                //             extentSuggestedSegments.push(segment);
                //         }
                //     // }
                // }
                log("Debug",`scanExtent: Done collecting suggested segments (${extentSuggestedSegments.length})`);
            }

            const promises: Array<Promise<IResults>> = [];
            for (let ix = 0; ix < plugins.length; ix++) {
                if (plugins[ix].Active && !cancelled) {
                    log("Debug","scanExtent: Calling plugin " + plugins[ix].Title);
                    promises.push(plugins[ix].ScanExtent(extentSegments, extentVenues, extentSuggestedSegments));
                }
            }

            log("Debug","scanExtent: Awaiting all promises");
            const pluginResults = await Promise.allSettled(promises);
            let anyErrors = false;
            for (let ix = 0; ix < pluginResults.length; ix++) {
                log("Debug",`scanExtent: Plugin ${ix}: ${pluginResults[ix].status}`);
                if (pluginResults[ix].status === "rejected") {
                    log("error",(<PromiseRejectedResult>pluginResults[ix]).reason);
                    anyErrors = true;
                } else {
                    const results: IResults = (<PromiseFulfilledResult<IResults>>pluginResults[ix]).value;
                    if (results != null) {
                        pb.setCount(results.Streets, results.Places, results.MapComments);
                    }
                }
            }

            if (anyErrors) {
                keepScanning = confirm("An error occurred in the one of the plugins. Do you want to continue?");
            }
        }

        if (keepScanning) {
            return ScanStatus.Continue;
        } else {
            return ScanStatus.Abort;
        }
    }

    function log(level: string, ...args: any[]): void {
        switch (level.toLocaleLowerCase()) {
            case "debug":
            case "verbose":
                console.debug(`${SCRIPT_NAME}:`, ...args);
                break;
            case "info":
            case "information":
                console.info(`${SCRIPT_NAME}:`, ...args);
                break;
            case "warning":
            case "warn":
                console.warn(`${SCRIPT_NAME}:`, ...args);
                break;
            case "error":
                console.error(`${SCRIPT_NAME}:`, ...args);
                break;
            case "log":
                console.log(`${SCRIPT_NAME}:`, ...args);
                break;
            default:
                break;
        }
    }

    function parseOutputTo(outputTo: string): OutputTo {
        let ot: OutputTo;
        switch ((outputTo ?? '').toLowerCase()) {
            case "csv":
                ot = OutputTo.CSV;
                break;
            case "tab":
                ot = OutputTo.Tab;
                break;
            case "both":
                ot = OutputTo.CSV | OutputTo.Tab;
                break;
            default:
                break;
        }
        return ot;
    }

    export function WazeRoadTypeToRoadTypeBitmask(roadType: number): RoadType {
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
                return RoadType.Unknown;
        }
    }

    export function RoadTypeBitmaskToWazeRoadType(roadType: RoadType): number {
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

    export function WazeRoadTypeToRoutingPreference(roadType: number): number {
        switch (roadType) {
            case 1:
                return 1;
            case 2:
                return 2;
            case 7:
                return 3;
            case 6:
                return 4;
            case 3:
                return 5;
            default:
                return 0;
        }
    }

    export function TranslateRoadType(wazeRoadType: number): string {
        return I18n.t("segment.road_types." + wazeRoadType.toString());
    }

    export function GenerateBasePL(lat: number, lon: number, zoom: number): string {
        if (zoom < 12) {
            zoom += 12;
        }
        return "https://www.waze.com/editor/?env=" + W.app.getAppRegionCode() + "&lon=" + lon + "&lat=" + lat + "&zoomLevel=" + zoom;
    }

    export function CompareVersions(v1: string, v2: string) : number {
        const v1Parts = v1.split(".");
        const v2Parts = v2.split(".");

        for (; v1Parts.length < v2Parts.length;) {
            v1Parts.push(".0");
        }
        for (; v2Parts.length < v1Parts.length;) {
            v2Parts.push(".0");
        }

        for (let ix = 0; ix < v1Parts.length; ix++) {
            const v1Element = parseInt(v1Parts[ix]);
            const v2Element = parseInt(v2Parts[ix]);
            if (v1Element < v2Element) {
                return -1;
            }
            else if (v1Element > v2Element) {
                return 1;
            }
        }

        return 0;
    }

    export function IsAtMinimumVersion(version: string): boolean {
        return (CompareVersions(getVersion(), version) >= 0);
    }

    function getVersion(): string {
        let version = GM_info.script.version;
        if (version.startsWith("v")) {
            version = version.substring(1);
        }
        return version;
    }

    function promiseTimeout(ms: number, promise: Promise<any>) : Promise<any> {

        // Create a promise that rejects in <ms> milliseconds
        const timeout = new Promise((resolve, reject) => {
            const id = setTimeout(() => {
                clearTimeout(id);
                reject()
            }, ms)
        });

        // Returns a race between our timeout and the passed in promise
        return Promise.race([
          promise,
          timeout
        ]);
      }

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
    export let LZString = (function () {
        // private property
        const f = String.fromCharCode;
        const keyStrBase64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
        const keyStrUriSafe = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$";
        const baseReverseDic = {};
        function getBaseValue(alphabet, character) {
            if (!baseReverseDic[alphabet]) {
                baseReverseDic[alphabet] = {};
                for (let i = 0; i < alphabet.length; i++) {
                    baseReverseDic[alphabet][alphabet.charAt(i)] = i;
                }
            }
            return baseReverseDic[alphabet][character];
        }
        const LZString = {
            compressToBase64: function (input) {
                if (input == null)
                    return "";
                let res = LZString._compress(input, 6, function (a) { return keyStrBase64.charAt(a); });
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
                const compressed = LZString.compress(uncompressed);
                const buf = new Uint8Array(compressed.length * 2); // 2 bytes per character
                for (let i = 0, TotalLen = compressed.length; i < TotalLen; i++) {
                    const current_value = compressed.charCodeAt(i);
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
                    const buf = new Array(compressed.length / 2); // 2 bytes per character
                    for (let i = 0, TotalLen = buf.length; i < TotalLen; i++) {
                        buf[i] = compressed[i * 2] * 256 + compressed[i * 2 + 1];
                    }
                    const result_1 = [];
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
                let i, value, context_dictionary = {}, context_dictionaryToCreate = {}, context_c = "", context_wc = "", context_w = "", context_enlargeIn = 2, // Compensate for the first entry which should not count
                context_dictSize = 3, context_numBits = 2, context_data = [], context_data_val = 0, context_data_position = 0, ii;
                for (let ii_1 = 0; ii_1 < uncompressed.length; ii_1 += 1) {
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
                                for (let i_1 = 0; i_1 < context_numBits; i_1++) {
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
                                for (let i_2 = 0; i_2 < 8; i_2++) {
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
                                for (let i_3 = 0; i_3 < context_numBits; i_3++) {
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
                                for (let i_4 = 0; i_4 < 16; i_4++) {
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
                            for (let i_5 = 0; i_5 < context_numBits; i_5++) {
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
                            for (let i_6 = 0; i_6 < context_numBits; i_6++) {
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
                            for (let i_7 = 0; i_7 < 8; i_7++) {
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
                            for (let i_8 = 0; i_8 < context_numBits; i_8++) {
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
                            for (let i_9 = 0; i_9 < 16; i_9++) {
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
                        for (let i_10 = 0; i_10 < context_numBits; i_10++) {
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
                for (let i_11 = 0; i_11 < context_numBits; i_11++) {
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
                let dictionary = [], next, enlargeIn = 4, dictSize = 4, numBits = 3, entry = "", result = [], i, w, bits, resb, maxpower, power, c, data = { val: getNextValue(0), position: resetValue, index: 1 };
                for (let i_12 = 0; i_12 < 3; i_12 += 1) {
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
    bootstrap();
}