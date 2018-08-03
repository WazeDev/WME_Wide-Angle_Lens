// ==UserScript==
// @name                WME Wide-Angle Lens Streets
// @namespace           https://greasyfork.org/en/users/19861-vtpearce
// @description         Find streets that match filter criteria
// @author              vtpearce and crazycaveman
// @include             https://www.waze.com/editor
// @include             /^https:\/\/(www|beta)\.waze\.com\/(?!user\/)(.{2,6}\/)?editor.*$/
// @version             1.5.5
// @grant               none
// @copyright           2017 vtpearce
// @license             CC BY-SA 4.0
// @updateURL           https://greasyfork.org/scripts/40646-wme-wide-angle-lens-streets/code/WME%20Wide-Angle%20Lens%20Streets.meta.js
// @downloadURL         https://greasyfork.org/scripts/40646-wme-wide-angle-lens-streets/code/WME%20Wide-Angle%20Lens%20Streets.user.js
// ==/UserScript==

/*global W, OL, $, WazeWrap, WMEWAL*/

var WMEWAL_Streets;
(function (WMEWAL_Streets) {
    var Direction;
    (function (Direction) {
        Direction[Direction["OneWay"] = 1] = "OneWay";
        Direction[Direction["TwoWay"] = 2] = "TwoWay";
        Direction[Direction["Unknown"] = 3] = "Unknown";
    })(Direction || (Direction = {}));
    var Operation;
    (function (Operation) {
        Operation[Operation["Equal"] = 1] = "Equal";
        Operation[Operation["NotEqual"] = 2] = "NotEqual";
        Operation[Operation["LessThan"] = 3] = "LessThan";
        Operation[Operation["LessThanOrEqual"] = 4] = "LessThanOrEqual";
        Operation[Operation["GreaterThan"] = 5] = "GreaterThan";
        Operation[Operation["GreaterThanOrEqual"] = 6] = "GreaterThanOrEqual";
    })(Operation || (Operation = {}));
    var Issue;
    (function (Issue) {
        Issue[Issue["NoSpeedLimit"] = 1] = "NoSpeedLimit";
        Issue[Issue["TimeBasedRestrictions"] = 2] = "TimeBasedRestrictions";
        Issue[Issue["TimeBasedTurnRestrictions"] = 4] = "TimeBasedTurnRestrictions";
        Issue[Issue["RestrictedJunctionArrows"] = 8] = "RestrictedJunctionArrows";
        Issue[Issue["UTurn"] = 16] = "UTurn";
        Issue[Issue["SoftTurns"] = 32] = "SoftTurns";
        Issue[Issue["UnnecessaryJunctionNode"] = 64] = "UnnecessaryJunctionNode";
        Issue[Issue["Elevation"] = 128] = "Elevation";
        Issue[Issue["SegmentLength"] = 256] = "SegmentLength";
        Issue[Issue["NoName"] = 512] = "NoName";
        Issue[Issue["NoCity"] = 1024] = "NoCity";
        Issue[Issue["RoutingPreference"] = 2048] = "RoutingPreference";
        Issue[Issue["UnknownDirection"] = 4096] = "UnknownDirection";
    })(Issue || (Issue = {}));
    var pluginName = "WMEWAL-Streets";
    WMEWAL_Streets.Title = "Streets";
    WMEWAL_Streets.MinimumZoomLevel = 2;
    WMEWAL_Streets.SupportsSegments = true;
    WMEWAL_Streets.SupportsVenues = false;
    var settingsKey = "WMEWALStreetsSettings";
    var savedSettingsKey = "WMEWALStreetsSavedSettings";
    var settings = null;
    var savedSettings = [];
    var streets = null;
    var state;
    var stateName;
    var lastModifiedBy;
    var lastModifiedByName;
    var nameRegex = null;
    var cityRegex = null;
    var roundabouts = null;
    var detectIssues = false;
    var initCount = 0;
    var Version = GM_info.script.version;
    function GetTab() {
        var html = "<table style='border-collapse: separate; border-spacing:0px 1px;'>";
        html += "<tbody>";
        html += "<tr><td class='wal-heading'>Output To:</td></tr>";
        html += "<tr><td style='padding-left:20px'>" +
            "<select id='_wmewalStreetsOutputTo'>" +
            "<option value='csv'>CSV File</option>" +
            "<option value='tab'>Browser Tab</option>" +
            "<option value='both'>Both CSV File and Browser Tab</option></select></td></tr>";
        html += "<tr><td class='wal-indent'><input type='checkbox' id='_wmewalStreetsIncludeAlt', name='_wmewalStreetsIncludeAlt'>" +
            "<label for='_wmewalStreetsIncludeAlt' style='margin-left:8px;'>Include Alt Names in output</label></td></tr>";
        html += "<tr><td class='wal-heading' style='border-top: 1px solid'>Saved Filters</td></tr>";
        html += "<tr><td class='wal-indent' style='padding-bottom: 8px'>" +
            "<select id='_wmewalStreetsSavedSettings'/><br/>" +
            "<button class='btn btn-primary' id='_wmewalStreetsLoadSetting' title='Load'>Load</button>" +
            "<button class='btn btn-primary' style='margin-left: 4px;' id='_wmewalStreetsSaveSetting' title='Save'>Save</button>" +
            "<button class='btn btn-primary' style='margin-left: 4px;' id='_wmewalStreetsDeleteSetting' title='Delete'>Delete</button></td></tr>";
        html += "<tr><td class='wal-heading' style='border-top: 1px solid; padding-top: 4px'>Filters (All Of These)</td></tr>";
        html += "<tr><td><b>Lock Level:</b></td></tr>";
        html += "<tr><td class='wal-indent'>" +
            "<select id='_wmewalStreetsLockLevelOp'>" +
            "<option value='" + Operation.Equal.toString() + "' selected='selected'>=</option>" +
            "<option value='" + Operation.NotEqual.toString() + "'>&lt;&gt;</option></select>" +
            "<select id='_wmewalStreetsLockLevel'>" +
            "<option value=''></option>" +
            "<option value='1'>1</option>" +
            "<option value='2'>2</option>" +
            "<option value='3'>3</option>" +
            "<option value='4'>4</option>" +
            "<option value='5'>5</option>" +
            "<option value='6'>6</option></select></td></tr>";
        html += "<tr><td><b>Name RegEx:</b></td></tr>";
        html += "<tr><td class='wal-indent'><input type='text' id='_wmewalStreetsName' class='wal-textbox'/><br/>" +
            "<input id='_wmewalStreetsIgnoreCase' type='checkbox'/>" +
            "<label for='_wmewalStreetsIgnoreCase' class='wal-label'>Ignore case</label></td></tr>";
        html += "<tr><td><b>City RegEx:</b></td></tr>";
        html += "<tr><td class='wal-indent'><input type='text' id='_wmewalStreetsCity' class='wal-textbox'/><br/>" +
            "<input id='_wmewalStreetsCityIgnoreCase' type='checkbox'/>" +
            "<label for='_wmewalStreetsCityIgnoreCase' class='wal-label'>Ignore case</label></td></tr>";
        html += "<tr><td><b>State:</b></td></tr>";
        html += "<tr><td class='wal-indent'>" +
            "<select id='_wmewalStreetsStateOp'>" +
            "<option value='" + Operation.Equal.toString() + "' selected='selected'>=</option>" +
            "<option value='" + Operation.NotEqual.toString() + "'>&lt;&gt;</option></select>" +
            "<select id='_wmewalStreetsState'/></td></tr>";
        html += "<tr><td><b>Direction:</b></td></tr>";
        html += "<tr><td class='wal-indent'>" +
            "<select id='_wmewalStreetsDirection'>" +
            "<option value=''></option>" +
            "<option value='" + Direction.OneWay.toString() + "'>One way</option>" +
            "<option value='" + Direction.TwoWay.toString() + "'>Two way</option>" +
            "<option value='" + Direction.Unknown.toString() + "'>Unknown</option></select></td></tr>";
        html += "<tr><td><b>Last Modified By:</b></td></tr>";
        html += "<tr><td class='wal-indent'>" +
            "<select id='_wmewalStreetsLastModifiedBy'/></td></tr>";
        html += "<tr><td><b>Road Type:</b></td></tr>";
        html += "<tr><td class='wal-indent'>" +
            "<button id='_wmewalStreetsRoadTypeAny' class='btn btn-primary' style='margin-right: 8px' title='Any'>Any</button>" +
            "<button id='_wmewalStreetsRoadTypeClear' class='btn btn-primary' title='Clear'>Clear</button>" +
            "<div><input type='checkbox' checked='checked' id='_wmewalStreetsRoadTypeFreeway' name='_wmewalStreetsRoadType' value='" + WMEWAL.RoadType.Freeway.toString() + "'/>" +
            "<label for='_wmewalStreetsRoadTypeFreeway' class='wal-label'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.Freeway)) + "</label></div>" +
            "<div><input type='checkbox' id='_wmewalStreetsRoadTypeRamp' name='_wmewalStreetsRoadType' value='" + WMEWAL.RoadType.Ramp.toString() + "'/>" +
            "<label for='_wmewalStreetsRoadTypeRamp' class='wal-label'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.Ramp)) + "</label></div>" +
            "<div><input type='checkbox' id='_wmewalStreetsRoadTypeMajorHighway' name='_wmewalStreetsRoadType' value='" + WMEWAL.RoadType.MajorHighway.toString() + "'/>" +
            "<label for='_wmewalStreetsRoadTypeMajorHighway' class='wal-label'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.MajorHighway)) + "</label></div>" +
            "<div><input type='checkbox' id='_wmewalStreetsRoadTypeMinorHighway' name='_wmewalStreetsRoadType' value='" + WMEWAL.RoadType.MinorHighway.toString() + "'/>" +
            "<label for='_wmewalStreetsRoadTypeMinorHighway' class='wal-label'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.MinorHighway)) + "</label></div>" +
            "<div><input type='checkbox' id='_wmewalStreetsRoadTypePrimary' name='_wmewalStreetsRoadType' value='" + WMEWAL.RoadType.PrimaryStreet.toString() + "'/>" +
            "<label for='_wmewalStreetsRoadTypePrimary' class='wal-label'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.PrimaryStreet)) + "</label></div>" +
            "<div><input type='checkbox' id='_wmewalStreetsRoadTypeStreet' name='_wmewalStreetsRoadType' value='" + WMEWAL.RoadType.Street.toString() + "'/>" +
            "<label for='_wmewalStreetsRoadTypeStreet' class='wal-label'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.Street)) + "</label></div>" +
            "<div><input type='checkbox' id='_wmewalStreetsRoadTypeAlley' name='_wmewalStreetsRoadType' value='" + WMEWAL.RoadType.Alley.toString() + "'/>" +
            "<label for='_wmewalStreetsRoadTypeAlley' class='wal-label'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.Alley)) + "</label></div>" +
            "<div><input type='checkbox' id='_wmewalStreetsRoadTypeUnpaved' name='_wmewalStreetsRoadType' value='" + WMEWAL.RoadType.Unpaved.toString() + "'/>" +
            "<label for='_wmewalStreetsRoadTypeUnpaved' class='wal-label'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.Unpaved)) + "</label></div>" +
            "<div><input type='checkbox' id='_wmewalStreetsRoadTypePLR' name='_wmewalStreetsRoadType' value='" + WMEWAL.RoadType.ParkingLotRoad.toString() + "'/>" +
            "<label for='_wmewalStreetsRoadTypePLR' class='wal-label'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.ParkingLotRoad)) + "</label></div>" +
            "<div><input type='checkbox' id='_wmewalStreetsRoadTypePrivate' name='_wmewalStreetsRoadType' value='" + WMEWAL.RoadType.PrivateRoad.toString() + "'/>" +
            "<label for='_wmewalStreetsRoadTypePrivate' class='wal-label'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.PrivateRoad)) + "</label></div>" +
            "<div><input type='checkbox' id='_wmewalStreetsRoadTypeFerry' name='_wmewalStreetsRoadType' value='" + WMEWAL.RoadType.Ferry.toString() + "'/>" +
            "<label for='_wmewalStreetsRoadTypeFerry' class='wal-label'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.Ferry)) + "</label></div>" +
            "<div><input type='checkbox' id='_wmewalStreetsRoadTypeWT' name='_wmewalStreetsRoadType' value='" + WMEWAL.RoadType.WalkingTrail.toString() + "'/>" +
            "<label for='_wmewalStreetsRoadTypeWT' class='wal-label'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.WalkingTrail)) + "</label></div>" +
            "<div><input type='checkbox' id='_wmewalStreetsRoadTypePB' name='_wmewalStreetsRoadType' value='" + WMEWAL.RoadType.PedestrianBoardwalk.toString() + "'/>" +
            "<label for='_wmewalStreetsRoadTypePB' class='wal-label'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.PedestrianBoardwalk)) + "</label></div>" +
            "<div><input type='checkbox' id='_wmewalStreetsRoadTypeStairway' name='_wmewalStreetsRoadType' value='" + WMEWAL.RoadType.Stairway.toString() + "'/>" +
            "<label for='_wmewalStreetsRoadTypeStairway' class='wal-label'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.Stairway)) + "</label></div>" +
            "<div><input type='checkbox' id='_wmewalStreetsRoadTypeRR' name='_wmewalStreetsRoadType' value='" + WMEWAL.RoadType.Railroad.toString() + "'/>" +
            "<label for='_wmewalStreetsRoadTypeRR' class='wal-label'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.Railroad)) + "</label></div>" +
            "<div><input type='checkbox' id='_wmewalStreetsRoadTypeRT' name='_wmewalStreetsRoadType' value='" + WMEWAL.RoadType.RunwayTaxiway.toString() + "'/>" +
            "<label for='_wmewalStreetsRoadTypeRT' class='wal-label'>" + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.RunwayTaxiway)) + "</label></div>" +
            "</td></tr>";
        html += "<tr><td><input id='_wmewalStreetsEditable' type='checkbox'/>" +
            "<label for='_wmewalStreetsEditable' class='wal-label'>Editable by me</label></td></tr>";
        html += "<tr><td><input id='_wmewalStreetsExcludeRoundabouts' type='checkbox'/>" +
            "<label for='_wmewalStreetsExcludeRoundabouts' class='wal-label'>Exclude Roundabouts</label></td></tr>";
        html += "<tr><td><input id='_wmewalStreetsExcludeJunctionBoxes' type='checkbox' checked='checked'/>" +
            "<label for='_wmewalStreetsExcludeJunctionBoxes' class='wal-label'>Exclude Junction Boxes</label></td></tr>";
        html += "<tr><td class='wal-heading' style='border-top: 1px solid; padding-top: 4px'>Issues (Any Of These)</td></tr>";
        html += "<tr><td><input id='_wmewalStreetsNoSpeedLimit' type='checkbox'/>" +
            "<label for='_wmewalStreetsNoSpeedLimit' class='wal-label'>No speed limit</label></td></tr>";
        html += "<tr><td><input id='_wmewalStreetsHasRestrictions' type='checkbox'/>" +
            "<label for='_wmewalStreetsHasRestrictions' class='wal-label'>Has time-based restrictions</label></td></tr>";
        html += "<tr><td><input id='_wmewalStreetsHasTurnRestrictions' type='checkbox'/>" +
            "<label for='_wmewalStreetsHasTurnRestrictions' class='wal-label'>Has time-based turn restrictions</label></td></tr>";
        html += "<tr><td><input id='_wmewalStreetsUnknownDirection' type='checkbox'/>" +
            "<label for='_wmewalStreetsUnknownDirection' class='wal-label'>Unknown Direction</label></td></tr>";
        html += "<tr><td><input id='_wmewalStreetsHasRestrictedJunctionArrow' type='checkbox'/>" +
            "<label for='_wmewalStreetsHasRestrictedJunctionArrow' class='wal-label'>Has restricted junction arrow</label></td></tr>";
        html += "<tr><td><input id='_wmewalStreetsHasUTurn' type='checkbox'/>" +
            "<label for='_wmewalStreetsHasUTurn' class='wal-label'>Has U-turn</label></td></tr>";
        html += "<tr><td><input id='_wmewalStreetsHasSoftTurns' type='checkbox'/>" +
            "<label for='_wmewalStreetsHasSoftTurns' class='wal-label'>Has soft turns</label></td></tr>";
        // html += "<tr><td><input id='_wmewalStreetsHasExtraJunctionNode' type='checkbox'/>" +
        //     "<label for='_wmewalStreetsHasExtraJunctionNode' class='wal-label'>Has unnecessary junction node</label></td></tr>";
        html += "<tr><td><input id='_wmewalStreetsElevation' type='checkbox'/>" +
            "<label for='_wmewalStreetsElevation' class='wal-label'>Elevation</label>&nbsp;" +
            "<select id='_wmewalStreetsElevationOperation'>" +
            "<option value='" + Operation.LessThan.toString() + "'>&lt;</option>" +
            "<option value='" + Operation.NotEqual.toString() + "'>!=</option>" +
            "<option value='" + Operation.GreaterThan.toString() + "'>&gt;</option>" +
            "</select>0" +
            "</td></tr>";
        html += "<tr><td><input id='_wmewalStreetsSegmentLength' type='checkbox'/>" +
            "<label for='_wmewalStreetsSegmentLength' class='wal-label'>Segment length</label>&nbsp;" +
            "<select id='_wmewalStreetsSegmentLengthOperation'>" +
            "<option value='" + Operation.LessThan.toString() + "'>&lt;</option>" +
            "<option value='" + Operation.LessThanOrEqual.toString() + "'>&lt;=</option>" +
            "<option value='" + Operation.GreaterThan.toString() + "'>&gt;</option>" +
            "<option value='" + Operation.GreaterThanOrEqual.toString() + "'>&gt;=</option></select>" +
            "<input type='text' id='_wmewalStreetsSegmentLengthValue' class='wal-textbox' style='width: 40px'/> m" +
            "</td></tr>";
        html += "<tr><td><input id='_wmewalStreetsHasNoName' type='checkbox'/>" +
            "<label for='_wmewalStreetsHasNoName' class='wal-label'>Has no name</label></td></tr>";
        html += "<tr><td><input id='_wmewalStreetsHasNoCity' type='checkbox'/>" +
            "<label for='_wmewalStreetsHasNoCity' class='wal-label'>Has no city</label></td></tr>";
        html += "<tr><td><input id='_wmewalStreetsNonNeutralRoutingPreference' type='checkbox'/>" +
            "<label for='_wmewalStreetsNonNeutralRoutingPreference' class='wal-label'>Non-neutral routing preference</label></td></tr>";
        html += "</tbody></table>";
        return html;
    }
    WMEWAL_Streets.GetTab = GetTab;
    function TabLoaded() {
        updateStates();
        updateUsers();
        updateUI();
        updateSavedSettingsList();
        $("#_wmewalStreetsState").on("focus", updateStates);
        $("#_wmewalStreetsLastModifiedBy").on("focus", updateUsers);
        $("#_wmewalStreetsRoadTypeAny").on("click", function () {
            $("input[name=_wmewalStreetsRoadType]").prop("checked", true);
        });
        $("#_wmewalStreetsRoadTypeClear").on("click", function () {
            $("input[name=_wmewalStreetsRoadType]").prop("checked", false);
        });
        $("#_wmewalStreetsLoadSetting").on("click", loadSetting);
        $("#_wmewalStreetsSaveSetting").on("click", saveSetting);
        $("#_wmewalStreetsDeleteSetting").on("click", deleteSetting);
    }
    WMEWAL_Streets.TabLoaded = TabLoaded;
    function updateStates() {
        var selectState = $("#_wmewalStreetsState");
        // Preserve current selection
        var currentId = parseInt(selectState.val());
        selectState.empty();
        var stateObjs = [];
        stateObjs.push({ id: null, name: "" });
        for (var s in W.model.states.objects) {
            if (W.model.states.objects.hasOwnProperty(s)) {
                var st = W.model.states.getObjectById(parseInt(s));
                if (st.id !== 1 && st.name !== "") {
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
            if (currentId != null && so.id == null) {
                stateOption.attr("selected", "selected");
            }
            selectState.append(stateOption);
        }
    }
    function updateUsers() {
        var selectLastModifiedBy = $("#_wmewalStreetsLastModifiedBy");
        // Preserve current selection
        var currentId = parseInt(selectLastModifiedBy.val());
        selectLastModifiedBy.empty();
        var userObjs = [];
        userObjs.push({ id: null, name: "" });
        for (var uo in W.model.users.objects) {
            if (W.model.users.objects.hasOwnProperty(uo)) {
                var u = W.model.users.getObjectById(parseInt(uo));
                if (u.type === "user" && u.userName !== null && typeof u.userName !== "undefined") {
                    userObjs.push({ id: u.id, name: u.userName });
                }
            }
        }
        userObjs.sort(function (a, b) {
            if (a.id == null) {
                return -1;
            }
            else {
                return a.name.localeCompare(b.name);
            }
        });
        for (var ix = 0; ix < userObjs.length; ix++) {
            var o = userObjs[ix];
            var userOption = $("<option/>").text(o.name).attr("value", o.id);
            if (currentId != null && o.id == null) {
                userOption.attr("selected", "selected");
            }
            selectLastModifiedBy.append(userOption);
        }
    }
    function updateSavedSettingsList() {
        var s = $("#_wmewalStreetsSavedSettings");
        s.empty();
        for (var ixSaved = 0; ixSaved < savedSettings.length; ixSaved++) {
            var opt = $("<option/>").attr("value", ixSaved).text(savedSettings[ixSaved].Name);
            s.append(opt);
        }
    }
    function updateUI() {
        $("#_wmewalStreetsOutputTo").val(settings.OutputTo);
        $("#_wmewalStreetsIncludeAlt").prop("checked", settings.IncludeAltNames);
        $("#_wmewalStreetsLockLevel").val(settings.LockLevel);
        $("#_wmewalStreetsLockLevelOp").val(settings.LockLevelOperation || Operation.Equal.toString());
        $("#_wmewalStreetsName").val(settings.Regex || "");
        $("#_wmewalStreetsIgnoreCase").prop("checked", settings.RegexIgnoreCase);
        $("#_wmewalStreetsCity").val(settings.CityRegex || "");
        $("#_wmewalStreetsCityIgnoreCase").prop("checked", settings.CityRegexIgnoreCase);
        $("#_wmewalStreetsState").val(settings.State);
        $("#_wmewalStreetsStateOp").val(settings.StateOperation || Operation.Equal.toString());
        $("#_wmewalStreetsRoadTypeFreeway").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.Freeway);
        $("#_wmewalStreetsRoadTypeRamp").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.Ramp);
        $("#_wmewalStreetsRoadTypeMajorHighway").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.MajorHighway);
        $("#_wmewalStreetsRoadTypeMinorHighway").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.MinorHighway);
        $("#_wmewalStreetsRoadTypePrimary").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.PrimaryStreet);
        $("#_wmewalStreetsRoadTypeStreet").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.Street);
        $("#_wmewalStreetsRoadTypeAlley").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.Alley);
        $("#_wmewalStreetsRoadTypeUnpaved").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.Unpaved);
        $("#_wmewalStreetsRoadTypePLR").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.ParkingLotRoad);
        $("#_wmewalStreetsRoadTypePrivate").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.PrivateRoad);
        $("#_wmewalStreetsRoadTypeFerry").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.Ferry);
        $("#_wmewalStreetsRoadTypeWT").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.WalkingTrail);
        $("#_wmewalStreetsRoadTypePB").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.PedestrianBoardwalk);
        $("#_wmewalStreetsRoadTypeStairway").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.Stairway);
        $("#_wmewalStreetsRoadTypeRR").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.Railroad);
        $("#_wmewalStreetsRoadTypeRT").prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.RunwayTaxiway);
        $("#_wmewalStreetsEditable").prop("checked", settings.EditableByMe);
        $("#_wmewalStreetsNoSpeedLimit").prop("checked", settings.NoSpeedLimit);
        $("#_wmewalStreetsExcludeRoundabouts").prop("checked", settings.ExcludeRoundabouts);
        $("#_wmewalStreetsExcludeJunctionBoxes").prop("checked", settings.ExcludeJunctionBoxes);
        $("#_wmewalStreetsDirection").val(settings.Direction);
        $("#_wmewalStreetsUnknownDirection").prop("checked", settings.UnknownDirection);
        $("#_wmewalStreetsHasRestrictions").prop("checked", settings.HasTimeBasedRestrictions);
        $("#_wmewalStreetsHasTurnRestrictions").prop("checked", settings.HasTimeBasedTurnRestrictions);
        $("#_wmewalStreetsHasRestrictedJunctionArrow").prop("checked", settings.HasRestrictedJunctionArrow);
        $("#_wmewalStreetsHasUTurn").prop("checked", settings.HasUTurn);
        $("#_wmewalStreetsHasSoftTurns").prop("checked", settings.HasSoftTurns);
        // $("#_wmewalStreetsHasExtraJunctionNode").prop("checked", settings.HasUnnecessaryJunctionNode);
        $("#_wmewalStreetsElevation").prop("checked", settings.Elevation);
        $("#_wmewalStreetsElevationOperation").val(settings.ElevationOperation || Operation.LessThan.toString());
        $("#_wmewalStreetsSegmentLength").prop("checked", settings.SegmentLength);
        $("#_wmewalStreetsSegmentLengthOperation").val(settings.SegmentLengthOperation || Operation.LessThan.toString());
        $("#_wmewalStreetsSegmentLengthValue").val(settings.SegmentLengthValue || "");
        $("#_wmewalStreetsLastModifiedBy").val(settings.LastModifiedBy);
        $("#_wmewalStreetsHasNoName").prop("checked", settings.HasNoName);
        $("#_wmewalStreetsHasNoCity").prop("checked", settings.HasNoCity);
        $("#_wmewalStreetsNonNeutralRoutingPreference").prop("checked", settings.NonNeutralRoutingPreference);
    }
    function loadSetting() {
        var selectedSetting = parseInt($("#_wmewalStreetsSavedSettings").val());
        if (selectedSetting == null || isNaN(selectedSetting) || selectedSetting < 0 || selectedSetting > savedSettings.length) {
            return;
        }
        settings.OutputTo = $("#_wmewalStreetsOutputTo").val();
        var savedSetting = savedSettings[selectedSetting].Setting;
        for (var name_1 in savedSetting) {
            if (settings.hasOwnProperty(name_1)) {
                settings[name_1] = savedSetting[name_1];
            }
        }
        updateUI();
    }
    function validateSettings() {
        var message = "";
        var mask = 0;
        $("input[name=_wmewalStreetsRoadType]:checked").each(function (ix, e) {
            mask = mask | parseInt(e.value);
        });
        if (mask === 0) {
            message = "Please select at least one road type";
        }
        var selectedState = $("#_wmewalStreetsState").val();
        if (selectedState != null && selectedState.length > 0) {
            if (W.model.states.getObjectById(selectedState) == null) {
                message += ((message.length > 0 ? "\n" : "") + "Invalid state selection");
            }
        }
        var selectedUser = $("#_wmewalStreetsLastModifiedBy").val();
        if (selectedUser != null && selectedUser.length > 0) {
            if (W.model.users.getObjectById(selectedUser) == null) {
                message += ((message.length > 0 ? "\n" : "") + "Invalid last modified user");
            }
        }
        var pattern = $("#_wmewalStreetsName").val();
        var ignoreCase = $("#_wmewalStreetsIgnoreCase").prop("checked");
        var r;
        if (pattern !== "") {
            try {
                r = (ignoreCase ? new RegExp(pattern, "i") : new RegExp(pattern));
            }
            catch (error) {
                message += ((message.length > 0 ? "\n" : "") + "Name RegEx is invalid");
            }
        }
        pattern = $("#_wmewalStreetsCity").val();
        ignoreCase = $("#_wmewalStreetsCityIgnoreCase").prop("checked");
        if (pattern !== "") {
            try {
                r = (ignoreCase ? new RegExp(pattern, "i") : new RegExp(pattern));
            }
            catch (error) {
                message += ((message.length > 0 ? "\n" : "") + "City RegEx is invalid");
            }
        }
        if ($("#_wmewalStreetsSegmentLength").prop("checked")) {
            var val = $("#_wmewalStreetsSegmentLengthValue").val();
            var numVal = parseInt(val);
            if (isNaN(numVal) || val.trim() !== numVal.toString()) {
                message += ((message.length > 0 ? "\n" : "") + "Invalid segment length");
            }
        }
        if (message.length > 0) {
            alert(pluginName + ": " + message);
            return false;
        }
        else {
            return true;
        }
    }
    function saveSetting() {
        if (validateSettings()) {
            var s_1 = {
                RoadTypeMask: 0,
                State: null,
                StateOperation: parseInt($("#_wmewalStreetsStateOp").val()),
                LockLevel: null,
                LockLevelOperation: parseInt($("#_wmewalStreetsLockLevelOp").val()),
                Regex: null,
                RegexIgnoreCase: $("#_wmewalStreetsIgnoreCase").prop("checked"),
                ExcludeJunctionBoxes: $("#_wmewalStreetsExcludeJunctionBoxes").prop("checked"),
                ExcludeRoundabouts: $("#_wmewalStreetsExcludeRoundabouts").prop("checked"),
                EditableByMe: $("#_wmewalStreetsEditable").prop("checked"),
                NoSpeedLimit: $("#_wmewalStreetsNoSpeedLimit").prop("checked"),
                IncludeAltNames: $("#_wmewalStreetsIncludeAlt").prop("checked"),
                Direction: null,
                CityRegex: null,
                CityRegexIgnoreCase: $("#_wmewalStreetsCityIgnoreCase").prop("checked"),
                HasTimeBasedRestrictions: $("#_wmewalStreetsHasRestrictions").prop("checked"),
                HasTimeBasedTurnRestrictions: $("#_wmewalStreetsHasTurnRestrictions").prop("checked"),
                HasRestrictedJunctionArrow: $("#_wmewalStreetsHasRestrictedJunctionArrow").prop("checked"),
                UnknownDirection: $("#_wmewalStreetsUnknownDirection").prop("checked"),
                HasUTurn: $("#_wmewalStreetsHasUTurn").prop("checked"),
                HasSoftTurns: $("#_wmewalStreetsHasSoftTurns").prop("checked"),
                HasUnnecessaryJunctionNode: false,
                // HasUnnecessaryJunctionNode: $("#_wmewalStreetsHasExtraJunctionNode").prop("checked"),
                Elevation: $("#_wmewalStreetsElevation").prop("checked"),
                ElevationOperation: parseInt($("#_wmewalStreetsElevationOperation").val()),
                SegmentLength: $("#_wmewalStreetsSegmentLength").prop("checked"),
                SegmentLengthOperation: parseInt($("#_wmewalStreetsSegmentLengthOperation").val()),
                SegmentLengthValue: null,
                LastModifiedBy: null,
                HasNoName: $("#_wmewalStreetsHasNoName").prop("checked"),
                HasNoCity: $("#_wmewalStreetsHasNoCity").prop("checked"),
                NonNeutralRoutingPreference: $("#_wmewalStreetsNonNeutralRoutingPreference").prop("checked")
            };
            $("input[name=_wmewalStreetsRoadType]:checked").each(function (ix, e) {
                s_1.RoadTypeMask = s_1.RoadTypeMask | parseInt(e.value);
            });
            var selectedState = $("#_wmewalStreetsState").val();
            if (selectedState != null && selectedState.length > 0) {
                s_1.State = W.model.states.getObjectById(selectedState).id;
            }
            var selectedUser = $("#_wmewalStreetsLastModifiedBy").val();
            if (selectedUser != null && selectedUser.length > 0) {
                s_1.LastModifiedBy = W.model.users.getObjectById(selectedUser).id;
            }
            var pattern = $("#_wmewalStreetsName").val();
            if (pattern !== "") {
                s_1.Regex = pattern;
            }
            pattern = $("#_wmewalStreetsCity").val();
            if (pattern !== "") {
                s_1.CityRegex = pattern;
            }
            var selectedLockLevel = $("#_wmewalStreetsLockLevel").val();
            if (selectedLockLevel != null && selectedLockLevel.length > 0) {
                s_1.LockLevel = parseInt(selectedLockLevel);
            }
            var selectedDirection = $("#_wmewalStreetsDirection").val();
            if (selectedDirection != null && selectedDirection.length > 0) {
                s_1.Direction = parseInt(selectedDirection);
            }
            var segmentLengthValue = $("#_wmewalStreetsSegmentLengthValue").val();
            if (segmentLengthValue != null && segmentLengthValue.length > 0 && !isNaN(parseInt(segmentLengthValue))) {
                s_1.SegmentLengthValue = parseInt(segmentLengthValue);
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
        var selectedSetting = parseInt($("#_wmewalStreetsSavedSettings").val());
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
            roundabouts = [];
            settings.OutputTo = $("#_wmewalStreetsOutputTo").val();
            settings.IncludeAltNames = $("#_wmewalStreetsIncludeAlt").prop("checked");
            settings.RoadTypeMask = 0;
            $("input[name=_wmewalStreetsRoadType]:checked").each(function (ix, e) {
                settings.RoadTypeMask = settings.RoadTypeMask | parseInt(e.value);
            });
            var selectedState = $("#_wmewalStreetsState").val();
            state = null;
            settings.State = null;
            stateName = null;
            if (selectedState != null && selectedState.length > 0) {
                state = W.model.states.getObjectById(parseInt(selectedState));
                settings.State = state.id;
                stateName = state.name;
            }
            settings.StateOperation = parseInt($("#_wmewalStreetsStateOp").val());
            var selectedUser = $("#_wmewalStreetsLastModifiedBy").val();
            lastModifiedBy = null;
            settings.LastModifiedBy = null;
            lastModifiedByName = null;
            if (selectedUser != null && selectedUser.length > 0) {
                lastModifiedBy = W.model.users.getObjectById(parseInt(selectedUser));
                settings.LastModifiedBy = lastModifiedBy.id;
                lastModifiedByName = lastModifiedBy.userName;
            }
            settings.RegexIgnoreCase = $("#_wmewalStreetsIgnoreCase").prop("checked");
            var pattern = $("#_wmewalStreetsName").val();
            settings.Regex = null;
            nameRegex = null;
            if (pattern !== "") {
                settings.Regex = pattern;
                nameRegex = (settings.RegexIgnoreCase ? new RegExp(pattern, "i") : new RegExp(pattern));
            }
            settings.CityRegexIgnoreCase = $("#_wmewalStreetsCityIgnoreCase").prop("checked");
            pattern = $("#_wmewalStreetsCity").val();
            settings.CityRegex = null;
            cityRegex = null;
            if (pattern !== "") {
                settings.CityRegex = pattern;
                cityRegex = (settings.CityRegexIgnoreCase ? new RegExp(pattern, "i") : new RegExp(pattern));
            }
            var selectedLockLevel = $("#_wmewalStreetsLockLevel").val();
            settings.LockLevel = null;
            if (selectedLockLevel != null && selectedLockLevel.length > 0) {
                settings.LockLevel = parseInt(selectedLockLevel);
            }
            settings.LockLevelOperation = parseInt($("#_wmewalStreetsLockLevelOp").val());
            settings.ExcludeRoundabouts = $("#_wmewalStreetsExcludeRoundabouts").prop("checked");
            settings.ExcludeJunctionBoxes = $("#_wmewalStreetsExcludeJunctionBoxes").prop("checked");
            settings.EditableByMe = $("#_wmewalStreetsEditable").prop("checked");
            settings.NoSpeedLimit = $("#_wmewalStreetsNoSpeedLimit").prop("checked");
            settings.HasTimeBasedRestrictions = $("#_wmewalStreetsHasRestrictions").prop("checked");
            settings.HasTimeBasedTurnRestrictions = $("#_wmewalStreetsHasTurnRestrictions").prop("checked");
            settings.HasRestrictedJunctionArrow = $("#_wmewalStreetsHasRestrictedJunctionArrow").prop("checked");
            settings.UnknownDirection = $("#_wmewalStreetsUnknownDirection").prop("checked");
            settings.HasUTurn = $("#_wmewalStreetsHasUTurn").prop("checked");
            settings.HasSoftTurns = $("#_wmewalStreetsHasSoftTurns").prop("checked");
            settings.HasUnnecessaryJunctionNode = false;
            // settings.HasUnnecessaryJunctionNode = $("#_wmewalStreetsHasExtraJunctionNode").prop("checked");
            settings.Elevation = $("#_wmewalStreetsElevation").prop("checked");
            settings.ElevationOperation = parseInt($("#_wmewalStreetsElevationOperation").val());
            settings.SegmentLength = $("#_wmewalStreetsSegmentLength").prop("checked");
            settings.SegmentLengthOperation = parseInt($("#_wmewalStreetsSegmentLengthOperation").val());
            var selectedDirection = $("#_wmewalStreetsDirection").val();
            settings.Direction = null;
            if (selectedDirection != null && selectedDirection.length > 0) {
                settings.Direction = parseInt(selectedDirection);
            }
            if (settings.SegmentLength) {
                settings.SegmentLengthValue = parseInt($("#_wmewalStreetsSegmentLengthValue").val());
            }
            settings.HasNoName = $("#_wmewalStreetsHasNoName").prop("checked");
            settings.HasNoCity = $("#_wmewalStreetsHasNoCity").prop("checked");
            settings.NonNeutralRoutingPreference = $("#_wmewalStreetsNonNeutralRoutingPreference").prop("checked");
            if (settings.RoadTypeMask & ~(WMEWAL.RoadType.Freeway | WMEWAL.RoadType.MajorHighway | WMEWAL.RoadType.MinorHighway | WMEWAL.RoadType.PrimaryStreet)) {
                WMEWAL_Streets.MinimumZoomLevel = 4;
            }
            else {
                WMEWAL_Streets.MinimumZoomLevel = 2;
            }
            detectIssues = settings.NoSpeedLimit
                || settings.HasTimeBasedRestrictions
                || settings.HasTimeBasedTurnRestrictions
                || settings.HasRestrictedJunctionArrow
                || settings.UnknownDirection
                || settings.HasUTurn
                || settings.HasSoftTurns
                || settings.SegmentLength
                || settings.Elevation
                || settings.HasNoName
                || settings.HasNoCity
                || settings.NonNeutralRoutingPreference;
            updateSettings();
        }
        return allOk;
    }
    WMEWAL_Streets.ScanStarted = ScanStarted;
    function ScanExtent(segments, venues) {
        var def = $.Deferred();
        var extentStreets = [];
        var segment;
        function determineDirection(s) {
            return (s.attributes.fwdDirection ? (s.attributes.revDirection ? Direction.TwoWay : Direction.OneWay) : (s.attributes.revDirection ? Direction.OneWay : Direction.Unknown));
        }
        function addSegment(s, rId, issues, newSegment) {
            var sid = s.attributes.primaryStreetID;
            var lastEditorID = s.attributes.updatedBy || s.attributes.createdBy;
            var lastEditor = W.model.users.getObjectById(lastEditorID);
            var address = s.getAddress();
            var thisStreet = null;
            if (sid != null && !newSegment) {
                thisStreet = extentStreets.find(function (e) {
                    var matches = (e.id === sid && (e.lockLevel === (s.attributes.lockRank | 0) + 1) && e.roundaboutId === rId &&
                        e.roadType === s.attributes.roadType && e.issues === issues && e.lastEditor === lastEditor.userName);
                    if (matches && (nameRegex != null || cityRegex != null || settings.IncludeAltNames)) {
                        // Test for alt names
                        for (var ixAlt = 0; ixAlt < e.altStreets.length && matches; ixAlt++) {
                            matches = false;
                            for (var ixSegAlt = 0; ixSegAlt < s.attributes.streetIDs.length && !matches; ixSegAlt++) {
                                if (e.altStreets[ixAlt].id === s.attributes.streetIDs[ixSegAlt]) {
                                    matches = true;
                                }
                            }
                            if (matches && settings.Direction) {
                                matches = (e.direction === determineDirection(s));
                            }
                        }
                    }
                    return matches;
                });
            }
            if (thisStreet == null) {
                thisStreet = {
                    id: sid,
                    city: ((address && !address.attributes.isEmpty && address.attributes.city.hasName()) ? address.attributes.city.attributes.name : "No City"),
                    state: ((address && !address.attributes.isEmpty) ? address.attributes.state.name : "No State"),
                    name: ((address && !address.attributes.isEmpty && !address.attributes.street.isEmpty) ? address.attributes.street.name : null),
                    geometries: new OL.Geometry.Collection(),
                    lockLevel: (s.attributes.lockRank || 0) + 1,
                    segments: [],
                    roundaboutId: rId,
                    altStreets: [],
                    roadType: s.attributes.roadType,
                    direction: determineDirection(s),
                    issues: issues,
                    length: s.attributes.length,
                    lastEditor: lastEditor.userName
                };
                if (nameRegex != null || settings.IncludeAltNames) {
                    for (var ixAlt = 0; ixAlt < s.attributes.streetIDs.length; ixAlt++) {
                        var altStreet = W.model.streets.getObjectById(s.attributes.streetIDs[ixAlt]);
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
        var graph = W.model.getTurnGraph();
        for (var ix = 0; ix < segments.length; ix++) {
            segment = segments[ix];
            if (segment != null) {
                if ((WMEWAL.WazeRoadTypeToRoadTypeBitmask(segment.attributes.roadType) & settings.RoadTypeMask) &&
                    (settings.LockLevel == null ||
                        (settings.LockLevelOperation === Operation.Equal && (segment.attributes.lockRank || 0) + 1 === settings.LockLevel) ||
                        (settings.LockLevelOperation === Operation.NotEqual && (segment.attributes.lockRank || 0) + 1 !== settings.LockLevel)) &&
                    (!settings.EditableByMe || segment.arePropertiesEditable()) &&
                    (!settings.ExcludeJunctionBoxes || !segment.isInBigJunction()) &&
                    (settings.Direction == null || determineDirection(segment) === settings.Direction)) {
                    var issues = 0;
                    var newSegment = false;
                    var address = segment.getAddress();
                    if (state != null) {
                        if (address != null && address.attributes != null && !address.attributes.isEmpty && address.attributes.state != null) {
                            if (settings.StateOperation === Operation.Equal && address.attributes.state.id !== state.id ||
                                settings.StateOperation === Operation.NotEqual && address.attributes.state.id === state.id) {
                                continue;
                            }
                        }
                        else if (settings.StateOperation === Operation.Equal) {
                            continue;
                        }
                    }
                    if (settings.LastModifiedBy != null) {
                        if (segment.attributes.updatedBy != null) {
                            if (segment.attributes.updatedBy !== settings.LastModifiedBy) {
                                continue;
                            }
                        }
                        else if (segment.attributes.createdBy !== settings.LastModifiedBy) {
                            continue;
                        }
                    }
                    if (settings.NoSpeedLimit &&
                        ((segment.attributes.fwdDirection && (segment.attributes.fwdMaxSpeed == null || segment.attributes.fwdMaxSpeedUnverified)) ||
                            (segment.attributes.revDirection && (segment.attributes.revMaxSpeed == null || segment.attributes.revMaxSpeedUnverified)))) {
                        issues = issues | Issue.NoSpeedLimit;
                    }
                    if (settings.HasTimeBasedRestrictions && segment.getDrivingRestrictionCount() > 0) {
                        issues = issues | Issue.TimeBasedRestrictions;
                    }
                    if (settings.HasTimeBasedTurnRestrictions) {
                        var directions = ["from", "to"];
                        var hasTurnRestrictions = false;
                        for (var ixDir = 0; ixDir < directions.length && !hasTurnRestrictions; ixDir++) {
                            var node = segment.getNodeByDirection(directions[ixDir]);
                            var connSegments = segment.getConnectedSegmentsByDirection(directions[ixDir]);
                            for (var ixConn = 0; ixConn < connSegments.length && !hasTurnRestrictions; ixConn++) {
                                var turn = graph.getTurnThroughNode(node, segment, connSegments[ixConn]);
                                if (turn !== null && turn.getTurnData() !== null && turn.getTurnData().getRestrictions() !== null && turn.getTurnData().getRestrictions().length > 0) {
                                    hasTurnRestrictions = true;
                                }
                            }
                        }
                        if (hasTurnRestrictions) {
                            issues = issues | Issue.TimeBasedTurnRestrictions;
                            newSegment = true;
                        }
                    }
                    if (settings.HasRestrictedJunctionArrow) {
                        var directions = ["from", "to"];
                        var hasRestrictedTurns = false;
                        for (var ixDir = 0; ixDir < directions.length && !hasRestrictedTurns; ixDir++) {
                            var node = segment.getNodeByDirection(directions[ixDir]);
                            if (node) {
                                var keys = node.allConnectionKeys();
                                for (var ixLegal = 0; ixLegal < keys.legal.length && !hasRestrictedTurns; ixLegal++) {
                                    if (keys.legal[ixLegal].from.attributes.id === segment.attributes.id &&
                                        keys.legal[ixLegal].to.isDrivable() &&
                                        !segment.isTurnAllowed(keys.legal[ixLegal].to, node)) {
                                        hasRestrictedTurns = true;
                                    }
                                }
                            }
                        }
                        if (hasRestrictedTurns) {
                            issues = issues | Issue.RestrictedJunctionArrows;
                            newSegment = true;
                        }
                    }
                    if (settings.UnknownDirection) {
                        var hasNoDirection = false;
                        if (segment.getDirection() === 0 ) {
                            hasNoDirection = true
                        }
                        if (hasNoDirection) {
                            issues = issues | Issue.UnknownDirection;
                            newSegment = true;
                        }
                    }
                    if (settings.HasUTurn
                        || settings.HasSoftTurns) {
                        var directions = ["from", "to"];
                        var hasUTurn = false;
                        var hasSoftTurns = false;
                        // let hasUnnecessaryJunctionNode = false;
                        for (var ixDir = 0; ixDir < directions.length; ixDir++) {
                            var node = segment.getNodeByDirection(directions[ixDir]);
                            if (node) {
                                hasUTurn = hasUTurn || (node.connectionsExist() && segment.isTurnAllowed(segment, node));
                                hasSoftTurns = hasSoftTurns || (node.connectionsExist() && !segment.areTurnsLocked(node));
                            }
                        }
                        if (hasUTurn && settings.HasUTurn) {
                            issues = issues | Issue.UTurn;
                            newSegment = true;
                        }
                        if (hasSoftTurns && settings.HasSoftTurns) {
                            issues = issues | Issue.SoftTurns;
                            newSegment = true;
                        }
                    }
                    if (settings.Elevation) {
                        if ((settings.ElevationOperation === Operation.LessThan && segment.attributes.level < 0) ||
                            (settings.ElevationOperation === Operation.GreaterThan && segment.attributes.level > 0) ||
                            (settings.ElevationOperation === Operation.NotEqual && segment.attributes.level !== 0)) {
                            issues = issues | Issue.Elevation;
                        }
                    }
                    if (settings.SegmentLength) {
                        if ((settings.SegmentLengthOperation === Operation.LessThan && segment.attributes.length < settings.SegmentLengthValue) ||
                            (settings.SegmentLengthOperation === Operation.LessThanOrEqual && segment.attributes.length <= settings.SegmentLengthValue) ||
                            (settings.SegmentLengthOperation === Operation.GreaterThan && segment.attributes.length > settings.SegmentLengthValue) ||
                            (settings.SegmentLengthOperation === Operation.GreaterThanOrEqual && segment.attributes.length >= settings.SegmentLengthValue)) {
                            issues = issues | Issue.SegmentLength;
                            newSegment = true;
                        }
                    }
                    if (settings.HasNoName) {
                        if (!address || !address.attributes || address.attributes.isEmpty || !address.attributes.street || address.attributes.street.isEmpty ||
                            address.attributes.street.name === null || address.attributes.street.name.trim().length === 0) {
                            issues = issues | Issue.NoName;
                        }
                    }
                    if (settings.HasNoCity) {
                        if (!address || !address.attributes || address.attributes.isEmpty || !address.attributes.city || address.attributes.city.isEmpty() ||
                            !address.attributes.city.hasName || !address.attributes.city.attributes ||
                            address.attributes.city.attributes.isEmpty || address.attributes.city.attributes.name === null ||
                            address.attributes.city.attributes.name.trim().length == 0) {
                            issues = issues | Issue.NoCity;
                        }
                    }
                    if (settings.NonNeutralRoutingPreference) {
                        if (segment.attributes.routingRoadType != null && segment.attributes.routingRoadType != segment.attributes.roadType) {
                            issues = issues | Issue.RoutingPreference;
                        }
                    }
                    if (detectIssues && issues === 0) {
                        // If at least one issue was chosen and this segment doesn't have any issues, then skip it
                        continue;
                    }
                    if (nameRegex != null || cityRegex != null) {
                        var nameMatched = false;
                        if (address != null && address.attributes != null && !address.attributes.isEmpty) {
                            if (nameRegex != null && address.attributes.street != null && !address.attributes.street.isEmpty) {
                                nameMatched = nameRegex.test(address.attributes.street.name);
                            }
                            if (!nameMatched && cityRegex != null && address.attributes.city != null && address.attributes.city.hasName()) {
                                nameMatched = cityRegex.test(address.attributes.city.attributes.name);
                            }
                            if (!nameMatched && segment.attributes.streetIDs != null && segment.attributes.streetIDs.length > 0) {
                                for (var streetIx = 0; streetIx < segment.attributes.streetIDs.length && !nameMatched; streetIx++) {
                                    if (segment.attributes.streetIDs[streetIx] != null) {
                                        var street = W.model.streets.getObjectById(segment.attributes.streetIDs[streetIx]);
                                        if (street != null) {
                                            if (nameRegex != null) {
                                                nameMatched = nameRegex.test(street.name);
                                            }
                                            if (!nameMatched && cityRegex != null && street.cityID != null) {
                                                var city = W.model.cities.getObjectById(street.cityID);
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
                        addSegment(segment, null, issues, newSegment);
                    }
                    else if (!settings.ExcludeRoundabouts) {
                        var r = segment.getRoundabout();
                        addSegment(segment, r.id, issues, newSegment);
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
    WMEWAL_Streets.ScanExtent = ScanExtent;
    function translateDirection(d) {
        switch (d) {
            case Direction.OneWay:
                return "One way";
            case Direction.TwoWay:
                return "Two way";
            default:
                return "Unknown";
        }
    }
    function ScanComplete() {
        roundabouts = null;
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
            var outputTo = $("#_wmewalStreetsOutputTo").val();
            var isCSV = (outputTo === "csv" || outputTo === "both");
            var isTab = (outputTo === "tab" || outputTo === "both");
            var includeAltNames = (nameRegex != null || settings.IncludeAltNames || cityRegex != null);
            var includeDirection = (settings.Direction != null);
            var includeLength = settings.SegmentLength;
            var lineArray = void 0;
            var columnArray = void 0;
            var w = void 0;
            var fileName = void 0;
            if (isCSV) {
                lineArray = [];
                columnArray = ["Name"];
                if (includeAltNames) {
                    columnArray.push("Alt Names");
                }
                columnArray.push("City");
                columnArray.push("State");
                columnArray.push("Road Type");
                columnArray.push("Lock Level");
                if (includeDirection) {
                    columnArray.push("Direction");
                }
                if (includeLength) {
                    columnArray.push("Length (m)");
                }
                if (detectIssues) {
                    columnArray.push("Issues");
                }
                columnArray.push("Last Editor");
                columnArray.push("Latitude");
                columnArray.push("Longitude");
                columnArray.push("Permalink");
                lineArray.push(columnArray);
                fileName = "Streets_" + WMEWAL.areaName;
                let RTMask = settings.RoadTypeMask;
                for (var rt in WMEWAL.RoadType) {
                    if (WMEWAL.RoadType.hasOwnProperty(rt)) {
                        var mask = parseInt(rt);
                        if (!isNaN(mask)) {
                            if (RTMask === 65535) {
                                fileName += "_AllRoads";
                                break;
                            }
                            else if (RTMask === (RTMask | 60)) { // All highways
                                fileName += "_" + I18n.t("segment.categories.highways").replace(/\s+/g, "_");
                                RTMask = RTMask & (65535-60);
                            }
                            else if (RTMask === (RTMask |  32771)) { // All local roads (PS, St, Alley)
                                fileName += "_" + I18n.t("segment.categories.streets").replace(/\s+/g, "_");
                                RTMask = RTMask & (65535-32771);
                            }
                            else if (RTMask === (RTMask |  17728)) { // Other drivable roads
                                fileName += "_" + I18n.t("segment.categories.other_drivable").replace(/\s+/g, "_");
                                RTMask = RTMask & (65535-17728);
                            }
                            else if (RTMask === (RTMask |  14976)) { // Non-drivable roads, including pedestrian paths
                                fileName += "_" + I18n.t("segment.categories.non_drivable").replace(/\s+/g, "_");
                                RTMask = RTMask & (65535-14976);
                            }
                            else if (RTMask & mask) {
                                fileName += "_" + WMEWAL.RoadType[mask.toString()];
                            }
                        }
                    }
                }
                fileName += ".csv";
            }
            if (isTab) {
                w = window.open();
                w.document.write("<html><head><title>Streets</title></head><body>");
                w.document.write("<h3>Area: " + WMEWAL.areaName + "</h3>");
                w.document.write("<b>Filters</b>");
                w.document.write("<br/>Road Type: ");
                var comma = "";
                for (var rt in WMEWAL.RoadType) {
                    if (WMEWAL.RoadType.hasOwnProperty(rt)) {
                        var mask = parseInt(rt);
                        if (!isNaN(mask) && settings.RoadTypeMask & mask) {
                            w.document.write(comma + WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(mask)));
                            comma = ", ";
                        }
                    }
                }
                if (settings.LockLevel != null) {
                    w.document.write("<br/>Lock level " + (settings.LockLevelOperation === Operation.NotEqual ? "does not equal " : "equals ") + settings.LockLevel.toString());
                }
                if (settings.Direction != null) {
                    w.document.write("<br/>Direction " + translateDirection(settings.Direction));
                }
                if (cityRegex != null) {
                    w.document.write("<br/>City Name matches " + cityRegex.source);
                    if (settings.CityRegexIgnoreCase) {
                        w.document.write(" (ignoring case)");
                    }
                }
                if (settings.State != null) {
                    w.document.write("<br/>State " + (settings.StateOperation === Operation.NotEqual ? "does not equal " : "equals ") + stateName);
                }
                if (nameRegex != null) {
                    w.document.write("<br/>Name matches " + nameRegex.source);
                    if (settings.RegexIgnoreCase) {
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
                if (settings.LastModifiedBy != null) {
                    w.document.write("<br/>Last modified by " + lastModifiedByName);
                }
                if (settings.NoSpeedLimit) {
                    w.document.write("<br/>Missing speed limit");
                }
                if (settings.HasTimeBasedRestrictions) {
                    w.document.write("<br/>Has time-based restrictions");
                }
                if (settings.HasTimeBasedTurnRestrictions) {
                    w.document.write("<br/>Has time-based turn restrictions");
                }
                if (settings.HasRestrictedJunctionArrow) {
                    w.document.write("<br/>Has restricted junction arrows (red arrows)");
                }
                if (settings.UnknownDirection) {
                    w.document.write("<br/>Unknown direction");
                }
                if (settings.HasUTurn) {
                    w.document.write("<br/>Has u-turn");
                }
                if (settings.HasSoftTurns) {
                    w.document.write("<br/>Has soft turns");
                }
                if (settings.HasUnnecessaryJunctionNode) {
                    w.document.write("<br/>Has unnecessary junction node");
                }
                if (settings.Elevation) {
                    w.document.write("<br/>Elevation ");
                    switch (settings.ElevationOperation) {
                        case Operation.LessThan:
                            w.document.write("&lt;");
                            break;
                        case Operation.GreaterThan:
                            w.document.write("&gt;");
                            break;
                        case Operation.NotEqual:
                            w.document.write("!=");
                            break;
                        default:
                            break;
                    }
                    w.document.write(" 0");
                }
                if (settings.SegmentLength) {
                    w.document.write("<br/>Segment length ");
                    switch (settings.SegmentLengthOperation) {
                        case Operation.LessThan:
                            w.document.write("&lt;");
                            break;
                        case Operation.LessThanOrEqual:
                            w.document.write("&lt;=");
                            break;
                        case Operation.GreaterThan:
                            w.document.write("&gt;");
                            break;
                        case Operation.GreaterThanOrEqual:
                            w.document.write("&gt;=");
                            break;
                        default:
                            break;
                    }
                    w.document.write(" " + settings.SegmentLengthValue.toString() + "m");
                }
                if (settings.HasNoName) {
                    w.document.write("<br/>Has no name");
                }
                if (settings.HasNoCity) {
                    w.document.write("<br/>Has no city");
                }
                if (settings.NonNeutralRoutingPreference) {
                    w.document.write("<br/>Non-neutral routing preference");
                }
                w.document.write("</p><table style='border-collapse: separate; border-spacing: 8px 0px'><tr><th>Name</th>");
                if (includeAltNames) {
                    w.document.write("<th>Alt Names</th>");
                }
                w.document.write("<th>City</th><th>State</th>");
                w.document.write("<th>Road Type</th><th>Lock Level</th>");
                if (includeDirection) {
                    w.document.write("<th>Direction</th>");
                }
                if (includeLength) {
                    w.document.write("<th>Length (m)</th>");
                }
                if (detectIssues) {
                    w.document.write("<th>Issues</th>");
                }
                w.document.write("<th>Last Editor</th><th>Latitude</th><th>Longitude</th><th>Permalink</th></tr>");
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
                            if (includeDirection) {
                                columnArray.push("\"" + translateDirection(street.direction) + "\"");
                            }
                            if (includeLength) {
                                columnArray.push(street.length.toString());
                            }
                            if (detectIssues) {
                                columnArray.push("\"" + getIssues(street.issues) + "\"");
                            }
                            columnArray.push("\"" + street.lastEditor + "\"");
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
                            w.document.write("<td>" + roadTypeText + "</td><td>" + street.lockLevel + "</td>");
                            if (includeDirection) {
                                w.document.write("<td>" + translateDirection(street.direction) + "</td>");
                            }
                            if (includeLength) {
                                w.document.write("<td>" + street.length.toString() + "</td>");
                            }
                            if (detectIssues) {
                                w.document.write("<td>" + getIssues(street.issues) + "</td>");
                            }
                            w.document.write("<td>" + street.lastEditor + "</td><td>" + latlon.lat.toString() + "</td><td>" + latlon.lon.toString() + "</td>" +
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
                        if (includeDirection) {
                            columnArray.push("\"" + translateDirection(street.direction) + "\"");
                        }
                        if (includeLength) {
                            columnArray.push(street.length.toString());
                        }
                        if (detectIssues) {
                            columnArray.push("\"" + getIssues(street.issues) + "\"");
                        }
                        columnArray.push("\"" + street.lastEditor + "\"");
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
                        w.document.write("<td>" + roadTypeText + "</td><td>" + street.lockLevel + "</td>");
                        if (includeDirection) {
                            w.document.write("<td>" + translateDirection(street.direction) + "</td>");
                        }
                        if (includeLength) {
                            w.document.write("<td>" + street.length.toString() + "</td>");
                        }
                        if (detectIssues) {
                            w.document.write("<td>" + getIssues(street.issues) + "</td>");
                        }
                        w.document.write("<td>" + street.lastEditor + "</td><td>" + latlon.lat.toString() + "</td><td>" + latlon.lon.toString() + "</td>" +
                            "<td><a href=\'" + plStreet + "\' target=\'_blank\'>Permalink</a></td></tr>");
                    }
                }
            }
            if (isCSV) {
                var csvContent = lineArray.join("\n");
                //var encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
                var blob = new Blob([csvContent], {type: "data:text/csv;charset=utf-8;"});
                var link = document.createElement("a");
                var url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
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
            streets = null;
        }
    }
    WMEWAL_Streets.ScanComplete = ScanComplete;
    function ScanCancelled() {
        ScanComplete();
    }
    WMEWAL_Streets.ScanCancelled = ScanCancelled;
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
    function getIssues(issues) {
        var issuesList = [];
        if (issues & Issue.NoSpeedLimit) {
            issuesList.push("No Speed Limit");
        }
        if (issues & Issue.RestrictedJunctionArrows) {
            issuesList.push("Restricted junction arrows (red arrows)");
        }
        if (issues & Issue.TimeBasedRestrictions) {
            issuesList.push("Time-based restrictions");
        }
        if (issues & Issue.TimeBasedTurnRestrictions) {
            issuesList.push("Time-based turn restrictions");
        }
        if (issues & Issue.UTurn) {
            issuesList.push("U-turn");
        }
        if (issues & Issue.SoftTurns) {
            issuesList.push("Soft turns");
        }
        if (issues & Issue.UnnecessaryJunctionNode) {
            issuesList.push("Unnecessary junction node");
        }
        if (issues & Issue.Elevation) {
            issuesList.push("Elevation");
        }
        if (issues & Issue.SegmentLength) {
            issuesList.push("Segment length");
        }
        if (issues & Issue.NoName) {
            issuesList.push("No name");
        }
        if (issues & Issue.NoCity) {
            issuesList.push("No city");
        }
        if (issues & Issue.RoutingPreference) {
            issuesList.push("Non-neutral routing preference");
        }
        if (issuesList.length === 0) {
            return "None";
        }
        else {
            return issuesList.join(", ");
        }
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
                if (object == null) {
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
                } catch (e) {}
                if (typeof savedSettings === "undefined" || savedSettings === null || savedSettings.length === 0)
                {
                    console.debug(pluginName + ": decompressFromUTF16 failed, attempting decompress");
                    localStorage[savedSettingsKey +"Backup"] = localStorage[savedSettingsKey];
                    try {
                        savedSettings = JSON.parse(WMEWAL.LZString.decompress(localStorage[savedSettingsKey]));
                    } catch (e) {}
                    if (typeof savedSettings === "undefined" || savedSettings === null || savedSettings.length === 0)
                    {
                        console.debug(pluginName + ": decompress failed, savedSettings unrecoverable. Using blank");
                        savedSettings = [];
                    }
                    updateSavedSettings();
                }
                for (var ix = 0; ix < savedSettings.length; ix++) {
                    if (savedSettings[ix].Setting.hasOwnProperty("OutputTo")) {
                        delete savedSettings[ix].Setting.OutputTo;
                    }
                }
            }
        }
        if (settings == null) {
            settings = {
                OutputTo: "csv",
                RoadTypeMask: WMEWAL.RoadType.Freeway,
                State: null,
                StateOperation: Operation.Equal,
                LockLevel: null,
                LockLevelOperation: Operation.Equal,
                Regex: null,
                RegexIgnoreCase: true,
                ExcludeRoundabouts: false,
                ExcludeJunctionBoxes: true,
                EditableByMe: true,
                NoSpeedLimit: false,
                IncludeAltNames: false,
                Direction: null,
                CityRegex: null,
                CityRegexIgnoreCase: true,
                HasTimeBasedRestrictions: false,
                HasTimeBasedTurnRestrictions: false,
                HasRestrictedJunctionArrow: false,
                UnknownDirection: false,
                HasUTurn: false,
                HasSoftTurns: false,
                HasUnnecessaryJunctionNode: false,
                Elevation: false,
                ElevationOperation: Operation.LessThan,
                SegmentLength: false,
                SegmentLengthOperation: Operation.LessThan,
                SegmentLengthValue: null,
                LastModifiedBy: null,
                HasNoName: false,
                HasNoCity: false,
                Version: Version,
                NonNeutralRoutingPreference: false
            };
        }
        else {
            if (!settings.hasOwnProperty("Elevation")) {
                settings.Elevation = false;
            }
            if (!settings.hasOwnProperty("ElevationOperation")) {
                settings.ElevationOperation = Operation.LessThan;
            }
            if (!settings.hasOwnProperty("LastModifiedBy")) {
                settings.LastModifiedBy = null;
            }
            if (!settings.hasOwnProperty("HasNoName")) {
                settings.HasNoName = false;
            }
            if (!settings.hasOwnProperty("HasNoCity")) {
                settings.HasNoCity = false;
            }
            if (!settings.hasOwnProperty("Version")) {
                settings.Version = Version;
                updateSettings();
            }
            if (!settings.hasOwnProperty("NonNeutralRoutingPreference")) {
                settings.NonNeutralRoutingPreference = false;
            }
            if (!settings.hasOwnProperty("UnknownDirection")) {
                settings.UnknownDirection = false;
            }
        }
        console.log("Initialized");
        console.groupEnd();
        /*if (compareVersions(settings.Version, Version) < 0) {
            var versionHistory = "WME WAL Streets Plugin\nv" + Version + "\n\nWhat's New\n--------";
            if (compareVersions(settings.Version, "1.4.1")) {
                versionHistory += "\nv1.4.1: Find segments with non-neutral routing preference.";
            }
            alert(versionHistory);
            settings.Version = Version;
            updateSettings();
        }*/
        WMEWAL.RegisterPlugIn(WMEWAL_Streets);
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
    function compareVersions(v1, v2) {
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
    Init();
})(WMEWAL_Streets || (WMEWAL_Streets = {}));
