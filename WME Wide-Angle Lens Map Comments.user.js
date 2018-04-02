// ==UserScript==
// @name                WME Wide-Angle Lens Map Comments
// @namespace           https://greasyfork.org/en/users/19861-vtpearce
// @description         Find map comments that match filter criteria
// @author              vtpearce
// @include             https://www.waze.com/editor
// @include             /^https:\/\/(www|beta)\.waze\.com\/(?!user\/)(.{2,6}\/)?editor.*$/
// @version             0.0.4b2
// @grant               none
// @copyright           2017 vtpearce
// @license             CC BY-SA 4.0
// @updateURL           https://greasyfork.org/scripts/39523-wme-wide-angle-lens-map-comments/code/WME%20Wide-Angle%20Lens%20Map%20Comments.meta.js
// @downloadURL         https://greasyfork.org/scripts/39523-wme-wide-angle-lens-map-comments/code/WME%20Wide-Angle%20Lens%20Map%20Comments.user.js
// ==/UserScript==
// ---------------------------------------------------------------------------------------
var WMEWAL_MapComments;
(function (WMEWAL_MapComments) {
    var Operation;
    (function (Operation) {
        Operation[Operation["Equal"] = 1] = "Equal";
        Operation[Operation["NotEqual"] = 2] = "NotEqual";
    })(Operation || (Operation = {}));
    var pluginName = "WMEWAL-MapComments";
    WMEWAL_MapComments.Title = "Map Comments";
    WMEWAL_MapComments.MinimumZoomLevel = 0;
    WMEWAL_MapComments.SupportsSegments = false;
    WMEWAL_MapComments.SupportsVenues = false;
    var settingsKey = "WMEWALMapCommentsSettings";
    var savedSettingsKey = "WMEWALMapCommentsSavedSettings";
    var settings = null;
    var savedSettings = [];
    var mapComments;
    var titleRegex = null;
    var commentRegex = null;
    var lastModifiedBy;
    var lastModifiedByName;
    var mc = null;
    var initCount = 0;
    function GetTab() {
        var html = "<table style='border-collapse: separate; border-spacing:0px 1px;'>";
        html += "<tbody>";
        html += "<tr><td class='wal-heading'>Output To:</td></tr>";
        html += "<tr><td style='padding-left:20px'>" +
            "<select id='_wmewalMapCommentsOutputTo'>" +
            "<option value='csv'>CSV File</option>" +
            "<option value='tab'>Browser Tab</option>" +
            "<option value='both'>Both CSV File and Browser Tab</option></select></td></tr>";
        html += "<tr><td class='wal-heading' style='border-top: 1px solid'>Saved Filters</td></tr>";
        html += "<tr><td class='wal-indent' style='padding-bottom: 8px'>" +
            "<select id='_wmewalMapCommentsSavedSettings'/><br/>" +
            "<button class='btn btn-primary' id='_wmewalMapCommentsLoadSetting' title='Load'>Load</button>" +
            "<button class='btn btn-primary' style='margin-left: 4px;' id='_wmewalMapCommentsSaveSetting' title='Save'>Save</button>" +
            "<button class='btn btn-primary' style='margin-left: 4px;' id='_wmewalMapCommentsDeleteSetting' title='Delete'>Delete</button></td></tr>";
        html += "<tr><td class='wal-heading' style='border-top: 1px solid; padding-top: 4px'>Filters (All Of These)</td></tr>";
        html += "<tr><td><b>Lock Level:</b></td></tr>";
        html += "<tr><td class='wal-indent'>" +
            "<select id='_wmewalMapCommentsLockLevelOp'>" +
            "<option value='" + Operation.Equal.toString() + "' selected='selected'>=</option>" +
            "<option value='" + Operation.NotEqual.toString() + "'>&lt;&gt;</option></select>" +
            "<select id='_wmewalMapCommentsLockLevel'>" +
            "<option value=''></option>" +
            "<option value='1'>1</option>" +
            "<option value='2'>2</option>" +
            "<option value='3'>3</option>" +
            "<option value='4'>4</option>" +
            "<option value='5'>5</option>" +
            "<option value='6'>6</option></select></td></tr>";
        html += "<tr><td><b>Title RegEx:</b></td></tr>";
        html += "<tr><td class='wal-indent'><input type='text' id='_wmewalMapCommentsTitle' class='wal-textbox'/><br/>" +
            "<input id='_wmewalMapCommentsTitleIgnoreCase' type='checkbox'/>" +
            "<label for='_wmewalMapCommentsTitleIgnoreCase' class='wal-label'>Ignore case</label></td></tr>";
        html += "<tr><td><b>Comments RegEx:</b></td></tr>";
        html += "<tr><td class='wal-indent'><input type='text' id='_wmewalMapCommentsComments' class='wal-textbox'/><br/>" +
            "<input id='_wmewalMapCommentsCommentsIgnoreCase' type='checkbox'/>" +
            "<label for='_wmewalMapCommentsCommentsIgnoreCase' class='wal-label'>Ignore case</label></td></tr>";
        html += "<tr><td><b>Last Modified By:</b></td></tr>";
        html += "<tr><td class='wal-indent'>" +
            "<select id='_wmewalMapCommentsLastModifiedBy'/></td></tr>";
        html += "<tr><td><b>Geometry Type:</b></td></tr>" +
            "<tr><td class='wal-indent'><select id='_wmewalMapCommentsGeometryType'>" +
            "<option value=''></option>" +
            "<option value='area'>" + I18n.t("edit.landmark.type.area") + "</option>" +
            "<option value='point'>" + I18n.t("edit.landmark.type.point") + "</option>" +
            "</select></td></tr>";
        html += "<tr><td><b>Expiration Date:</b></td></tr>";
        html += "<tr><td class='wal-indent'><input type='text' id='_wmewalMapCommentsExpirationDate' class='wal-textbox'/></td></tr>";
        html += "<tr><td><input id='_wmewalMapCommentsEditable' type='checkbox'/>" +
            "<label for='_wmewalMapCommentsEditable' class='wal-label'>Editable by me</label></td></tr>";
        html += "</tbody></table>";
        return html;
    }
    WMEWAL_MapComments.GetTab = GetTab;
    function TabLoaded() {
        updateUsers();
        updateUI();
        updateSavedSettingsList();
        $("#_wmewalMapCommentsLastModifiedBy").on("focus", updateUsers);
        $("#_wmewalMapCommentsLoadSetting").on("click", loadSetting);
        $("#_wmewalMapCommentsSaveSetting").on("click", saveSetting);
        $("#_wmewalMapCommentsDeleteSetting").on("click", deleteSetting);
    }
    WMEWAL_MapComments.TabLoaded = TabLoaded;
    function updateUsers() {
        var selectLastModifiedBy = $("#_wmewalMapCommentsLastModifiedBy");
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
        var s = $("#_wmewalMapCommentsSavedSettings");
        s.empty();
        for (var ixSaved = 0; ixSaved < savedSettings.length; ixSaved++) {
            var opt = $("<option/>").attr("value", ixSaved).text(savedSettings[ixSaved].Name);
            s.append(opt);
        }
    }
    function updateUI() {
        $("#_wmewalMapCommentsOutputTo").val(settings.OutputTo);
        $("#_wmewalMapCommentsLockLevel").val(settings.LockLevel);
        $("#_wmewalMapCommentsLockLevelOp").val(settings.LockLevelOperation || Operation.Equal.toString());
        $("#_wmewalMapCommentsTitle").val(settings.TitleRegex || "");
        $("#_wmewalMapCommentsTitleIgnoreCase").prop("checked", settings.TitleRegexIgnoreCase);
        $("#_wmewalMapCommentsComments").val(settings.CommentRegex || "");
        $("#_wmewalMapCommentsCommentsIgnoreCase").prop("checked", settings.CommentRegexIgnoreCase);
        $("#_wmewalMapCommentsEditable").prop("checked", settings.EditableByMe);
        $("#_wmewalMapCommentsLastModifiedBy").val(settings.LastModifiedBy);
        if (settings.ExpirationDate != null) {
            $("#_wmewalMapCommentsExpirationDate").val(new Date(settings.ExpirationDate).toLocaleString());
        }
        else {
            $("#_wmewalMapCommentsExpirationDate").val("");
        }
        $("#_wmewalMapCommentsGeometryType").val(settings.GeometryType);
    }
    function loadSetting() {
        var selectedSetting = parseInt($("#_wmewalMapCommentsSavedSettings").val());
        if (selectedSetting == null || isNaN(selectedSetting) || selectedSetting < 0 || selectedSetting > savedSettings.length) {
            return;
        }
        settings.OutputTo = $("#_wmewalMapCommentsOutputTo").val();
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
        var selectedUser = $("#_wmewalMapCommentsLastModifiedBy").val();
        if (selectedUser != null && selectedUser.length > 0) {
            if (W.model.users.get(selectedUser) == null) {
                message += ((message.length > 0 ? "\n" : "") + "Invalid last modified user");
            }
        }
        var pattern = $("#_wmewalMapCommentsTitle").val();
        var ignoreCase = $("#_wmewalMapCommentsTitleIgnoreCase").prop("checked");
        var r;
        if (pattern !== "") {
            try {
                r = (ignoreCase ? new RegExp(pattern, "i") : new RegExp(pattern));
            }
            catch (error) {
                message += ((message.length > 0 ? "\n" : "") + "Title RegEx is invalid");
            }
        }
        pattern = $("#_wmewalMapCommentsComments").val();
        ignoreCase = $("#_wmewalMapCommentsCommentsIgnoreCase").prop("checked");
        if (pattern !== "") {
            try {
                r = (ignoreCase ? new RegExp(pattern, "i") : new RegExp(pattern));
            }
            catch (error) {
                message += ((message.length > 0 ? "\n" : "") + "Comments RegEx is invalid");
            }
        }
        var dateString = $("#_wmewalMapCommentsExpirationDate").val();
        if (dateString !== "") {
            var date = Date.parse(dateString);
            if (isNaN(date)) {
                message += ((message.length > 0 ? "\n" : "") + "Cannot parse expiration date");
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
            var s = getSettings();
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
    function getSettings() {
        var s = {
            LockLevel: null,
            LockLevelOperation: parseInt($("#_wmewalMapCommentsLockLevelOp").val()),
            TitleRegex: null,
            TitleRegexIgnoreCase: $("#_wmewalMapCommentsTitleIgnoreCase").prop("checked"),
            CommentRegex: null,
            CommentRegexIgnoreCase: $("#_wmewalMapCommentsCommentsIgnoreCase").prop("checked"),
            EditableByMe: $("#_wmewalMapCommentsEditable").prop("checked"),
            LastModifiedBy: null,
            GeometryType: $("#_wmewalMapCommentsGeometryType").val(),
            ExpirationDate: null
        };
        var selectedUser = $("#_wmewalMapCommentsLastModifiedBy").val();
        if (selectedUser != null && selectedUser.length > 0) {
            s.LastModifiedBy = W.model.users.get(selectedUser).id;
        }
        var pattern = $("#_wmewalMapCommentsTitle").val();
        if (pattern !== "") {
            s.TitleRegex = pattern;
        }
        pattern = $("#_wmewalMapCommentsComments").val();
        if (pattern !== "") {
            s.CommentRegex = pattern;
        }
        var selectedLockLevel = $("#_wmewalMapCommentsLockLevel").val();
        if (selectedLockLevel != null && selectedLockLevel.length > 0) {
            s.LockLevel = parseInt(selectedLockLevel);
        }
        var dateString = $("#_wmewalMapCommentsExpirationDate").val();
        if (dateString !== "") {
            s.ExpirationDate = Date.parse(dateString);
        }
        if (s.GeometryType === "") {
            s.GeometryType = null;
        }
        return s;
    }
    function deleteSetting() {
        var selectedSetting = parseInt($("#_wmewalMapCommentsSavedSettings").val());
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
            mapComments = [];
            mc = [];
            settings.OutputTo = $("#_wmewalMapCommentsOutputTo").val();
            var s = getSettings();
            settings.CommentRegex = s.CommentRegex;
            settings.CommentRegexIgnoreCase = s.CommentRegexIgnoreCase;
            settings.EditableByMe = s.EditableByMe;
            settings.ExpirationDate = s.ExpirationDate;
            settings.GeometryType = s.GeometryType;
            settings.LastModifiedBy = s.LastModifiedBy;
            settings.LockLevel = s.LockLevel;
            settings.LockLevelOperation = s.LockLevelOperation;
            settings.TitleRegex = s.TitleRegex;
            settings.TitleRegexIgnoreCase = s.TitleRegexIgnoreCase;
            lastModifiedBy = null;
            if (settings.LastModifiedBy !== null) {
                lastModifiedBy = W.model.users.get(settings.LastModifiedBy);
                lastModifiedByName = lastModifiedBy.userName;
            }
            titleRegex = null;
            if (settings.TitleRegex !== null) {
                titleRegex = (settings.TitleRegexIgnoreCase ? new RegExp(settings.TitleRegex, "i") : new RegExp(settings.TitleRegex));
            }
            commentRegex = null;
            if (settings.CommentRegex !== null) {
                commentRegex = (settings.CommentRegexIgnoreCase ? new RegExp(settings.CommentRegex, "i") : new RegExp(settings.CommentRegex));
            }
            updateSettings();
        }
        return allOk;
    }
    WMEWAL_MapComments.ScanStarted = ScanStarted;
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
    function getPL(mapComment, lonlat) {
        var url = "https://www.waze.com/editor/?env=" + W.location.code + "&lon=" + lonlat.lon + "&lat=" + lonlat.lat + "&zoom=5&mode=0&mapComments=" + mapComment.id;
        return url;
    }
    function ScanExtent(segments, venues) {
        var def = $.Deferred();
        for (var c in W.model.mapComments.objects) {
            if (mc.indexOf(c) === -1) {
                var mapComment = W.model.mapComments.get(c);
                if (mapComment != null) {
                    mc.push(c);
                    if ((settings.LockLevel == null ||
                        (settings.LockLevelOperation === Operation.Equal && (mapComment.attributes.lockRank || 0) + 1 === settings.LockLevel) ||
                        (settings.LockLevelOperation === Operation.NotEqual && (mapComment.attributes.lockRank || 0) + 1 !== settings.LockLevel)) &&
                        (!settings.EditableByMe || mapComment.arePropertiesEditable()) &&
                        (settings.GeometryType == null || (settings.GeometryType === "point" && mapComment.isPoint()) || (settings.GeometryType === "area" && !mapComment.isPoint())) &&
                        (titleRegex == null || titleRegex.test(mapComment.attributes.subject))) {
                        if (settings.ExpirationDate != null) {
                            if (mapComment.attributes.endDate === null) {
                                continue;
                            }
                            var endDateNumber = Date.parse(mapComment.attributes.endDate);
                            if (isNaN(endDateNumber)) {
                                continue;
                            }
                            var endDate_1 = new Date(endDateNumber);
                            if (endDate_1.getTime() !== new Date(settings.ExpirationDate).getTime()) {
                                continue;
                            }
                        }
                        if (settings.LastModifiedBy != null) {
                            if (mapComment.attributes.updatedBy != null) {
                                if (mapComment.attributes.updatedBy !== settings.LastModifiedBy) {
                                    continue;
                                }
                            }
                            else if (mapComment.attributes.createdBy !== settings.LastModifiedBy) {
                                continue;
                            }
                        }
                        if (settings.CommentRegex != null) {
                            var match = false;
                            match = commentRegex.test(mapComment.attributes.body);
                            var comments = mapComment.getComments();
                            for (var ixComment = 0; ixComment < comments.length; ixComment++ && !match) {
                                match = commentRegex.test(comments.models[ixComment].attributes.text);
                            }
                            if (!match) {
                                continue;
                            }
                        }
                        if (!WMEWAL.IsMapCommentInArea(mapComment)) {
                            continue;
                        }
                        var lastEditorID = mapComment.attributes.updatedBy || mapComment.attributes.createdBy;
                        var lastEditor = W.model.users.get(lastEditorID);
                        var endDate = null;
                        var expirationDate = mapComment.attributes.endDate;
                        if (expirationDate != null) {
                            endDate = Date.parse(expirationDate);
                            if (isNaN(endDate)) {
                                endDate = null;
                            }
                        }
                        var mComment = {
                            id: mapComment.attributes.id,
                            geometryType: ((mapComment.isPoint()) ? I18n.t("edit.landmark.type.point") : I18n.t("edit.landmark.type.area")),
                            lastEditor: (lastEditor && lastEditor.userName) || "",
                            title: mapComment.attributes.subject,
                            lockLevel: mapComment.attributes.lockRank + 1,
                            expirationDate: endDate,
                            center: mapComment.attributes.geometry.getCentroid(),
                            createdOn: mapComment.attributes.createdOn,
                            updatedOn: mapComment.attributes.updatedOn
                        };
                        mapComments.push(mComment);
                    }
                }
            }
        }
        def.resolve();
        return def.promise();
    }
    WMEWAL_MapComments.ScanExtent = ScanExtent;
    function ScanComplete() {
        if (mapComments.length === 0) {
            alert(pluginName + ": No map comments found.");
        }
        else {
            mapComments.sort(function (a, b) {
                return a.title.localeCompare(b.title);
            });
            var outputTo = $("#_wmewalMapCommentsOutputTo").val();
            var isCSV = (outputTo === "csv" || outputTo === "both");
            var isTab = (outputTo === "tab" || outputTo === "both");
            var lineArray = void 0;
            var columnArray = void 0;
            var w = void 0;
            var fileName = void 0;
            if (isCSV) {
                lineArray = [];
                columnArray = ["data:text/csv;charset=utf-8,Title,Lock Level,Geometry Type,Expiration Date,Last Editor,Created On,Updated On,Latitude,Longitude,Permalink"];
                lineArray.push(columnArray);
                fileName = "MapComments" + WMEWAL.areaName;
                fileName += ".csv";
            }
            if (isTab) {
                w = window.open();
                w.document.write("<html><head><title>Map Comments</title></head><body>");
                w.document.write("<h2>Area: " + WMEWAL.areaName + "</h2>");
                w.document.write("<b>Filters</b>");
                if (settings.LockLevel != null) {
                    w.document.write("<br/>Lock Level " + (settings.LockLevelOperation === Operation.NotEqual ? "does not equal " : "equals ") + settings.LockLevel.toString());
                }
                if (settings.TitleRegex != null) {
                    w.document.write("<br/>Title matches " + settings.TitleRegex);
                    if (settings.TitleRegexIgnoreCase) {
                        w.document.write(" (ignoring case)");
                    }
                }
                if (settings.CommentRegex != null) {
                    w.document.write("<br/>Comment matches " + settings.CommentRegex);
                    if (settings.CommentRegexIgnoreCase) {
                        w.document.write(" (ignoring case)");
                    }
                }
                if (settings.GeometryType != null) {
                    w.document.write("<br/>Geometry type is " + I18n.t("edit.landmark.type." + settings.GeometryType));
                }
                if (settings.ExpirationDate != null) {
                    w.document.write("<br/>Expires on " + new Date(settings.ExpirationDate).toLocaleString());
                }
                if (settings.LastModifiedBy != null) {
                    w.document.write("<br/>Last modified by " + lastModifiedByName);
                }
                if (settings.EditableByMe) {
                    w.document.write("<br/>Editable by me");
                }
                w.document.write("<table style='border-collapse: separate; border-spacing: 8px 0px'><thead><tr><th>Title</th><th>Lock Level</th><th>Geometry Type</th><th>Expiration Date</th>");
                w.document.write("<th>Last Editor</th><th>Created On</th><th>Updated On</th><th>Latitude</th><th>Longitude</th><th>Permalink</th></tr><thead><tbody>");
            }
            for (var ixmc = 0; ixmc < mapComments.length; ixmc++) {
                var mapComment = mapComments[ixmc];
                var lonlat = OL.Layer.SphericalMercator.inverseMercator(mapComment.center.x, mapComment.center.y);
                var pl = getPL(mapComment, lonlat);
                var expirationDate = "";
                if (mapComment.expirationDate != null) {
                    expirationDate = new Date(mapComment.expirationDate).toLocaleString();
                }
                if (isCSV) {
                    columnArray = ["\"" + mapComment.title + "\"", mapComment.lockLevel.toString(), mapComment.geometryType, "\"" + expirationDate + "\"", "\"" + mapComment.lastEditor + "\"",
                        mapComment.createdOn ? new Date(mapComment.createdOn).toLocaleString() : "",
                        mapComment.updatedOn ? new Date(mapComment.updatedOn).toLocaleString() : "",
                        lonlat.lat.toString(), lonlat.lon.toString(), "\"" + pl + "\""];
                    lineArray.push(columnArray);
                }
                if (isTab) {
                    w.document.write("<tr><td>" + mapComment.title + "</td><td>" + mapComment.lockLevel.toString() + "</td>");
                    w.document.write("<td>" + mapComment.geometryType + "</td>");
                    w.document.write("<td>" + expirationDate + "</td>");
                    w.document.write("<td>" + mapComment.lastEditor + "</td>");
                    w.document.write("<td>" + (mapComment.createdOn ? new Date(mapComment.createdOn).toLocaleString() : "&nbsp;") + "</td>");
                    w.document.write("<td>" + (mapComment.updatedOn ? new Date(mapComment.updatedOn).toLocaleString() : "&nbsp;") + "</td>");
                    w.document.write("<td>" + lonlat.lat.toString() + "</td>");
                    w.document.write("<td>" + lonlat.lon.toString() + "</td>");
                    w.document.write("<td><a href=\'" + pl + "\' target=\'_blank\'>Permalink</a></td></tr>");
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
                w.document.write("</tbody></table></body></html>");
                w.document.close();
                w = null;
            }
        }
        mapComments = null;
        mc = null;
    }
    WMEWAL_MapComments.ScanComplete = ScanComplete;
    function ScanCancelled() {
        ScanComplete();
    }
    WMEWAL_MapComments.ScanCancelled = ScanCancelled;
    function Init() {
        console.group(pluginName + ": Initializing");
        initCount++;
        var objectToCheck = ["OL",
            "W.location",
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
                    localStorage[savedSettingsKey +"Backup"] = localStorage[savedSettingsKey];
                    savedSettings = JSON.parse(WMEWAL.LZString.decompress(localStorage[savedSettingsKey]));
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
                TitleRegex: null,
                TitleRegexIgnoreCase: true,
                CommentRegex: null,
                CommentRegexIgnoreCase: true,
                GeometryType: null,
                ExpirationDate: null,
                LockLevel: null,
                LockLevelOperation: Operation.Equal,
                LastModifiedBy: null,
                EditableByMe: true
            };
        }
        console.log("Initialized");
        console.groupEnd();
        WMEWAL.RegisterPlugIn(WMEWAL_MapComments);
    }
    Init();
})(WMEWAL_MapComments || (WMEWAL_MapComments = {}));
