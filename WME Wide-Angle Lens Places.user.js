// ==UserScript==
// @name                WME Wide-Angle Lens Places
// @namespace           https://greasyfork.org/en/users/19861-vtpearce
// @description         Find place that match filter criteria
// @author              vtpearce and crazycaveman
// @include             https://www.waze.com/editor
// @include             /^https:\/\/(www|beta)\.waze\.com\/(?!user\/)(.{2,6}\/)?editor.*$/
// @version             1.3.4
// @grant               none
// @copyright           2017 vtpearce
// @license             CC BY-SA 4.0
// @updateURL           https://greasyfork.org/scripts/40645-wme-wide-angle-lens-places/code/WME%20Wide-Angle%20Lens%20Places.meta.js
// @downloadURL         https://greasyfork.org/scripts/40645-wme-wide-angle-lens-places/code/WME%20Wide-Angle%20Lens%20Places.user.js
// ==/UserScript==

/*global W, OL, $, WazeWrap, WMEWAL*/

var WMEWAL_Places;
(function (WMEWAL_Places) {
    var Operation;
    (function (Operation) {
        Operation[Operation["Equal"] = 1] = "Equal";
        Operation[Operation["NotEqual"] = 2] = "NotEqual";
    })(Operation || (Operation = {}));
    var pluginName = "WMEWAL-Places";
    WMEWAL_Places.Title = "Places";
    WMEWAL_Places.MinimumZoomLevel = 5;
    WMEWAL_Places.SupportsSegments = false;
    WMEWAL_Places.SupportsVenues = true;
    var settingsKey = "WMEWALPlacesSettings";
    var savedSettingsKey = "WMEWALPlacesSavedSettings";
    var settings = null;
    var savedSettings = [];
    var places;
    var nameRegex = null;
    var cityRegex = null;
    var state;
    var stateName;
    var lastModifiedBy;
    var lastModifiedByName;
    var initCount = 0;
    var Version = "1.2.3";
    function GetTab() {
        var html = "<table style='border-collapse:separate;border-spacing:0px 1px;'>";
        html += "<tbody>";
        html += "<tr><td style='font-size:1.2em'><b>Output To:</b></td></tr>";
        html += "<tr><td style='padding-left:20px'>" +
            "<select id='_wmewalPlacesOutputTo'>" +
            "<option value='csv'>CSV File</option>" +
            "<option value='tab'>Browser Tab</option>" +
            "<option value='both'>Both CSV File and Browser Tab</option></select></td></tr>";
        html += "<tr><td style='border-top: 1px solid; font-size: 1.2em'><b>Saved Filters</b></td></tr>";
        html += "<tr><td style='padding-left: 20px; padding-bottom: 8px'>" +
            "<select id='_wmewalPlacesSavedSettings'/><br/>" +
            "<button class='btn btn-primary' id='_wmewalPlacesLoadSetting' title='Load'>Load</button>" +
            "<button class='btn btn-primary' style='margin-left: 4px;' id='_wmewalPlacesSaveSetting' title='Save'>Save</button>" +
            "<button class='btn btn-primary' style='margin-left: 4px;' id='_wmewalPlacesDeleteSetting' title='Delete'>Delete</button></td></tr>";
        html += "<tr><td style='border-top: 1px solid; padding-top: 4px;font-size:1.2em'><b>Filters</b></td></tr>";
        html += "<tr><td><b>Category:</b></td></tr>";
        html += "<tr><td style='padding-left:20px'>" +
            "<select id='_wmewalPlacesCategory'>" +
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
        html += "</select></td></tr>";
        html += "<tr><td><b>Lock Level:</b></td></tr>" +
            "<tr><td style='padding-left: 20px'>" +
            "<select id='_wmewalPlacesLockLevelOp'>" +
            "<option value='" + Operation.Equal.toString() + "' selected='selected'>=</option>" +
            "<option value='" + Operation.NotEqual.toString() + "'>&lt;&gt;</option></select>" +
            "<select id='_wmewalPlacesLockLevel'>" +
            "<option value=''></option>" +
            "<option value='1'>1</option>" +
            "<option value='2'>2</option>" +
            "<option value='3'>3</option>" +
            "</select></td></tr>";
        html += "<tr><td><b>Name RegEx</b></td></tr>";
        html += "<tr><td style='padding-left: 20px'>" +
            "<input type='text' id='_wmewalPlacesName' class='wal-textbox'/><br/>" +
            "<input id='_wmewalPlacesIgnoreCase' type='checkbox'/>" +
            "<label for='_wmewalPlacesIgnoreCase' style='padding-left: 20px'>Ignore case</label></td>";
        html += "<tr><td><b>City RegEx:</b></td></tr>";
        html += "<tr><td style='padding-left: 20px'><input type='text' id='_wmewalPlacesCity' class='wal-textbox'/><br/>" +
            "<input id='_wmewalPlacesCityIgnoreCase' type='checkbox'/>" +
            "<label for='_wmewalPlacesCityIgnoreCase' style='margin-left: 8px'>Ignore case</label></td></tr>";
        html += "<tr><td><b>State:</b></td></tr>";
        html += "<tr><td style='padding-left:20px'>" +
            "<select id='_wmewalPlacesStateOp'>" +
            "<option value='" + Operation.Equal.toString() + "' selected='selected'>=</option>" +
            "<option value='" + Operation.NotEqual.toString() + "'>&lt;&gt;</option></select>" +
            "<select id='_wmewalPlacesState'/>";
        html += "<tr><td><b>Type:</b></td></tr>" +
            "<tr><td style='padding-left: 20px'><select id='_wmewalPlacesType'>" +
            "<option value=''></option>" +
            "<option value='area'>" + I18n.t("edit.landmark.type.area") + "</option>" +
            "<option value='point'>" + I18n.t("edit.landmark.type.point") + "</option>" +
            "</select></td></tr>";
        html += "<tr><td><b>Last Modified By:</b></td></tr>";
        html += "<tr><td class='wal-indent'>" +
            "<select id='_wmewalPlacesLastModifiedBy'/></td></tr>";
        html += "<tr><td><input id='_wmewalPlacesEditable' type='checkbox'/>" +
            "<label for='_wmewalPlacesEditable' style='padding-left: 20px'>Editable by me</label></td></tr>";
        html += "<tr><td><input type='checkbox' id='_wmewalPlacesNoHouseNumber'/>" +
            "<label for='_wmewalPlacesNoHouseNumber' style='padding-left: 20px'>Missing House Number</label></td></tr>";
        html += "<tr><td><input type='checkbox' id='_wmewalPlacesNoStreet'/>" +
            "<label for='_wmewalPlacesNoStreet' style='padding-left: 20px'>Missing Street</label></td></tr>";
        html += "<tr><td><input type='checkbox' id='_wmewalPlacesAdLocked'/>" +
            "<label for='_wmewalPlacesAdLocked' style='padding-left: 20px'>Ad Locked</label></td></tr>";
        html += "<tr><td ><input type='checkbox' id='_wmewalPlacesUpdateRequests'/>" +
            "<label for='_wmewalPlacesUpdateRequests' style='padding-left: 20px'>Has Update Requests</label></td></tr>";
        html += "<tr><td ><input type='checkbox' id='_wmewalPlacesPendingApproval'/>" +
            "<label for='_wmewalPlacesPendingApproval' style='padding-left: 20px'>Pending Approval</label></td></tr>";
        return html;
    }
    WMEWAL_Places.GetTab = GetTab;
    function TabLoaded() {
        updateStates();
        updateUsers();
        updateUI();
        updateSavedSettingsList();
        $("#_wmewalPlacesState").on("focus", updateStates);
        $("#_wmewalPlacesLastModifiedBy").on("focus", updateUsers);
        $("#_wmewalPlacesLoadSetting").on("click", loadSetting);
        $("#_wmewalPlacesSaveSetting").on("click", saveSetting);
        $("#_wmewalPlacesDeleteSetting").on("click", deleteSetting);
    }
    WMEWAL_Places.TabLoaded = TabLoaded;
    function updateStates() {
        var selectState = $("#_wmewalPlacesState");
        // Preserve current selection
        var currentId = parseInt(selectState.val());
        selectState.empty();
        var stateObjs = [];
        stateObjs.push({ id: null, name: "" });
        for (var s in W.model.states.objects) {
            if (W.model.states.objects.hasOwnProperty(s)) {
                var st = W.model.states.get(parseInt(s));
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
        for (var ix = 0; ix < stateObjs.length; ix++) {
            var so = stateObjs[ix];
            var stateOption = $("<option/>").text(so.name).attr("value", so.id || "");
            if (currentId != null && so.id === currentId) {
                stateOption.attr("selected", "selected");
            }
            selectState.append(stateOption);
        }
    }
    function updateUsers() {
        var selectLastModifiedBy = $("#_wmewalPlacesLastModifiedBy");
        // Preserve current selection
        var currentId = parseInt(selectLastModifiedBy.val());
        selectLastModifiedBy.empty();
        var userObjs = [];
        userObjs.push({ id: null, name: "" });
        for (var uo in W.model.users.objects) {
            if (W.model.users.objects.hasOwnProperty(uo)) {
                var u = W.model.users.get(parseInt(uo));
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
        var s = $("#_wmewalPlacesSavedSettings");
        s.empty();
        for (var ixSaved = 0; ixSaved < savedSettings.length; ixSaved++) {
            var opt = $("<option/>").attr("value", ixSaved).text(savedSettings[ixSaved].Name);
            s.append(opt);
        }
    }
    function updateUI() {
        $("#_wmewalPlacesOutputTo").val(settings.OutputTo);
        $("#_wmewalPlacesCategory").val(settings.Category);
        $("#_wmewalPlacesLockLevel").val(settings.LockLevel);
        $("#_wmewalPlacesLockLevelOp").prop("checked", settings.LockLevelOperation || Operation.Equal);
        $("#_wmewalPlacesName").val(settings.Regex || "");
        $("#_wmewalPlacesIgnoreCase").prop("checked", settings.RegexIgnoreCase);
        $("#_wmewalPlacesCity").val(settings.CityRegex || "");
        $("#_wmewalPlacesCityIgnoreCase").prop("checked", settings.CityRegexIgnoreCase);
        $("#_wmewalPlacesState").val(settings.State);
        $("#_wmewalPlacesStateOp").val(settings.StateOperation || Operation.Equal);
        $("#_wmewalPlacesType").val(settings.PlaceType);
        $("#_wmewalPlacesEditable").prop("checked", settings.EditableByMe);
        $("#_wmewalPlacesNoHouseNumber").prop("checked", settings.NoHouseNumber);
        $("#_wmewalPlacesAdLocked").prop("checked", settings.AdLocked);
        $("#_wmewalPlacesUpdateRequests").prop("checked", settings.UpdateRequests);
        $("#_wmewalPlacesPendingApproval").prop("checked", settings.PendingApproval);
        $("#_wmewalPlacesNoStreet").prop("checked", settings.NoStreet);
        $("#_wmewalPlacesLastModifiedBy").val(settings.LastModifiedBy);
    }
    function loadSetting() {
        var selectedSetting = parseInt($("#_wmewalPlacesSavedSettings").val());
        if (selectedSetting == null || isNaN(selectedSetting) || selectedSetting < 0 || selectedSetting > savedSettings.length) {
            return;
        }
        settings.OutputTo = $("#_wmewalPlacesOutputTo").val();
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
        var ignoreCase = $("#_wmewalPlacesIgnoreCase").prop("checked");
        var pattern = $("#_wmewalPlacesName").val();
        var r;
        if (pattern.length !== 0) {
            try {
                r = (ignoreCase ? new RegExp(pattern, "i") : new RegExp(pattern, "i"));
            }
            catch (error) {
                message = "Name RegEx is invalid";
                allOk = false;
            }
        }
        ignoreCase = $("#_wmewalPlacesCityIgnoreCase").prop("checked");
        pattern = $("#_wmewalPlacesCity").val();
        if (pattern.length !== 0) {
            try {
                r = (ignoreCase ? new RegExp(pattern, "i") : new RegExp(pattern, "i"));
            }
            catch (error) {
                message += ((message.length > 0 ? "\n" : "") + "City RegEx is invalid");
                allOk = false;
            }
        }
        var selectedState = $("#_wmewalPlacesState").val();
        if (selectedState != null && selectedState.length !== 0) {
            if (W.model.states.get(selectedState) == null) {
                message += ((message.length > 0 ? "\n" : "") + "Invalid state selection");
                allOk = false;
            }
        }
        var selectedUser = $("#_wmewalPlacesLastModifiedBy").val();
        if (selectedUser != null && selectedUser.length > 0) {
            if (W.model.users.get(selectedUser) == null) {
                message += ((message.length > 0 ? "\n" : "") + "Invalid last modified user");
            }
        }
        if (!allOk) {
            alert(pluginName + ": " + message);
        }
        return allOk;
    }
    function saveSetting() {
        if (validateSettings()) {
            var s = {
                Regex: null,
                RegexIgnoreCase: $("#_wmewalPlacesIgnoreCase").prop("checked"),
                Category: null,
                NoHouseNumber: $("#_wmewalPlacesNoHouseNumber").prop("checked"),
                State: null,
                StateOperation: parseInt($("#_wmewalPlacesStateOp").val()),
                LockLevel: null,
                LockLevelOperation: parseInt($("#_wmewalPlacesLockLevelOp").val()),
                EditableByMe: $("#_wmewalPlacesEditable").prop("checked"),
                AdLocked: $("#_wmewalPlacesAdLocked").prop("checked"),
                UpdateRequests: $("#_wmewalPlacesUpdateRequests").prop("checked"),
                PlaceType: null,
                PendingApproval: $("#_wmewalPlacesPendingApproval").prop("checked"),
                CityRegex: null,
                CityRegexIgnoreCase: $("#_wmewalPlacesCityIgnoreCase").prop("checked"),
                NoStreet: $("#_wmewalPlacesNoStreet").prop("checked"),
                LastModifiedBy: null
            };
            var pattern = $("#_wmewalPlacesName").val();
            s.Regex = pattern.length > 0 ? pattern : null;
            pattern = $("#_wmewalPlacesCity").val();
            s.CityRegex = pattern.length > 0 ? pattern : null;
            var selectedState = $("#_wmewalPlacesState").val();
            if (selectedState != null && selectedState.length > 0) {
                s.State = W.model.states.get(parseInt(selectedState)).id;
            }
            var selectedUser = $("#_wmewalPlacesLastModifiedBy").val();
            if (selectedUser != null && selectedUser.length > 0) {
                s.LastModifiedBy = W.model.users.get(selectedUser).id;
            }
            var selectedLockLevel = $("#_wmewalPlacesLockLevel").val();
            if (selectedLockLevel != null && selectedLockLevel.length > 0) {
                s.LockLevel = parseInt(selectedLockLevel);
            }
            s.PlaceType = $("#_wmewalPlacesType").val();
            if (s.PlaceType.length === 0) {
                s.PlaceType = null;
            }
            s.Category = $("#_wmewalPlacesCategory").val();
            if (s.Category.length === 0) {
                s.Category = null;
            }
            var sName = prompt("Enter a name for this setting");
            if (sName == null) {
                return;
            }
            // Check to see if there is already a name that matches this
            for (var ixSetting = 0; ixSetting < savedSettings.length; ixSetting++) {
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
            var savedSetting = {
                Name: sName,
                Setting: s
            };
            savedSettings.push(savedSetting);
            updateSavedSettings();
        }
    }
    function deleteSetting() {
        var selectedSetting = parseInt($("#_wmewalPlacesSavedSettings").val());
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
            places = [];
            settings.OutputTo = $("#_wmewalPlacesOutputTo").val();
            settings.RegexIgnoreCase = $("#_wmewalPlacesIgnoreCase").prop("checked");
            var pattern = $("#_wmewalPlacesName").val();
            settings.Regex = null;
            nameRegex = null;
            if (pattern.length > 0) {
                settings.Regex = pattern;
                nameRegex = (settings.RegexIgnoreCase ? new RegExp(pattern, "i") : new RegExp(pattern));
            }
            settings.CityRegexIgnoreCase = $("#_wmewalPlacesCityIgnoreCase").prop("checked");
            pattern = $("#_wmewalPlacesCity").val();
            settings.CityRegex = null;
            cityRegex = null;
            if (pattern.length !== 0) {
                settings.CityRegex = pattern;
                cityRegex = (settings.CityRegexIgnoreCase ? new RegExp(pattern, "i") : new RegExp(pattern));
            }
            var selectedState = $("#_wmewalPlacesState").val();
            state = null;
            settings.State = null;
            stateName = null;
            if (selectedState != null && selectedState.length !== 0) {
                state = W.model.states.get(selectedState);
                settings.State = state.id;
                stateName = state.name;
            }
            settings.StateOperation = parseInt($("#_wmewalPlacesStateOp").val());
            var selectedUser = $("#_wmewalPlacesLastModifiedBy").val();
            lastModifiedBy = null;
            settings.LastModifiedBy = null;
            lastModifiedByName = null;
            if (selectedUser != null && selectedUser.length > 0) {
                lastModifiedBy = W.model.users.get(parseInt(selectedUser));
                settings.LastModifiedBy = lastModifiedBy.id;
                lastModifiedByName = lastModifiedBy.userName;
            }
            var selectedLockLevel = $("#_wmewalPlacesLockLevel").val();
            settings.LockLevel = null;
            if (selectedLockLevel != null && selectedLockLevel.length !== 0) {
                settings.LockLevel = parseInt(selectedLockLevel);
            }
            settings.LockLevelOperation = parseInt($("#_wmewalPlacesLockLevelOp").val());
            settings.PlaceType = $("#_wmewalPlacesType").val();
            if (settings.PlaceType.length === 0) {
                settings.PlaceType = null;
            }
            settings.Category = $("#_wmewalPlacesCategory").val();
            if (settings.Category.length === 0) {
                settings.Category = null;
            }
            settings.NoHouseNumber = $("#_wmewalPlacesNoHouseNumber").prop("checked");
            settings.EditableByMe = $("#_wmewalPlacesEditable").prop("checked");
            settings.AdLocked = $("#_wmewalPlacesAdLocked").prop("checked");
            settings.UpdateRequests = $("#_wmewalPlacesUpdateRequests").prop("checked");
            settings.PendingApproval = $("#_wmewalPlacesPendingApproval").prop("checked");
            settings.NoStreet = $("#_wmewalPlacesNoStreet").prop("checked");
            updateSettings();
        }
        return allOk;
    }
    WMEWAL_Places.ScanStarted = ScanStarted;
    function ScanExtent(segments, venues) {
        var def = $.Deferred();
        for (var ix = 0; ix < venues.length; ix++) {
            var venue = venues[ix];
            if (venue != null) {
                var categories = Object.getOwnPropertyNames(venue.getCategorySet());
                var address = venue.getAddress();
                if ((settings.LockLevel == null ||
                    (settings.LockLevelOperation === Operation.Equal && (venue.attributes.lockRank || 0) + 1 === settings.LockLevel) ||
                    (settings.LockLevelOperation === Operation.NotEqual && (venue.attributes.lockRank || 0) + 1 !== settings.LockLevel)) &&
                    (!settings.EditableByMe || venue.arePropertiesEditable() || venue.areUpdateRequestsEditable()) &&
                    (settings.PlaceType == null || (settings.PlaceType === "point" && venue.isPoint() && !venue.is2D()) || (settings.PlaceType === "area" && !venue.isPoint() && venue.is2D())) &&
                    (nameRegex == null || nameRegex.test(venue.attributes.name)) &&
                    (!settings.NoHouseNumber || address == null || address.attributes == null || address.attributes.houseNumber == null) &&
                    (!settings.AdLocked || venue.attributes.adLocked) &&
                    (!settings.UpdateRequests || venue.hasOpenUpdateRequests()) &&
                    (!settings.PendingApproval || !venue.isApproved()) &&
                    (!settings.NoStreet || address == null || address.attributes == null || address.attributes.street == null || address.attributes.street.isEmpty || address.attributes.street.name == null)) {
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
                        if (venue.attributes.updatedBy != null) {
                            if (venue.attributes.updatedBy !== settings.LastModifiedBy) {
                                continue;
                            }
                        }
                        else if (venue.attributes.createdBy !== settings.LastModifiedBy) {
                            continue;
                        }
                    }
                    if (settings.Category != null) {
                        var categoryMatch = categories.find(function (e) {
                            return e.localeCompare(settings.Category) === 0;
                        });
                        if (typeof categoryMatch === "undefined" || categoryMatch == null || categoryMatch.length === 0) {
                            continue;
                        }
                    }
                    if (cityRegex != null) {
                        var nameMatched = false;
                        if (address != null && !address.attributes.isEmpty) {
                            if (address.attributes.city != null && address.attributes.city.hasName()) {
                                nameMatched = cityRegex.test(address.attributes.city.attributes.name);
                            }
                        }
                        if (!nameMatched) {
                            continue;
                        }
                    }
                    if (!WMEWAL.IsVenueInArea(venue)) {
                        continue;
                    }
                    var lastEditorID = venue.attributes.updatedBy || venue.attributes.createdBy;
                    var lastEditor = W.model.users.get(lastEditorID);
                    var place = {
                        id: venue.attributes.id,
                        mainCategory: venue.getMainCategory(),
                        name: venue.attributes.name,
                        lockLevel: venue.getLockRank() + 1,
                        pointGeometry: venue.getPointGeometry(),
                        // navigationPoint: venue.getNavigationPoint(),
                        categories: categories,
                        adLocked: venue.attributes.adLocked,
                        hasOpenUpdateRequests: venue.hasOpenUpdateRequests(),
                        placeType: ((venue.isPoint() && !venue.is2D()) ? I18n.t("edit.landmark.type.point") : I18n.t("edit.landmark.type.area")),
                        isApproved: venue.isApproved(),
                        city: ((address && !address.attributes.isEmpty && address.attributes.city.hasName()) ? address.attributes.city.attributes.name : "No City"),
                        state: ((address && !address.attributes.isEmpty) ? address.attributes.state.name : "No State"),
                        houseNumber: venue.attributes.houseNumber || "",
                        streetName: ((address && !address.attributes.isEmpty && !address.attributes.street.isEmpty) ? address.attributes.street.name : "") || "",
                        hasExternalProvider: venue.attributes.externalProviderIDs != null && venue.attributes.externalProviderIDs.length > 0,
                        lastEditor: (lastEditor && lastEditor.userName) || ""
                    };
                    places.push(place);
                }
            }
        }
        def.resolve();
        return def.promise();
    }
    WMEWAL_Places.ScanExtent = ScanExtent;
    function ScanComplete() {
        if (places.length === 0) {
            alert(pluginName + ": No places found.");
        }
        else {
            places.sort(function (a, b) {
                return a.name.localeCompare(b.name);
            });
            var outputTo = $("#_wmewalPlacesOutputTo").val();
            var isCSV = (outputTo === "csv" || outputTo === "both");
            var isTab = (outputTo === "tab" || outputTo === "both");
            var lineArray = void 0;
            var columnArray = void 0;
            var w = void 0;
            var fileName = void 0;
            if (isCSV) {
                lineArray = [];
                columnArray = ["Name,Categories,City,State,Lock Level,Type,Ad Locked,Has Open Update Requests,Pending Approval,Street,House Number,Has External Provider Link,Last Editor,Latitude,Longitude,Permalink"];
                lineArray.push(columnArray);
                fileName = "Places_" + WMEWAL.areaName;
                fileName += ".csv";
            }
            if (isTab) {
                w = window.open();
                w.document.write("<html><head><title>Places</title></head><body>");
                w.document.write("<h2>Area: " + WMEWAL.areaName + "</h2>");
                w.document.write("<b>Filters</b>");
                if (settings.Category != null) {
                    w.document.write("<br/>Category: " + I18n.t("venue.categories." + settings.Category));
                }
                if (settings.LockLevel != null) {
                    w.document.write("<br/>Lock Level " + (settings.LockLevelOperation === Operation.NotEqual ? "does not equal " : "equals ") + settings.LockLevel.toString());
                }
                if (settings.Regex != null) {
                    w.document.write("<br/>Name matches " + settings.Regex);
                    if (settings.RegexIgnoreCase) {
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
                    w.document.write("<br/>State " + (settings.StateOperation === Operation.NotEqual ? "does not equal " : "equals ") + stateName);
                }
                if (settings.PlaceType != null) {
                    w.document.write("<br/>Type " + I18n.t("edit.landmark.type." + settings.PlaceType));
                }
                if (settings.LastModifiedBy != null) {
                    w.document.write("<br/>Last modified by " + lastModifiedByName);
                }
                if (settings.NoHouseNumber) {
                    w.document.write("<br/>No house number");
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
                w.document.write("<table style='border-collapse: separate; border-spacing: 8px 0px'><thead><tr><th>Name</th><th>Categories</th><th>City</th><th>State</th>");
                w.document.write("<th>Lock Level</th><th>Type</th><th>Ad Locked</th><th>Has Open Update Requests</th><th>Pending Approval</th><th>Street</th><th>House Number</th><th>Has External Provider Link</th><th>Last Editor</th><th>Latitude</th><th>Longitude</th><th>Permalink</th></tr><thead><tbody>");
            }
            for (var ixPlace = 0; ixPlace < places.length; ixPlace++) {
                var place = places[ixPlace];
                var plPlace = getPlacePL(place);
                var latlon = OL.Layer.SphericalMercator.inverseMercator(place.pointGeometry.x, place.pointGeometry.y);
                var categories = "";
                for (var ixCategory = 0; ixCategory < place.categories.length; ixCategory++) {
                    if (ixCategory > 0) {
                        categories += ", ";
                    }
                    categories += I18n.t("venues.categories." + place.categories[ixCategory]);
                }
                if (isCSV) {
                    columnArray = ["\"" + place.name + "\"", "\"" + categories + "\"", "\"" + place.city + "\"", "\"" + place.state + "\"", place.lockLevel.toString(),
                        place.placeType, (place.adLocked ? "Yes" : "No"), (place.hasOpenUpdateRequests ? "Yes" : "No"), (place.isApproved ? "No" : "Yes"),
                        place.streetName, place.houseNumber, (place.hasExternalProvider ? "Yes" : "No"),
                        "\"" + place.lastEditor + "\"",
                        latlon.lat.toString(), latlon.lon.toString(), "\"" + plPlace + "\""];
                    lineArray.push(columnArray);
                }
                if (isTab) {
                    w.document.write("<tr><td>" + place.name + "</td><td>" + categories + "</td>");
                    w.document.write("<td>" + place.city + "</td>");
                    w.document.write("<td>" + place.state + "</td>");
                    w.document.write("<td>" + place.lockLevel.toString() + "</td>");
                    w.document.write("<td>" + place.placeType + "</td>");
                    w.document.write("<td>" + (place.adLocked ? "Yes" : "No") + "</td>");
                    w.document.write("<td>" + (place.hasOpenUpdateRequests ? "Yes" : "No") + "</td>");
                    w.document.write("<td>" + (place.isApproved ? "No" : "Yes") + "</td>");
                    w.document.write("<td>" + place.streetName + "</td>");
                    w.document.write("<td>" + place.houseNumber + "</td>");
                    w.document.write("<td>" + (place.hasExternalProvider ? "Yes" : "No") + "</td>");
                    w.document.write("<td>" + place.lastEditor + "</td>");
                    w.document.write("<td>" + latlon.lat.toString() + "</td>");
                    w.document.write("<td>" + latlon.lon.toString() + "</td>");
                    w.document.write("<td><a href=\'" + plPlace + "\' target=\'_blank\'>Permalink</a></td></tr>");
                }
            }
            if (isCSV) {
                var csvContent = encodeURIComponent(lineArray.join("\n"));
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
                w.document.write("</tbody></table></body></html>");
                w.document.close();
                w = null;
            }
        }
    }
    WMEWAL_Places.ScanComplete = ScanComplete;
    function ScanCancelled() {
        ScanComplete();
    }
    WMEWAL_Places.ScanCancelled = ScanCancelled;
    function Init() {
        console.group(pluginName + ": Initializing");
        initCount++;
        var objectToCheck = ["OL",
            "W.location",
            "W.Config.venues",
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
                Regex: null,
                RegexIgnoreCase: true,
                Category: null,
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
                LastModifiedBy: null,
                Version: Version
            };
        }
        else {
            if (!settings.hasOwnProperty("NoStreet")) {
                settings.NoStreet = false;
            }
            if (!settings.hasOwnProperty("LastModifiedBy")) {
                settings.LastModifiedBy = null;
            }
            if (!settings.hasOwnProperty("Version")) {
                settings.Version = Version;
                updateSettings();
            }
        }
        console.log("Initialized");
        console.groupEnd();
        if (compareVersions(settings.Version, Version) < 0) {
            var versionHistory = "WME WAL Places Plugin\nv" + Version + "\n\nWhat's New\n--------";
            if (compareVersions(settings.Version, "1.2.3")) {
                versionHistory += "\nv1.2.3: Updates to supported latest WME.";
            }
            alert(versionHistory);
            settings.Version = Version;
            updateSettings();
        }
        WMEWAL.RegisterPlugIn(WMEWAL_Places);
    }
    function getPlacePL(place) {
        var latlon = OL.Layer.SphericalMercator.inverseMercator(place.pointGeometry.x, place.pointGeometry.y);
        var url = "https://www.waze.com/editor/?env=" + W.location.code + "&lon=" + latlon.lon + "&lat=" + latlon.lat + "&zoom=5&mode=0&venues=" + place.id;
        return url;
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
})(WMEWAL_Places || (WMEWAL_Places = {}));
