/// <reference path="../typescript-typings/globals/openlayers/index.d.ts" />
/// <reference path="../typescript-typings/I18n.d.ts" />
/// <reference path="../typescript-typings/waze.d.ts" />
/// <reference path="../typescript-typings/globals/jquery/index.d.ts" />
/// <reference path="WME Wide-Angle Lens.user.ts" />
/// <reference path="../typescript-typings/greasyfork.d.ts" />
// ==UserScript==
// @name                WME Wide-Angle Lens Places
// @namespace           https://greasyfork.org/en/users/19861-vtpearce
// @description         Find place that match filter criteria
// @author              vtpearce and crazycaveman
// @include             https://www.waze.com/editor
// @include             /^https:\/\/(www|beta)\.waze\.com\/(?!user\/)(.{2,6}\/)?editor.*$/
// @version             1.4.5
// @grant               none
// @copyright           2020 vtpearce
// @license             CC BY-SA 4.0
// @require             https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js
// @updateURL           https://greasyfork.org/scripts/40645-wme-wide-angle-lens-places/code/WME%20Wide-Angle%20Lens%20Places.meta.js
// @downloadURL         https://greasyfork.org/scripts/40645-wme-wide-angle-lens-places/code/WME%20Wide-Angle%20Lens%20Places.user.js
// ==/UserScript==
/*global W, OL, I18n, $, WazeWrap, WMEWAL, OpenLayers */
var WMEWAL_Places;
(function (WMEWAL_Places) {
    const scrName = GM_info.script.name;
    const Version = GM_info.script.version;
    const updateText = '<ul>' +
        '<li>Add Category Operation</li>' +
        '<li>Add No Phone Number option</li>' +
        '<li>Added No Website option</li>' +
        '</ul>';
    const greasyForkPage = 'https://greasyfork.org/scripts/40645';
    const wazeForumThread = 'https://www.waze.com/forum/viewtopic.php?t=206376';
    const ctlPrefix = "_wmewalPlaces";
    const minimumWALVersionRequired = "1.5.3";
    let Operation;
    (function (Operation) {
        Operation[Operation["Equal"] = 1] = "Equal";
        Operation[Operation["NotEqual"] = 2] = "NotEqual";
        Operation[Operation["LessThan"] = 3] = "LessThan";
        Operation[Operation["LessThanOrEqual"] = 4] = "LessThanOrEqual";
        Operation[Operation["GreaterThan"] = 5] = "GreaterThan";
        Operation[Operation["GreaterThanOrEqual"] = 6] = "GreaterThanOrEqual";
    })(Operation || (Operation = {}));
    let Issue;
    (function (Issue) {
        Issue[Issue["MissingHouseNumber"] = 1] = "MissingHouseNumber";
        Issue[Issue["MissingStreet"] = 2] = "MissingStreet";
        Issue[Issue["AdLocked"] = 4] = "AdLocked";
        Issue[Issue["HasUpdateRequests"] = 8] = "HasUpdateRequests";
        Issue[Issue["PendingApproval"] = 16] = "PendingApproval";
        Issue[Issue["UndefStreet"] = 32] = "UndefStreet";
        Issue[Issue["NoExternalProviders"] = 64] = "NoExternalProviders";
        Issue[Issue["NoHours"] = 128] = "NoHours";
        Issue[Issue["NoEntryExitPoints"] = 256] = "NoEntryExitPoints";
        Issue[Issue["MissingBrand"] = 512] = "MissingBrand";
        Issue[Issue["NoPhoneNumber"] = 1024] = "NoPhoneNumber";
        Issue[Issue["InvalidPhoneNumber"] = 2048] = "InvalidPhoneNumber";
        Issue[Issue["NoWebsite"] = 4096] = "NoWebsite";
        Issue[Issue["NoCity"] = 8192] = "NoCity";
    })(Issue || (Issue = {}));
    let pluginName = "WMEWAL-Places";
    WMEWAL_Places.Title = "Places";
    WMEWAL_Places.MinimumZoomLevel = 5;
    WMEWAL_Places.SupportsSegments = false;
    WMEWAL_Places.SupportsVenues = true;
    let settingsKey = "WMEWALPlacesSettings";
    let savedSettingsKey = "WMEWALPlacesSavedSettings";
    let settings = null;
    let savedSettings = [];
    let places;
    let nameRegex = null;
    let cityRegex = null;
    let websiteRegex = null;
    let streetRegex = null;
    let state;
    let stateName;
    let lastModifiedBy;
    let lastModifiedByName;
    let createdBy;
    let createdByName;
    let initCount = 0;
    let detectIssues = false;
    let savedVenues;
    function GetTab() {
        let rpp = "RESIDENCE_HOME";
        let html = "<table style='border-collapse:separate;border-spacing:0px 1px;'>";
        html += "<tbody>";
        html += "<tr><td class='wal-heading'><b>Saved Filters</b></td></tr>";
        html += "<tr><td style='padding-left: 20px; padding-bottom: 8px'>" +
            `<select id='${ctlPrefix}SavedSettings'/><br/>` +
            `<button class='btn btn-primary' id='${ctlPrefix}LoadSetting' title='Load'>Load</button>` +
            `<button class='btn btn-primary' style='margin-left: 4px;' id='${ctlPrefix}SaveSetting' title='Save'>Save</button>` +
            `<button class='btn btn-primary' style='margin-left: 4px;' id='${ctlPrefix}DeleteSetting' title='Delete'>Delete</button></td></tr>`;
        html += "<tr><td class='wal-heading' style='border-top: 1px solid'>Output Options</td></tr>";
        html += `<tr><td class='wal-indent'><input type='checkbox' id='${ctlPrefix}IncludeAlt' name='${ctlPrefix}IncludeAlt'>` +
            `<label for='${ctlPrefix}IncludeAlt' style='margin-left:8px;'>Include Alt Names</label></td></tr>`;
        html += "<tr><td class='wal-heading' style='border-top: 1px solid; padding-top: 4px'><b>Filters (All of these)</b></td></tr>";
        html += "<tr><td><b>Category:</b></td></tr>";
        html += `<tr><td style='padding-left:20px'><select id='${ctlPrefix}CategoryOp'>` +
            "<option value='" + Operation.Equal.toString() + "' selected='selected'>=</option>" +
            "<option value='" + Operation.NotEqual.toString() + "'>&lt;&gt;</option>" +
            "</select>";
        html += `<select id='${ctlPrefix}Category'>` +
            "<option value=''></option>";
        for (var topIx = 0; topIx < W.Config.venues.categories.length; topIx++) {
            var topCategory = W.Config.venues.categories[topIx];
            html += ("<option value='" + topCategory + "'>" + I18n.t("venues.categories." + topCategory) + "</option>");
            var subCategories = W.Config.venues.subcategories[topCategory];
            for (var subIx = 0; subIx < subCategories.length; subIx++) {
                var subCategory = W.Config.venues.subcategories[topCategory][subIx];
                html += ("<option value='" + subCategory + "'>--" + I18n.t("venues.categories." + subCategory) + "</option>");
            }
        }
        html += "<option value='" + rpp + "'>" + I18n.t("venues.categories." + rpp) + "</option>";
        html += "</select></td></tr>";
        html += "<tr><td><b>Lock Level:</b></td></tr>" +
            "<tr><td style='padding-left: 20px'>" +
            `<select id='${ctlPrefix}LockLevelOp'>` +
            "<option value='" + Operation.Equal.toString() + "' selected='selected'>=</option>" +
            "<option value='" + Operation.NotEqual.toString() + "'>&lt;&gt;</option></select>" +
            `<select id='${ctlPrefix}LockLevel'>` +
            "<option value=''></option>" +
            "<option value='1'>1</option>" +
            "<option value='2'>2</option>" +
            "<option value='3'>3</option>" +
            "<option value='4'>4</option>" +
            "<option value='5'>5</option>" +
            "<option value='6'>6</option>" +
            "<option value='7'>7</option>" +
            "</select></td></tr>";
        html += "<tr><td><b>Name RegEx</b></td></tr>";
        html += "<tr><td style='padding-left: 20px'>" +
            `<input type='text' id='${ctlPrefix}Name' class='wal-textbox'/><br/>` +
            `<input id='${ctlPrefix}IgnoreCase' type='checkbox'/>` +
            `<label for='${ctlPrefix}IgnoreCase' style='padding-left: 20px'>Ignore case</label></td>`;
        html += "<tr><td><b>Street RegEx</b></td></tr>";
        html += "<tr><td style='padding-left: 20px'>" +
            `<input type='text' id='${ctlPrefix}Street' class='wal-textbox'/><br/>` +
            `<input id='${ctlPrefix}StreetIgnoreCase' type='checkbox'/>` +
            `<label for='${ctlPrefix}StreetIgnoreCase' style='padding-left: 20px'>Ignore case</label></td>`;
        html += "<tr><td><b>City RegEx:</b></td></tr>";
        html += `<tr><td style='padding-left: 20px'><input type='text' id='${ctlPrefix}City' class='wal-textbox'/><br/>` +
            `<input id='${ctlPrefix}CityIgnoreCase' type='checkbox'/>` +
            `<label for='${ctlPrefix}CityIgnoreCase' style='margin-left: 8px'>Ignore case</label></td></tr>`;
        html += "<tr><td><b>Website RegEx:</b></td></tr>";
        html += `<tr><td style='padding-left: 20px'><input type='text' id='${ctlPrefix}Website' class='wal-textbox'/><br/>` +
            `<input id='${ctlPrefix}WebsiteIgnoreCase' type='checkbox'/>` +
            `<label for='${ctlPrefix}WebsiteIgnoreCase' style='margin-left: 8px'>Ignore case</label></td></tr>`;
        html += "<tr><td><b>State:</b></td></tr>";
        html += "<tr><td style='padding-left:20px'>" +
            `<select id='${ctlPrefix}StateOp'>` +
            "<option value='" + Operation.Equal.toString() + "' selected='selected'>=</option>" +
            "<option value='" + Operation.NotEqual.toString() + "'>&lt;&gt;</option></select>" +
            `<select id='${ctlPrefix}State'/>`;
        html += "<tr><td><b>Type:</b></td></tr>" +
            `<tr><td style='padding-left: 20px'><select id='${ctlPrefix}Type'>` +
            "<option value=''></option>" +
            "<option value='area'>" + I18n.t("edit.venue.type.area") + "</option>" +
            "<option value='point'>" + I18n.t("edit.venue.type.point") + "</option>" +
            "</select></td></tr>";
        html += "<tr><td><b>Created By:</b></td></tr>";
        html += "<tr><td class='wal-indent'>" +
            `<select id='${ctlPrefix}CreatedBy'/></td></tr>`;
        html += `<tr><td><input id='${ctlPrefix}Created' type='checkbox' />` +
            `<label for=${ctlPrefix}Created' class='wal-label'>Date Created:</label> ` +
            `<select id='${ctlPrefix}CreatedOp'>` +
            `<option value='${Operation.LessThan}'>&lt;</option>` +
            `<option value='${Operation.LessThanOrEqual}'>&lt;=</option>` +
            `<option value='${Operation.GreaterThanOrEqual}' selected='selected'>&gt;=</option>` +
            `<option value='${Operation.GreaterThan}'>&gt;</option></select>` +
            "</td></tr>";
        html += "<tr><td class='wal-indent'>" +
            `<input id='${ctlPrefix}CreatedDate' type='date'/> <input id='${ctlPrefix}CreatedTime' type='time'/></td></tr>`;
        html += "<tr><td><b>Last Updated By:</b></td></tr>";
        html += "<tr><td class='wal-indent'>" +
            `<select id='${ctlPrefix}LastModifiedBy'/></td></tr>`;
        html += `<tr><td><input id='${ctlPrefix}Updated' type='checkbox' />` +
            `<label for=${ctlPrefix}Updated' class='wal-label'>Date Updated:</label> ` +
            `<select id='${ctlPrefix}UpdatedOp'>` +
            `<option value='${Operation.LessThan}'>&lt;</option>` +
            `<option value='${Operation.LessThanOrEqual}'>&lt;=</option>` +
            `<option value='${Operation.GreaterThanOrEqual}' selected='selected'>&gt;=</option>` +
            `<option value='${Operation.GreaterThan}'>&gt;</option></select>` +
            "</td></tr>";
        html += "<tr><td class='wal-indent'>" +
            `<input id='${ctlPrefix}UpdatedDate' type='date'/> <input id='${ctlPrefix}UpdatedTime' type='time'/></td></tr>`;
        html += `<tr><td><input id='${ctlPrefix}Editable' type='checkbox'/>` +
            `<label for='${ctlPrefix}Editable' class='wal-label'>Editable by me</label></td></tr>`;
        html += `<tr><td><input id='${ctlPrefix}ParkingLotType' type='checkbox'/>` +
            `<label for='${ctlPrefix}ParkingLotType' class='wal-label'>`;
        html += `Parking Lot Type: <select id='${ctlPrefix}ParkingLotTypeFilter'>` +
            "<option value='PRIVATE'>" + I18n.t("edit.venue.parking.types.parkingType.PRIVATE") + "</option>" +
            "<option value='PUBLIC'>" + I18n.t("edit.venue.parking.types.parkingType.PUBLIC") + "</option>" +
            "<option value='RESTRICTED'>" + I18n.t("edit.venue.parking.types.parkingType.RESTRICTED") + "</option>" +
            "</select></label></td></tr>";
        html += "<tr><td class='wal-heading' style='border-top: 1px solid; padding-top: 4px'>Issues (Any of these)</td></tr>";
        html += `<tr><td><input type='checkbox' id='${ctlPrefix}NoHouseNumber'/>` +
            `<label for='${ctlPrefix}NoHouseNumber' class='wal-label'>Missing House Number</label></td></tr>`;
        html += `<tr><td><input type='checkbox' id='${ctlPrefix}NoStreet'/>` +
            `<label for='${ctlPrefix}NoStreet' class='wal-label'>Missing Street</label></td></tr>`;
        html += `<tr><td><input type='checkbox' id='${ctlPrefix}NoCity'/>` +
            `<label for='${ctlPrefix}NoCity' class='wal-label'>Missing City</label></td></tr>`;
        html += `<tr><td><input type='checkbox' id='${ctlPrefix}AdLocked'/>` +
            `<label for='${ctlPrefix}AdLocked' class='wal-label'>Ad Locked</label></td></tr>`;
        html += `<tr><td ><input type='checkbox' id='${ctlPrefix}UpdateRequests'/>` +
            `<label for='${ctlPrefix}UpdateRequests' class='wal-label'>Has Update Requests</label></td></tr>`;
        html += `<tr><td ><input type='checkbox' id='${ctlPrefix}PendingApproval'/>` +
            `<label for='${ctlPrefix}PendingApproval' class='wal-label'>Pending Approval</label></td></tr>`;
        html += `<tr><td><input type='checkbox' id='${ctlPrefix}UndefStreet' />` +
            `<label for='${ctlPrefix}UndefStreet' class='wal-label' title='Street ID not found in W.model.streets.objects, possibly as a result of a cities form Merge or Delete'>Undefined Street ID</label></td></tr>`;
        html += `<tr><td><input type='checkbox' id='${ctlPrefix}NoExternalProviders' />` +
            `<label for='${ctlPrefix}NoExternalProviders' class='wal-label'>No External Provider Links</label></td></tr>`;
        html += `<tr><td><input type='checkbox' id='${ctlPrefix}NoHours' />` +
            `<label for='${ctlPrefix}NoHours' class='wal-label'>No Hours</label></td></tr>`;
        html += `<tr><td><input type='checkbox' id='${ctlPrefix}NoWebsite' />` +
            `<label for='${ctlPrefix}NoWebsite' class='wal-label'>No Website</label></td></tr>`;
        html += `<tr><td><input type='checkbox' id='${ctlPrefix}NoPhoneNumber' />` +
            `<label for='${ctlPrefix}NoPhoneNumber' class='wal-label'>No Phone Number</label></td></tr>`;
        html += `<tr><td><input type='checkbox' id='${ctlPrefix}InvalidPhoneNumber' />` +
            `<label for='${ctlPrefix}InvalidPhoneNumber' class='wal-label'>Invalid Phone Number</label></td></tr>`;
        html += `<tr><td><input type='checkbox' id='${ctlPrefix}NoEntryExitPoints' />` +
            `<label for='${ctlPrefix}NoEntryExitPoints' class='wal-label'>No Entry/Exit Points</label></td></tr>`;
        html += `<tr><td><input type='checkbox' id='${ctlPrefix}MissingBrand' />` +
            `<label for='${ctlPrefix}MissingBrand' class='wal-label'>Missing Brand (GS)</label></td></tr>`;
        html += "</tbody></table>";
        return html;
    }
    WMEWAL_Places.GetTab = GetTab;
    function TabLoaded() {
        updateStates();
        updateUsers($(`#${ctlPrefix}LastModifiedBy`));
        updateUsers($(`#${ctlPrefix}CreatedBy`));
        updateUI();
        updateSavedSettingsList();
        $(`#${ctlPrefix}State`).on("focus", updateStates);
        $(`#${ctlPrefix}LastModifiedBy`).on("focus", function () {
            updateUsers($(`#${ctlPrefix}LastModifiedBy`));
        });
        $(`#${ctlPrefix}CreatedBy`).on("focus", function () {
            updateUsers($(`#${ctlPrefix}CreatedBy`));
        });
        $(`#${ctlPrefix}LoadSetting`).on("click", loadSetting);
        $(`#${ctlPrefix}SaveSetting`).on("click", saveSetting);
        $(`#${ctlPrefix}DeleteSetting`).on("click", deleteSetting);
    }
    WMEWAL_Places.TabLoaded = TabLoaded;
    function updateStates() {
        let selectState = $(`#${ctlPrefix}State`);
        // Preserve current selection
        let currentId = parseInt(selectState.val());
        selectState.empty();
        let stateObjs = [];
        stateObjs.push({ id: null, name: "" });
        for (let s in W.model.states.objects) {
            if (W.model.states.objects.hasOwnProperty(s)) {
                let st = W.model.states.getObjectById(parseInt(s));
                if (st.id !== 1 && st.name.length !== 0) {
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
        for (let ix = 0; ix < stateObjs.length; ix++) {
            let so = stateObjs[ix];
            let stateOption = $("<option/>").text(so.name).attr("value", so.id ?? "");
            if (currentId != null && so.id === currentId) {
                stateOption.attr("selected", "selected");
            }
            selectState.append(stateOption);
        }
    }
    function updateUsers(selectUsernameList) {
        // Preserve current selection
        var currentId = parseInt(selectUsernameList.val());
        selectUsernameList.empty();
        let userObjs = [];
        userObjs.push({ id: null, name: "" });
        for (let uo in W.model.users.objects) {
            if (W.model.users.objects.hasOwnProperty(uo)) {
                let u = W.model.users.getObjectById(parseInt(uo));
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
        for (let ix = 0; ix < userObjs.length; ix++) {
            let o = userObjs[ix];
            let userOption = $("<option/>").text(o.name).attr("value", o.id);
            if (currentId != null && o.id == null) {
                userOption.attr("selected", "selected");
            }
            selectUsernameList.append(userOption);
        }
    }
    function updateSavedSettingsList() {
        let s = $(`#${ctlPrefix}SavedSettings`);
        s.empty();
        for (let ixSaved = 0; ixSaved < savedSettings.length; ixSaved++) {
            let opt = $("<option/>").attr("value", ixSaved).text(savedSettings[ixSaved].Name);
            s.append(opt);
        }
    }
    function updateUI() {
        // $(`#${ctlPrefix}OutputTo`).val(settings.OutputTo);
        $(`#${ctlPrefix}CategoryOp`).val(settings.CategoryOperation || Operation.Equal);
        $(`#${ctlPrefix}Category`).val(settings.Category);
        $(`#${ctlPrefix}LockLevel`).val(settings.LockLevel);
        $(`#${ctlPrefix}LockLevelOp`).val(settings.LockLevelOperation || Operation.Equal);
        $(`#${ctlPrefix}Name`).val(settings.Regex || "");
        $(`#${ctlPrefix}IgnoreCase`).prop("checked", settings.RegexIgnoreCase);
        $(`#${ctlPrefix}City`).val(settings.CityRegex || "");
        $(`#${ctlPrefix}CityIgnoreCase`).prop("checked", settings.CityRegexIgnoreCase);
        $(`#${ctlPrefix}State`).val(settings.State);
        $(`#${ctlPrefix}StateOp`).val(settings.StateOperation || Operation.Equal);
        $(`#${ctlPrefix}Type`).val(settings.PlaceType);
        $(`#${ctlPrefix}Editable`).prop("checked", settings.EditableByMe);
        $(`#${ctlPrefix}NoHouseNumber`).prop("checked", settings.NoHouseNumber);
        $(`#${ctlPrefix}UndefStreet`).prop("checked", settings.UndefStreet);
        $(`#${ctlPrefix}AdLocked`).prop("checked", settings.AdLocked);
        $(`#${ctlPrefix}UpdateRequests`).prop("checked", settings.UpdateRequests);
        $(`#${ctlPrefix}PendingApproval`).prop("checked", settings.PendingApproval);
        $(`#${ctlPrefix}NoStreet`).prop("checked", settings.NoStreet);
        $(`#${ctlPrefix}NoCity`).prop("checked", settings.NoCity);
        $(`#${ctlPrefix}LastModifiedBy`).val(settings.LastModifiedBy);
        $(`#${ctlPrefix}CreatedBy`).val(settings.CreatedBy);
        $(`#${ctlPrefix}NoExternalProviders`).prop("checked", settings.NoExternalProviders);
        $(`#${ctlPrefix}NoHours`).prop("checked", settings.NoHours);
        $(`#${ctlPrefix}NoPhoneNumber`).prop("checked", settings.NoPhoneNumber);
        $(`#${ctlPrefix}InvalidPhoneNumber`).prop("checked", settings.InvalidPhoneNumber);
        $(`#${ctlPrefix}NoWebsite`).prop("checked", settings.NoWebsite);
        $(`#${ctlPrefix}NoEntryExitPoints`).prop("checked", settings.NoEntryExitPoints);
        $(`#${ctlPrefix}ParkingLotType`).prop("checked", settings.ParkingLotType);
        $(`#${ctlPrefix}ParkingLotTypeFilter`).val(settings.ParkingLotTypeFilter);
        $(`#${ctlPrefix}MissingBrand`).prop("checked", settings.MissingBrand);
        $(`#${ctlPrefix}IncludeAlt`).prop("checked", settings.IncludeAlt);
        $(`#${ctlPrefix}Created`).prop("checked", settings.Created);
        $(`#${ctlPrefix}CreatedOp`).val(settings.CreatedOperation);
        if (settings.CreatedDate != null) {
            let createdDateTime = new Date(settings.CreatedDate);
            $(`#${ctlPrefix}CreatedDate`).val(createdDateTime.getFullYear().toString().padStart(4, "0") + "-" +
                (createdDateTime.getMonth() + 1).toString().padStart(2, "0") + "-" + createdDateTime.getDate().toString().padStart(2, "0"));
            $(`#${ctlPrefix}CreatedTime`).val(createdDateTime.getHours().toString().padStart(2, "0") + ":" +
                createdDateTime.getMinutes().toString().padStart(2, "0"));
        }
        else {
            $(`#${ctlPrefix}CreatedDate`).val("");
            $(`#${ctlPrefix}CreatedTime`).val("");
        }
        $(`#${ctlPrefix}Updated`).prop("checked", settings.Updated);
        $(`#${ctlPrefix}UpdatedOp`).val(settings.UpdatedOperation);
        if (settings.UpdatedDate != null) {
            let updatedDateTime = new Date(settings.UpdatedDate);
            $(`#${ctlPrefix}UpdatedDate`).val(updatedDateTime.getFullYear().toString().padStart(4, "0") + "-" +
                (updatedDateTime.getMonth() + 1).toString().padStart(2, "0") + "-" + updatedDateTime.getDate().toString().padStart(2, "0"));
            $(`#${ctlPrefix}UpdatedTime`).val(updatedDateTime.getHours().toString().padStart(2, "0") + ":" +
                updatedDateTime.getMinutes().toString().padStart(2, "0"));
        }
        else {
            $(`#${ctlPrefix}UpdatedDate`).val("");
            $(`#${ctlPrefix}UpdatedTime`).val("");
        }
        $(`#${ctlPrefix}Website`).val(settings.WebsiteRegex || "");
        $(`#${ctlPrefix}WebsiteIgnoreCase`).prop("checked", settings.WebsiteRegexIgnoreCase);
        $(`#${ctlPrefix}Street`).val(settings.StreetRegex || "");
        $(`#${ctlPrefix}StreetIgnoreCase`).prop("checked", settings.StreetRegexIgnoreCase);
    }
    function loadSetting() {
        let selectedSetting = parseInt($(`#${ctlPrefix}SavedSettings`).val());
        if (selectedSetting == null || isNaN(selectedSetting) || selectedSetting < 0 || selectedSetting > savedSettings.length) {
            return;
        }
        // settings.OutputTo = $(`#${ctlPrefix}OutputTo`).val();
        let savedSetting = savedSettings[selectedSetting].Setting;
        for (let name in savedSetting) {
            if (settings.hasOwnProperty(name)) {
                settings[name] = savedSetting[name];
            }
        }
        updateUI();
    }
    function validateSettings() {
        function addMessage(error) {
            message += ((message.length > 0 ? "\n" : "") + error);
        }
        let message = "";
        let s = getSettings();
        let cat = $(`#${ctlPrefix}Category`).val();
        let r;
        if (nullif(s.Regex, "") !== null) {
            try {
                r = (s.RegexIgnoreCase ? new RegExp(s.Regex, "i") : new RegExp(s.Regex));
            }
            catch (error) {
                addMessage("Name RegEx is invalid");
            }
        }
        if (nullif(s.CityRegex, "") !== null) {
            try {
                r = (s.CityRegexIgnoreCase ? new RegExp(s.CityRegex, "i") : new RegExp(s.CityRegex));
            }
            catch (error) {
                addMessage("City RegEx is invalid");
            }
        }
        if (nullif(s.WebsiteRegex, "") !== null) {
            try {
                r = (s.WebsiteRegexIgnoreCase ? new RegExp(s.WebsiteRegex, "i") : new RegExp(s.WebsiteRegex));
            }
            catch (error) {
                addMessage("Website RegEx is invalid");
            }
        }
        if (nullif(s.StreetRegex, "") !== null) {
            try {
                r = (s.StreetRegexIgnoreCase ? new RegExp(s.StreetRegex, "i") : new RegExp(s.StreetRegex));
            }
            catch (error) {
                addMessage("Street RegEx is invalid");
            }
        }
        let selectedState = $(`#${ctlPrefix}State`).val();
        if (nullif(selectedState, "") !== null && s.State === null) {
            addMessage("Invalid state selection");
        }
        let selectedModifiedUser = $(`#${ctlPrefix}LastModifiedBy`).val();
        if (nullif(selectedModifiedUser, "") !== null && s.LastModifiedBy === null) {
            addMessage("Invalid last modified user");
        }
        let selectedCreatedUser = $(`#${ctlPrefix}CreatedBy`).val();
        if (nullif(selectedCreatedUser, "") !== null && s.CreatedBy === null) {
            addMessage("Invalid created user");
        }
        if (s.ParkingLotType) {
            if (nullif(s.ParkingLotTypeFilter, "") === null) {
                addMessage("Please select a parking lot type");
            }
            if (cat !== "" && cat !== "PARKING_LOT") {
                addMessage("When filtering on parking lot type, category must be parking lot.");
            }
        }
        if (s.MissingBrand && cat !== "" && cat !== "GAS_STATION" && cat !== "CAR_SERVICES") {
            addMessage("Invalid category selected if checking for missing gas station brand");
        }
        if (s.Created && s.CreatedDate === null) {
            addMessage("Select a created date on which to filter.");
        }
        if (s.Updated && s.UpdatedDate === null) {
            addMessage("Select an updated date on which to filter.");
        }
        if (message.length > 0) {
            alert(pluginName + ": " + message);
            return false;
        }
        return true;
    }
    function saveSetting() {
        if (validateSettings()) {
            let s = getSettings();
            let sName = prompt("Enter a name for this setting");
            if (sName == null) {
                return;
            }
            // Check to see if there is already a name that matches this
            for (let ixSetting = 0; ixSetting < savedSettings.length; ixSetting++) {
                if (savedSettings[ixSetting].Name === sName) {
                    if (confirm("A setting with this name already exists. Overwrite?")) {
                        savedSettings[ixSetting].Setting = s;
                        updateSavedSettings();
                    }
                    else {
                        alert("Please pick a new name.");
                    }
                    return;
                }
            }
            let savedSetting = {
                Name: sName,
                Setting: s
            };
            savedSettings.push(savedSetting);
            updateSavedSettings();
        }
    }
    function getSettings() {
        let s = {
            Regex: null,
            RegexIgnoreCase: $(`#${ctlPrefix}IgnoreCase`).prop("checked"),
            CategoryOperation: parseInt($(`#${ctlPrefix}CategoryOp`).val()),
            Category: null,
            NoHouseNumber: $(`#${ctlPrefix}NoHouseNumber`).prop("checked"),
            State: null,
            StateOperation: parseInt($(`#${ctlPrefix}StateOp`).val()),
            LockLevel: null,
            LockLevelOperation: parseInt($(`#${ctlPrefix}LockLevelOp`).val()),
            EditableByMe: $(`#${ctlPrefix}Editable`).prop("checked"),
            AdLocked: $(`#${ctlPrefix}AdLocked`).prop("checked"),
            UndefStreet: $(`#${ctlPrefix}UndefStreet`).prop("checked"),
            UpdateRequests: $(`#${ctlPrefix}UpdateRequests`).prop("checked"),
            PlaceType: null,
            PendingApproval: $(`#${ctlPrefix}PendingApproval`).prop("checked"),
            CityRegex: null,
            CityRegexIgnoreCase: $(`#${ctlPrefix}CityIgnoreCase`).prop("checked"),
            NoStreet: $(`#${ctlPrefix}NoStreet`).prop("checked"),
            NoCity: $(`#${ctlPrefix}NoCity`).prop("checked"),
            LastModifiedBy: null,
            CreatedBy: null,
            NoExternalProviders: $(`#${ctlPrefix}NoExternalProviders`).prop("checked"),
            NoHours: $(`#${ctlPrefix}NoHours`).prop("checked"),
            NoPhoneNumber: $(`#${ctlPrefix}NoPhoneNumber`).prop("checked"),
            InvalidPhoneNumber: $(`#${ctlPrefix}InvalidPhoneNumber`).prop("checked"),
            NoWebsite: $(`#${ctlPrefix}NoWebsite`).prop("checked"),
            NoEntryExitPoints: $(`#${ctlPrefix}NoEntryExitPoints`).prop("checked"),
            ParkingLotType: $(`#${ctlPrefix}ParkingLotType`).prop("checked"),
            ParkingLotTypeFilter: $(`#${ctlPrefix}ParkingLotTypeFilter`).val(),
            MissingBrand: $(`#${ctlPrefix}MissingBrand`).prop("checked"),
            IncludeAlt: $(`#${ctlPrefix}IncludeAlt`).prop("checked"),
            Created: $(`#${ctlPrefix}Created`).prop("checked"),
            CreatedOperation: parseInt($(`#${ctlPrefix}CreatedOp`).val()),
            CreatedDate: null,
            Updated: $(`#${ctlPrefix}Updated`).prop("checked"),
            UpdatedOperation: parseInt($(`#${ctlPrefix}UpdatedOp`).val()),
            UpdatedDate: null,
            WebsiteRegex: null,
            WebsiteRegexIgnoreCase: $(`#${ctlPrefix}WebsiteIgnoreCase`).prop("checked"),
            StreetRegex: null,
            StreetRegexIgnoreCase: $(`#${ctlPrefix}StreetIgnoreCase`).prop("checked")
        };
        s.Regex = nullif($(`#${ctlPrefix}Name`).val(), "");
        s.CityRegex = nullif($(`#${ctlPrefix}City`).val(), "");
        s.WebsiteRegex = nullif($(`#${ctlPrefix}Website`).val(), "");
        s.StreetRegex = nullif($(`#${ctlPrefix}Street`).val(), "");
        let selectedState = $(`#${ctlPrefix}State`).val();
        if (nullif(selectedState, "") !== null) {
            let state = W.model.states.getObjectById(parseInt(selectedState));
            if (state !== null) {
                s.State = state.id;
            }
        }
        let selectedModifiedUser = $(`#${ctlPrefix}LastModifiedBy`).val();
        if (nullif(selectedModifiedUser, "") !== null) {
            let u = W.model.users.getObjectById(selectedModifiedUser);
            if (u !== null) {
                s.LastModifiedBy = u.id;
            }
        }
        let selectedCreatedUser = $(`#${ctlPrefix}CreatedBy`).val();
        if (nullif(selectedCreatedUser, "") !== null) {
            let u = W.model.users.getObjectById(selectedCreatedUser);
            if (u !== null) {
                s.CreatedBy = u.id;
            }
        }
        let selectedLockLevel = $(`#${ctlPrefix}LockLevel`).val();
        if (selectedLockLevel != null && selectedLockLevel.length > 0) {
            s.LockLevel = parseInt(selectedLockLevel);
        }
        s.PlaceType = nullif($(`#${ctlPrefix}Type`).val(), "");
        s.Category = nullif($(`#${ctlPrefix}Category`).val(), "");
        let createdDate = $(`#${ctlPrefix}CreatedDate`).val();
        if (createdDate && createdDate.length > 0) {
            let createdTime = $(`#${ctlPrefix}CreatedTime`).val();
            if (createdTime && createdTime.length > 0) {
                createdDate += ` ${createdTime}`;
            }
            else {
                createdDate += ' 00:00';
            }
            s.CreatedDate = (new Date(createdDate)).getTime();
        }
        let updatedDate = $(`#${ctlPrefix}UpdatedDate`).val();
        if (updatedDate && updatedDate.length > 0) {
            let updatedTime = $(`#${ctlPrefix}UpdatedTime`).val();
            if (updatedTime && updatedTime.length > 0) {
                updatedDate += ` ${updatedTime}`;
            }
            else {
                updatedDate += ' 00:00';
            }
            s.UpdatedDate = (new Date(updatedDate)).getTime();
        }
        return s;
    }
    function deleteSetting() {
        let selectedSetting = parseInt($(`#${ctlPrefix}SavedSettings`).val());
        if (selectedSetting == null || isNaN(selectedSetting) || selectedSetting < 0 || selectedSetting > savedSettings.length) {
            return;
        }
        if (confirm("Are you sure you want to delete this saved setting?")) {
            savedSettings.splice(selectedSetting, 1);
            updateSavedSettings();
        }
    }
    function ScanStarted() {
        let allOk = validateSettings();
        places = [];
        savedVenues = [];
        if (allOk) {
            settings = getSettings();
            if (nullif(settings.Regex, "") !== null) {
                nameRegex = (settings.RegexIgnoreCase ? new RegExp(settings.Regex, "i") : new RegExp(settings.Regex));
            }
            else {
                nameRegex = null;
            }
            if (nullif(settings.CityRegex, "") !== null) {
                cityRegex = (settings.CityRegexIgnoreCase ? new RegExp(settings.CityRegex, "i") : new RegExp(settings.CityRegex));
            }
            else {
                cityRegex = null;
            }
            if (nullif(settings.WebsiteRegex, "") !== null) {
                websiteRegex = (settings.WebsiteRegexIgnoreCase ? new RegExp(settings.WebsiteRegex, "i") : new RegExp(settings.WebsiteRegex));
            }
            else {
                websiteRegex = null;
            }
            if (nullif(settings.StreetRegex, "") !== null) {
                streetRegex = (settings.StreetRegexIgnoreCase ? new RegExp(settings.StreetRegex, "i") : new RegExp(settings.StreetRegex));
            }
            else {
                streetRegex = null;
            }
            if (settings.State !== null) {
                state = W.model.states.getObjectById(settings.State);
                stateName = state.name;
            }
            else {
                state = null;
                stateName = null;
            }
            if (settings.LastModifiedBy !== null) {
                lastModifiedBy = W.model.users.getObjectById(settings.LastModifiedBy);
                lastModifiedByName = lastModifiedBy.userName;
            }
            else {
                lastModifiedBy = null;
                lastModifiedByName = null;
            }
            if (settings.CreatedBy !== null) {
                createdBy = W.model.users.getObjectById(settings.CreatedBy);
                createdByName = createdBy.userName;
            }
            else {
                createdBy = null;
                createdByName = null;
            }
            detectIssues = settings.NoHouseNumber ||
                settings.NoStreet ||
                settings.NoCity ||
                settings.AdLocked ||
                settings.UpdateRequests ||
                settings.PendingApproval ||
                settings.UndefStreet ||
                settings.NoExternalProviders ||
                settings.NoHours ||
                settings.NoPhoneNumber ||
                settings.InvalidPhoneNumber ||
                settings.NoWebsite ||
                settings.NoEntryExitPoints ||
                settings.MissingBrand;
            updateSettings();
        }
        return allOk;
    }
    WMEWAL_Places.ScanStarted = ScanStarted;
    function ScanExtent(segments, venues) {
        return new Promise(resolve => {
            setTimeout(function () {
                scan(segments, venues);
                resolve();
            });
        });
    }
    WMEWAL_Places.ScanExtent = ScanExtent;
    function scan(segments, venues) {
        function checkCategory(categories, category, operation) {
            let match = categories.find(function (e) {
                return e.localeCompare(category) === 0;
            });
            if (typeof match === "undefined" || match == null || match.length === 0) {
                return false;
            }
            return operation === Operation.Equal;
        }
        let validPhoneRegex = new RegExp("\\(\\d\\d\\d\\) \\d\\d\\d-\\d\\d\\d\\d");
        for (let ix = 0; ix < venues.length; ix++) {
            let venue = venues[ix];
            if (venue != null) {
                var categories = venue.attributes.categories;
                let address = venue.getAddress();
                if ((settings.LockLevel == null ||
                    (settings.LockLevelOperation === Operation.Equal && (venue.attributes.lockRank || 0) + 1 === settings.LockLevel) ||
                    (settings.LockLevelOperation === Operation.NotEqual && (venue.attributes.lockRank || 0) + 1 !== settings.LockLevel)) &&
                    (!settings.EditableByMe || venue.arePropertiesEditable() || venue.areUpdateRequestsEditable()) &&
                    (settings.PlaceType == null || (settings.PlaceType === "point" && venue.isPoint() && !venue.is2D()) || (settings.PlaceType === "area" && !venue.isPoint() && venue.is2D())) &&
                    (nameRegex == null || nameRegex.test(venue.attributes.name)) &&
                    (!settings.Created ||
                        (settings.CreatedOperation === Operation.LessThan && venue.attributes.createdOn < settings.CreatedDate) ||
                        (settings.CreatedOperation === Operation.LessThanOrEqual && venue.attributes.createdOn <= settings.CreatedDate) ||
                        (settings.CreatedOperation === Operation.GreaterThanOrEqual && venue.attributes.createdOn >= settings.CreatedDate) ||
                        (settings.CreatedOperation === Operation.GreaterThan && venue.attributes.createdOn > settings.CreatedDate)) &&
                    (!settings.Updated ||
                        (settings.UpdatedOperation === Operation.LessThan && (venue.attributes.updatedOn || venue.attributes.createdOn) < settings.UpdatedDate) ||
                        (settings.UpdatedOperation === Operation.LessThanOrEqual && (venue.attributes.updatedOn || venue.attributes.createdOn) <= settings.UpdatedDate) ||
                        (settings.UpdatedOperation === Operation.GreaterThanOrEqual && (venue.attributes.updatedOn || venue.attributes.createdOn) >= settings.UpdatedDate) ||
                        (settings.UpdatedOperation === Operation.GreaterThan && (venue.attributes.updatedOn || venue.attributes.createdOn) > settings.UpdatedDate)) &&
                    ((settings.CreatedBy === null) ||
                        (venue.attributes.createdBy === settings.CreatedBy)) &&
                    ((settings.LastModifiedBy === null) ||
                        ((venue.attributes.updatedBy || venue.attributes.createdBy) === settings.LastModifiedBy)) &&
                    (websiteRegex === null ||
                        websiteRegex.test(venue.attributes.url))) {
                    let issues = 0;
                    if (state != null) {
                        if (address && !address.isEmpty() && address.attributes.state) {
                            if (settings.StateOperation === Operation.Equal && address.attributes.state.id !== state.id ||
                                settings.StateOperation === Operation.NotEqual && address.attributes.state.id === state.id) {
                                continue;
                            }
                        }
                        else if (settings.StateOperation === Operation.Equal) {
                            continue;
                        }
                    }
                    // if (settings.LastModifiedBy != null) {
                    //     if (venue.attributes.updatedBy != null) {
                    //         if (venue.attributes.updatedBy !== settings.LastModifiedBy) {
                    //             continue;
                    //         }
                    //     } else if (venue.attributes.createdBy !== settings.LastModifiedBy) {
                    //         continue;
                    //     }
                    // }
                    // if (settings.CreatedBy != null) {
                    //     if (venue.attributes.createdBy !== settings.CreatedBy) {
                    //         continue;
                    //     }
                    // }
                    if (settings.Category != null) {
                        if (!checkCategory(categories, settings.Category, settings.CategoryOperation)) {
                            continue;
                        }
                    }
                    let regExMatched = false;
                    if (cityRegex != null) {
                        regExMatched = false;
                        if (address && !address.isEmpty() && address.attributes.city && !address.attributes.city.isEmpty() && address.attributes.city.hasName()) {
                            regExMatched = cityRegex.test(address.attributes.city.attributes.name);
                        }
                        if (!regExMatched) {
                            continue;
                        }
                    }
                    if (streetRegex != null) {
                        regExMatched = false;
                        if (address && !address.isEmpty() && !address.isEmptyStreet()) {
                            regExMatched = streetRegex.test(address.attributes.street.name);
                        }
                        if (!regExMatched) {
                            continue;
                        }
                    }
                    if (settings.ParkingLotType) {
                        // Don't pay attention if we don't have a parking lot type
                        if (!venue.attributes.categoryAttributes.PARKING_LOT ||
                            venue.attributes.categoryAttributes.PARKING_LOT.parkingType !== settings.ParkingLotTypeFilter) {
                            continue;
                        }
                    }
                    if (settings.NoHouseNumber && (!address || !address || address.attributes.houseNumber == null)) {
                        issues |= Issue.MissingHouseNumber;
                    }
                    if (settings.AdLocked && venue.attributes.adLocked) {
                        issues |= Issue.AdLocked;
                    }
                    if (settings.UndefStreet && typeof W.model.streets.objects[venue.attributes.streetID] === 'undefined') {
                        issues |= Issue.UndefStreet;
                    }
                    if (settings.UpdateRequests && venue.hasOpenUpdateRequests()) {
                        issues |= Issue.HasUpdateRequests;
                    }
                    if (settings.PendingApproval && !venue.isApproved()) {
                        issues |= Issue.PendingApproval;
                    }
                    if (settings.NoStreet && (!address || address.isEmpty() || address.isEmptyStreet())) {
                        issues |= Issue.MissingStreet;
                    }
                    if (settings.NoCity && (!address || address.isEmpty() || !address.getCity() || address.getCity().isEmpty())) {
                        //((!address || address.isEmpty() || !address.attributes.city || address.attributes.city.isEmpty() || !address.attributes.city.hasName())
                        issues |= Issue.NoCity;
                    }
                    if (settings.NoExternalProviders && (!venue.attributes.externalProviderIDs || venue.attributes.externalProviderIDs.length === 0)) {
                        issues |= Issue.NoExternalProviders;
                    }
                    if (settings.NoHours && (!venue.attributes.openingHours || venue.attributes.openingHours.length === 0)) {
                        issues |= Issue.NoHours;
                    }
                    if (settings.NoPhoneNumber && !venue.attributes.phone) {
                        issues |= Issue.NoPhoneNumber;
                    }
                    if (settings.InvalidPhoneNumber && (venue.attributes.phone && !validPhoneRegex.test(venue.attributes.phone))) {
                        issues |= Issue.InvalidPhoneNumber;
                    }
                    if (settings.NoWebsite && !venue.attributes.url) {
                        issues |= Issue.NoWebsite;
                    }
                    if (settings.NoEntryExitPoints && (!venue.attributes.entryExitPoints || venue.attributes.entryExitPoints.length === 0)) {
                        issues |= Issue.NoEntryExitPoints;
                    }
                    if (settings.MissingBrand && checkCategory(categories, "GAS_STATION", Operation.Equal) && venue.attributes.brand === null) {
                        issues |= Issue.MissingBrand;
                    }
                    if (detectIssues && issues === 0) {
                        // If at least one issue was chosen and this segment doesn't have any issues, then skip it
                        continue;
                    }
                    if (!WMEWAL.IsVenueInArea(venue)) {
                        continue;
                    }
                    // Don't add it if we've already done so
                    if (savedVenues.indexOf(venue.getID()) === -1) {
                        savedVenues.push(venue.getID());
                        let lastEditorID = venue.attributes.updatedBy || venue.attributes.createdBy;
                        var lastEditor = W.model.users.getObjectById(lastEditorID);
                        var createdByID = venue.attributes.createdBy;
                        var createdBy = W.model.users.getObjectById(createdByID);
                        let place = {
                            id: venue.attributes.id,
                            mainCategory: venue.getMainCategory(),
                            name: venue.attributes.name,
                            lockLevel: venue.getLockRank() + 1,
                            pointGeometry: venue.getPointGeometry(),
                            // navigationPoint: venue.getNavigationPoint(),
                            categories: categories,
                            streetID: venue.attributes.streetID,
                            placeType: ((venue.isPoint() && !venue.is2D()) ? I18n.t("edit.venue.type.point") : I18n.t("edit.venue.type.area")),
                            isApproved: venue.isApproved(),
                            city: ((address && !address.isEmpty() && address.attributes.city && !address.attributes.city.isEmpty() && address.attributes.city.hasName()) ? address.attributes.city.attributes.name : "No City"),
                            state: ((address && !address.isEmpty() && address.attributes.state) ? address.attributes.state.name : "No State"),
                            houseNumber: venue.attributes.houseNumber ?? "",
                            streetName: ((address && !address.isEmpty() && !address.isEmptyStreet()) ? address.attributes.street.name : "") || "",
                            lastEditor: (lastEditor && lastEditor.userName) || "",
                            createdBy: (createdBy && createdBy.userName) || "",
                            url: venue.attributes.url ?? "",
                            phone: venue.attributes.phone ?? "",
                            issues: issues,
                            parkingLotType: (venue.attributes.categoryAttributes.PARKING_LOT && venue.attributes.categoryAttributes.PARKING_LOT.parkingType && I18n.t("edit.venue.parking.types.parkingType." + venue.attributes.categoryAttributes.PARKING_LOT.parkingType)) || "",
                            altNames: [...venue.attributes.aliases]
                        };
                        places.push(place);
                    }
                }
            }
        }
    }
    function ScanComplete() {
        if (places.length === 0) {
            alert(pluginName + ": No places found.");
        }
        else {
            places.sort(function (a, b) {
                return a.name.localeCompare(b.name);
            });
            let isCSV = (WMEWAL.outputTo & WMEWAL.OutputTo.CSV);
            let isTab = (WMEWAL.outputTo & WMEWAL.OutputTo.Tab);
            let lineArray;
            let columnArray;
            let w;
            let fileName;
            if (isCSV) {
                lineArray = [];
                // (settings.undefStreet ? "Street ID," : "")
                columnArray = ["Name"];
                if (settings.IncludeAlt) {
                    columnArray.push("Alt Names");
                }
                columnArray.push("Categories", "City", "State", "Lock Level", "Type", "Street", "House Number");
                if (detectIssues) {
                    columnArray.push("Issues");
                }
                columnArray.push("Website", "Phone Number", "Parking Lot Type", "Created By", "Last Updated By", "Latitude", "Longitude", "Permalink");
                lineArray.push(columnArray);
                fileName = "Places_" + WMEWAL.areaName;
                fileName += ".csv";
            }
            function getOperationText(operation) {
                return operation === Operation.NotEqual ? "does not equal " : "equals ";
            }
            if (isTab) {
                w = window.open();
                w.document.write("<html><head><title>Places</title></head><body>");
                w.document.write("<h3>Area: " + WMEWAL.areaName + "</h3>");
                w.document.write("<h4>Filters</h4>");
                if (settings.Category != null) {
                    w.document.write("<br/>Category: " + getOperationText(settings.CategoryOperation) + I18n.t("venues.categories." + settings.Category));
                }
                if (settings.LockLevel != null) {
                    w.document.write("<br/>Lock Level " + getOperationText(settings.LockLevelOperation) + settings.LockLevel.toString());
                }
                if (settings.Regex != null) {
                    w.document.write("<br/>Name matches " + settings.Regex);
                    if (settings.RegexIgnoreCase) {
                        w.document.write(" (ignoring case)");
                    }
                }
                if (streetRegex != null) {
                    w.document.write("<br/>Street Name matches: " + settings.StreetRegex);
                    if (settings.StreetRegexIgnoreCase) {
                        w.document.write(" (ignoring case)");
                    }
                }
                if (cityRegex != null) {
                    w.document.write("<br/>City Name matches: " + settings.CityRegex);
                    if (settings.CityRegexIgnoreCase) {
                        w.document.write(" (ignoring case)");
                    }
                }
                if (stateName != null) {
                    w.document.write("<br/>State " + getOperationText(settings.StateOperation) + stateName);
                }
                if (settings.PlaceType != null) {
                    w.document.write("<br/>Type " + I18n.t("edit.venue.type." + settings.PlaceType));
                }
                if (settings.LastModifiedBy != null) {
                    w.document.write("<br/>Last modified by " + lastModifiedByName);
                }
                if (settings.CreatedBy != null) {
                    w.document.write(`<br/>Created by ${createdByName}`);
                }
                if (settings.EditableByMe) {
                    w.document.write("<br/>Editable by me");
                }
                if (settings.ParkingLotType) {
                    w.document.write(`<br/>Parking lot type: ${settings.ParkingLotTypeFilter}`);
                }
                if (settings.Created) {
                    w.document.write("<br/>Created ");
                    switch (settings.CreatedOperation) {
                        case Operation.GreaterThan:
                            w.document.write("after");
                            break;
                        case Operation.GreaterThanOrEqual:
                            w.document.write("on or after");
                            break;
                        case Operation.LessThan:
                            w.document.write("before");
                            break;
                        case Operation.LessThanOrEqual:
                            w.document.write("on or before");
                            break;
                        default:
                            break;
                    }
                    w.document.write(` ${new Date(settings.CreatedDate).toString()}`);
                }
                if (settings.Updated) {
                    w.document.write("<br/>Updated ");
                    switch (settings.UpdatedOperation) {
                        case Operation.GreaterThan:
                            w.document.write("after");
                            break;
                        case Operation.GreaterThanOrEqual:
                            w.document.write("on or after");
                            break;
                        case Operation.LessThan:
                            w.document.write("before");
                            break;
                        case Operation.LessThanOrEqual:
                            w.document.write("on or before");
                            break;
                        default:
                            break;
                    }
                    w.document.write(` ${new Date(settings.UpdatedDate).toString()}`);
                }
                if (detectIssues) {
                    w.document.write("<h4>Issues</h4>");
                }
                if (settings.NoHouseNumber) {
                    w.document.write("<br/>Missing house number");
                }
                if (settings.NoStreet) {
                    w.document.write("<br/>Missing street");
                }
                if (settings.NoCity) {
                    w.document.write("<br/>Missing city");
                }
                if (settings.AdLocked) {
                    w.document.write("<br/>Ad locked");
                }
                if (settings.UpdateRequests) {
                    w.document.write("<br/>Has update requests");
                }
                if (settings.PendingApproval) {
                    w.document.write("<br/>Pending approval");
                }
                if (settings.UndefStreet) {
                    w.document.write("<br/>Undefined street ID");
                }
                if (settings.NoExternalProviders) {
                    w.document.write("<br/>No external provider links");
                }
                if (settings.NoHours) {
                    w.document.write("<br/>No hours");
                }
                if (settings.NoPhoneNumber) {
                    w.document.write("<br/>No phone number");
                }
                if (settings.InvalidPhoneNumber) {
                    w.document.write("<br/>Invalid phone number");
                }
                if (settings.NoWebsite) {
                    w.document.write("<br/>No website");
                }
                if (settings.NoEntryExitPoints) {
                    w.document.write("<br/>No entry/exit points");
                }
                if (settings.MissingBrand) {
                    w.document.write("<br/>Missing brand");
                }
                w.document.write("<table style='border-collapse: separate; border-spacing: 8px 0px'><thead><tr><th>Name</th>");
                if (settings.IncludeAlt) {
                    w.document.write("<th>Alt Names</th>");
                }
                w.document.write("<th>Categories</th><th>City</th><th>State</th>");
                w.document.write("<th>Lock Level</th><th>Type</th><th>Street</th><th>House Number</th>");
                if (detectIssues) {
                    w.document.write("<th>Issues</th>");
                }
                w.document.write("<th>Website</th><th>Phone Number</th><th>Parking Lot Type</th><th>Created By</th><th>Last Updated By</th><th>Latitude</th><th>Longitude</th><th>Permalink</th></tr><thead><tbody>");
            }
            for (let ixPlace = 0; ixPlace < places.length; ixPlace++) {
                let place = places[ixPlace];
                let plPlace = getPlacePL(place);
                let latlon = OpenLayers.Layer.SphericalMercator.inverseMercator(place.pointGeometry.x, place.pointGeometry.y);
                let categories = "";
                for (let ixCategory = 0; ixCategory < place.categories.length; ixCategory++) {
                    if (ixCategory > 0) {
                        categories += ", ";
                    }
                    categories += I18n.t("venues.categories." + place.categories[ixCategory]);
                }
                if (isCSV) {
                    // (settings.undefStreet ? `${place.streetID},` : "")
                    // columnArray = [`"${place.name}"`, `"${categories}"`, `"${place.city}"`, `"${place.state}"`, place.lockLevel.toString(),
                    //     place.placeType, (place.adLocked ? "Yes" : "No"), (place.hasOpenUpdateRequests ? "Yes" : "No"), (place.isApproved ? "No" : "Yes"),
                    //     `"${place.streetName}"`, `"${place.houseNumber}"`, (place.hasExternalProvider ? "Yes" : "No"), `"${place.url}"`, `"${place.phone}"`,
                    //     (place.hasHours ? "Yes" : "No"), `"${place.lastEditor}"`, latlon.lat.toString(), latlon.lon.toString(), `"${plPlace}"`];
                    columnArray = [`"${place.name}"`];
                    if (settings.IncludeAlt) {
                        columnArray.push(`"${place.altNames.join(',')}"`);
                    }
                    columnArray.push(`"${categories}"`, `"${place.city}"`, `"${place.state}"`, place.lockLevel.toString(), place.placeType, `"${place.streetName}"`, `"${place.houseNumber}"`);
                    if (detectIssues) {
                        columnArray.push(`"${getIssues(place.issues)}"`);
                    }
                    columnArray.push(`"${place.url}"`, `"${place.phone}"`, `"${place.parkingLotType}"`, `"${place.createdBy}"`, `"${place.lastEditor}"`, latlon.lat.toString(), latlon.lon.toString(), `"${plPlace}"`);
                    lineArray.push(columnArray);
                }
                if (isTab) {
                    w.document.write(`<tr><td>${place.name}</td>`);
                    if (settings.IncludeAlt) {
                        w.document.write(`<td>${place.altNames.join(", ")}</td>`);
                    }
                    w.document.write(`<td>${categories}</td>`);
                    w.document.write(`<td>${place.city}</td>`);
                    w.document.write(`<td>${place.state}</td>`);
                    w.document.write(`<td>${place.lockLevel.toString()}</td>`);
                    w.document.write(`<td>${place.placeType}</td>`);
                    w.document.write(`<td>${place.streetName}</td>`);
                    w.document.write(`<td>${place.houseNumber}</td>`);
                    if (detectIssues) {
                        w.document.write(`<td>${getIssues(place.issues)}</td>`);
                    }
                    // w.document.write(`<td>${place.adLocked ? "Yes" : "No"}</td>`);
                    // w.document.write(`<td>${place.hasOpenUpdateRequests ? "Yes" : "No"}</td>`);
                    // w.document.write(`<td>${place.isApproved ? "No" : "Yes"}</td>`);
                    w.document.write(`<td>${place.url === "" ? place.url : `<a href="${/^http/.test(place.url) ? '' : 'http://'}${place.url}">${place.url}</a>`}</td>`);
                    w.document.write(`<td>${place.phone}</td>`);
                    w.document.write(`<td>${place.parkingLotType}</td>`);
                    w.document.write(`<td>${place.createdBy}</td>`);
                    w.document.write(`<td>${place.lastEditor}</td>`);
                    w.document.write(`<td>${latlon.lat.toString()}</td>`);
                    w.document.write(`<td>${latlon.lon.toString()}</td>`);
                    w.document.write(`<td><a href='${plPlace}' target='_blank'>Permalink</a></td></tr>`);
                }
            }
            if (isCSV) {
                let csvContent = lineArray.join("\n");
                //var encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
                var blob = new Blob([csvContent], { type: "data:text/csv;charset=utf-8;" });
                let link = document.createElement("a");
                let url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", fileName);
                let node = document.body.appendChild(link);
                link.click();
                document.body.removeChild(node);
            }
            if (isTab) {
                w.document.write("</tbody></table></body></html>");
                w.document.close();
                w = null;
            }
        }
        places = null;
        savedVenues = null;
    }
    WMEWAL_Places.ScanComplete = ScanComplete;
    function ScanCancelled() {
        ScanComplete();
    }
    WMEWAL_Places.ScanCancelled = ScanCancelled;
    async function Init() {
        console.group(pluginName + ": Initializing");
        initCount++;
        let allOK = true;
        let objectToCheck = ["OpenLayers",
            "W.app",
            "W.Config.venues",
            "WMEWAL.RegisterPlugIn",
            "WazeWrap.Ready"];
        for (let i = 0; i < objectToCheck.length; i++) {
            let path = objectToCheck[i].split(".");
            let object = window;
            let ok = true;
            for (let j = 0; j < path.length; j++) {
                object = object[path[j]];
                if (typeof object === "undefined" || object == null) {
                    console.warn(objectToCheck[i] + " NOT OK");
                    ok = false;
                    break;
                }
            }
            if (ok) {
                console.log(objectToCheck[i] + " OK");
            }
            else {
                allOK = false;
            }
        }
        if (!allOK) {
            if (initCount < 60) {
                console.groupEnd();
                setTimeout(Init, 1000);
            }
            else {
                console.error("Giving up on initialization");
                console.groupEnd();
            }
            return;
        }
        // Check to see if WAL is at the minimum verson needed
        if (!(typeof WMEWAL.IsAtMinimumVersion === "function" && WMEWAL.IsAtMinimumVersion(minimumWALVersionRequired))) {
            log("log", "WAL not at required minimum version.");
            console.groupEnd();
            WazeWrap.Alerts.info(GM_info.script.name, "Cannot load plugin because WAL is not at the required minimum version.&nbsp;" +
                "You might need to manually update it from <a href='https://greasyfork.org/scripts/40641' target='_blank'>Greasy Fork</a>.", true, false);
            return;
        }
        if (typeof Storage !== "undefined") {
            if (localStorage[settingsKey]) {
                settings = JSON.parse(localStorage[settingsKey]);
            }
            if (localStorage[savedSettingsKey]) {
                try {
                    savedSettings = JSON.parse(WMEWAL.LZString.decompressFromUTF16(localStorage[savedSettingsKey]));
                }
                catch (e) { }
                if (typeof savedSettings === "undefined" || savedSettings === null || savedSettings.length === 0) {
                    log("debug", "decompressFromUTF16 failed, attempting decompress");
                    localStorage[savedSettingsKey + "Backup"] = localStorage[savedSettingsKey];
                    try {
                        savedSettings = JSON.parse(WMEWAL.LZString.decompress(localStorage[savedSettingsKey]));
                    }
                    catch (e) { }
                    if (typeof savedSettings === "undefined" || savedSettings === null) {
                        log("debug", "decompress failed, savedSettings unrecoverable. Using blank");
                        savedSettings = [];
                    }
                    updateSavedSettings();
                }
            }
        }
        if (settings == null) {
            settings = {
                Regex: null,
                RegexIgnoreCase: true,
                Category: null,
                CategoryOperation: Operation.Equal,
                NoHouseNumber: false,
                State: null,
                StateOperation: Operation.Equal,
                LockLevel: null,
                LockLevelOperation: Operation.Equal,
                EditableByMe: true,
                AdLocked: false,
                UpdateRequests: false,
                PlaceType: null,
                PendingApproval: false,
                CityRegex: null,
                CityRegexIgnoreCase: true,
                NoStreet: false,
                NoCity: false,
                LastModifiedBy: null,
                CreatedBy: null,
                UndefStreet: false,
                NoExternalProviders: false,
                NoHours: false,
                NoPhoneNumber: false,
                InvalidPhoneNumber: false,
                NoWebsite: false,
                NoEntryExitPoints: false,
                ParkingLotType: false,
                ParkingLotTypeFilter: null,
                MissingBrand: false,
                IncludeAlt: false,
                Created: false,
                CreatedOperation: Operation.GreaterThanOrEqual,
                CreatedDate: null,
                Updated: false,
                UpdatedOperation: Operation.GreaterThanOrEqual,
                UpdatedDate: null,
                WebsiteRegex: null,
                WebsiteRegexIgnoreCase: true,
                StreetRegex: null,
                StreetRegexIgnoreCase: true
            };
        }
        else {
            if (updateProperties()) {
                updateSettings();
            }
        }
        console.log("Initialized");
        console.groupEnd();
        WazeWrap.Interface.ShowScriptUpdate(scrName, Version, updateText, greasyForkPage, wazeForumThread);
        WMEWAL.RegisterPlugIn(WMEWAL_Places);
    }
    function updateProperties() {
        let upd = false;
        if (settings !== null) {
            if (!settings.hasOwnProperty("NoStreet")) {
                settings.NoStreet = false;
                upd = true;
            }
            if (!settings.hasOwnProperty("NoCity")) {
                settings.NoCity = false;
                upd = true;
            }
            if (!settings.hasOwnProperty("LastModifiedBy")) {
                settings.LastModifiedBy = null;
                upd = true;
            }
            if (!settings.hasOwnProperty("NoExternalProviders")) {
                settings.NoExternalProviders = false;
                upd = true;
            }
            if (!settings.hasOwnProperty("NoHours")) {
                settings.NoHours = false;
                upd = true;
            }
            if (!settings.hasOwnProperty("NoPhoneNumber")) {
                settings.NoPhoneNumber = false;
            }
            if (!settings.hasOwnProperty("InvalidPhoneNumber")) {
                settings.InvalidPhoneNumber = false;
                upd = true;
            }
            if (!settings.hasOwnProperty("NoWebsite")) {
                settings.NoWebsite = false;
            }
            if (!settings.hasOwnProperty("NoEntryExitPoints")) {
                settings.NoEntryExitPoints = false;
                upd = true;
            }
            if (!settings.hasOwnProperty("ParkingLotType")) {
                settings.ParkingLotType = false;
                upd = true;
            }
            if (!settings.hasOwnProperty("ParkingLotTypeFilter")) {
                settings.ParkingLotTypeFilter = null;
                upd = true;
            }
            if (!settings.hasOwnProperty("MissingBrand")) {
                settings.MissingBrand = false;
                upd = true;
            }
            if (!settings.hasOwnProperty("IncludeAlt")) {
                settings.IncludeAlt = false;
                upd = true;
            }
            if (!settings.hasOwnProperty("CreatedDate")) {
                settings.CreatedDate = null;
                upd = true;
            }
            if (!settings.hasOwnProperty("Created")) {
                settings.Created = false;
                upd = true;
            }
            if (!settings.hasOwnProperty("CreatedOperation")) {
                settings.CreatedOperation = Operation.GreaterThanOrEqual;
                upd = true;
            }
            if (!settings.hasOwnProperty("UpdatedDate")) {
                settings.UpdatedDate = null;
                upd = true;
            }
            if (!settings.hasOwnProperty("Updated")) {
                settings.Updated = false;
                upd = true;
            }
            if (!settings.hasOwnProperty("UpdatedOperation")) {
                settings.UpdatedOperation = Operation.GreaterThanOrEqual;
                upd = true;
            }
            if (!settings.hasOwnProperty("WebsiteRegex")) {
                settings.WebsiteRegex = null;
                upd = true;
            }
            if (!settings.hasOwnProperty("WebsiteRegexIgnoreCase")) {
                settings.WebsiteRegexIgnoreCase = true;
                upd = true;
            }
            if (!settings.hasOwnProperty("StreetRegex")) {
                settings.StreetRegex = null;
                upd = true;
            }
            if (!settings.hasOwnProperty("StreetRegexIgnoreCase")) {
                settings.StreetRegexIgnoreCase = true;
                upd = true;
            }
            if (settings.hasOwnProperty("OutputTo")) {
                delete settings["OutputTo"];
                upd = true;
            }
            if (settings.hasOwnProperty("Version")) {
                delete settings["Version"];
                upd = true;
            }
        }
        return upd;
    }
    function getPlacePL(place) {
        let latlon = OpenLayers.Layer.SphericalMercator.inverseMercator(place.pointGeometry.x, place.pointGeometry.y);
        return WMEWAL.GenerateBasePL(latlon.lat, latlon.lon, 5) + "&mode=0&venues=" + place.id;
    }
    function getIssues(issues) {
        let issuesList = [];
        if (issues & Issue.AdLocked) {
            issuesList.push("Ad locked");
        }
        if (issues & Issue.HasUpdateRequests) {
            issuesList.push("Has update requests");
        }
        if (issues & Issue.MissingHouseNumber) {
            issuesList.push("Missing house number");
        }
        if (issues & Issue.MissingStreet) {
            issuesList.push("Missing street");
        }
        if (issues & Issue.NoCity) {
            issuesList.push("No City");
        }
        if (issues & Issue.NoExternalProviders) {
            issuesList.push("No external provider IDs");
        }
        if (issues & Issue.PendingApproval) {
            issuesList.push("Pending approval");
        }
        if (issues & Issue.UndefStreet) {
            issuesList.push("Undefined street ID");
        }
        if (issues & Issue.NoHours) {
            issuesList.push("No hours");
        }
        if (issues & Issue.NoPhoneNumber) {
            issuesList.push("No phone number");
        }
        if (issues & Issue.InvalidPhoneNumber) {
            issuesList.push("Invalid phone number");
        }
        if (issues & Issue.NoHours) {
            issuesList.push("No website");
        }
        if (issues & Issue.NoEntryExitPoints) {
            issuesList.push("No entry/exit points");
        }
        if (issues & Issue.MissingBrand) {
            issuesList.push("Missing brand");
        }
        if (issuesList.length === 0) {
            return "None";
        }
        else {
            return issuesList.join(", ");
        }
    }
    function updateSettings() {
        if (typeof Storage !== "undefined") {
            localStorage[settingsKey] = JSON.stringify(settings);
        }
    }
    function updateSavedSettings() {
        if (typeof Storage !== "undefined") {
            localStorage[savedSettingsKey] = WMEWAL.LZString.compressToUTF16(JSON.stringify(savedSettings));
        }
        updateSavedSettingsList();
    }
    function log(level, message) {
        let t = new Date();
        switch (level.toLocaleLowerCase()) {
            case "debug":
            case "verbose":
                console.debug(`${scrName} ${t.toISOString()}: ${message}`);
                break;
            case "info":
            case "information":
                console.info(`${scrName} ${t.toISOString()}: ${message}`);
                break;
            case "warning":
            case "warn":
                console.warn(`${scrName} ${t.toISOString()}: ${message}`);
                break;
            case "error":
                console.error(`${scrName} ${t.toISOString()}: ${message}`);
                break;
            case "log":
                console.log(`${scrName} ${t.toISOString()}: ${message}`);
                break;
            default:
                break;
        }
    }
    function nullif(s, nullVal) {
        if (s !== null && s === nullVal) {
            return null;
        }
        return s;
    }
    Init();
})(WMEWAL_Places || (WMEWAL_Places = {}));
