// ==UserScript==
// @name                WME Wide-Angle Lens Locks
// @namespace           https://greasyfork.org/en/users/19861-vtpearce
// @description         Find segments that don't match lock levels
// @author              vtpearce
// @include             https://www.waze.com/editor
// @include             /^https:\/\/(www|beta)\.waze\.com\/(?!user\/)(.{2,6}\/)?editor.*$/
// @version             1.1.7b1
// @grant               none
// @copyright           2017 vtpearce
// @license             CC BY-SA 4.0
// @updateURL           https://greasyfork.org/scripts/39522-wme-wide-angle-lens-locks/code/WME%20Wide-Angle%20Lens%20Locks.meta.js
// @downloadURL         https://greasyfork.org/scripts/39522-wme-wide-angle-lens-locks/code/WME%20Wide-Angle%20Lens%20Locks.user.js
// ==/UserScript==
// ---------------------------------------------------------------------------------------
var WMEWAL_Locks;
(function (WMEWAL_Locks) {
    var IncludeInOutput;
    (function (IncludeInOutput) {
        IncludeInOutput[IncludeInOutput["Low"] = 1] = "Low";
        IncludeInOutput[IncludeInOutput["High"] = 2] = "High";
    })(IncludeInOutput || (IncludeInOutput = {}));
    var Operation;
    (function (Operation) {
        Operation[Operation["Equal"] = 1] = "Equal";
        Operation[Operation["NotEqual"] = 2] = "NotEqual";
    })(Operation || (Operation = {}));
    var pluginName = "WMEWAL-Locks";
    WMEWAL_Locks.Title = "Locks";
    WMEWAL_Locks.MinimumZoomLevel = 2;
    WMEWAL_Locks.SupportsSegments = true;
    WMEWAL_Locks.SupportsVenues = false;
    var settingsKey = "WMEWALLocksSettings";
    var savedSettingsKey = "WMEWALLocksSavedSettings";
    var settings = null;
    var savedSettings = [];
    var streets = null;
    var state;
    var stateName;
    var nameRegex = null;
    var cityRegex = null;
    var initCount = 0;
    function GetTab() {
        var html = "<table style='border-collapse: separate; border-spacing:0px 1px;'>";
        html += "<tbody>";
        html += "<tr><td style='font-size:1.2em'><b>Output To:</b></td></tr>";
        html += "<tr><td style='padding-left:20px'>" +
            "<select id='_wmewalLocksOutputTo'>" +
            "<option value='csv'>CSV File</option>" +
            "<option value='tab'>Browser Tab</option>" +
            "<option value='both'>Both CSV File and Browser Tab</option></select></td></tr>";
        html += "<tr><td style='border-top: 1px solid; font-size: 1.2em'><b>Saved Settings</b></td></tr>";
        html += "<tr><td style='padding-left: 20px; padding-bottom: 8px'>" +
            "<select id='_wmewalLocksSavedSettings'/><br/>" +
            "<button class='btn btn-primary' id='_wmewalLocksLoadSetting' title='Load'>Load</button>" +
            "<button class='btn btn-primary' style='margin-left: 4px;' id='_wmewalLocksSaveSetting' title='Save'>Save</button>" +
            "<button class='btn btn-primary' style='margin-left: 4px;' id='_wmewalLocksDeleteSetting' title='Delete'>Delete</button></td></tr>";
        html += "<tr><td style='border-top: 1px solid; padding-top: 4px;font-size:1.2em'><b>Lock Levels</b></td></tr>";
        html += "<tr><td><table style='border-collapse: separate; border-spacing: 0px'>";
        html += "<tr><td><b>Include in output</b></td>" +
            "<td><select id='_wmewalLocksIncludeInOutput'>" +
            "<option value='" + IncludeInOutput.Low.toString() + "'>Locked too low</option>" +
            "<option value='" + IncludeInOutput.High.toString() + "'>Locked too high</option>" +
            "<option value='" + (IncludeInOutput.Low | IncludeInOutput.High).toString() + "'>Locked incorrectly</option></select></td></tr>";
        html += "<tr><td>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.Street)) + "</td><td><select id='_wmewalLocksStreet'>" +
            "<option value='1' selected='selected'>1</option>" +
            "<option value='2'>2</option>" +
            "<option value='3'>3</option>" +
            "<option value='4'>4</option>" +
            "<option value='5'>5</option>" +
            "<option value='6'>6</option></select>" +
            "<br/><input id='_wmewalLocksPlusOneWayStreet' type='checkbox'/><label for='_wmewalLocksPlusOneWayStreet' style='margin-left: 8px'>+1 for One-Way</label>" +
            "</td></tr>";
        html += "<tr><td>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.PrimaryStreet)) + "</td><td><select id='_wmewalLocksPrimaryStreet'>" +
            "<option value='1'>1</option>" +
            "<option value='2' selected='selected'>2</option>" +
            "<option value='3'>3</option>" +
            "<option value='4'>4</option>" +
            "<option value='5'>5</option>" +
            "<option value='6'>6</option></select>" +
            "<br/><input id='_wmewalLocksPlusOneWayPS' type='checkbox'/><label for='_wmewalLocksPlusOneWayPS' style='margin-left: 8px'>+1 for One-Way</label></td></tr>";
        html += "<tr><td>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.MinorHighway)) + "</td><td><select id='_wmewalLocksMinorHighway'>" +
            "<option value='1'>1</option>" +
            "<option value='2'>2</option>" +
            "<option value='3' selected='selected'>3</option>" +
            "<option value='4'>4</option>" +
            "<option value='5'>5</option>" +
            "<option value='6'>6</option></select>" +
            "<br/><input id='_wmewalLocksPlusOneWayMinorH' type='checkbox'/><label for='_wmewalLocksPlusOneWayMinorH' style='margin-left: 8px'>+1 for One-Way</label></td></tr>";
        html += "<tr><td>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.MajorHighway)) + "</td><td><select id='_wmewalLocksMajorHighway'>" +
            "<option value='1'>1</option>" +
            "<option value='2'>2</option>" +
            "<option value='3'>3</option>" +
            "<option value='4' selected='selected'>4</option>" +
            "<option value='5'>5</option>" +
            "<option value='6'>6</option></select>" +
            "<br/><input id='_wmewalLocksPlusOneWayMajorH' type='checkbox'/><label for='_wmewalLocksPlusOneWayMajorH' style='margin-left: 8px'>+1 for One-Way</label></td></tr>";
        html += "<tr><td>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.Freeway)) + "</td><td><select id='_wmewalLocksFreeway'>" +
            "<option value='1'>1</option>" +
            "<option value='2'>2</option>" +
            "<option value='3'>3</option>" +
            "<option value='4'>4</option>" +
            "<option value='5' selected='selected'>5</option>" +
            "<option value='6'>6</option></select>" +
            "<br/><input id='_wmewalLocksPlusOneWayFW' type='checkbox'/><label for='_wmewalLocksPlusOneWayFW' style='margin-left: 8px'>+1 for One-Way</label></td></tr>";
        html += "<tr><td>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.Ramp)) + "</td><td><select id='_wmewalLocksRamp'>" +
            "<option value='7' selected='selected'>Highest connection</option>" +
            "<option value='1'>1</option>" +
            "<option value='2'>2</option>" +
            "<option value='3'>3</option>" +
            "<option value='4'>4</option>" +
            "<option value='5'>5</option>" +
            "<option value='6'>6</option></select>" +
            "<br/><input id='_wmewalLocksPlusOneWayRamp' type='checkbox'/><label for='_wmewalLocksPlusOneWayRamp' style='margin-left: 8px'>+1 for One-Way</label></td></tr>";
        html += "<tr><td>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.Railroad)) + "</td><td><select id='_wmewalLocksRailroad'>" +
            "<option value='1'>1</option>" +
            "<option value='2' selected='selected'>2</option>" +
            "<option value='3'>3</option>" +
            "<option value='4'>4</option>" +
            "<option value='5'>5</option>" +
            "<option value='6'>6</option></select>" +
            "</td></tr>";
        html += "</table></td></tr>";
        html += "<tr><td style='border-top: 1px solid; padding-top: 4px;font-size:1.2em'><b>Filters</b></td></tr>";
        html += "<tr><td><b>Name RegEx:</b></td></tr>";
        html += "<tr><td style='padding-left: 20px'><input type='text' id='_wmewalLocksName' class='wal-textbox'/><br/>" +
            "<input id='_wmewalLocksIgnoreCase' type='checkbox'/>" +
            "<label for='_wmewalLocksIgnoreCase' style='margin-left: 8px'>Ignore case</label></td></tr>";
        html += "<tr><td><b>City RegEx:</b></td></tr>";
        html += "<tr><td style='padding-left: 20px'><input type='text' id='_wmewalLocksCity' class='wal-textbox'/><br/>" +
            "<input id='_wmewalLocksCityIgnoreCase' type='checkbox'/>" +
            "<label for='_wmewalLocksCityIgnoreCase' style='margin-left: 8px'>Ignore case</label></td></tr>";
        html += "<tr><td><b>State:</b></td></tr>";
        html += "<tr><td style='padding-left: 20px'>" +
            "<select id='_wmewalLocksStateOp'>" +
            "<option value='" + Operation.Equal.toString() + "' selected='selected'>=</option>" +
            "<option value='" + Operation.NotEqual.toString() + "'>&lt;&gt;</option></select>" +
            "<select id='_wmewalLocksState'/></td></tr>";
        html += "<tr><td><b>Road Type:</b></td></tr>";
        html += "<tr><td style='padding-left: 20px'>" +
            "<button id='_wmewalLocksRoadTypeAny' class='btn btn-primary' style='margin-right: 8px' title='Any'>Any</button>" +
            "<button id='_wmewalLocksRoadTypeClear' class='btn btn-primary' title='Clear'>Clear</button><br/>" +
            "<input type='checkbox' id='_wmewalLocksRoadTypeStreet' name='_wmewalLocksRoadType' value='" + WMEWAL.RoadType.Street.toString() + "'/>" +
            "<label for='_wmewalLocksRoadTypeStreet' style='margin-left: 8px'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.Street)) + "</label><br/>" +
            "<input type='checkbox' id='_wmewalLocksRoadTypePrimary' name='_wmewalLocksRoadType' value='" + WMEWAL.RoadType.PrimaryStreet.toString() + "'/>" +
            "<label for='_wmewalLocksRoadTypePrimary' style='margin-left: 8px'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.PrimaryStreet)) + "</label><br/>" +
            "<input type='checkbox' id='_wmewalLocksRoadTypeMinorHighway' name='_wmewalLocksRoadType' value='" + WMEWAL.RoadType.MinorHighway.toString() + "'/>" +
            "<label for='_wmewalLocksRoadTypeMinorHighway' style='margin-left: 8px'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.MinorHighway)) + "</label><br/>" +
            "<input type='checkbox' id='_wmewalLocksRoadTypeMajorHighway' name='_wmewalLocksRoadType' value='" + WMEWAL.RoadType.MajorHighway.toString() + "'/>" +
            "<label for='_wmewalLocksRoadTypeMajorHighway' style='margin-left: 8px'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.MajorHighway)) + "</label><br/>" +
            "<input type='checkbox' id='_wmewalLocksRoadTypeRamp' name='_wmewalLocksRoadType' value='" + WMEWAL.RoadType.Ramp.toString() + "'/>" +
            "<label for='_wmewalLocksRoadTypeRamp' style='margin-left: 8px'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.Ramp)) + "</label><br/>" +
            "<input type='checkbox' checked='checked' id='_wmewalLocksRoadTypeFreeway' name='_wmewalLocksRoadType' value='" + WMEWAL.RoadType.Freeway.toString() + "'/>" +
            "<label for='_wmewalLocksRoadTypeFreeway' style='margin-left: 8px'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.Freeway)) + "</label><br/>" +
            "<input type='checkbox' checked='checked' id='_wmewalLocksRoadTypeRailroad' name='_wmewalLocksRoadType' value='" + WMEWAL.RoadType.Railroad.toString() + "'/>" +
            "<label for='_wmewalLocksRoadTypeRailroad' style='margin-left: 8px'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.Railroad)) + "</label>" +
            "</td></tr>";
        html += "<tr><td><input id='_wmewalLocksEditable' type='checkbox'/>" +
            "<label for='_wmewalLocksEditable' style='margin-left: 8px'>Editable by me</label></td></tr>";
        html += "<tr><td><input id='_wmewalLocksExcludeRoundabouts' type='checkbox'/>" +
            "<label for='_wmewalLocksExcludeRoundabouts' style='margin-left: 8px'>Exclude Roundabouts</label></td></tr>";
        html += "<tr><td><input id='_wmewalLocksExcludeJunctionBoxes' type='checkbox' checked='checked'/>" +
            "<label for='_wmewalLocksExcludeJunctionBoxes' style='margin-left: 8px'>Exclude Junction Boxes</label></td></tr>";
        html += "</tbody></table>";
        return html;
    }
    WMEWAL_Locks.GetTab = GetTab;
    function TabLoaded() {
        updateStates();
        updateUI();
        updateSavedSettingsList();
        $("#_wmewalLocksState").on("focus", updateStates);
        $("#_wmewalLocksRoadTypeAny").on("click", function () {
            $("input[name=_wmewalLocksRoadType]").prop("checked", true);
        });
        $("#_wmewalLocksRoadTypeClear").on("click", function () {
            $("input[name=_wmewalLocksRoadType]").prop("checked", false);
        });
        $("#_wmewalLocksLoadSetting").on("click", loadSetting);
        $("#_wmewalLocksSaveSetting").on("click", saveSetting);
        $("#_wmewalLocksDeleteSetting").on("click", deleteSetting);
    }
    WMEWAL_Locks.TabLoaded = TabLoaded;
    function updateStates() {
        var selectState = $("#_wmewalLocksState");
        // Preserve current selection
        var currentId = parseInt(selectState.val());
        selectState.empty();
        var stateObjs = [];
        stateObjs.push({ id: null, name: "" });
        for (var s in W.model.states.objects) {
            if (W.model.states.objects.hasOwnProperty(s)) {
                var st = W.model.states.get(parseInt(s));
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
    function updateSavedSettingsList() {
        var s = $("#_wmewalLocksSavedSettings");
        s.empty();
        for (var ixSaved = 0; ixSaved < savedSettings.length; ixSaved++) {
            var opt = $("<option/>").attr("value", ixSaved).text(savedSettings[ixSaved].Name);
            s.append(opt);
        }
    }
    function updateUI() {
        $("#_wmewalLocksOutputTo").val(settings.OutputTo);
        $("#_wmewalLocksIncludeInOutput").val(settings.IncludeInOutput);
        $("#_wmewalLocksStreet").val(settings.StreetLockLevel);
        $("#_wmewalLocksPrimaryStreet").val(settings.PrimaryStreetLockLevel);
        $("#_wmewalLocksMinorHighway").val(settings.MinorHighwayLockLevel);
        $("#_wmewalLocksMajorHighway").val(settings.MajorHighwayLockLevel);
        $("#_wmewalLocksFreeway").val(settings.FreewayLockLevel);
        $("#_wmewalLocksRamp").val(settings.RampLockLevel);
        $("#_wmewalLocksRailroad").val(settings.RailroadLockLevel);
        $("#_wmewalLocksName").val(settings.Regex || "");
        $("#_wmewalLocksIgnoreCase").prop("checked", settings.RegexIgnoreCase);
        $("#_wmewalLocksCity").val(settings.CityRegex || "");
        $("#_wmewalLocksCityIgnoreCase").prop("checked", settings.CityRegexIgnoreCase);
        $("#_wmewalLocksState").val(settings.State);
        $("#_wmewalLocksRoadTypeStreet").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.Street);
        $("#_wmewalLocksRoadTypePrimary").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.PrimaryStreet);
        $("#_wmewalLocksRoadTypeMinorHighway").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.MinorHighway);
        $("#_wmewalLocksRoadTypeMajorHighway").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.MajorHighway);
        $("#_wmewalLocksRoadTypeRamp").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.Ramp);
        $("#_wmewalLocksRoadTypeFreeway").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.Freeway);
        $("#_wmewalLocksRoadTypeRailroad").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.Railroad);
        $("#_wmewalLocksEditable").prop("checked", settings.EditableByMe);
        $("#_wmewalLocksExcludeRoundabouts").prop("checked", settings.ExcludeRoundabouts);
        $("#_wmewalLocksExcludeJunctionBoxes").prop("checked", settings.ExcludeJunctionBoxes);
        $("#_wmewalLocksPlusOneWayStreet").prop("checked", settings.PlusOneWayMask & WMEWAL.RoadType.Street);
        $("#_wmewalLocksPlusOneWayPS").prop("checked", settings.PlusOneWayMask & WMEWAL.RoadType.PrimaryStreet);
        $("#_wmewalLocksPlusOneWayMinorH").prop("checked", settings.PlusOneWayMask & WMEWAL.RoadType.MinorHighway);
        $("#_wmewalLocksPlusOneWayMajorH").prop("checked", settings.PlusOneWayMask & WMEWAL.RoadType.MajorHighway);
        $("#_wmewalLocksPlusOneWayFW").prop("checked", settings.PlusOneWayMask & WMEWAL.RoadType.Freeway);
        $("#_wmewalLocksPlusOneWayRamp").prop("checked", settings.PlusOneWayMask & WMEWAL.RoadType.Ramp);
        $("#_wmewalLocksStateOp").val(settings.StateOperation || Operation.Equal.toString());
    }
    function loadSetting() {
        var selectedSetting = parseInt($("#_wmewalLocksSavedSettings").val());
        if (selectedSetting == null || isNaN(selectedSetting) || selectedSetting < 0 || selectedSetting > savedSettings.length) {
            return;
        }
        var savedSetting = savedSettings[selectedSetting].Setting;
        settings.OutputTo = $("#_wmewalLocksOutputTo").val();
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
        $("input[name=_wmewalLocksRoadType]:checked").each(function (ix, e) {
            mask = mask | parseInt(e.value);
        });
        if (mask === 0) {
            message = "Please select at least one road type.";
            allOk = false;
        }
        var selectedState = $("#_wmewalLocksState").val();
        if (selectedState != null && selectedState.length > 0) {
            if (W.model.states.get(selectedState) == null) {
                message += ((message.length > 0 ? "\n" : "") + "Invalid state selection");
                allOk = false;
            }
        }
        var ignoreCase = $("#_wmewalLocksIgnoreCase").prop("checked");
        var pattern = $("#_wmewalLocksName").val();
        var r;
        if (pattern.length > 0) {
            try {
                r = (ignoreCase ? new RegExp(pattern, "i") : new RegExp(pattern));
            }
            catch (error) {
                message += ((message.length > 0 ? "\n" : "") + "Name RegEx is invalid");
                allOk = false;
            }
        }
        ignoreCase = $("#_wmewalLocksCityIgnoreCase").prop("checked");
        pattern = $("#_wmewalLocksCity").val();
        if (pattern.length > 0) {
            try {
                r = (ignoreCase ? new RegExp(pattern, "i") : new RegExp(pattern));
            }
            catch (error) {
                message += ((message.length > 0 ? "\n" : "") + "City RegEx is invalid");
                allOk = false;
            }
        }
        if (!allOk) {
            alert(pluginName + ": " + message);
        }
        return allOk;
    }
    function saveSetting() {
        if (validateSettings()) {
            var plusOneWayMask = 0;
            var s_1 = {
                RoadTypeMask: null,
                State: null,
                Regex: null,
                RegexIgnoreCase: $("#_wmewalLocksIgnoreCase").prop("checked"),
                ExcludeJunctionBoxes: $("#_wmewalLocksExcludeJunctionBoxes").prop("checked"),
                ExcludeRoundabouts: $("#_wmewalLocksExcludeRoundabouts").prop("checked"),
                EditableByMe: $("#_wmewalLocksEditable").prop("checked"),
                StreetLockLevel: parseInt($("#_wmewalLocksStreet").val()),
                PrimaryStreetLockLevel: parseInt($("#_wmewalLocksPrimaryStreet").val()),
                MinorHighwayLockLevel: parseInt($("#_wmewalLocksMinorHighway").val()),
                MajorHighwayLockLevel: parseInt($("#_wmewalLocksMajorHighway").val()),
                FreewayLockLevel: parseInt($("#_wmewalLocksFreeway").val()),
                RampLockLevel: parseInt($("#_wmewalLocksRamp").val()),
                IncludeInOutput: parseInt($("#_wmewalLocksIncludeInOutput").val()),
                PlusOneWayMask: plusOneWayMask,
                CityRegex: null,
                CityRegexIgnoreCase: $("#_wmewalLocksCityIgnoreCase").prop("checked"),
                StateOperation: parseInt($("#_wmewalLocksStateOp").val()),
                RailroadLockLevel: parseInt($("#_wmewalLocksRailroad").val())
            };
            s_1.RoadTypeMask = 0;
            $("input[name=_wmewalLocksRoadType]:checked").each(function (ix, e) {
                s_1.RoadTypeMask = s_1.RoadTypeMask | parseInt(e.value);
            });
            if ($("#_wmewalLocksPlusOneWayStreet").prop("checked")) {
                plusOneWayMask = plusOneWayMask | WMEWAL.RoadType.Street;
            }
            if ($("#_wmewalLocksPlusOneWayPS").prop("checked")) {
                plusOneWayMask = plusOneWayMask | WMEWAL.RoadType.PrimaryStreet;
            }
            if ($("#_wmewalLocksPlusOneWayMinorH").prop("checked")) {
                plusOneWayMask = plusOneWayMask | WMEWAL.RoadType.MinorHighway;
            }
            if ($("#_wmewalLocksPlusOneWayMajorH").prop("checked")) {
                plusOneWayMask = plusOneWayMask | WMEWAL.RoadType.MajorHighway;
            }
            if ($("#_wmewalLocksPlusOneWayFW").prop("checked")) {
                plusOneWayMask = plusOneWayMask | WMEWAL.RoadType.Freeway;
            }
            if ($("#_wmewalLocksPlusOneWayRamp").prop("checked")) {
                plusOneWayMask = plusOneWayMask | WMEWAL.RoadType.Ramp;
            }
            var selectedState = $("#_wmewalLocksState").val();
            if (selectedState != null && selectedState.length > 0) {
                s_1.State = W.model.states.get(parseInt(selectedState)).id;
            }
            var pattern = $("#_wmewalLocksName").val();
            if (pattern.length > 0) {
                s_1.Regex = pattern;
            }
            pattern = $("#_wmewalLocksCity").val();
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
        var selectedSetting = parseInt($("#_wmewalLocksSavedSettings").val());
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
        streets = [];
        if (allOk) {
            settings.OutputTo = $("#_wmewalLocksOutputTo").val();
            settings.RoadTypeMask = 0;
            $("input[name=_wmewalLocksRoadType]:checked").each(function (ix, e) {
                settings.RoadTypeMask = settings.RoadTypeMask | parseInt(e.value);
            });
            var selectedState = $("#_wmewalLocksState").val();
            state = null;
            settings.State = null;
            stateName = null;
            if (selectedState != null && selectedState.length > 0) {
                state = W.model.states.get(selectedState);
                settings.State = state.id;
                stateName = state.name;
            }
            settings.StateOperation = parseInt($("#_wmewalLocksStateOp").val());
            settings.RegexIgnoreCase = $("#_wmewalLocksIgnoreCase").prop("checked");
            var pattern = $("#_wmewalLocksName").val();
            settings.Regex = null;
            nameRegex = null;
            if (pattern.length > 0) {
                settings.Regex = pattern;
                nameRegex = (settings.RegexIgnoreCase ? new RegExp(pattern, "i") : new RegExp(pattern));
            }
            settings.CityRegexIgnoreCase = $("#_wmewalLocksCityIgnoreCase").prop("checked");
            pattern = $("#_wmewalLocksCity").val();
            settings.CityRegex = null;
            cityRegex = null;
            if (pattern.length > 0) {
                settings.CityRegex = pattern;
                cityRegex = (settings.CityRegexIgnoreCase ? new RegExp(pattern, "i") : new RegExp(pattern));
            }
            settings.ExcludeRoundabouts = $("#_wmewalLocksExcludeRoundabouts").prop("checked");
            settings.ExcludeJunctionBoxes = $("#_wmewalLocksExcludeJunctionBoxes").prop("checked");
            settings.EditableByMe = $("#_wmewalLocksEditable").prop("checked");
            settings.StreetLockLevel = parseInt($("#_wmewalLocksStreet").val());
            settings.PrimaryStreetLockLevel = parseInt($("#_wmewalLocksPrimaryStreet").val());
            settings.MinorHighwayLockLevel = parseInt($("#_wmewalLocksMinorHighway").val());
            settings.MajorHighwayLockLevel = parseInt($("#_wmewalLocksMajorHighway").val());
            settings.FreewayLockLevel = parseInt($("#_wmewalLocksFreeway").val());
            settings.RampLockLevel = parseInt($("#_wmewalLocksRamp").val());
            settings.RailroadLockLevel = parseInt($("#_wmewalLocksRailroad").val());
            settings.IncludeInOutput = parseInt($("#_wmewalLocksIncludeInOutput").val());
            var plusOneWayMask = 0;
            if ($("#_wmewalLocksPlusOneWayStreet").prop("checked")) {
                plusOneWayMask = plusOneWayMask | WMEWAL.RoadType.Street;
            }
            if ($("#_wmewalLocksPlusOneWayPS").prop("checked")) {
                plusOneWayMask = plusOneWayMask | WMEWAL.RoadType.PrimaryStreet;
            }
            if ($("#_wmewalLocksPlusOneWayMinorH").prop("checked")) {
                plusOneWayMask = plusOneWayMask | WMEWAL.RoadType.MinorHighway;
            }
            if ($("#_wmewalLocksPlusOneWayMajorH").prop("checked")) {
                plusOneWayMask = plusOneWayMask | WMEWAL.RoadType.MajorHighway;
            }
            if ($("#_wmewalLocksPlusOneWayFW").prop("checked")) {
                plusOneWayMask = plusOneWayMask | WMEWAL.RoadType.Freeway;
            }
            if ($("#_wmewalLocksPlusOneWayRamp").prop("checked")) {
                plusOneWayMask = plusOneWayMask | WMEWAL.RoadType.Ramp;
            }
            settings.PlusOneWayMask = plusOneWayMask;
            if (settings.RoadTypeMask & 1 || settings.RoadTypeMask & 4096) {
                WMEWAL_Locks.MinimumZoomLevel = 4;
            }
            else {
                WMEWAL_Locks.MinimumZoomLevel = 2;
            }
            updateSettings();
        }
        return allOk;
    }
    WMEWAL_Locks.ScanStarted = ScanStarted;
    function isOneWay(segment) {
        return segment.attributes.fwdDirection !== segment.attributes.revDirection && (segment.attributes.fwdDirection || segment.attributes.revDirection);
    }
    function ScanExtent(segments, venues) {
        var def = $.Deferred();
        var extentStreets = [];
        function addSegment(s, rId) {
            var sid = s.attributes.primaryStreetID;
            var address = s.getAddress();
            var thisStreet = null;
            if (sid != null) {
                // let street = W.model.streets.get(sid);
                thisStreet = extentStreets.find(function (e) {
                    var matches = (e.id === sid && (e.lockLevel === (s.attributes.lockRank || 0) + 1) && e.roundaboutId === rId && e.roadType === s.attributes.roadType);
                    if (matches && (nameRegex != null || cityRegex != null)) {
                        // Test for alt names
                        for (var ixAlt = 0; ixAlt < e.altStreets.length && matches; ixAlt++) {
                            matches = false;
                            for (var ixSegAlt = 0; ixSegAlt < address.altStreets.length && !matches; ixSegAlt++) {
                                if (e.altStreets[ixAlt].id === address.altStreets[ixSegAlt].id) {
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
                    city: (address.city != null && address.city.attributes != null && address.city.attributes.name != null ? address.city.attributes.name : "No city"),
                    state: (address.state != null && address.state.name != null ? address.state.name : "No state"),
                    name: (address.street != null ? address.street.name : "No street"),
                    geometries: new OL.Geometry.Collection(),
                    lockLevel: (s.attributes.lockRank || 0) + 1,
                    segments: [],
                    roundaboutId: rId,
                    altStreets: [],
                    roadType: s.attributes.roadType
                };
                if (nameRegex != null) {
                    for (var ixAlt = 0; ixAlt < s.attributes.streetIDs.length; ixAlt++) {
                        var altStreet = W.model.streets.get(s.attributes.streetIDs[ixAlt]);
                        if (altStreet != null) {
                            thisStreet.altStreets.push({
                                id: s.attributes.streetIDs[ixAlt],
                                name: altStreet.name
                            });
                        }
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
        for (var ix = 0; ix < segments.length; ix++) {
            var segment = segments[ix];
            if (segment != null) {
                if ((WMEWAL.WazeRoadTypeToRoadTypeBitmask(segment.attributes.roadType) & settings.RoadTypeMask) &&
                    (!settings.EditableByMe || segment.arePropertiesEditable()) &&
                    (!settings.ExcludeJunctionBoxes || !segment.isInBigJunction())) {
                    var address = segment.getAddress();
                    if (state != null) {
                        if (address != null && address.state != null) {
                            if (settings.StateOperation === Operation.Equal && address.state.id !== state.id ||
                                settings.StateOperation === Operation.NotEqual && address.state.id === state.id) {
                                continue;
                            }
                        }
                        else if (settings.StateOperation === Operation.Equal) {
                            continue;
                        }
                    }
                    var plusOne = (isOneWay(segment) && (WMEWAL.WazeRoadTypeToRoadTypeBitmask(segment.attributes.roadType) & settings.PlusOneWayMask)) ? 1 : 0;
                    var incorrectLock = false;
                    switch (segment.attributes.roadType) {
                        case 1:
                            if ((settings.IncludeInOutput & IncludeInOutput.Low && (segment.attributes.lockRank || 0) + 1 < settings.StreetLockLevel + plusOne) ||
                                (settings.IncludeInOutput & IncludeInOutput.High && (segment.attributes.lockRank || 0) + 1 > settings.StreetLockLevel + plusOne)) {
                                incorrectLock = true;
                            }
                            break;
                        case 2:
                            if ((settings.IncludeInOutput & IncludeInOutput.Low && (segment.attributes.lockRank || 0) + 1 < settings.PrimaryStreetLockLevel + plusOne) ||
                                (settings.IncludeInOutput & IncludeInOutput.High && (segment.attributes.lockRank || 0) + 1 > settings.PrimaryStreetLockLevel + plusOne)) {
                                incorrectLock = true;
                            }
                            break;
                        case 3:
                            if ((settings.IncludeInOutput & IncludeInOutput.Low && (segment.attributes.lockRank || 0) + 1 < settings.FreewayLockLevel + plusOne) ||
                                (settings.IncludeInOutput & IncludeInOutput.High && (segment.attributes.lockRank || 0) + 1 > settings.FreewayLockLevel + plusOne)) {
                                incorrectLock = true;
                            }
                            break;
                        case 4:
                            var expectedLockRank = 0;
                            if (settings.RampLockLevel === 7) {
                                // Find lock rank of every connected segment
                                var fromSegments = segment.getConnectedSegments("from");
                                for (var ix_1 = 0; ix_1 < fromSegments.length; ix_1++) {
                                    if (fromSegments[ix_1].attributes.id !== segment.attributes.id && (fromSegments[ix_1].attributes.lockRank || 0) + 1 > expectedLockRank) {
                                        expectedLockRank = (fromSegments[ix_1].attributes.lockRank || 0) + 1;
                                    }
                                }
                                var toSegments = segment.getConnectedSegments("to");
                                for (var ix_2 = 0; ix_2 < toSegments.length; ix_2++) {
                                    if (toSegments[ix_2].attributes.id !== segment.attributes.id && (toSegments[ix_2].attributes.lockRank || 0) + 1 > expectedLockRank) {
                                        expectedLockRank = (toSegments[ix_2].attributes.lockRank || 0) + 1;
                                    }
                                }
                            }
                            else {
                                expectedLockRank = settings.RampLockLevel;
                            }
                            expectedLockRank += plusOne;
                            if ((settings.IncludeInOutput & IncludeInOutput.Low && (segment.attributes.lockRank || 0) + 1 < expectedLockRank) ||
                                (settings.IncludeInOutput & IncludeInOutput.High && (segment.attributes.lockRank || 0) + 1 > expectedLockRank)) {
                                incorrectLock = true;
                            }
                            break;
                        case 6:
                            if ((settings.IncludeInOutput & IncludeInOutput.Low && (segment.attributes.lockRank || 0) + 1 < settings.MajorHighwayLockLevel + plusOne) ||
                                (settings.IncludeInOutput & IncludeInOutput.High && (segment.attributes.lockRank || 0) + 1 > settings.MajorHighwayLockLevel + plusOne)) {
                                incorrectLock = true;
                            }
                            break;
                        case 7:
                            if ((settings.IncludeInOutput & IncludeInOutput.Low && (segment.attributes.lockRank || 0) + 1 < settings.MinorHighwayLockLevel + plusOne) ||
                                (settings.IncludeInOutput & IncludeInOutput.High && (segment.attributes.lockRank || 0) + 1 > settings.MinorHighwayLockLevel + plusOne)) {
                                incorrectLock = true;
                            }
                            break;
                        case 18:
                            if ((settings.IncludeInOutput & IncludeInOutput.Low && (segment.attributes.lockRank || 0) + 1 < settings.RailroadLockLevel + plusOne) ||
                                (settings.IncludeInOutput & IncludeInOutput.High && (segment.attributes.lockRank || 0) + 1 > settings.RailroadLockLevel + plusOne)) {
                                incorrectLock = true;
                            }
                            break;
                        default:
                            break;
                    }
                    if (!incorrectLock) {
                        continue;
                    }
                    if (nameRegex != null || cityRegex != null) {
                        var nameMatched = false;
                        if (address != null) {
                            if (nameRegex != null && address.street != null) {
                                nameMatched = nameRegex.test(address.street.name);
                            }
                            if (!nameMatched && cityRegex != null && address.city != null && address.city.hasName()) {
                                nameMatched = cityRegex.test(address.city.attributes.name);
                            }
                            if (!nameMatched && segment.attributes.streetIDs != null) {
                                for (var streetIx = 0; streetIx < segment.attributes.streetIDs.length && !nameMatched; streetIx++) {
                                    if (segment.attributes.streetIDs[streetIx] != null) {
                                        var street = W.model.streets.get(segment.attributes.streetIDs[streetIx]);
                                        if (street != null) {
                                            if (nameRegex != null) {
                                                nameMatched = nameRegex.test(street.name);
                                            }
                                            if (!nameMatched && cityRegex != null && street.cityID != null) {
                                                var city = W.model.cities.get(street.cityID);
                                                if (city != null && city.hasName()) {
                                                    nameMatched = cityRegex.test(city.attributes.name);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        if (!nameMatched) {
                            continue;
                        }
                    }
                    if (!WMEWAL.IsSegmentInArea(segment)) {
                        continue;
                    }
                    if (!segment.isInRoundabout()) {
                        addSegment(segment, null);
                    }
                    else if (!settings.ExcludeRoundabouts) {
                        var r = segment.getRoundabout();
                        for (var rIx = 0; rIx < r.segIDs.length; rIx++) {
                            addSegment(W.model.segments.get(r.segIDs[rIx]), r.id);
                        }
                    }
                }
            }
        }
        for (var ix = 0; ix < extentStreets.length; ix++) {
            extentStreets[ix].center = extentStreets[ix].geometries.getCentroid(true);
            delete extentStreets[ix].geometries;
            streets.push(extentStreets[ix]);
        }
        def.resolve();
        return def.promise();
    }
    WMEWAL_Locks.ScanExtent = ScanExtent;
    function ScanComplete() {
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
                cmp = a.city.localeCompare(b.city);
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
            var outputTo = $("#_wmewalLocksOutputTo").val();
            var isCSV = (outputTo === "csv" || outputTo === "both");
            var isTab = (outputTo === "tab" || outputTo === "both");
            var includeAltNames = (nameRegex != null || cityRegex != null);
            var lineArray = void 0;
            var columnArray = void 0;
            var w = void 0;
            var fileName = void 0;
            if (isCSV) {
                lineArray = [];
                columnArray = ["data:text/csv;charset=utf-8,Name"];
                if (includeAltNames) {
                    columnArray.push("Alt Names");
                }
                columnArray.push("City");
                columnArray.push("State");
                columnArray.push("Road Type");
                columnArray.push("Lock Level");
                columnArray.push("Latitude");
                columnArray.push("Longitude");
                columnArray.push("Permalink");
                lineArray.push(columnArray);
                fileName = "Locks_" + WMEWAL.areaName;
                for (var rt in WMEWAL.RoadType) {
                    if (WMEWAL.RoadType.hasOwnProperty(rt)) {
                        var mask = parseInt(rt);
                        if (!isNaN(mask) && settings.RoadTypeMask & mask) {
                            fileName += "_" + WMEWAL.RoadType[mask.toString()];
                        }
                    }
                }
                fileName += ".csv";
            }
            if (isTab) {
                w = window.open();
                w.document.write("<html><head><title>Locks</title></head><body>");
                w.document.write("<h3>Area: " + WMEWAL.areaName + "</h3>");
                w.document.write("<b>Filters</b>");
                w.document.write("<br/>Road Type(s): ");
                var comma = "";
                for (var rt in WMEWAL.RoadType) {
                    if (WMEWAL.RoadType.hasOwnProperty(rt)) {
                        var mask = parseInt(rt);
                        if (!isNaN(mask) && settings.RoadTypeMask & mask) {
                            w.document.write(comma + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(mask)));
                            if (settings.PlusOneWayMask & mask) {
                                w.document.write(" (+1 for one-way)");
                            }
                            comma = ", ";
                        }
                    }
                }
                if (stateName != null) {
                    w.document.write("<br/>State " + (settings.StateOperation === Operation.NotEqual ? "does not equal " : "equals ") + stateName);
                }
                if (nameRegex != null) {
                    w.document.write("<br/>Name matches " + nameRegex.source);
                    if (settings.RegexIgnoreCase) {
                        w.document.write(" (ignoring case)");
                    }
                }
                if (cityRegex != null) {
                    w.document.write("</br/>City name matches " + cityRegex.source);
                    if (settings.CityRegexIgnoreCase) {
                        w.document.write(" (ignoring case)");
                    }
                }
                if (settings.ExcludeRoundabouts) {
                    w.document.write("<br/>Roundabouts excluded");
                }
                if (settings.ExcludeJunctionBoxes) {
                    w.document.write("<br/>Junction boxes excluded");
                }
                if (settings.EditableByMe) {
                    w.document.write("<br/>Editable by me");
                }
                w.document.write("</p><table style='border-collapse: separate; border-spacing: 8px 0px'><tr><th>Name</th>");
                if (includeAltNames) {
                    w.document.write("<th>Alt Names</th>");
                }
                w.document.write("<th>City</th><th>State</th>");
                w.document.write("<th>Road Type</th><th>Lock Level</th><th>Latitude</th><th>Longitude</th><th>Permalink</th></tr>");
            }
            for (var ixStreet = 0; ixStreet < streets.length; ixStreet++) {
                var street = streets[ixStreet];
                var roadTypeText = WMEWAL.TranslateRoadType(street.roadType);
                if (street.name == null && street.roundaboutId == null) {
                    for (var ixSeg = 0; ixSeg < street.segments.length; ixSeg++) {
                        var segment = street.segments[ixSeg];
                        var latlon = OL.Layer.SphericalMercator.inverseMercator(segment.center.x, segment.center.y);
                        var plSeg = getSegmentPL(segment);
                        if (isCSV) {
                            columnArray = [getStreetName(street)];
                            if (includeAltNames) {
                                columnArray.push("");
                            }
                            columnArray.push("\"" + street.city + "\"");
                            columnArray.push("\"" + street.state + "\"");
                            columnArray.push("\"" + roadTypeText + "\"");
                            columnArray.push(street.lockLevel.toString());
                            columnArray.push(latlon.lat.toString());
                            columnArray.push(latlon.lon.toString());
                            columnArray.push("\"" + plSeg + "\"");
                            lineArray.push(columnArray);
                        }
                        if (isTab) {
                            w.document.write("<tr><td>" + getStreetName(street) + "</td>");
                            if (includeAltNames) {
                                w.document.write("<td>&nbsp;</td>");
                            }
                            w.document.write("<td>" + street.city + "</td>");
                            w.document.write("<td>" + street.state + "</td>");
                            w.document.write("<td>" + roadTypeText + "</td><td>" + street.lockLevel + "</td>" +
                                "<td>" + latlon.lat.toString() + "</td><td>" + latlon.lon.toString() + "</td>" +
                                "<td><a href=\'" + plSeg + "\' target=\'_blank\'>Permalink</a></td></tr>");
                        }
                    }
                }
                else {
                    var latlon = OL.Layer.SphericalMercator.inverseMercator(street.center.x, street.center.y);
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
                        if (includeAltNames) {
                            columnArray.push("\"" + altNames + "\"");
                        }
                        columnArray.push("\"" + street.city + "\"");
                        columnArray.push("\"" + street.state + "\"");
                        columnArray.push("\"" + roadTypeText + "\"");
                        columnArray.push(street.lockLevel.toString());
                        columnArray.push(latlon.lat.toString());
                        columnArray.push(latlon.lon.toString());
                        columnArray.push("\"" + plStreet + "\"");
                        lineArray.push(columnArray);
                    }
                    if (isTab) {
                        w.document.write("<tr><td>" + getStreetName(street) + "</td>");
                        if (includeAltNames) {
                            w.document.write("<td>" + altNames + "</td>");
                        }
                        w.document.write("<td>" + street.city + "</td>");
                        w.document.write("<td>" + street.state + "</td>");
                        w.document.write("<td>" + roadTypeText + "</td><td>" + street.lockLevel + "</td>" +
                            "<td>" + latlon.lat.toString() + "</td><td>" + latlon.lon.toString() + "</td>" +
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
        }
    }
    WMEWAL_Locks.ScanComplete = ScanComplete;
    function ScanCancelled() {
        ScanComplete();
    }
    WMEWAL_Locks.ScanCancelled = ScanCancelled;
    function getStreetPL(street) {
        var latlon = OL.Layer.SphericalMercator.inverseMercator(street.center.x, street.center.y);
        var url = "https://www.waze.com/editor/?env=" + W.location.code + "&lon=" + latlon.lon + "&lat=" + latlon.lat + "&zoom=" + WMEWAL.zoomLevel + "&segments=";
        for (var ix = 0; ix < street.segments.length; ix++) {
            if (ix > 0) {
                url += ",";
            }
            url += street.segments[ix].id;
        }
        return url;
    }
    function getSegmentPL(segment) {
        var latlon = OL.Layer.SphericalMercator.inverseMercator(segment.center.x, segment.center.y);
        return "https://www.waze.com/editor/?env=" + W.location.code + "&lon=" + latlon.lon + "&lat=" + latlon.lat + "&zoom=5&segments=" + segment.id;
    }
    function getStreetName(street) {
        return street.name || "No street";
    }
    function Init() {
        console.group(pluginName + ": Initializing");
        initCount++;
        var objectToCheck = [
            "W.location",
            "W.model.states",
            "OL",
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
                try {
                    savedSettings = JSON.parse(WMEWAL.LZString.decompressFromUTF16(localStorage[savedSettingsKey]));
                } catch (e) {
                    console.debug("WMEWAL: "+ e);
                    savedSettings = JSON.parse(WMEWAL.LZString.decompress(localStorage[savedSettingsKey]));
                    updateSavedSettings();
                }
            }
        }
        if (settings == null) {
            settings = {
                OutputTo: "csv",
                RoadTypeMask: WMEWAL.RoadType.Freeway,
                State: null,
                Regex: null,
                RegexIgnoreCase: true,
                ExcludeRoundabouts: false,
                ExcludeJunctionBoxes: true,
                EditableByMe: true,
                StreetLockLevel: 1,
                PrimaryStreetLockLevel: 2,
                MinorHighwayLockLevel: 3,
                MajorHighwayLockLevel: 4,
                FreewayLockLevel: 5,
                RampLockLevel: 7,
                IncludeInOutput: IncludeInOutput.Low | IncludeInOutput.High,
                PlusOneWayMask: 0,
                CityRegex: null,
                CityRegexIgnoreCase: true,
                StateOperation: Operation.Equal,
                RailroadLockLevel: 2
            };
        }
        else {
            if (!settings.hasOwnProperty("RailroadLockLevel")) {
                settings.RailroadLockLevel = 2;
            }
        }
        console.log("Initialized");
        console.groupEnd();
        WMEWAL.RegisterPlugIn(WMEWAL_Locks);
    }
    function updateSavedSettings() {
        if (typeof Storage !== "undefined") {
            localStorage[savedSettingsKey] = WMEWAL.LZString.compressToUTF16(JSON.stringify(savedSettings));
        }
        updateSavedSettingsList();
    }
    function updateSettings() {
        if (typeof Storage !== "undefined") {
            localStorage[settingsKey] = JSON.stringify(settings);
        }
    }
    Init();
})(WMEWAL_Locks || (WMEWAL_Locks = {}));
