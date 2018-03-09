// ==UserScript==
// @name                WME Wide-Angle Lens Cities
// @namespace           https://greasyfork.org/en/users/19861-vtpearce
// @description         Find streets whose city doesn't match the boundaries of a polygon layer
// @author              vtpearce
// @include             /^https:\/\/(www|beta)\.waze\.com\/(?!user\/)(.{2,6}\/)?editor\/.*$/
// @version             1.0.1
// @grant               none
// @copyright           2017 vtpearce
// @license             CC BY-SA 4.0
// ==/UserScript==
// ---------------------------------------------------------------------------------------
var WMEWAL_Cities;
(function (WMEWAL_Cities) {
    var Operation;
    (function (Operation) {
        Operation[Operation["Equal"] = 1] = "Equal";
        Operation[Operation["NotEqual"] = 2] = "NotEqual";
    })(Operation || (Operation = {}));
    var pluginName = "WMEWAL-Cities";
    WMEWAL_Cities.Title = "Cities";
    WMEWAL_Cities.MinimumZoomLevel = 2;
    WMEWAL_Cities.SupportsSegments = true;
    WMEWAL_Cities.SupportsVenues = false;
    var settingsKey = "WMEWALCitiesSettings";
    var savedSettingsKey = "WMEWALCitiesSavedSettings";
    var settings = null;
    var savedSettings = [];
    var streets = null;
    var state;
    var stateName;
    var cityRegex = null;
    var cityPolygons = null;
    var initCount = 0;
    function GetTab() {
        var html = "<table style='border-collapse: separate; border-spacing:0px 1px;'>";
        html += "<tbody>";
        html += "<tr><td style='font-size:1.2em'><b>Output To:</b></td></tr>";
        html += "<tr><td style='padding-left:20px'>" +
            "<select id='_wmewalCitiesOutputTo'>" +
            "<option value='csv'>CSV File</option>" +
            "<option value='tab'>Browser Tab</option>" +
            "<option value='both'>Both CSV File and Browser Tab</option></select></td></tr>";
        html += "<tr><td style='border-top: 1px solid; padding-top: 4px;font-size:1.2em'><b>Settings</b></td></tr>";
        html += "<tr><td><b>Polygon Layer:</b></td></tr>";
        html += "<tr><td style='padding-left: 20px'>" +
            "<select id='_wmewalCitiesLayer'/>" +
            "</td></tr>";
        html += "<tr><td style='border-top: 1px solid; font-size: 1.2em'><b>Saved Filters</b></td></tr>";
        html += "<tr><td style='padding-left: 20px; padding-bottom: 8px'>" +
            "<select id='_wmewalCitiesSavedSettings'/><br/>" +
            "<button class='btn btn-primary' id='_wmewalCitiesLoadSetting' title='Load'>Load</button>" +
            "<button class='btn btn-primary' style='margin-left: 4px;' id='_wmewalCitiesSaveSetting' title='Save'>Save</button>" +
            "<button class='btn btn-primary' style='margin-left: 4px;' id='_wmewalCitiesDeleteSetting' title='Delete'>Delete</button></td></tr>";
        html += "<tr><td style='border-top: 1px solid; padding-top: 4px;font-size:1.2em'><b>Filters</b></td></tr>";
        html += "<tr><td><b>City RegEx:</b></td></tr>";
        html += "<tr><td style='padding-left: 20px'><input type='text' id='_wmewalCitiesCity' class='wal-textbox'/><br/>" +
            "<input id='_wmewalCitiesCityIgnoreCase' type='checkbox'/>" +
            "<label for='_wmewalCitiesCityIgnoreCase' style='margin-left: 8px'>Ignore case</label></td></tr>";
        html += "<tr><td><b>State:</b></td></tr>";
        html += "<tr><td style='padding-left: 20px'>" +
            "<select id='_wmewalCitiesStateOp'>" +
            "<option value='" + Operation.Equal.toString() + "' selected='selected'>=</option>" +
            "<option value='" + Operation.NotEqual.toString() + "'>&lt;&gt;</option></select>" +
            "<select id='_wmewalCitiesState'/></td></tr>";
        html += "<tr><td><b>Road Type:</b></td></tr>";
        html += "<tr><td style='padding-left: 20px'>" +
            "<button id='_wmewalCitiesRoadTypeAny' class='btn btn-primary' style='margin-right: 8px' title='Any'>Any</button>" +
            "<button id='_wmewalCitiesRoadTypeClear' class='btn btn-primary' title='Clear'>Clear</button>" +
            "<div><input type='checkbox' checked='checked' id='_wmewalCitiesRoadTypeFreeway' name='_wmewalCitiesRoadType' value='" + WMEWAL.RoadType.Freeway.toString() + "'/>" +
            "<label for='_wmewalCitiesRoadTypeFreeway' style='margin-left: 8px'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.Freeway)) + "</label></div>" +
            "<div><input type='checkbox' id='_wmewalCitiesRoadTypeRamp' name='_wmewalCitiesRoadType' value='" + WMEWAL.RoadType.Ramp.toString() + "'/>" +
            "<label for='_wmewalCitiesRoadTypeRamp' style='margin-left: 8px'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.Ramp)) + "</label></div>" +
            "<div><input type='checkbox' id='_wmewalCitiesRoadTypeMajorHighway' name='_wmewalCitiesRoadType' value='" + WMEWAL.RoadType.MajorHighway.toString() + "'/>" +
            "<label for='_wmewalCitiesRoadTypeMajorHighway' style='margin-left: 8px'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.MajorHighway)) + "</label></div>" +
            "<div><input type='checkbox' id='_wmewalCitiesRoadTypeMinorHighway' name='_wmewalCitiesRoadType' value='" + WMEWAL.RoadType.MinorHighway.toString() + "'/>" +
            "<label for='_wmewalCitiesRoadTypeMinorHighway' style='margin-left: 8px'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.MinorHighway)) + "</label></div>" +
            "<div><input type='checkbox' id='_wmewalCitiesRoadTypePrimary' name='_wmewalCitiesRoadType' value='" + WMEWAL.RoadType.PrimaryStreet.toString() + "'/>" +
            "<label for='_wmewalCitiesRoadTypePrimary' style='margin-left: 8px'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.PrimaryStreet)) + "</label></div>" +
            "<div><input type='checkbox' id='_wmewalCitiesRoadTypeStreet' name='_wmewalCitiesRoadType' value='" + WMEWAL.RoadType.Street.toString() + "'/>" +
            "<label for='_wmewalCitiesRoadTypeStreet' style='margin-left: 8px'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.Street)) + "</label></div>" +
            "<div><input type='checkbox' id='_wmewalCitiesRoadTypeUnpaved' name='_wmewalCitiesRoadType' value='" + WMEWAL.RoadType.Unpaved.toString() + "'/>" +
            "<label for='_wmewalCitiesRoadTypeUnpaved' style='margin-left: 8px'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.Unpaved)) + "</label></div>" +
            "<div><input type='checkbox' id='_wmewalCitiesRoadTypePLR' name='_wmewalCitiesRoadType' value='" + WMEWAL.RoadType.ParkingLotRoad.toString() + "'/>" +
            "<label for='_wmewalCitiesRoadTypePLR' style='margin-left: 8px'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.ParkingLotRoad)) + "</label></div>" +
            "<div><input type='checkbox' id='_wmewalCitiesRoadTypePrivate' name='_wmewalCitiesRoadType' value='" + WMEWAL.RoadType.PrivateRoad.toString() + "'/>" +
            "<label for='_wmewalCitiesRoadTypePrivate' style='margin-left: 8px'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.PrivateRoad)) + "</label></div>" +
            "<div><input type='checkbox' id='_wmewalCitiesRoadTypeFerry' name='_wmewalCitiesRoadType' value='" + WMEWAL.RoadType.Ferry.toString() + "'/>" +
            "<label for='_wmewalCitiesRoadTypeFerry' style='margin-left: 8px'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.Ferry)) + "</label></div>" +
            "<div><input type='checkbox' id='_wmewalCitiesRoadTypeWT' name='_wmewalCitiesRoadType' value='" + WMEWAL.RoadType.WalkingTrail.toString() + "'/>" +
            "<label for='_wmewalCitiesRoadTypeWT' style='margin-left: 8px'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.WalkingTrail)) + "</label></div>" +
            "<div><input type='checkbox' id='_wmewalCitiesRoadTypePB' name='_wmewalCitiesRoadType' value='" + WMEWAL.RoadType.PedestrianBoardwalk.toString() + "'/>" +
            "<label for='_wmewalCitiesRoadTypePB' style='margin-left: 8px'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.PedestrianBoardwalk)) + "</label></div>" +
            "<div><input type='checkbox' id='_wmewalCitiesRoadTypeStairway' name='_wmewalCitiesRoadType' value='" + WMEWAL.RoadType.Stairway.toString() + "'/>" +
            "<label for='_wmewalCitiesRoadTypeStairway' style='margin-left: 8px'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.Stairway)) + "</label></div>" +
            "<div><input type='checkbox' id='_wmewalCitiesRoadTypeRR' name='_wmewalCitiesRoadType' value='" + WMEWAL.RoadType.Railroad.toString() + "'/>" +
            "<label for='_wmewalCitiesRoadTypeRR' style='margin-left: 8px'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.Railroad)) + "</label></div>" +
            "<div><input type='checkbox' id='_wmewalCitiesRoadTypeRT' name='_wmewalCitiesRoadType' value='" + WMEWAL.RoadType.RunwayTaxiway.toString() + "'/>" +
            "<label for='_wmewalCitiesRoadTypeRT' style='margin-left: 8px'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.RunwayTaxiway)) + "</label></div>" +
            "</td></tr>";
        html += "<tr><td><input id='_wmewalCitiesEditable' type='checkbox'/>" +
            "<label for='_wmewalCitiesEditable' style='margin-left: 8px'>Editable by me</label></td></tr>";
        html += "<tr><td><input id='_wmewalCitiesExcludeJunctionBoxes' type='checkbox' checked='checked'/>" +
            "<label for='_wmewalCitiesExcludeJunctionBoxes' style='margin-left: 8px'>Exclude Junction Boxes</label></td></tr>";
        html += "</tbody></table>";
        return html;
    }
    WMEWAL_Cities.GetTab = GetTab;
    function TabLoaded() {
        updateStates();
        updateLayers();
        updateUI();
        updateSavedSettingsList();
        $("#_wmewalCitiesState").on("focus", updateStates);
        $("#_wmewalCitiesLayer").on("focus", updateLayers);
        $("#_wmewalCitiesRoadTypeAny").on("click", function () {
            $("input[name=_wmewalCitiesRoadType]").prop("checked", true);
        });
        $("#_wmewalCitiesRoadTypeClear").on("click", function () {
            $("input[name=_wmewalCitiesRoadType]").prop("checked", false);
        });
        $("#_wmewalCitiesLoadSetting").on("click", loadSetting);
        $("#_wmewalCitiesSaveSetting").on("click", saveSetting);
        $("#_wmewalCitiesDeleteSetting").on("click", deleteSetting);
    }
    WMEWAL_Cities.TabLoaded = TabLoaded;
    function updateStates() {
        var selectState = $("#_wmewalCitiesState");
        // Preserve current selection
        var currentId = parseInt(selectState.val());
        selectState.empty();
        var stateObjs = [];
        stateObjs.push({ id: null, name: "" });
        for (var s in Waze.model.states.objects) {
            if (Waze.model.states.objects.hasOwnProperty(s)) {
                var st = Waze.model.states.get(parseInt(s));
                if (st.id !== 1 && st.name.length > 0) {
                    stateObjs.push({ id: st.id, name: st.name });
                }
            }
        }
        stateObjs.sort(function (a, b) {
            if (a.id == null) {
                return -1;
            }
            else {
                return a.name.localeCompare(b.name);
            }
        });
        for (var ix = 0; ix < stateObjs.length; ix++) {
            var so = stateObjs[ix];
            var stateOption = $("<option/>").text(so.name).attr("value", so.id);
            if (currentId != null && so.id === currentId) {
                stateOption.attr("selected", "selected");
            }
            selectState.append(stateOption);
        }
    }
    function updateLayers() {
        var selectLayer = $("#_wmewalCitiesLayer");
        var currentLayer = selectLayer.val();
        selectLayer.empty();
        var layers = [];
        for (var ixLayer = 0; ixLayer < Waze.map.layers.length; ixLayer++) {
            var layer = Waze.map.layers[ixLayer];
            if (layer.CLASS_NAME === "OpenLayers.Layer.Vector") {
                var vectorLayer = layer;
                if (vectorLayer.features && vectorLayer.features.length > 0) {
                    layers.push({
                        uniqueName: vectorLayer.uniqueName,
                        name: vectorLayer.name
                    });
                }
            }
        }
        layers.sort(function (a, b) {
            return a.name.localeCompare(b.name);
        });
        for (var ix = 0; ix < layers.length; ix++) {
            var l = layers[ix];
            var layerOption = $("<option/>").text(l.name).attr("value", l.uniqueName);
            if (currentLayer != null && currentLayer === l.uniqueName) {
                layerOption.attr("selected", "selected");
            }
            selectLayer.append(layerOption);
        }
    }
    function updateSavedSettingsList() {
        var s = $("#_wmewalCitiesSavedSettings");
        s.empty();
        for (var ixSaved = 0; ixSaved < savedSettings.length; ixSaved++) {
            var opt = $("<option/>").attr("value", ixSaved).text(savedSettings[ixSaved].Name);
            s.append(opt);
        }
    }
    function updateUI() {
        $("#_wmewalCitiesOutputTo").val(settings.OutputTo);
        $("#_wmewalCitiesCity").val(settings.CityRegex || "");
        $("#_wmewalCitiesCityIgnoreCase").prop("checked", settings.CityRegexIgnoreCase);
        $("#_wmewalCitiesState").val(settings.State);
        $("#_wmewalCitiesStateOp").val(settings.StateOperation || Operation.Equal.toString());
        $("#_wmewalCitiesRoadTypeFreeway").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.Freeway);
        $("#_wmewalCitiesRoadTypeRamp").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.Ramp);
        $("#_wmewalCitiesRoadTypeMajorHighway").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.MajorHighway);
        $("#_wmewalCitiesRoadTypeMinorHighway").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.MinorHighway);
        $("#_wmewalCitiesRoadTypePrimary").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.PrimaryStreet);
        $("#_wmewalCitiesRoadTypeStreet").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.Street);
        $("#_wmewalCitiesRoadTypeUnpaved").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.Unpaved);
        $("#_wmewalCitiesRoadTypePLR").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.ParkingLotRoad);
        $("#_wmewalCitiesRoadTypePrivate").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.PrivateRoad);
        $("#_wmewalCitiesRoadTypeFerry").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.Ferry);
        $("#_wmewalCitiesRoadTypeWT").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.WalkingTrail);
        $("#_wmewalCitiesRoadTypePB").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.PedestrianBoardwalk);
        $("#_wmewalCitiesRoadTypeStairway").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.Stairway);
        $("#_wmewalCitiesRoadTypeRR").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.Railroad);
        $("#_wmewalCitiesRoadTypeRT").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.RunwayTaxiway);
        $("#_wmewalCitiesEditable").prop("checked", settings.EditableByMe);
        $("#_wmewalCitiesExcludeJunctionBoxes").prop("checked", settings.ExcludeJunctionBoxes);
        $("#_wmewalCitiesLayer").val(settings.PolygonLayerUniqueName);
    }
    function loadSetting() {
        var selectedSetting = parseInt($("#_wmewalCitiesSavedSettings").val());
        if (selectedSetting == null || isNaN(selectedSetting) || selectedSetting < 0 || selectedSetting > savedSettings.length) {
            return;
        }
        settings.OutputTo = $("#_wmewalCitiesOutputTo").val();
        var savedSetting = savedSettings[selectedSetting].Setting;
        for (var name_1 in savedSetting) {
            if (settings.hasOwnProperty(name_1)) {
                settings[name_1] = savedSetting[name_1];
            }
        }
        updateUI();
    }
    function validateSettings() {
        var allOk = true;
        var message = "";
        var mask = 0;
        $("input[name=_wmewalCitiesRoadType]:checked").each(function (ix, e) {
            mask = mask | parseInt(e.value);
        });
        if (mask === 0) {
            message = "Please select at least one road type";
            allOk = false;
        }
        var selectedState = $("#_wmewalCitiesState").val();
        if (selectedState != null && selectedState.length > 0) {
            if (Waze.model.states.get(selectedState) == null) {
                message += ((message.length > 0 ? "\n" : "") + "Invalid state selection");
                allOk = false;
            }
        }
        var pattern = $("#_wmewalCitiesCity").val();
        var ignoreCase = $("#_wmewalCitiesCityIgnoreCase").prop("checked");
        var r;
        if (pattern.length > 0) {
            try {
                r = (ignoreCase ? new RegExp(pattern, "i") : new RegExp(pattern));
            }
            catch (error) {
                message += ((message.length > 0 ? "\n" : "") + "City RegEx is invalid");
                allOk = false;
            }
        }
        var layerUniqueName = $("#_wmewalCitiesLayer").val();
        if (layerUniqueName.length > 0) {
            var layers = Waze.map.getLayersBy("uniqueName", layerUniqueName);
            if (layers.length === 0) {
                message += ((message.length > 0 ? "\n" : "") + "Could not find layer.");
                allOk = false;
            }
            else if (layers.length > 1) {
                message += ((message.length > 0 ? "\n" : "") + "More than one layer found");
                allOk = false;
            }
            else {
                cityPolygons = [];
                for (var ixFeature = 0; ixFeature < layers[0].features.length; ixFeature++) {
                    var feature = layers[0].features[ixFeature];
                    if (feature.style && feature.style.label && feature.style.label.length > 0) {
                        console.log("Checking to see if " + feature.style.label + " is in area");
                        if (feature.geometry.intersects(WMEWAL.areaToScan)) {
                            cityPolygons.push({
                                name: feature.style.label,
                                geometry: feature.geometry.clone(),
                                compressedName: feature.style.label.replace(/\s/g, "")
                            });
                        }
                    }
                }
                if (cityPolygons.length === 0) {
                    message += ((message.length > 0 ? "\n" : "") + "No features in the layer have an appropriate label to use as City Name and are in the scanned area");
                    allOk = false;
                }
            }
        }
        else {
            message += ((message.length > 0 ? "\n" : "") + "Please select a layer containing City polygons");
            allOk = false;
        }
        if (!allOk) {
            alert(pluginName + ": " + message);
        }
        return allOk;
    }
    function saveSetting() {
        if (validateSettings()) {
            var s_1 = {
                RoadTypeMask: 0,
                State: null,
                StateOperation: parseInt($("#_wmewalCitiesStateOp").val()),
                ExcludeJunctionBoxes: $("#_wmewalCitiesExcludeJunctionBoxes").prop("checked"),
                EditableByMe: $("#_wmewalCitiesEditable").prop("checked"),
                CityRegex: null,
                CityRegexIgnoreCase: $("#_wmewalCitiesCityIgnoreCase").prop("checked"),
                PolygonLayerUniqueName: $("#_wmewalCitiesLayer").val()
            };
            $("input[name=_wmewalCitiesRoadType]:checked").each(function (ix, e) {
                s_1.RoadTypeMask = s_1.RoadTypeMask | parseInt(e.value);
            });
            var selectedState = $("#_wmewalCitiesState").val();
            if (selectedState != null && selectedState.length > 0) {
                s_1.State = Waze.model.states.get(selectedState).id;
            }
            var pattern = $("#_wmewalCitiesCity").val();
            if (pattern.length > 0) {
                s_1.CityRegex = pattern;
            }
            var sName = prompt("Enter a name for this setting");
            if (sName == null) {
                return;
            }
            // Check to see if there is already a name that matches this
            for (var ixSetting = 0; ixSetting < savedSettings.length; ixSetting++) {
                if (savedSettings[ixSetting].Name === sName) {
                    if (confirm("A setting with this name already exists. Overwrite?")) {
                        savedSettings[ixSetting].Setting = s_1;
                        updateSavedSettings();
                    }
                    else {
                        alert("Please pick a new name.");
                    }
                    return;
                }
            }
            var savedSetting = {
                Name: sName,
                Setting: s_1
            };
            savedSettings.push(savedSetting);
            updateSavedSettings();
        }
    }
    function deleteSetting() {
        var selectedSetting = parseInt($("#_wmewalCitiesSavedSettings").val());
        if (selectedSetting == null || isNaN(selectedSetting) || selectedSetting < 0 || selectedSetting > savedSettings.length) {
            return;
        }
        if (confirm("Are you sure you want to delete this saved setting?")) {
            savedSettings.splice(selectedSetting, 1);
            updateSavedSettings();
        }
    }
    function ScanStarted() {
        var allOk = validateSettings();
        if (allOk) {
            streets = [];
            settings.OutputTo = $("#_wmewalCitiesOutputTo").val();
            settings.PolygonLayerUniqueName = $("#_wmewalCitiesLayer").val();
            settings.RoadTypeMask = 0;
            $("input[name=_wmewalCitiesRoadType]:checked").each(function (ix, e) {
                settings.RoadTypeMask = settings.RoadTypeMask | parseInt(e.value);
            });
            var selectedState = $("#_wmewalCitiesState").val();
            state = null;
            settings.State = null;
            stateName = null;
            if (selectedState != null && selectedState.length > 0) {
                state = Waze.model.states.get(selectedState);
                settings.State = state.id;
                stateName = state.name;
            }
            settings.StateOperation = parseInt($("#_wmewalCitiesStateOp").val());
            settings.CityRegexIgnoreCase = $("#_wmewalCitiesCityIgnoreCase").prop("checked");
            var pattern = $("#_wmewalCitiesCity").val();
            settings.CityRegex = null;
            cityRegex = null;
            if (pattern.length > 0) {
                settings.CityRegex = pattern;
                cityRegex = (settings.CityRegexIgnoreCase ? new RegExp(pattern, "i") : new RegExp(pattern));
            }
            settings.ExcludeJunctionBoxes = $("#_wmewalCitiesExcludeJunctionBoxes").prop("checked");
            settings.EditableByMe = $("#_wmewalCitiesEditable").prop("checked");
            if (settings.RoadTypeMask & ~(WMEWAL.RoadType.Freeway | WMEWAL.RoadType.MajorHighway | WMEWAL.RoadType.MinorHighway | WMEWAL.RoadType.PrimaryStreet)) {
                WMEWAL_Cities.MinimumZoomLevel = 4;
            }
            else {
                WMEWAL_Cities.MinimumZoomLevel = 2;
            }
            updateSettings();
        }
        return allOk;
    }
    WMEWAL_Cities.ScanStarted = ScanStarted;
    function ScanExtent(segments, venues) {
        var def = $.Deferred();
        var extentStreets = [];
        var segment;
        var spaceRegex = /\s/g;
        function addSegment(s, incorrectCity, cityShouldBe, rId) {
            var sid = s.attributes.primaryStreetID;
            var address = s.getAddress();
            var thisStreet = null;
            if (sid != null) {
                thisStreet = extentStreets.find(function (e) {
                    var matches = (e.id === sid && (e.lockLevel === (s.attributes.lockRank | 0) + 1) && e.roundaboutId === rId && e.roadType === s.attributes.roadType);
                    if (matches) {
                        // Test for alt names
                        for (var ixAlt = 0; ixAlt < e.altStreets.length && matches; ixAlt++) {
                            matches = false;
                            for (var ixSegAlt = 0; ixSegAlt < s.attributes.streetIDs.length && !matches; ixSegAlt++) {
                                if (e.altStreets[ixAlt].id === s.attributes.streetIDs[ixSegAlt]) {
                                    matches = true;
                                }
                            }
                        }
                    }
                    return matches;
                });
            }
            if (thisStreet == null) {
                thisStreet = {
                    id: sid,
                    state: (address.state != null && address.state.name != null ? address.state.name : "No state"),
                    name: (address.street != null ? address.street.name : "No street"),
                    geometries: new OpenLayers.Geometry.Collection(),
                    lockLevel: (s.attributes.lockRank || 0) + 1,
                    segments: [],
                    roundaboutId: rId,
                    altStreets: [],
                    roadType: s.attributes.roadType,
                    incorrectCity: incorrectCity,
                    cityShouldBe: cityShouldBe
                };
                for (var ixAlt = 0; ixAlt < s.attributes.streetIDs.length; ixAlt++) {
                    var altStreet = Waze.model.streets.get(s.attributes.streetIDs[ixAlt]);
                    if (altStreet != null) {
                        thisStreet.altStreets.push({
                            id: s.attributes.streetIDs[ixAlt],
                            name: altStreet.name
                        });
                    }
                }
                extentStreets.push(thisStreet);
            }
            thisStreet.segments.push({
                id: s.attributes.id,
                center: s.attributes.geometry.getCentroid()
            });
            thisStreet.geometries.addComponents([s.attributes.geometry.clone()]);
        }
        var _loop_1 = function(ix) {
            segment = segments[ix];
            if (segment != null) {
                if ((WMEWAL.WazeRoadTypeToRoadTypeBitmask(segment.attributes.roadType) & settings.RoadTypeMask) &&
                    (!settings.EditableByMe || segment.arePropertiesEditable()) &&
                    (!settings.ExcludeJunctionBoxes || !segment.isInBigJunction())) {
                    var address = segment.getAddress();
                    if (state != null) {
                        if (address != null && address.state != null) {
                            if (settings.StateOperation === Operation.Equal && address.state.id !== state.id ||
                                settings.StateOperation === Operation.NotEqual && address.state.id === state.id) {
                                return "continue";
                            }
                        }
                        else if (settings.StateOperation === Operation.Equal) {
                            return "continue";
                        }
                    }
                    var altCityNames_1 = [];
                    if (segment.attributes.streetIDs != null) {
                        for (var streetIx = 0; streetIx < segment.attributes.streetIDs.length; streetIx++) {
                            if (segment.attributes.streetIDs[streetIx] != null) {
                                var street = Waze.model.streets.get(segment.attributes.streetIDs[streetIx]);
                                if (street != null) {
                                    if (street.cityID != null) {
                                        var city = Waze.model.cities.get(street.cityID);
                                        if (city != null) {
                                            altCityNames_1.push({
                                                hasName: city.hasName(),
                                                name: city.hasName() ? city.attributes.name : null,
                                                compressedName: city.hasName() ? city.attributes.name.replace(spaceRegex, "") : null
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if (cityRegex != null) {
                        var nameMatched = false;
                        if (address != null) {
                            if (address.city != null && address.city.hasName()) {
                                nameMatched = cityRegex.test(address.city.attributes.name);
                            }
                            if (!nameMatched) {
                                for (var altIx = 0; altIx < altCityNames_1.length && !nameMatched; altIx++) {
                                    if (altCityNames_1[altIx].hasName) {
                                        nameMatched = cityRegex.test(altCityNames_1[altIx].name);
                                    }
                                }
                            }
                        }
                        if (!nameMatched) {
                            return "continue";
                        }
                    }
                    if (!WMEWAL.IsSegmentInArea(segment)) {
                        return "continue";
                    }
                    var cityMatches = true;
                    var cityNames = [];
                    var cityShouldBe = "";
                    var incorrectCity = "";
                    var anyBlankCity = false;
                    if (address.city && address.city.hasName()) {
                        cityNames.push({
                            hasName: true,
                            name: address.city.attributes.name,
                            compressedName: address.city.attributes.name.replace(spaceRegex, "")
                        });
                    }
                    else {
                        anyBlankCity = true;
                    }
                    var _loop_2 = function(ixAlt) {
                        if (altCityNames_1[ixAlt].hasName) {
                            if (cityNames.find(function (c) {
                                return c.compressedName === altCityNames_1[ixAlt].compressedName;
                            })) {
                                cityNames.push({
                                    hasName: true,
                                    name: altCityNames_1[ixAlt].name,
                                    compressedName: altCityNames_1[ixAlt].name.replace(spaceRegex, "")
                                });
                            }
                        }
                        else {
                            anyBlankCity = true;
                        }
                    };
                    for (var ixAlt = 0; ixAlt < altCityNames_1.length; ixAlt++) {
                        _loop_2(ixAlt);
                    }
                    if (cityNames.length > 0) {
                        // Check to see if it's in any of the city polygons that are referenced
                        for (var ixCityName = 0; ixCityName < cityNames.length && cityMatches; ixCityName++) {
                            var foundAny = false;
                            for (var ixCity = 0; ixCity < cityPolygons.length && cityMatches; ixCity++) {
                                if (cityNames[ixCityName].compressedName === cityPolygons[ixCity].name.replace(spaceRegex, "")) {
                                    foundAny = true;
                                    if (!cityPolygons[ixCity].geometry.intersects(segment.geometry)) {
                                        incorrectCity = cityNames[ixCityName].name;
                                        cityShouldBe = "No City";
                                        cityMatches = false;
                                    }
                                }
                            }
                            if (!foundAny) {
                                incorrectCity = cityNames[ixCityName].name;
                                cityShouldBe = "No matching city polygon";
                                cityMatches = false;
                            }
                        }
                    }
                    if (anyBlankCity && cityMatches) {
                        // No city names listed, so check to see if it's inside any of the city polygons
                        for (var ixCity = 0; ixCity < cityPolygons.length && cityMatches; ixCity++) {
                            if (cityPolygons[ixCity].geometry.intersects(segment.geometry)) {
                                incorrectCity = "No City";
                                cityShouldBe = cityPolygons[ixCity].name;
                                cityMatches = false;
                            }
                        }
                    }
                    if (cityMatches) {
                        return "continue";
                    }
                    if (!segment.isInRoundabout()) {
                        addSegment(segment, incorrectCity, cityShouldBe, null);
                    }
                    else {
                        var r = segment.getRoundabout();
                        for (var rIx = 0; rIx < r.segIDs.length; rIx++) {
                            addSegment(Waze.model.segments.get(r.segIDs[rIx]), incorrectCity, cityShouldBe, r.id);
                        }
                    }
                }
            }
        };
        for (var ix = 0; ix < segments.length; ix++) {
            _loop_1(ix);
        }
        for (var ix = 0; ix < extentStreets.length; ix++) {
            extentStreets[ix].center = extentStreets[ix].geometries.getCentroid(true);
            delete extentStreets[ix].geometries;
            streets.push(extentStreets[ix]);
        }
        def.resolve();
        return def.promise();
    }
    WMEWAL_Cities.ScanExtent = ScanExtent;
    function ScanComplete() {
        cityPolygons = [];
        if (streets.length === 0) {
            alert(pluginName + ": No streets found.");
        }
        else {
            streets.sort(function (a, b) {
                var cmp = getStreetName(a).localeCompare(getStreetName(b));
                if (cmp !== 0) {
                    return cmp;
                }
                cmp = a.state.localeCompare(b.state);
                if (cmp !== 0) {
                    return cmp;
                }
                if (a.lockLevel < b.lockLevel) {
                    return -1;
                }
                else if (a.lockLevel > b.lockLevel) {
                    return 1;
                }
                return 0;
            });
            var outputTo = $("#_wmewalCitiesOutputTo").val();
            var isCSV = (outputTo === "csv" || outputTo === "both");
            var isTab = (outputTo === "tab" || outputTo === "both");
            var lineArray = void 0;
            var columnArray = void 0;
            var w = void 0;
            var fileName = void 0;
            if (isCSV) {
                lineArray = [];
                columnArray = ["data:text/csv;charset=utf-8,Name"];
                columnArray.push("Alt Names");
                columnArray.push("State");
                columnArray.push("Road Type");
                columnArray.push("Lock Level");
                columnArray.push("Incorrect City");
                columnArray.push("City Should Be");
                columnArray.push("Latitude");
                columnArray.push("Longitude");
                columnArray.push("Permalink");
                lineArray.push(columnArray);
                fileName = "Cities_" + WMEWAL.areaName + ".csv";
            }
            if (isTab) {
                w = window.open();
                w.document.write("<html><head><title>Cities</title></head><body>");
                w.document.write("<h3>Area: " + WMEWAL.areaName + "</h3>");
                w.document.write("<b>Filters</b>");
                if (cityRegex != null) {
                    w.document.write("<br/>City Name matches " + cityRegex.source);
                    if (settings.CityRegexIgnoreCase) {
                        w.document.write(" (ignoring case)");
                    }
                }
                if (stateName != null) {
                    w.document.write("<br/>State " + (settings.StateOperation === Operation.NotEqual ? "does not equal " : "equals ") + stateName);
                }
                if (settings.ExcludeJunctionBoxes) {
                    w.document.write("<br/>Junction boxes excluded");
                }
                if (settings.EditableByMe) {
                    w.document.write("<br/>Editable by me");
                }
                w.document.write("</p><table style='border-collapse: separate; border-spacing: 8px 0px'><tr><th>Name</th>");
                w.document.write("<th>Alt Names</th><th>State</th>");
                w.document.write("<th>Road Type</th><th>Lock Level</th>");
                w.document.write("<th>Incorrect City</th><th>City Should Be</th>");
                w.document.write("<th>Latitude</th><th>Longitude</th><th>Permalink</th></tr>");
            }
            for (var ixStreet = 0; ixStreet < streets.length; ixStreet++) {
                var street = streets[ixStreet];
                var roadTypeText = WMEWAL.TranslateRoadType(street.roadType);
                if (street.name == null && street.roundaboutId == null) {
                    for (var ixSeg = 0; ixSeg < street.segments.length; ixSeg++) {
                        var segment = street.segments[ixSeg];
                        var latlon = OpenLayers.Layer.SphericalMercator.inverseMercator(segment.center.x, segment.center.y);
                        var plSeg = getSegmentPL(segment);
                        if (isCSV) {
                            columnArray = [getStreetName(street)];
                            columnArray.push("");
                            columnArray.push("\"" + street.state + "\"");
                            columnArray.push("\"" + roadTypeText + "\"");
                            columnArray.push(street.lockLevel.toString());
                            columnArray.push("\"" + street.incorrectCity + "\"");
                            columnArray.push("\"" + street.cityShouldBe + "\"");
                            columnArray.push(latlon.lat.toString());
                            columnArray.push(latlon.lon.toString());
                            columnArray.push("\"" + plSeg + "\"");
                            lineArray.push(columnArray);
                        }
                        if (isTab) {
                            w.document.write("<tr><td>" + getStreetName(street) + "</td>");
                            w.document.write("<td>&nbsp;</td>");
                            w.document.write("<td>" + street.state + "</td>");
                            w.document.write("<td>" + roadTypeText + "</td><td>" + street.lockLevel + "</td>");
                            w.document.write("<td>" + street.incorrectCity + "</td><td>" + street.cityShouldBe + "</td>");
                            w.document.write("<td>" + latlon.lat.toString() + "</td><td>" + latlon.lon.toString() + "</td>" +
                                "<td><a href=\'" + plSeg + "\' target=\'_blank\'>Permalink</a></td></tr>");
                        }
                    }
                }
                else {
                    var latlon = OpenLayers.Layer.SphericalMercator.inverseMercator(street.center.x, street.center.y);
                    var plStreet = getStreetPL(street);
                    var altNames = "";
                    for (var ixAlt = 0; ixAlt < street.altStreets.length; ixAlt++) {
                        if (ixAlt > 0) {
                            altNames += ", ";
                        }
                        altNames += street.altStreets[ixAlt].name;
                    }
                    if (isCSV) {
                        columnArray = ["\"" + getStreetName(street) + "\""];
                        columnArray.push("\"" + altNames + "\"");
                        columnArray.push("\"" + street.state + "\"");
                        columnArray.push("\"" + roadTypeText + "\"");
                        columnArray.push(street.lockLevel.toString());
                        columnArray.push("\"" + street.incorrectCity + "\"");
                        columnArray.push("\"" + street.cityShouldBe + "\"");
                        columnArray.push(latlon.lat.toString());
                        columnArray.push(latlon.lon.toString());
                        columnArray.push("\"" + plStreet + "\"");
                        lineArray.push(columnArray);
                    }
                    if (isTab) {
                        w.document.write("<tr><td>" + getStreetName(street) + "</td>");
                        w.document.write("<td>" + altNames + "</td>");
                        w.document.write("<td>" + street.state + "</td>");
                        w.document.write("<td>" + roadTypeText + "</td><td>" + street.lockLevel + "</td>");
                        w.document.write("<td>" + street.incorrectCity + "</td><td>" + street.cityShouldBe + "</td>");
                        w.document.write("<td>" + latlon.lat.toString() + "</td><td>" + latlon.lon.toString() + "</td>" +
                            "<td><a href=\'" + plStreet + "\' target=\'_blank\'>Permalink</a></td></tr>");
                    }
                }
            }
            if (isCSV) {
                var csvContent = lineArray.join("\n");
                var encodedUri = encodeURI(csvContent);
                var link = document.createElement("a");
                link.href = encodedUri;
                link.setAttribute("download", fileName);
                var node = document.body.appendChild(link);
                link.click();
                document.body.removeChild(node);
            }
            if (isTab) {
                w.document.write("</table></body></html>");
                w.document.close();
                w = null;
            }
            streets = [];
        }
    }
    WMEWAL_Cities.ScanComplete = ScanComplete;
    function ScanCancelled() {
        ScanComplete();
    }
    WMEWAL_Cities.ScanCancelled = ScanCancelled;
    function getStreetPL(street) {
        var latlon = OpenLayers.Layer.SphericalMercator.inverseMercator(street.center.x, street.center.y);
        var url = "https://www.waze.com/editor/?env=" + Waze.location.code + "&lon=" + latlon.lon + "&lat=" + latlon.lat + "&zoom=" + WMEWAL.zoomLevel + "&segments=";
        for (var ix = 0; ix < street.segments.length; ix++) {
            if (ix > 0) {
                url += ",";
            }
            url += street.segments[ix].id;
        }
        return url;
    }
    function getSegmentPL(segment) {
        var latlon = OpenLayers.Layer.SphericalMercator.inverseMercator(segment.center.x, segment.center.y);
        return "https://www.waze.com/editor/?env=" + Waze.location.code + "&lon=" + latlon.lon + "&lat=" + latlon.lat + "&zoom=5&segments=" + segment.id;
    }
    function getStreetName(street) {
        return street.name || "No street";
    }
    function Init() {
        console.group(pluginName + ": Initializing");
        initCount++;
        var objectToCheck = [
            "Waze.location",
            "Waze.model.states",
            "OpenLayers",
            "WMEWAL.RegisterPlugIn"];
        for (var i = 0; i < objectToCheck.length; i++) {
            var path = objectToCheck[i].split(".");
            var object = window;
            for (var j = 0; j < path.length; j++) {
                object = object[path[j]];
                if (typeof object === "undefined" || object == null) {
                    console.warn(path[j] + " NOT OK");
                    if (initCount < 60) {
                        console.groupEnd();
                        window.setTimeout(Init, 1000);
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
        if (typeof Storage !== "undefined") {
            if (localStorage[settingsKey]) {
                settings = JSON.parse(localStorage[settingsKey]);
            }
            if (localStorage[savedSettingsKey]) {
                savedSettings = JSON.parse(WMEWAL.LZString.decompress(localStorage[savedSettingsKey]));
                for (var ix = 0; ix < savedSettings.length; ix++) {
                    if (savedSettings[ix].Setting.hasOwnProperty("OutputTo")) {
                        delete savedSettings[ix].Setting.OutputTo;
                    }
                }
            }
        }
        if (settings == null) {
            settings = {
                RoadTypeMask: WMEWAL.RoadType.Freeway,
                OutputTo: "csv",
                State: null,
                StateOperation: Operation.Equal,
                ExcludeJunctionBoxes: true,
                EditableByMe: true,
                CityRegex: null,
                CityRegexIgnoreCase: true,
                PolygonLayerUniqueName: null
            };
        }
        console.log("Initialized");
        console.groupEnd();
        WMEWAL.RegisterPlugIn(WMEWAL_Cities);
    }
    function updateSavedSettings() {
        if (typeof Storage !== "undefined") {
            localStorage[savedSettingsKey] = WMEWAL.LZString.compress(JSON.stringify(savedSettings));
        }
        updateSavedSettingsList();
    }
    function updateSettings() {
        if (typeof Storage !== "undefined") {
            localStorage[settingsKey] = JSON.stringify(settings);
        }
    }
    Init();
})(WMEWAL_Cities || (WMEWAL_Cities = {}));
