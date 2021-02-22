/// <reference path="../typings/globals/openlayers/index.d.ts" />
/// <reference path="../typings/I18n.d.ts" />
/// <reference path="../typings/waze.d.ts" />
/// <reference path="../typings/globals/jquery/index.d.ts" />
/// <reference path="WME Wide-Angle Lens.user.ts" />
/// <reference path="../typings/greasyfork.d.ts" />
// ==UserScript==
// @name                WME Wide-Angle Lens Streets
// @namespace           https://greasyfork.org/en/users/19861-vtpearce
// @description         Find streets that match filter criteria
// @author              vtpearce and crazycaveman
// @include             https://www.waze.com/editor
// @include             /^https:\/\/(www|beta)\.waze\.com\/(?!user\/)(.{2,6}\/)?editor.*$/
// @version             1.6.6
// @grant               none
// @copyright           2020 vtpearce
// @license             CC BY-SA 4.0
// @require             https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js
// @updateURL           https://greasyfork.org/scripts/40646-wme-wide-angle-lens-streets/code/WME%20Wide-Angle%20Lens%20Streets.meta.js
// @downloadURL         https://greasyfork.org/scripts/40646-wme-wide-angle-lens-streets/code/WME%20Wide-Angle%20Lens%20Streets.user.js
// ==/UserScript==

/*global W, OL, $, WazeWrap, WMEWAL, OpenLayers, I18n */

namespace WMEWAL_Streets {

    const scrName = GM_info.script.name;
    const Version = GM_info.script.version;
    const updateText = '<ul>' +
        '<li>Include one-way as an issue</li>' +
        '</ul>';
    const greasyForkPage = 'https://greasyfork.org/scripts/40646';
    const wazeForumThread = 'https://www.waze.com/forum/viewtopic.php?t=206376';

    const ctlPrefix = "_wmewalStreets";

    const minimumWALVersionRequired = "1.5.6";

    enum Direction {
        OneWay = 1,
        TwoWay = 2,
        Unknown = 3
    }

    enum Operation {
        Equal = 1,
        NotEqual = 2,
        LessThan = 3,
        LessThanOrEqual = 4,
        GreaterThan = 5,
        GreaterThanOrEqual = 6
    }

    enum Issue {
        NoSpeedLimit = 1 << 0,
        TimeBasedRestrictions = 1 << 1,
        TimeBasedTurnRestrictions = 1 << 2,
        RestrictedJunctionArrows = 1 << 3,
        UTurn = 1 << 4,
        SoftTurns = 1 << 5,
        UnnecessaryJunctionNode = 1 << 6,
        Elevation = 1 << 7,
        SegmentLength = 1 << 8,
        NoName = 1 << 9,
        NoCity = 1 << 10,
        RoutingPreference = 1 << 11,
        UnknownDirection = 1 << 12,
        NoHN = 1 << 13,
        RampWithSL = 1 << 14,
        Plus1RoutingPreference = 1 << 15,
        Minus1RoutingPreference = 1 << 16,
        NewlyPaved = 1 << 17,
        OneWay = 1 << 18
    }

    enum Unit {
        Metric = 1,
        Imperial = 2
    }

    interface ISegment {
        id: number;
        center: OpenLayers.Geometry.Point;
    }

    interface IState {
        id: number;
        name: string;
    }

    interface IUser {
        id: number;
        name: string;
    }

    interface IStreetBase {
        id: number;
        name: string;
        city: string;
    }

    interface IStreet extends IStreetBase {
        state: string;
        geometries: OpenLayers.Geometry.Collection;
        roadType: number;
        lockLevel: number;
        segments: Array<ISegment>;
        roundaboutId: number;
        center?: OpenLayers.Geometry.Point;
        altStreets?: Array<IStreetBase>;
        direction: Direction;
        issues: number;
        length: number;
        lastEditor: string;
        asc: string;
        createdEditor: string;
    }

    interface ISaveableSettings {
        RoadTypeMask: number;
        State: number;
        StateOperation: Operation;
        LockLevel: number;
        LockLevelOperation: Operation;
        Regex: string;
        RegexIgnoreCase: boolean;
        CityRegex: string;
        CityRegexIgnoreCase: boolean;
        ExcludeJunctionBoxes: boolean;
        EditableByMe: boolean;
        NoSpeedLimit: boolean;
        IncludeAltNames: boolean;
        Direction: number;
        HasTimeBasedRestrictions: boolean;
        HasTimeBasedTurnRestrictions: boolean;
        HasRestrictedJunctionArrow: boolean;
        HasUTurn: boolean;
        HasSoftTurns: boolean;
        HasUnnecessaryJunctionNode: boolean;
        Elevation: boolean;
        ElevationOperation: number;
        SegmentLength: boolean;
        SegmentLengthOperation: Operation;
        SegmentLengthValue: number;
        SegmentLengthUnit: Unit;
        LastModifiedBy: number;
        HasNoName: boolean;
        HasNoCity: boolean;
        NonNeutralRoutingPreference: boolean;
        IncludeASC: boolean;
        Roundabouts: boolean;
        RoundaboutsOperation: number;
        UnknownDirection: boolean;
        NoHN: boolean;
        RampWithSL: boolean;
        Unpaved: boolean;
        Tunnel: boolean;
        HeadlightsRequired: boolean;
        NearHOV: boolean;
        Toll: boolean;
        Beacons: boolean;
        CreatedBy: number;
        LaneGuidance: boolean;
        LaneGuidanceOperation: number;
        Created: boolean;
        CreatedOperation: Operation;
        CreatedDate: number;
        Updated: boolean;
        UpdatedOperation: Operation;
        UpdatedDate: number;
        Plus1RoutingPreference: boolean;
        Minus1RoutingPreference: boolean;
        NewlyPaved: boolean;
        SegmentLengthFilter: boolean;
        SegmentLengthFilterOperation: Operation;
        SegmentLengthFilterValue: number;
        SegmentLengthFilterUnit: Unit;
        OneWay: boolean;
    }

    interface ISettings extends ISaveableSettings {
    }

    interface ISavedSetting {
        Name: string;
        Setting: ISaveableSettings;
    }

    let pluginName = "WMEWAL-Streets";

    export let Title: string = "Streets";
    export let MinimumZoomLevel = 2;
    export let SupportsSegments = true;
    export let SupportsVenues = false;

    let settingsKey = "WMEWALStreetsSettings";
    let savedSettingsKey = "WMEWALStreetsSavedSettings";
    let settings: ISettings = null;
    let savedSettings: Array<ISavedSetting> = [];
    let streets: Array<IStreet> = null;
    let state: WazeNS.Model.Object.State;
    let stateName: string;
    let lastModifiedBy: WazeNS.Model.Object.User;
    let lastModifiedByName: string;
    let nameRegex: RegExp = null;
    let cityRegex: RegExp = null;
    let roundabouts: Array<number> = null;
    let detectIssues = false;
    let initCount = 0;
    let createdBy: WazeNS.Model.Object.User;
    let createdByName: string;
    let savedSegments: Array<number>;
    let segmentLengthMultiplier: number;
    let segmentLengthFilterMultipier: number;
    const mToFt: number = 3.28084;
    let isImperial: boolean;

    export function GetTab(): string {
        let html = "<table style='border-collapse: separate; border-spacing:0px 1px;'>";

        html += "<tbody>";
        html += "<tr><td class='wal-heading'>Saved Filters</td></tr>";
        html += "<tr><td class='wal-indent' style='padding-bottom: 8px'>" +
            `<select id='${ctlPrefix}SavedSettings'/><br/>` +
            `<button class='btn btn-primary' id='${ctlPrefix}LoadSetting' title='Load'>Load</button>` +
            `<button class='btn btn-primary' style='margin-left: 4px;' id='${ctlPrefix}SaveSetting' title='Save'>Save</button>` +
            `<button class='btn btn-primary' style='margin-left: 4px;' id='${ctlPrefix}DeleteSetting' title='Delete'>Delete</button></td></tr>`;

        html += "<tr><td class='wal-heading' style='border-top: 1px solid'>Output Options</td></tr>";
        html += `<tr><td class='wal-indent'><input type='checkbox' id='${ctlPrefix}IncludeAlt'>` +
            `<label for='${ctlPrefix}IncludeAlt' style='margin-left:8px;'>Include Alt Names</label></td></tr>`;
        html += `<tr><td class='wal-indent'><input type='checkbox' id='${ctlPrefix}IncludeASC'>` +
            `<label for='${ctlPrefix}IncludeASC' style='margin-left:8px;'>Include Avg Speed Cams</label></td></tr>`;

        html += "<tr><td class='wal-heading' style='border-top: 1px solid; padding-top: 4px'>Filters (All of these)</td></tr>";
        html += "<tr><td><b>Lock Level:</b></td></tr>";
        html += "<tr><td class='wal-indent'>" +
            `<select id='${ctlPrefix}LockLevelOp'>` +
            `<option value='${Operation.Equal}' selected='selected'>=</option>` +
            `<option value='${Operation.NotEqual}'>&lt;&gt;</option></select>` +
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
        html += "<tr><td><b>Name RegEx:</b></td></tr>";
        html += `<tr><td class='wal-indent'><input type='text' id='${ctlPrefix}Name' class='wal-textbox'/><br/>` +
            `<input id='${ctlPrefix}IgnoreCase' type='checkbox'/>` +
            `<label for='${ctlPrefix}IgnoreCase' class='wal-label'>Ignore case</label></td></tr>`;
        html += "<tr><td><b>City RegEx:</b></td></tr>";
        html += `<tr><td class='wal-indent'><input type='text' id='${ctlPrefix}City' class='wal-textbox'/><br/>` +
            `<input id='${ctlPrefix}CityIgnoreCase' type='checkbox'/>` +
            `<label for='${ctlPrefix}CityIgnoreCase' class='wal-label'>Ignore case</label></td></tr>`;
        html += "<tr><td><b>State:</b></td></tr>";
        html += "<tr><td class='wal-indent'>" +
            `<select id='${ctlPrefix}StateOp'>` +
            `<option value='${Operation.Equal}' selected='selected'>=</option>` +
            `<option value='${Operation.NotEqual}'>&lt;&gt;</option></select>` +
            `<select id='${ctlPrefix}State'/></td></tr>`;
        html += "<tr><td><b>Direction:</b></td></tr>";
        html += "<tr><td class='wal-indent'>" +
            `<select id='${ctlPrefix}Direction'>` +
            "<option value=''></option>" +
            `<option value='${Direction.OneWay}'>One way</option>` +
            `<option value='${Direction.TwoWay}'>Two way</option>` +
            `<option value='${Direction.Unknown}'>Unknown</option></select></td></tr>`;
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
        html += "<tr><td><b>Road Type:</b></td></tr>";
        html += "<tr><td class='wal-indent'>" +
            `<button id='${ctlPrefix}RoadTypeAny' class='btn btn-primary' style='margin-right: 8px' title='Any'>Any</button>` +
            `<button id='${ctlPrefix}RoadTypeClear' class='btn btn-primary' title='Clear'>Clear</button>` +
            `<div><input type='checkbox' checked='checked' id='${ctlPrefix}RoadTypeFreeway' data-group='${ctlPrefix}RoadType' value='${WMEWAL.RoadType.Freeway}'/>` +
            `<label for='${ctlPrefix}RoadTypeFreeway' class='wal-label'>${WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.Freeway))}</label></div>` +
            `<div><input type='checkbox' id='${ctlPrefix}RoadTypeRamp' data-group='${ctlPrefix}RoadType' value='${WMEWAL.RoadType.Ramp}'/>` +
            `<label for='${ctlPrefix}RoadTypeRamp' class='wal-label'>${WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.Ramp))}</label></div>` +
            `<div><input type='checkbox' id='${ctlPrefix}RoadTypeMajorHighway' data-group='${ctlPrefix}RoadType' value='${WMEWAL.RoadType.MajorHighway}'/>` +
            `<label for='${ctlPrefix}RoadTypeMajorHighway' class='wal-label'>${WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.MajorHighway))}</label></div>` +
            `<div><input type='checkbox' id='${ctlPrefix}RoadTypeMinorHighway' data-group='${ctlPrefix}RoadType' value='${WMEWAL.RoadType.MinorHighway}'/>` +
            `<label for='${ctlPrefix}RoadTypeMinorHighway' class='wal-label'>${WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.MinorHighway))}</label></div>` +
            `<div><input type='checkbox' id='${ctlPrefix}RoadTypePrimary' data-group='${ctlPrefix}RoadType' value='${WMEWAL.RoadType.PrimaryStreet}'/>` +
            `<label for='${ctlPrefix}RoadTypePrimary' class='wal-label'>${WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.PrimaryStreet))}</label></div>` +
            `<div><input type='checkbox' id='${ctlPrefix}RoadTypeStreet' data-group='${ctlPrefix}RoadType' value='${WMEWAL.RoadType.Street}'/>` +
            `<label for='${ctlPrefix}RoadTypeStreet' class='wal-label'>${WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.Street))}</label></div>` +
            `<div><input type='checkbox' id='${ctlPrefix}RoadTypeAlley' data-group='${ctlPrefix}RoadType' value='${WMEWAL.RoadType.Alley}'/>` +
            `<label for='${ctlPrefix}RoadTypeAlley' class='wal-label'>${WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.Alley))}</label></div>` +
            `<div><input type='checkbox' id='${ctlPrefix}RoadTypeUnpaved' data-group='${ctlPrefix}RoadType' value='${WMEWAL.RoadType.Unpaved}'/>` +
            `<label for='${ctlPrefix}RoadTypeUnpaved' class='wal-label'>${WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.Unpaved))}</label></div>` +
            `<div><input type='checkbox' id='${ctlPrefix}RoadTypePLR' data-group='${ctlPrefix}RoadType' value='${WMEWAL.RoadType.ParkingLotRoad}'/>` +
            `<label for='${ctlPrefix}RoadTypePLR' class='wal-label'>${WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.ParkingLotRoad))}</label></div>` +
            `<div><input type='checkbox' id='${ctlPrefix}RoadTypePrivate' data-group='${ctlPrefix}RoadType' value='${WMEWAL.RoadType.PrivateRoad}'/>` +
            `<label for='${ctlPrefix}RoadTypePrivate' class='wal-label'>${WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.PrivateRoad))}</label></div>` +
            `<div><input type='checkbox' id='${ctlPrefix}RoadTypeFerry' data-group='${ctlPrefix}RoadType' value='${WMEWAL.RoadType.Ferry}'/>` +
            `<label for='${ctlPrefix}RoadTypeFerry' class='wal-label'>${WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.Ferry))}</label></div>` +
            `<div><input type='checkbox' id='${ctlPrefix}RoadTypeWT' data-group='${ctlPrefix}RoadType' value='${WMEWAL.RoadType.WalkingTrail}'/>` +
            `<label for='${ctlPrefix}RoadTypeWT' class='wal-label'>${WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.WalkingTrail))}</label></div>` +
            `<div><input type='checkbox' id='${ctlPrefix}RoadTypePB' data-group='${ctlPrefix}RoadType' value='${WMEWAL.RoadType.PedestrianBoardwalk}'/>` +
            `<label for='${ctlPrefix}RoadTypePB' class='wal-label'>${WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.PedestrianBoardwalk))}</label></div>` +
            `<div><input type='checkbox' id='${ctlPrefix}RoadTypeStairway' data-group='${ctlPrefix}RoadType' value='${WMEWAL.RoadType.Stairway}'/>` +
            `<label for='${ctlPrefix}RoadTypeStairway' class='wal-label'>${WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.Stairway))}</label></div>` +
            `<div><input type='checkbox' id='${ctlPrefix}RoadTypeRR' data-group='${ctlPrefix}RoadType' value='${WMEWAL.RoadType.Railroad}'/>` +
            `<label for='${ctlPrefix}RoadTypeRR' class='wal-label'>${WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.Railroad))}</label></div>` +
            `<div><input type='checkbox' id='${ctlPrefix}RoadTypeRT' data-group='${ctlPrefix}RoadType' value='${WMEWAL.RoadType.RunwayTaxiway}'/>` +
            `<label for='${ctlPrefix}RoadTypeRT' class='wal-label'>${WMEWAL.TranslateRoadType(WMEWAL.RoadTypeBitmaskToWazeRoadType(WMEWAL.RoadType.RunwayTaxiway))}</label></div>` +
            "</td></tr>";
        html += `<tr><td><input id='${ctlPrefix}Editable' type='checkbox'/>` +
            `<label for='${ctlPrefix}Editable' class='wal-label'>Editable by me</label></td></tr>`;
        html += `<tr><td><input id='${ctlPrefix}Roundabouts' type='checkbox'/>` +
            `<label for='${ctlPrefix}Roundabouts' class='wal-label'>`;
        html += `<select id='${ctlPrefix}RoundaboutsOp' style='margin-right: 0px'>` +
            "<option value='0'>Exclude</option>" +
            "<option value='1'>Only</option>" +
            "</select> Roundabouts</label></td></tr>";
        html += `<tr><td><input id='${ctlPrefix}ExcludeJunctionBoxes' type='checkbox' checked='checked'/>` +
            `<label for='${ctlPrefix}ExcludeJunctionBoxes' class='wal-label'>Exclude Junction Boxes</label></td></tr>`;
        html += `<tr><td><input id='${ctlPrefix}Unpaved' type='checkbox' checked='checked'/>` +
            `<label for='${ctlPrefix}Unpaved' class='wal-label'>` + I18n.t("edit.segment.fields.unpaved") + "</label></td></tr>";
        html += `<tr><td><input id='${ctlPrefix}Tunnel' type='checkbox' checked='checked'/>` +
            `<label for='${ctlPrefix}Tunnel' class='wal-label'>` + I18n.t("edit.segment.fields.tunnel") + "</label></td></tr>";
        html += `<tr><td><input id='${ctlPrefix}HeadlightsRequired' type='checkbox' checked='checked'/>` +
            `<label for='${ctlPrefix}HeadlightsRequired' class='wal-label'>` + I18n.t("edit.segment.fields.headlights") + "</label></td></tr>";
        html += `<tr><td><input id='${ctlPrefix}NearHOV' type='checkbox' checked='checked'/>` +
            `<label for='${ctlPrefix}NearHOV' class='wal-label'>` + I18n.t("edit.segment.fields.nearbyHOV") + "</label></td></tr>";
        html += `<tr><td><input id='${ctlPrefix}Toll' type='checkbox' checked='checked'/>` +
            `<label for='${ctlPrefix}Toll' class='wal-label'>${I18n.t("edit.segment.fields.toll_road")}</label></td></tr>`;
        html += `<tr><td><input id='${ctlPrefix}Beacons' type='checkbox' checked='checked'/>` +
            `<label for='${ctlPrefix}Beacons' class='wal-label'>` + I18n.t("edit.segment.fields.beacons") + "</label></td></tr>";
        html += `<tr><td><input id='${ctlPrefix}LaneGuidance' type='checkbox'/>` +
            `<label for='${ctlPrefix}LaneGuidance' class='wal-label'>`;
        html += `<select id='${ctlPrefix}LaneGuidanceOp' style='margin-right: 0px'>` +
            "<option value='0'>Has</option>" +
            "<option value='1'>Missing</option>" +
            "</select> Lane guidance</label></td></tr>";
        html += `<tr><td><input id='${ctlPrefix}SegmentLengthFilter' type='checkbox'/>` +
            `<label for='${ctlPrefix}SegmentLengthFilter' class='wal-label'>Segment length</label>&nbsp;` +
            `<select id='${ctlPrefix}SegmentLengthFilterOperation' style='margin-right: 0px'>` +
            `<option value='${Operation.LessThan}'>&lt;</option>` +
            `<option value='${Operation.LessThanOrEqual}'>&lt;=</option>` +
            `<option value='${Operation.GreaterThan}'>&gt;</option>` +
            `<option value='${Operation.GreaterThanOrEqual}'>&gt;=</option></select>` +
            `<input type='text' id='${ctlPrefix}SegmentLengthFilterValue' class='wal-textbox' style='width: 40px'/> ` +
            `<select id='${ctlPrefix}SegmentLengthFilterUnit' style='margin-right: 0px'>` +
            `<option value='${Unit.Metric}'>m</option>` +
            `<option value='${Unit.Imperial}'>ft</option></select>` +
            "</td></tr>";

        html += "<tr><td class='wal-heading' style='border-top: 1px solid; padding-top: 4px'>Issues (Any of these)</td></tr>";
        html += `<tr><td><input id='${ctlPrefix}NoSpeedLimit' type='checkbox'/>` +
            `<label for='${ctlPrefix}NoSpeedLimit' class='wal-label'>No speed limit</label></td></tr>`;
        html += `<tr><td><input id='${ctlPrefix}HasRestrictions' type='checkbox'/>` +
            `<label for='${ctlPrefix}HasRestrictions' class='wal-label'>Has time-based restrictions</label></td></tr>`;
        html += `<tr><td><input id='${ctlPrefix}HasTurnRestrictions' type='checkbox'/>` +
            `<label for='${ctlPrefix}HasTurnRestrictions' class='wal-label'>Has time-based turn restrictions</label></td></tr>`;
        html += `<tr><td><input id='${ctlPrefix}UnknownDirection' type='checkbox'/>` +
            `<label for='${ctlPrefix}UnknownDirection' class='wal-label'>Unknown Direction</label></td></tr>`;
        html += `<tr><td><input id='${ctlPrefix}OneWay' type='checkbox'/>` +
            `<label for='${ctlPrefix}OneWay' class='wal-label'>One way</label></td></tr>`;
        html += `<tr><td><input id='${ctlPrefix}HasRestrictedJunctionArrow' type='checkbox'/>` +
            `<label for='${ctlPrefix}HasRestrictedJunctionArrow' class='wal-label'>Has restricted junction arrow</label></td></tr>`;
        html += `<tr><td><input id='${ctlPrefix}HasUTurn' type='checkbox'/>` +
            `<label for='${ctlPrefix}HasUTurn' class='wal-label'>Has U-turn</label></td></tr>`;
        html += `<tr><td><input id='${ctlPrefix}HasSoftTurns' type='checkbox'/>` +
            `<label for='${ctlPrefix}HasSoftTurns' class='wal-label'>Has soft turns</label></td></tr>`;
        // html += `<tr><td><input id='${ctlPrefix}HasExtraJunctionNode' type='checkbox'/>` +
        //     `<label for='${ctlPrefix}HasExtraJunctionNode' class='wal-label'>Has unnecessary junction node</label></td></tr>`;
        html += `<tr><td><input id='${ctlPrefix}Elevation' type='checkbox'/>` +
            `<label for='${ctlPrefix}Elevation' class='wal-label'>Elevation</label>&nbsp;` +
            `<select id='${ctlPrefix}ElevationOperation'>` +
            `<option value='${Operation.LessThan}'>&lt;</option>` +
            `<option value='${Operation.NotEqual}'>!=</option>` +
            `<option value='${Operation.GreaterThan}'>&gt;</option>` +
            "</select>0" +
            "</td></tr>";
        html += `<tr><td><input id='${ctlPrefix}SegmentLength' type='checkbox'/>` +
            `<label for='${ctlPrefix}SegmentLength' class='wal-label'>Segment length</label>&nbsp;` +
            `<select id='${ctlPrefix}SegmentLengthOperation' style='margin-right: 0px'>` +
            `<option value='${Operation.LessThan}'>&lt;</option>` +
            `<option value='${Operation.LessThanOrEqual}'>&lt;=</option>` +
            `<option value='${Operation.GreaterThan}'>&gt;</option>` +
            `<option value='${Operation.GreaterThanOrEqual}'>&gt;=</option></select>` +
            `<input type='text' id='${ctlPrefix}SegmentLengthValue' class='wal-textbox' style='width: 40px'/> ` +
            `<select id='${ctlPrefix}SegmentLengthUnit' style='margin-right: 0px'>` +
            `<option value='${Unit.Metric}'>m</option>` +
            `<option value='${Unit.Imperial}'>ft</option></select>` +
            "</td></tr>";
        html += `<tr><td><input id='${ctlPrefix}HasNoName' type='checkbox'/>` +
            `<label for='${ctlPrefix}HasNoName' class='wal-label'>Has no name</label></td></tr>`;
        html += `<tr><td><input id='${ctlPrefix}HasNoCity' type='checkbox'/>` +
            `<label for='${ctlPrefix}HasNoCity' class='wal-label'>Has no city (primary or alt)</label></td></tr>`;
        html += `<tr><td><input id='${ctlPrefix}NoHN' type='checkbox'/>` +
            `<label for='${ctlPrefix}NoHN' class='wal-label'>Has no house numbers</label></td></tr>`;
//        html += `<tr><td><input id='${ctlPrefix}NonNeutralRoutingPreference' type='checkbox'/>` +
//            `<label for='${ctlPrefix}NonNeutralRoutingPreference' class='wal-label'>Non-neutral routing preference</label></td></tr>`;
        html += `<tr><td><input id='${ctlPrefix}Minus1RoutingPreference' type='checkbox'/>` +
            `<label for='${ctlPrefix}Minus1RoutingPreference' class='wal-label'>-1 routing preference</label></td></tr>`;
        html += `<tr><td><input id='${ctlPrefix}Plus1RoutingPreference' type='checkbox'/>` +
            `<label for='${ctlPrefix}Plus1RoutingPreference' class='wal-label'>+1 routing preference</label></td></tr>`;
        html += `<tr><td><input id='${ctlPrefix}RampWithSL' type='checkbox'/>` +
            `<label for='${ctlPrefix}RampWithSL' class='wal-label'>Ramp with speed limit</label></td></tr>`;
        html += `<tr><td><input id='${ctlPrefix}NewlyPaved' type='checkbox'/>` +
            `<label for='${ctlPrefix}NewlyPaved' class='wal-label'>Newly paved</label></td></tr>`;
        html += "</tbody></table>";

        return html;
    }

    export function TabLoaded(): void {
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
        $(`#${ctlPrefix}RoadTypeAny`).on("click", function () {
            $(`input[data-group=${ctlPrefix}RoadType]`).prop("checked", true);
        });
        $(`#${ctlPrefix}RoadTypeClear`).on("click", function () {
            $(`input[data-group=${ctlPrefix}RoadType]`).prop("checked", false);
        });
        $(`#${ctlPrefix}LoadSetting`).on("click", loadSetting);
        $(`#${ctlPrefix}SaveSetting`).on("click", saveSetting);
        $(`#${ctlPrefix}DeleteSetting`).on("click", deleteSetting);
    }

    function updateStates(): void {
        let selectState = $(`#${ctlPrefix}State`);

        // Preserve current selection
        let currentId: number = selectState.val();

        selectState.empty();

        let stateObjs: Array<IState> = [];
        stateObjs.push({id: null, name: "" });

        for (let s in W.model.states.objects) {
            if (W.model.states.objects.hasOwnProperty(s)) {
                let st = W.model.states.getObjectById(parseInt(s));
                if (st.id !== 1 && st.name !== "") {
                    stateObjs.push({ id: st.id, name: st.name });
                }
            }
        }

        stateObjs.sort(function (a, b) {
            if (a.id == null) {
                return -1;
            } else {
                return a.name.localeCompare(b.name);
            }
        });

        for (let ix = 0; ix < stateObjs.length; ix++) {
            let so = stateObjs[ix];
            let stateOption = $("<option/>").text(so.name).attr("value", so.id);

            if (currentId != null && so.id == null) {
                stateOption.attr("selected", "selected");
            }
            selectState.append(stateOption);
        }
    }

    function updateUsers(selectUsernameList: JQuery): void {
        // Preserve current selection
        let currentId: number = parseInt(selectUsernameList.val());

        selectUsernameList.empty();

        let userObjs: Array<IUser> = [];
        userObjs.push({id: null, name: "" });

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
            } else {
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

    function updateSavedSettingsList(): void {
        let s = $(`#${ctlPrefix}SavedSettings`);

        s.empty();

        for (let ixSaved = 0; ixSaved < savedSettings.length; ixSaved++) {
            let opt = $("<option/>").attr("value", ixSaved).text(savedSettings[ixSaved].Name);
            s.append(opt);
        }
    }

    function updateUI(): void {
        // $(`#${ctlPrefix}OutputTo`).val(settings.OutputTo);
        $(`#${ctlPrefix}IncludeAlt`).prop("checked", settings.IncludeAltNames);
        $(`#${ctlPrefix}IncludeASC`).prop("checked", settings.IncludeASC);
        $(`#${ctlPrefix}LockLevel`).val(settings.LockLevel);
        $(`#${ctlPrefix}LockLevelOp`).val(settings.LockLevelOperation || Operation.Equal.toString());
        $(`#${ctlPrefix}Name`).val(settings.Regex ?? "");
        $(`#${ctlPrefix}IgnoreCase`).prop("checked", settings.RegexIgnoreCase);
        $(`#${ctlPrefix}City`).val(settings.CityRegex ?? "");
        $(`#${ctlPrefix}CityIgnoreCase`).prop("checked", settings.CityRegexIgnoreCase);
        $(`#${ctlPrefix}State`).val(settings.State);
        $(`#${ctlPrefix}StateOp`).val(settings.StateOperation || Operation.Equal.toString());
        $(`#${ctlPrefix}RoadTypeFreeway`).prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.Freeway);
        $(`#${ctlPrefix}RoadTypeRamp`).prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.Ramp);
        $(`#${ctlPrefix}RoadTypeMajorHighway`).prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.MajorHighway);
        $(`#${ctlPrefix}RoadTypeMinorHighway`).prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.MinorHighway);
        $(`#${ctlPrefix}RoadTypePrimary`).prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.PrimaryStreet);
        $(`#${ctlPrefix}RoadTypeStreet`).prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.Street);
        $(`#${ctlPrefix}RoadTypeAlley`).prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.Alley);
        $(`#${ctlPrefix}RoadTypeUnpaved`).prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.Unpaved);
        $(`#${ctlPrefix}RoadTypePLR`).prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.ParkingLotRoad);
        $(`#${ctlPrefix}RoadTypePrivate`).prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.PrivateRoad);
        $(`#${ctlPrefix}RoadTypeFerry`).prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.Ferry);
        $(`#${ctlPrefix}RoadTypeWT`).prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.WalkingTrail);
        $(`#${ctlPrefix}RoadTypePB`).prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.PedestrianBoardwalk);
        $(`#${ctlPrefix}RoadTypeStairway`).prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.Stairway);
        $(`#${ctlPrefix}RoadTypeRR`).prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.Railroad);
        $(`#${ctlPrefix}RoadTypeRT`).prop("checked", settings.RoadTypeMask & WMEWAL.RoadType.RunwayTaxiway);
        $(`#${ctlPrefix}Editable`).prop("checked", settings.EditableByMe);
        $(`#${ctlPrefix}NoSpeedLimit`).prop("checked", settings.NoSpeedLimit);
        $(`#${ctlPrefix}Roundabouts`).prop("checked", settings.Roundabouts);
        $(`#${ctlPrefix}RoundaboutsOp`).val(settings.RoundaboutsOperation);
        $(`#${ctlPrefix}ExcludeJunctionBoxes`).prop("checked", settings.ExcludeJunctionBoxes);
        $(`#${ctlPrefix}Direction`).val(settings.Direction);
        $(`#${ctlPrefix}UnknownDirection`).prop("checked", settings.UnknownDirection);
        $(`#${ctlPrefix}HasRestrictions`).prop("checked", settings.HasTimeBasedRestrictions);
        $(`#${ctlPrefix}HasTurnRestrictions`).prop("checked", settings.HasTimeBasedTurnRestrictions);
        $(`#${ctlPrefix}HasRestrictedJunctionArrow`).prop("checked", settings.HasRestrictedJunctionArrow);
        $(`#${ctlPrefix}HasUTurn`).prop("checked", settings.HasUTurn);
        $(`#${ctlPrefix}HasSoftTurns`).prop("checked", settings.HasSoftTurns);
        // $(`#${ctlPrefix}HasExtraJunctionNode`).prop("checked", settings.HasUnnecessaryJunctionNode);
        $(`#${ctlPrefix}Elevation`).prop("checked", settings.Elevation);
        $(`#${ctlPrefix}ElevationOperation`).val(settings.ElevationOperation || Operation.LessThan.toString());
        $(`#${ctlPrefix}SegmentLength`).prop("checked", settings.SegmentLength);
        $(`#${ctlPrefix}SegmentLengthOperation`).val(settings.SegmentLengthOperation || Operation.LessThan.toString());
        $(`#${ctlPrefix}SegmentLengthValue`).val(settings.SegmentLengthValue ?? "");
        $(`#${ctlPrefix}SegmentLengthUnit`).val(settings.SegmentLengthUnit || Unit.Metric.toString());
        $(`#${ctlPrefix}LastModifiedBy`).val(settings.LastModifiedBy);
        $(`#${ctlPrefix}HasNoName`).prop("checked", settings.HasNoName);
        $(`#${ctlPrefix}HasNoCity`).prop("checked", settings.HasNoCity);
        $(`#${ctlPrefix}NoHN`).prop("checked", settings.NoHN);
        // $(`#${ctlPrefix}NonNeutralRoutingPreference`).prop("checked", settings.NonNeutralRoutingPreference);
        $(`#${ctlPrefix}Minus1RoutingPreference`).prop("checked", settings.Minus1RoutingPreference);
        $(`#${ctlPrefix}Plus1RoutingPreference`).prop("checked", settings.Plus1RoutingPreference);
        $(`#${ctlPrefix}RampWithSL`).prop("checked", settings.RampWithSL);
        $(`#${ctlPrefix}Unpaved`).prop("checked", settings.Unpaved);
        $(`#${ctlPrefix}Tunnel`).prop("checked", settings.Tunnel);
        $(`#${ctlPrefix}HeadlightsRequired`).prop("checked", settings.HeadlightsRequired);
        $(`#${ctlPrefix}NearHOV`).prop("checked", settings.NearHOV);
        $(`#${ctlPrefix}Toll`).prop("checked", settings.Toll);
        $(`#${ctlPrefix}Beacons`).prop("checked", settings.Beacons);
        $(`#${ctlPrefix}CreatedBy`).val(settings.CreatedBy);
        $(`#${ctlPrefix}LaneGuidance`).prop("checked", settings.LaneGuidance);
        $(`#${ctlPrefix}LaneGuidanceOp`).val(settings.LaneGuidanceOperation);
        $(`#${ctlPrefix}Created`).prop("checked", settings.Created);
        $(`#${ctlPrefix}CreatedOp`).val(settings.CreatedOperation);
        if (settings.CreatedDate != null) {
            let createdDateTime = new Date(settings.CreatedDate);
            $(`#${ctlPrefix}CreatedDate`).val(createdDateTime.getFullYear().toString().padStart(4, "0") + "-" +
                (createdDateTime.getMonth() + 1).toString().padStart(2, "0") + "-" + createdDateTime.getDate().toString().padStart(2, "0"));
            $(`#${ctlPrefix}CreatedTime`).val(createdDateTime.getHours().toString().padStart(2, "0") + ":" +
                createdDateTime.getMinutes().toString().padStart(2, "0"));
        } else {
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
        } else {
            $(`#${ctlPrefix}UpdatedDate`).val("");
            $(`#${ctlPrefix}UpdatedTime`).val("");
        }
        $(`#${ctlPrefix}NewlyPaved`).prop("checked", settings.NewlyPaved);
        $(`#${ctlPrefix}SegmentLengthFilter`).prop("checked", settings.SegmentLengthFilter);
        $(`#${ctlPrefix}SegmentLengthFilterOperation`).val(settings.SegmentLengthFilterOperation || Operation.LessThan.toString());
        $(`#${ctlPrefix}SegmentLengthFilterValue`).val(settings.SegmentLengthFilterValue ?? "");
        $(`#${ctlPrefix}SegmentLengthFilterUnit`).val(settings.SegmentLengthFilterUnit || Unit.Metric.toString());
        $(`#${ctlPrefix}OneWay`).prop("checked", settings.OneWay);
    }

    function loadSetting(): void {
        let selectedSetting = parseInt($(`#${ctlPrefix}SavedSettings`).val());
        if (selectedSetting == null || isNaN(selectedSetting) || selectedSetting < 0 || selectedSetting > savedSettings.length) {
            return;
        }

        initSettings();
        let savedSetting = savedSettings[selectedSetting].Setting;
        for (let name in savedSetting) {
            if (settings.hasOwnProperty(name)) {
                settings[name] = savedSetting[name];
            }
        }
        updateProperties();
        updateUI();
    }

    function validateSettings(): boolean {
        function addMessage(error:string): void {
            message += ((message.length > 0 ? "\n" : "") + error);
        }

        let message = "";

        let s = getSettings();

        if (s.RoadTypeMask === 0) {
            addMessage("Please select at least one road type");
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

        let r: RegExp;
        if (nullif(s.Regex, "") !== null) {
            try {
                r = (s.RegexIgnoreCase ? new RegExp(s.Regex, "i") : new RegExp(s.Regex));
            } catch (error) {
                addMessage("Name RegEx is invalid");
            }
        }

        if (nullif(s.CityRegex, "")) {
            try {
                r = (s.CityRegexIgnoreCase ? new RegExp(s.CityRegex, "i") : new RegExp(s.CityRegex));
            } catch (error) {
                addMessage("City RegEx is invalid");
            }
        }

        if (s.SegmentLength) {
            let val = $(`#${ctlPrefix}SegmentLengthValue`).val();
            let numVal = parseInt(val);
            if (isNaN(numVal) || val.trim() !== numVal.toString()) {
                addMessage("Invalid segment length (issue)");
            }
        }

        if (s.SegmentLengthFilter) {
            let val = $(`#${ctlPrefix}SegmentLengthFilterValue`).val();
            let numVal = parseInt(val);
            if (isNaN(numVal) || val.trim() !== numVal.toString()) {
                addMessage("Invalid segment length (filter)");
            }
        }

        if (s.RampWithSL && !(s.RoadTypeMask & WMEWAL.RoadType.Ramp)) {
            addMessage("If checking for ramps with SL, the Ramp road type needs to be checked");
        }

        if (s.Created && s.CreatedDate === null) {
            addMessage("Select a created date on which to filter");
        }

        if (s.Updated && s.UpdatedDate === null) {
            addMessage("Select an updated date on which to filter");
        }

        if (message.length > 0) {
            alert(pluginName + ": " + message);
            return false;
        }

        return true;
    }

    function saveSetting(): void {
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
                    } else {
                        alert("Please pick a new name.");
                    }
                    return;
                }
            }

            let savedSetting: ISavedSetting = {
                Name: sName,
                Setting: s
            };

            savedSettings.push(savedSetting);
            updateSavedSettings();
        }
    }

    function getSettings(): ISaveableSettings {
        let s: ISaveableSettings = {
            RoadTypeMask: 0,
            State: null,
            StateOperation: parseInt($(`#${ctlPrefix}StateOp`).val()),
            LockLevel: null,
            LockLevelOperation: parseInt($(`#${ctlPrefix}LockLevelOp`).val()),
            Regex: null,
            RegexIgnoreCase: $(`#${ctlPrefix}IgnoreCase`).prop("checked"),
            ExcludeJunctionBoxes: $(`#${ctlPrefix}ExcludeJunctionBoxes`).prop("checked"),
            Roundabouts: $(`#${ctlPrefix}Roundabouts`).prop("checked"),
            RoundaboutsOperation: parseInt($(`#${ctlPrefix}RoundaboutsOp`).val()),
            EditableByMe: $(`#${ctlPrefix}Editable`).prop("checked"),
            NoSpeedLimit: $(`#${ctlPrefix}NoSpeedLimit`).prop("checked"),
            IncludeAltNames: $(`#${ctlPrefix}IncludeAlt`).prop("checked"),
            IncludeASC: $(`#${ctlPrefix}IncludeASC`).prop("checked"),
            Direction: null,
            CityRegex: null,
            CityRegexIgnoreCase: $(`#${ctlPrefix}CityIgnoreCase`).prop("checked"),
            HasTimeBasedRestrictions: $(`#${ctlPrefix}HasRestrictions`).prop("checked"),
            HasTimeBasedTurnRestrictions: $(`#${ctlPrefix}HasTurnRestrictions`).prop("checked"),
            HasRestrictedJunctionArrow: $(`#${ctlPrefix}HasRestrictedJunctionArrow`).prop("checked"),
            UnknownDirection: $(`#${ctlPrefix}UnknownDirection`).prop("checked"),
            HasUTurn: $(`#${ctlPrefix}HasUTurn`).prop("checked"),
            HasSoftTurns: $(`#${ctlPrefix}HasSoftTurns`).prop("checked"),
            HasUnnecessaryJunctionNode: false,
            // HasUnnecessaryJunctionNode: $(`#${ctlPrefix}HasExtraJunctionNode`).prop("checked"),
            Elevation: $(`#${ctlPrefix}Elevation`).prop("checked"),
            ElevationOperation: parseInt($(`#${ctlPrefix}ElevationOperation`).val()),
            SegmentLength: $(`#${ctlPrefix}SegmentLength`).prop("checked"),
            SegmentLengthOperation: parseInt($(`#${ctlPrefix}SegmentLengthOperation`).val()),
            SegmentLengthValue: null,
            SegmentLengthUnit: parseInt($(`#${ctlPrefix}SegmentLengthUnit`).val()),
            LastModifiedBy: null,
            HasNoName: $(`#${ctlPrefix}HasNoName`).prop("checked"),
            HasNoCity: $(`#${ctlPrefix}HasNoCity`).prop("checked"),
            NoHN: $(`#${ctlPrefix}NoHN`).prop("checked"),
            // NonNeutralRoutingPreference: $(`#${ctlPrefix}NonNeutralRoutingPreference`).prop("checked"),
            NonNeutralRoutingPreference: null,
            RampWithSL: $(`#${ctlPrefix}RampWithSL`).prop("checked"),
            Unpaved: $(`#${ctlPrefix}Unpaved`).prop("checked"),
            Tunnel: $(`#${ctlPrefix}Tunnel`).prop("checked"),
            HeadlightsRequired: $(`#${ctlPrefix}HeadlightsRequired`).prop("checked"),
            NearHOV: $(`#${ctlPrefix}NearHOV`).prop("checked"),
            Toll: $(`#${ctlPrefix}Toll`).prop("checked"),
            Beacons: $(`#${ctlPrefix}Beacons`).prop("checked"),
            CreatedBy: null,
            LaneGuidance: $(`#${ctlPrefix}LaneGuidance`).prop("checked"),
            LaneGuidanceOperation: $(`#${ctlPrefix}LaneGuidanceOp`).val(),
            Created: $(`#${ctlPrefix}Created`).prop("checked"),
            CreatedOperation: parseInt($(`#${ctlPrefix}CreatedOp`).val()),
            CreatedDate: null,
            Updated: $(`#${ctlPrefix}Updated`).prop("checked"),
            UpdatedOperation: parseInt($(`#${ctlPrefix}UpdatedOp`).val()),
            UpdatedDate: null,
            Minus1RoutingPreference: $(`#${ctlPrefix}Minus1RoutingPreference`).prop("checked"),
            Plus1RoutingPreference: $(`#${ctlPrefix}Plus1RoutingPreference`).prop("checked"),
            NewlyPaved: $(`#${ctlPrefix}NewlyPaved`).prop("checked"),
            SegmentLengthFilter: $(`#${ctlPrefix}SegmentLengthFilter`).prop("checked"),
            SegmentLengthFilterOperation: parseInt($(`#${ctlPrefix}SegmentLengthFilterOperation`).val()),
            SegmentLengthFilterValue: null,
            SegmentLengthFilterUnit: parseInt($(`#${ctlPrefix}SegmentLengthFilterUnit`).val()),
            OneWay: $(`#${ctlPrefix}OneWay`).prop('checked')
        };

        $(`input[data-group=${ctlPrefix}RoadType]:checked`).each(function (ix, e) {
            s.RoadTypeMask = s.RoadTypeMask | parseInt((<HTMLInputElement> e).value);
        });

        let selectedState: string = $(`#${ctlPrefix}State`).val();
        if (nullif(selectedState, "") !== null) {
            let state = W.model.states.getObjectById(parseInt(selectedState));
            if (state != null) {
                s.State = state.getID();
            }
        }

        let selectedUpdateUser: string = $(`#${ctlPrefix}LastModifiedBy`).val();
        if (nullif(selectedUpdateUser, "") !== null) {
            let u = W.model.users.getObjectById(parseInt(selectedUpdateUser));
            if (u != null) {
                s.LastModifiedBy = u.id;
            }
        }

        let selectedCreateUser: string = $(`#${ctlPrefix}CreatedBy`).val();
        if (nullif(selectedCreateUser, "") !== null) {
            let u = W.model.users.getObjectById(parseInt(selectedCreateUser));
            if (u != null) {
                s.CreatedBy = u.id;
            }
        }

        let pattern = $(`#${ctlPrefix}Name`).val();
        if (nullif(pattern, "") !== null) {
            s.Regex = pattern;
        }

        pattern = $(`#${ctlPrefix}City`).val();
        if (nullif(pattern, "") !== null) {
            s.CityRegex = pattern;
        }

        let selectedLockLevel: string = $(`#${ctlPrefix}LockLevel`).val();
        if (selectedLockLevel != null && selectedLockLevel.length > 0) {
            s.LockLevel = parseInt(selectedLockLevel);
        }

        let selectedDirection: string = $(`#${ctlPrefix}Direction`).val();
        if (selectedDirection != null && selectedDirection.length > 0) {
            s.Direction = parseInt(selectedDirection);
        }

        let segmentLengthValue = $(`#${ctlPrefix}SegmentLengthValue`).val();
        if (segmentLengthValue != null && segmentLengthValue.length > 0 && !isNaN(parseInt(segmentLengthValue))) {
            s.SegmentLengthValue = parseInt(segmentLengthValue);
        }

        segmentLengthValue = $(`#${ctlPrefix}SegmentLengthFilterValue`).val();
        if (segmentLengthValue != null && segmentLengthValue.length > 0 && !isNaN(parseInt(segmentLengthValue))) {
            s.SegmentLengthFilterValue = parseInt(segmentLengthValue);
        }

        let createdDate: string = $(`#${ctlPrefix}CreatedDate`).val();
        if (nullif(createdDate, "") !== null) {
            let createdTime: string = $(`#${ctlPrefix}CreatedTime`).val();
            if (createdTime && createdTime.length > 0) {
                createdDate += ` ${createdTime}`;
            } else {
                createdDate += ' 00:00';
            }
            s.CreatedDate = (new Date(createdDate)).getTime();
        }

        let updatedDate: string = $(`#${ctlPrefix}UpdatedDate`).val();
        if (nullif(updatedDate, "") !== null) {
            let updatedTime: string = $(`#${ctlPrefix}UpdatedTime`).val();
            if (updatedTime && updatedTime.length > 0) {
                updatedDate += ` ${updatedTime}`;
            } else {
                updatedDate += ' 00:00';
            }
            s.UpdatedDate = (new Date(updatedDate)).getTime();
        }

        return s;
    }

    function deleteSetting(): void {
        let selectedSetting = parseInt($(`#${ctlPrefix}SavedSettings`).val());
        if (selectedSetting == null || isNaN(selectedSetting) || selectedSetting < 0 || selectedSetting > savedSettings.length) {
            return;
        }

        if (confirm("Are you sure you want to delete this saved setting?")) {
            savedSettings.splice(selectedSetting, 1);

            updateSavedSettings();
        }
    }

    export function ScanStarted(): boolean {
        streets = [];
        roundabouts = [];
        savedSegments = [];

        let allOk = validateSettings();
        if (allOk) {
            settings = getSettings();

            if (settings.State !== null) {
                state = W.model.states.getObjectById(settings.State);
                stateName = state.name;
            } else {
                state = null;
                stateName = null;
            }

            if (settings.LastModifiedBy !== null) {
                lastModifiedBy = W.model.users.getObjectById(settings.LastModifiedBy);
                lastModifiedByName = lastModifiedBy.userName;
            } else {
                lastModifiedBy = null;
                lastModifiedByName = null;
            }

            if (settings.CreatedBy !== null) {
                createdBy = W.model.users.getObjectById(settings.CreatedBy);
                createdByName = createdBy.userName;
            } else {
                createdBy = null;
                createdByName = null;
            }

            if (settings.Regex !== null) {
                nameRegex = (settings.RegexIgnoreCase ? new RegExp(settings.Regex, "i") : new RegExp(settings.Regex));
            } else {
                nameRegex = null;
            }

            if (settings.CityRegex !== null) {
                cityRegex = (settings.CityRegexIgnoreCase ? new RegExp(settings.CityRegex, "i") : new RegExp(settings.CityRegex));
            } else {
                cityRegex = null;
            }

            if (settings.RoadTypeMask & ~(WMEWAL.RoadType.Freeway | WMEWAL.RoadType.MajorHighway | WMEWAL.RoadType.MinorHighway | WMEWAL.RoadType.PrimaryStreet)) {
                MinimumZoomLevel = 4;
            } else {
                MinimumZoomLevel = 2;
            }

            segmentLengthFilterMultipier = settings.SegmentLengthFilter ? (settings.SegmentLengthFilterUnit == Unit.Metric ? 1.0 : mToFt) : 0.0;
            segmentLengthMultiplier = settings.SegmentLength ? (settings.SegmentLengthUnit == Unit.Metric ? 1.0 : mToFt) : 0.0;

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
//                || settings.NonNeutralRoutingPreference
                || settings.NoHN
                || settings.RampWithSL
                || settings.Minus1RoutingPreference
                || settings.Plus1RoutingPreference
                || settings.NewlyPaved
                || settings.OneWay;

            updateSettings();
        }
        return allOk;
    }

    export function ScanExtent(segments: Array<WazeNS.Model.Object.Segment>, venues: Array<WazeNS.Model.Object.Venue>): Promise<void> {
        return new Promise(resolve => {
            setTimeout(function () {
                scan(segments, venues);
                resolve();
            }, 0);
        });
    }

    function scan(segments: Array<WazeNS.Model.Object.Segment>, venues: Array<WazeNS.Model.Object.Venue>): void {
        let extentStreets: Array<IStreet> = [];
        let segment: WazeNS.Model.Object.Segment;

        function determineDirection(s: WazeNS.Model.Object.Segment): Direction {
            return (s.attributes.fwdDirection ? (s.attributes.revDirection ? Direction.TwoWay : Direction.OneWay) : (s.attributes.revDirection ? Direction.OneWay : Direction.Unknown));
        }

        function addSegment(s: WazeNS.Model.Object.Segment, rId: number, issues: number, newSegment: boolean): void {
            // Don't add this segment if we've already scanned it
            if (savedSegments.indexOf(s.getID()) === -1 ) {
                savedSegments.push(s.getID());
                let sid = s.attributes.primaryStreetID;
                let lastEditorID = s.attributes.updatedBy || s.attributes.createdBy;
                let lastEditor = W.model.users.getObjectById(lastEditorID) || {userName: 'Not found'};
                let createdEditorID = s.attributes.createdBy;
                let createdEditor = W.model.users.getObjectById(createdEditorID) || {userName: 'Not found'};
                let address = s.getAddress();
                let thisStreet: IStreet = null;
                if (sid != null && !newSegment) {
                    thisStreet = extentStreets.find(function (e) {
                        let matches = (e.id === sid && (e.lockLevel === (s.attributes.lockRank | 0) + 1) && e.roundaboutId === rId &&
                            e.roadType === s.attributes.roadType && e.issues === issues && e.lastEditor === lastEditor.userName &&
                            e.createdEditor === createdEditor.userName);
                        if (matches && (nameRegex != null || cityRegex != null || settings.IncludeAltNames)) {
                            // Test for alt names
                            for (let ixAlt = 0; ixAlt < e.altStreets.length && matches; ixAlt++) {
                                matches = false;
                                for (let ixSegAlt = 0; ixSegAlt < s.attributes.streetIDs.length && !matches; ixSegAlt++) {
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
                        geometries: new OpenLayers.Geometry.Collection(),
                        lockLevel: (s.attributes.lockRank || 0) + 1,
                        segments: [],
                        roundaboutId: rId,
                        altStreets: [],
                        roadType: s.attributes.roadType,
                        direction: determineDirection(s),
                        issues: issues,
                        length: s.attributes.length * (isImperial ? mToFt : 1.0),
                        lastEditor: lastEditor.userName,
                        asc: (s.getFlagAttribute('fwdSpeedCamera') || s.getFlagAttribute('revSpeedCamera') ? 'Yes' : 'No'),
                        createdEditor: (createdEditor && createdEditor.userName) || ""
                    };

                    if (nameRegex != null || settings.IncludeAltNames) {
                        if (s.attributes.streetIDs != null) {
                            for (let ixAlt = 0; ixAlt < s.attributes.streetIDs.length; ixAlt++) {
                                if (s.attributes.streetIDs[ixAlt] != null) {
                                    let altStreet = W.model.streets.getObjectById(s.attributes.streetIDs[ixAlt]);
                                    if (altStreet != null) {
                                        let altCityName: string = null;
                                        if (altStreet.cityID != null) {
                                            let altCity = W.model.cities.getObjectById(altStreet.cityID);
                                            if (altCity != null) {
                                                altCityName = altCity.hasName() ? altCity.attributes.name : "No city";
                                            }
                                        }
                                        thisStreet.altStreets.push({
                                            id: s.attributes.streetIDs[ixAlt],
                                            name: altStreet.name,
                                            city: altCityName
                                        });
                                    }
                                }
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

        }

        let graph = W.model.getTurnGraph();

        for (let ix = 0; ix < segments.length; ix++) {
            segment = segments[ix];
            if (segment != null) {
                let attr = segment.getFlagAttributes();

                if ((WMEWAL.WazeRoadTypeToRoadTypeBitmask(segment.attributes.roadType) & settings.RoadTypeMask) &&
                    (settings.LockLevel == null ||
                        (settings.LockLevelOperation === Operation.Equal && (segment.attributes.lockRank || 0) + 1 === settings.LockLevel) ||
                        (settings.LockLevelOperation === Operation.NotEqual && (segment.attributes.lockRank || 0) + 1 !== settings.LockLevel)) &&
                    (!settings.EditableByMe || segment.arePropertiesEditable()) &&
                    (!settings.ExcludeJunctionBoxes || !segment.isInBigJunction()) &&
                    (settings.Direction == null || determineDirection(segment) === settings.Direction) &&
                    (!settings.Unpaved || attr.unpaved) &&
                    (!settings.Tunnel || attr.tunnel) &&
                    (!settings.HeadlightsRequired || attr.headlights) &&
                    (!settings.NearHOV || attr.nearbyHOV) &&
                    (!settings.Beacons || attr.beacons) &&
                    (!settings.Toll || segment.isTollRoad()) &&
                    (!settings.LaneGuidance || (settings.LaneGuidanceOperation === 0 && segment.isLanesEnabled()) || (settings.LaneGuidanceOperation === 1 && !segment.isLanesEnabled())) &&
                    (!settings.Created ||
                        (settings.CreatedOperation === Operation.LessThan && segment.attributes.createdOn < settings.CreatedDate) ||
                        (settings.CreatedOperation === Operation.LessThanOrEqual && segment.attributes.createdOn <= settings.CreatedDate) ||
                        (settings.CreatedOperation === Operation.GreaterThan && segment.attributes.createdOn > settings.CreatedDate) ||
                        (settings.CreatedOperation === Operation.GreaterThanOrEqual && segment.attributes.createdOn >= settings.CreatedDate)) &&
                    (!settings.Updated ||
                        (settings.UpdatedOperation === Operation.LessThan && segment.attributes.updatedOn < settings.UpdatedDate) ||
                        (settings.UpdatedOperation === Operation.LessThanOrEqual && segment.attributes.updatedOn <= settings.UpdatedDate) ||
                        (settings.UpdatedOperation === Operation.GreaterThan && segment.attributes.updatedOn > settings.UpdatedDate) ||
                        (settings.UpdatedOperation === Operation.GreaterThanOrEqual && segment.attributes.updatedOn >= settings.UpdatedDate)) &&
                    (!settings.SegmentLengthFilter ||
                        (settings.SegmentLengthFilterOperation === Operation.LessThan && (segment.attributes.length * segmentLengthFilterMultipier) < settings.SegmentLengthFilterValue) ||
                        (settings.SegmentLengthFilterOperation === Operation.LessThanOrEqual && (segment.attributes.length * segmentLengthFilterMultipier) <= settings.SegmentLengthFilterValue) ||
                        (settings.SegmentLengthFilterOperation === Operation.GreaterThan && (segment.attributes.length * segmentLengthFilterMultipier) > settings.SegmentLengthFilterValue) ||
                        (settings.SegmentLengthFilterOperation === Operation.GreaterThanOrEqual && (segment.attributes.length * segmentLengthFilterMultipier) >= settings.SegmentLengthFilterValue))) {

                    let issues = 0;
                    let newSegment = false;
                    let address = segment.getAddress();
                    if (state != null) {
                        if (address != null && address.attributes != null && !address.attributes.isEmpty && address.attributes.state != null) {
                            if (settings.StateOperation === Operation.Equal && address.attributes.state.id !== state.id ||
                                settings.StateOperation === Operation.NotEqual && address.attributes.state.id === state.id) {
                                    continue;
                            }

                        } else if (settings.StateOperation === Operation.Equal) {
                            continue;
                        }
                    }

                    if (settings.LastModifiedBy != null) {
                        if (segment.attributes.updatedBy != null) {
                            if (segment.attributes.updatedBy !== settings.LastModifiedBy) {
                                continue;
                            }
                        } else if (segment.attributes.createdBy !== settings.LastModifiedBy) {
                            continue;
                        }
                    }

                    if (settings.CreatedBy != null) {
                        if (segment.attributes.createdBy !== settings.CreatedBy) {
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
                        let directions = ["from", "to"];
                        let hasTurnRestrictions = false;
                        for (let ixDir = 0; ixDir < directions.length && !hasTurnRestrictions; ixDir++) {
                            let node = segment.getNodeByDirection(directions[ixDir]);
                            let connSegments = segment.getConnectedSegmentsByDirection(directions[ixDir]);
                            for (let ixConn = 0; ixConn < connSegments.length && !hasTurnRestrictions; ixConn++) {
                                let turn = graph.getTurnThroughNode(node, segment, connSegments[ixConn]);
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
                        let directions = ["from", "to"];
                        let hasRestrictedTurns = false;
                        for (let ixDir = 0; ixDir < directions.length && !hasRestrictedTurns; ixDir++) {
                            let node = segment.getNodeByDirection(directions[ixDir]);
                            if (node) {
                                let keys = node.allConnectionKeys();
                                for (let ixLegal = 0; ixLegal < keys.legal.length && !hasRestrictedTurns; ixLegal++) {
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

                    if (settings.UnknownDirection && determineDirection(segment) === Direction.Unknown ) {
                        issues = issues | Issue.UnknownDirection;
                        newSegment = true;
                    }

                    if (settings.OneWay && determineDirection(segment) == Direction.OneWay) {
                        issues |= Issue.OneWay;
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
                        if ((settings.ElevationOperation  === Operation.LessThan && segment.attributes.level < 0) ||
                            (settings.ElevationOperation === Operation.GreaterThan && segment.attributes.level > 0) ||
                            (settings.ElevationOperation === Operation.NotEqual && segment.attributes.level !== 0)) {
                            issues = issues | Issue.Elevation;
                        }
                    }

                    if (settings.SegmentLength) {
                        if ((settings.SegmentLengthOperation === Operation.LessThan && (segment.attributes.length * segmentLengthMultiplier) < settings.SegmentLengthValue) ||
                            (settings.SegmentLengthOperation === Operation.LessThanOrEqual && (segment.attributes.length * segmentLengthMultiplier) <= settings.SegmentLengthValue) ||
                            (settings.SegmentLengthOperation === Operation.GreaterThan && (segment.attributes.length * segmentLengthMultiplier) > settings.SegmentLengthValue) ||
                            (settings.SegmentLengthOperation === Operation.GreaterThanOrEqual && (segment.attributes.length * segmentLengthMultiplier) >= settings.SegmentLengthValue)) {
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
                        let noCity = true;
                        if (address && !address.isEmpty() && !address.getCity().isEmpty() && address.getCity().hasName()) {
                            noCity = false;
                        } else {
                            if (segment.attributes.streetIDs != null) {
                                for (let ixAlt = 0; ixAlt < segment.attributes.streetIDs.length; ixAlt++) {
                                    if (segment.attributes.streetIDs[ixAlt] != null) {
                                        let altStreet = W.model.streets.getObjectById(segment.attributes.streetIDs[ixAlt]);
                                        if (altStreet != null && altStreet.cityID != null) {
                                            let altCity = W.model.cities.getObjectById(altStreet.cityID);
                                            if (altCity != null && !altCity.isEmpty() && altCity.hasName()) {
                                                noCity = false;
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        if (noCity) {
                            issues = issues | Issue.NoCity;
                        }
                    }

                    if ((settings.Minus1RoutingPreference || settings.Plus1RoutingPreference) && segment.attributes.routingRoadType !== null) {
                        let originalRoutingPreference = WMEWAL.WazeRoadTypeToRoutingPreference(segment.attributes.roadType);
                        let routingRoadTypePreference = WMEWAL.WazeRoadTypeToRoutingPreference(segment.attributes.routingRoadType);
                        if (settings.Minus1RoutingPreference && originalRoutingPreference > routingRoadTypePreference) {
                            issues = issues | Issue.Minus1RoutingPreference;
                        }
                        if (settings.Plus1RoutingPreference && originalRoutingPreference < routingRoadTypePreference) {
                            issues = issues | Issue.Plus1RoutingPreference;
                        }
                        // if (segment.attributes.routingRoadType != null && segment.attributes.routingRoadType != segment.attributes.roadType) {
                        //     issues = issues | Issue.RoutingPreference;
                        // }
                    }

                    if (settings.NoHN && !segment.attributes.hasHNs) {
                        issues = issues | Issue.NoHN;
                    }

                    if (settings.RampWithSL && WMEWAL.WazeRoadTypeToRoadTypeBitmask(segment.attributes.roadType) == WMEWAL.RoadType.Ramp &&
                        ((segment.attributes.fwdDirection && segment.attributes.fwdMaxSpeed != null) ||
                        (segment.attributes.revDirection && segment.attributes.revMaxSpeed != null))) {
                        issues = issues | Issue.RampWithSL;
                    }

                    if (settings.NewlyPaved && !segment.attributes.validated) {
                        issues |= Issue.NewlyPaved;
                    }

                    if (detectIssues && issues === 0) {
                        // If at least one issue was chosen and this segment doesn't have any issues, then skip it
                        continue;
                    }

                    if (nameRegex != null || cityRegex != null) {
                        let nameMatched = false;
                        if (address != null && address.attributes != null && !address.attributes.isEmpty) {
                            if (nameRegex != null && address.attributes.street != null && !address.attributes.street.isEmpty) {
                                nameMatched = nameRegex.test(address.attributes.street.name);
                            }
                            if (!nameMatched && cityRegex != null && address.attributes.city != null && address.attributes.city.hasName()) {
                                nameMatched = cityRegex.test(address.attributes.city.attributes.name);
                            }
                            if (!nameMatched && segment.attributes.streetIDs != null && segment.attributes.streetIDs.length > 0) {
                                for (let streetIx = 0; streetIx < segment.attributes.streetIDs.length && !nameMatched; streetIx++) {
                                    if (segment.attributes.streetIDs[streetIx] != null) {
                                        let street = W.model.streets.getObjectById(segment.attributes.streetIDs[streetIx]);
                                        if (street != null) {
                                            if (nameRegex != null) {
                                                nameMatched = nameRegex.test(street.name);
                                            }
                                            if (!nameMatched && cityRegex != null && street.cityID != null) {
                                                let city = W.model.cities.getObjectById(street.cityID);
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

                    if (!settings.Roundabouts) {
                        addSegment(segment, (!segment.isInRoundabout() ? null : segment.getRoundabout().attributes.id), issues, newSegment);
                    }
                    else if (!segment.isInRoundabout() && settings.RoundaboutsOperation === 0) {
                        addSegment(segment, null, issues, newSegment);
                    }
                    else if (segment.isInRoundabout() && settings.RoundaboutsOperation === 1) {
                        let r = segment.getRoundabout().attributes;
                        addSegment(segment, r.id, issues, newSegment);
                    }
                }
            }
        }

        for (let ix = 0; ix < extentStreets.length; ix++) {
            extentStreets[ix].center = extentStreets[ix].geometries.getCentroid(true);
            delete extentStreets[ix].geometries;
            streets.push(extentStreets[ix]);
        }
    }

    function translateDirection(d: Direction): string {
        switch (d) {
            case Direction.OneWay:
                return "One way";
            case Direction.TwoWay:
                return "Two way";
            default:
                return "Unknown";
        }
    }

    export function ScanComplete(): void {
        roundabouts = null;
        if (streets.length === 0) {
            alert(pluginName + ": No streets found.");
        } else {
            streets.sort(function (a, b) {
                let cmp = getStreetName(a).localeCompare(getStreetName(b));
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
                } else if (a.lockLevel > b.lockLevel) {
                    return 1;
                }
                return 0;
            });

            let isCSV = (WMEWAL.outputTo & WMEWAL.OutputTo.CSV);
            let isTab = (WMEWAL.outputTo & WMEWAL.OutputTo.Tab);

            let includeAltNames = (nameRegex != null || settings.IncludeAltNames || cityRegex != null);
            var includeASC = settings.IncludeASC;
            let includeDirection = (settings.Direction != null);
            let includeLength = settings.SegmentLength || settings.SegmentLengthFilter;

            let lineArray: Array<Array<string>>;
            let columnArray: Array<string>;
            let w: Window;
            let fileName: string;
            if (isCSV) {
                lineArray = [];
                columnArray = ["Name"];
                if (includeAltNames) {
                    columnArray.push("Alt Names");
                }
                if (includeASC) {
                    columnArray.push("Has ASC");
                }
                columnArray.push("City","State","Road Type","Lock Level");
                if (includeDirection) {
                    columnArray.push("Direction");
                }
                if (includeLength) {
                    columnArray.push(`Length (${isImperial ? 'ft' : 'm'})`);
                }
                if (detectIssues) {
                    columnArray.push("Issues");
                }
                columnArray.push("Created By","Last Updated By","Latitude","Longitude","Permalink");
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
                w.document.write("<h4>Filters</h4>");
                w.document.write("<br/>Road Type: ");
                let comma = "";
                for (let rt in WMEWAL.RoadType) {
                    if (WMEWAL.RoadType.hasOwnProperty(rt)) {
                        let mask = parseInt(rt);
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
                if (settings.Roundabouts) {
                    w.document.write(`<br/>Roundabouts ${settings.RoundaboutsOperation === 0 ? 'excluded' : 'only'}`);
                }
                if (settings.ExcludeJunctionBoxes) {
                    w.document.write("<br/>Junction boxes excluded");
                }
                if (settings.EditableByMe) {
                    w.document.write("<br/>Editable by me");
                }
                if (settings.CreatedBy != null) {
                    w.document.write("<br/>Created by " + createdByName);
                }
                if (settings.LastModifiedBy != null) {
                    w.document.write("<br/>Last updated by " + lastModifiedByName);
                }
                if (settings.Unpaved) {
                    w.document.write("<br/>" + I18n.t("edit.segment.fields.unpaved"));
                }
                if (settings.Tunnel) {
                    w.document.write("<br/>" + I18n.t("edit.segment.fields.tunnel"));
                }
                if (settings.HeadlightsRequired) {
                    w.document.write("<br/>" + I18n.t("edit.segment.fields.headlights"));
                }
                if (settings.NearHOV) {
                    w.document.write("<br/>" + I18n.t("edit.segment.fields.nearbyHOV"));
                }
                if (settings.Toll) {
                    w.document.write("<br/>" + I18n.t("edit.segment.fields.toll_road"));
                }
                if (settings.Beacons) {
                    w.document.write("<br/>" + I18n.t("edit.segment.fields.beacons"));
                }
                if (settings.LaneGuidance) {
                    w.document.write(`<br/>${(settings.LaneGuidanceOperation === 0 ? "Has" : "Missing")} lane guidance`);
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
                if (settings.SegmentLengthFilter) {
                    w.document.write("<br/>Segment length ");
                    switch (settings.SegmentLengthFilterOperation) {
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
                    w.document.write(` ${settings.SegmentLengthFilterValue} ${settings.SegmentLengthFilterUnit == Unit.Metric ? 'm' : 'ft'}`);
                }

                if (detectIssues) {
                    w.document.write("<h4>Issues</h4>");
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
                if (settings.OneWay) {
                    w.document.write("<br/>One way");
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
                    w.document.write(` ${settings.SegmentLengthValue} ${settings.SegmentLengthUnit == Unit.Metric ? 'm' : 'ft'}`);
                }
                if (settings.HasNoName) {
                    w.document.write("<br/>Has no name");
                }
                if (settings.HasNoCity) {
                    w.document.write("<br/>Has no city");
                }
                if (settings.NoHN) {
                    w.document.write("<br/>Has no house numbers");
                }
                if (settings.Minus1RoutingPreference) {
                    w.document.write("<br/>-1 routing preference");
                }
                if (settings.Plus1RoutingPreference) {
                    w.document.write("<br/>+1 routing preference");
                }
                // if (settings.NonNeutralRoutingPreference) {
                //     w.document.write("<br/>Non-neutral routing preference");
                // }
                if (settings.RampWithSL) {
                    w.document.write("<br/>Ramp with speed limit")
                }
                if (settings.NewlyPaved) {
                    w.document.write("<br/>Newly paved");
                }

                w.document.write("<table style='border-collapse: separate; border-spacing: 8px 0px'><tr><th>Name</th>");
                if (includeAltNames) {
                    w.document.write("<th>Alt Names</th>");
                }
                if (includeASC) {
                    w.document.write("<th>Has ASC</th>");
                }
                w.document.write("<th>City</th><th>State</th>");
                w.document.write("<th>Road Type</th><th>Lock Level</th>");
                if (includeDirection) {
                    w.document.write("<th>Direction</th>");
                }
                if (includeLength) {
                    w.document.write(`<th>Length (${isImperial ? 'ft' : 'm'})</th>`);
                }
                if (detectIssues) {
                    w.document.write("<th>Issues</th>");
                }
                w.document.write("<th>Created By</th><th>Last Updated By</th><th>Latitude</th><th>Longitude</th><th>Permalink</th></tr>");
            }

            for (let ixStreet = 0; ixStreet < streets.length; ixStreet++) {
                let street = streets[ixStreet];
                let roadTypeText = WMEWAL.TranslateRoadType(street.roadType);
                if (street.name == null && street.roundaboutId == null) {
                    for (let ixSeg = 0; ixSeg < street.segments.length; ixSeg++) {
                        let segment = street.segments[ixSeg];
                        let latlon = OpenLayers.Layer.SphericalMercator.inverseMercator(segment.center.x, segment.center.y);
                        let plSeg = getSegmentPL(segment);
                        if (isCSV) {
                            columnArray = [getStreetName(street)];
                            if (includeAltNames) {
                                columnArray.push("");
                            }
                            if (includeASC) {
                                columnArray.push(street.asc);
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
                            columnArray.push("\"" + street.createdEditor + "\"")
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
                            if (includeASC) {
                                w.document.write(`<td>${street.asc}</td>`);
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
                            w.document.write("<td>" + street.createdEditor + "</td><td>" + street.lastEditor + "</td><td>" + latlon.lat.toString() + "</td><td>" + latlon.lon.toString() + "</td>" +
                                "<td><a href=\'" + plSeg + "\' target=\'_blank\'>Permalink</a></td></tr>");
                        }
                    }
                } else {
                    let latlon = OpenLayers.Layer.SphericalMercator.inverseMercator(street.center.x, street.center.y);

                    let plStreet = getStreetPL(street);
                    let altNames = "";
                    for (let ixAlt = 0; ixAlt < street.altStreets.length; ixAlt++) {
                        if (ixAlt > 0) {
                            altNames += "; ";
                        }
                        altNames += street.altStreets[ixAlt].name;
                        if (street.altStreets[ixAlt].city != null) {
                            altNames += ", " + street.altStreets[ixAlt].city;
                        }
                    }
                    if (isCSV) {
                        columnArray = ["\"" + getStreetName(street) + "\""];
                        if (includeAltNames) {
                            columnArray.push("\"" + altNames + "\"");
                        }
                        if (includeASC) {
                            columnArray.push(street.asc);
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
                        columnArray.push("\"" + street.createdEditor + "\"");
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
                        if (includeASC) {
                            w.document.write(`<td>${street.asc}</td>`);
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
                        w.document.write("<td>" + street.createdEditor + "</td><td>" + street.lastEditor + "</td><td>" + latlon.lat.toString() + "</td><td>" + latlon.lon.toString() + "</td>" +
                            "<td><a href=\'" + plStreet + "\' target=\'_blank\'>Permalink</a></td></tr>");
                    }
                }
            }
            if (isCSV) {
                let csvContent = lineArray.join("\n");
                //var encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
                var blob = new Blob([csvContent], {type: "data:text/csv;charset=utf-8;"});
                let link = document.createElement("a");
                let url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", fileName);
                let node = document.body.appendChild(link);
                link.click();
                document.body.removeChild(node);
            }

            if (isTab) {
                w.document.write("</table></body></html>");
                w.document.close();
                w = null;
            }
        }

        streets = null;
        savedSegments = null;
    }

    export function ScanCancelled(): void {
        ScanComplete();
    }

    function getStreetPL(street: IStreet): string {
        let latlon = OpenLayers.Layer.SphericalMercator.inverseMercator(street.center.x, street.center.y);
        let url = WMEWAL.GenerateBasePL(latlon.lat, latlon.lon,  WMEWAL.zoomLevel) + "&segments=";
        for (let ix = 0; ix < street.segments.length; ix++) {
            if (ix > 0) {
                url += ",";
            }
            url += street.segments[ix].id;
        }
        return url;
    }

    function getSegmentPL(segment: ISegment): string {
        let latlon = OpenLayers.Layer.SphericalMercator.inverseMercator(segment.center.x, segment.center.y);
        return WMEWAL.GenerateBasePL(latlon.lat, latlon.lon, 5) + "&segments=" + segment.id;
    }

    function getStreetName(street: IStreet): string {
        return street.name || "No street";
    }

    function getIssues(issues: number): string {
        let issuesList = [];
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
        if (issues & Issue.NoHN) {
            issuesList.push("No house numbers");
        }
        // if (issues & Issue.RoutingPreference) {
        //     issuesList.push("Non-neutral routing preference");
        // }
        if (issues & Issue.Minus1RoutingPreference) {
            issuesList.push("-1 routing preference");
        }
        if (issues & Issue.Plus1RoutingPreference) {
            issuesList.push("+1 routing preference");
        }
        if (issues & Issue.UnknownDirection) {
            issuesList.push("Unknown direction");
        }
        if (issues & Issue.RampWithSL) {
            issuesList.push("Ramp with speed limit")
        }
        if (issues & Issue.NewlyPaved) {
            issuesList.push("Newly paved");
        }
        if (issues & Issue.OneWay) {
            issuesList.push("One way");
        }

        if (issuesList.length === 0) {
            return "None";
        } else {
            return issuesList.join(", ");
        }
    }

    async function Init(): Promise<void> {
        console.group(pluginName + ": Initializing");
        initCount++;

        let allOK = true;
        let objectToCheck: Array<string> = [
            "W.app",
            "W.model.states",
            "OpenLayers",
            "WMEWAL.RegisterPlugIn",
            "WazeWrap.Ready"];
        for (let i: number = 0; i < objectToCheck.length; i++) {
            let path = objectToCheck[i].split(".");
            let object: Window = window;
            let ok = true;
            for (let j: number = 0; j < path.length; j++) {
                object = object[path[j]];
                if (typeof object === "undefined" || object == null) {
                    console.warn(objectToCheck[i] + " NOT OK");
                    ok = false;
                    break;
                }
            }
            if (ok) {
                console.log(objectToCheck[i] + " OK");
            } else {
                allOK = false;
            }
        }

        if (!allOK) {
            if (initCount < 60) {
                console.groupEnd();
                setTimeout(Init, 1000);
            } else {
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
                "You might need to manually update it from <a href='https://greasyfork.org/scripts/40641' target='_blank'>Greasy Fork</a>.", true, false)
            return;
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
                    log("debug","decompressFromUTF16 failed, attempting decompress");
                    localStorage[savedSettingsKey +"Backup"] = localStorage[savedSettingsKey];
                    try {
                        savedSettings = JSON.parse(WMEWAL.LZString.decompress(localStorage[savedSettingsKey]));
                    } catch (e) {}
                    if (typeof savedSettings === "undefined" || savedSettings === null)
                    {
                        log("debug", "decompress failed, savedSettings unrecoverable. Using blank");
                        savedSettings = [];
                    }
                    updateSavedSettings();
                }
            }
        }
        isImperial = W.app.modeController.appLayout.dataModel.isImperial;

        if (settings == null) {
            initSettings();
        } else {
            if (updateProperties()) {
                updateSettings();
            }
        }

        console.log("Initialized");
        console.groupEnd();

        WazeWrap.Interface.ShowScriptUpdate(scrName, Version, updateText, greasyForkPage, wazeForumThread);
        WMEWAL.RegisterPlugIn(WMEWAL_Streets);
    }

    function initSettings() : void {
        settings = {
            RoadTypeMask: WMEWAL.RoadType.Freeway,
            State: null,
            StateOperation: Operation.Equal,
            LockLevel: null,
            LockLevelOperation: Operation.Equal,
            Regex: null,
            RegexIgnoreCase: true,
            Roundabouts: false,
            RoundaboutsOperation: 0,
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
            SegmentLengthUnit: null,
            LastModifiedBy: null,
            HasNoName: false,
            HasNoCity: false,
            NonNeutralRoutingPreference: false,
            IncludeASC: false,
            NoHN: false,
            RampWithSL: false,
            Unpaved: false,
            Tunnel: false,
            HeadlightsRequired: false,
            NearHOV: false,
            Toll: false,
            Beacons: false,
            CreatedBy: null,
            LaneGuidance: false,
            LaneGuidanceOperation: 0,
            Created: false,
            CreatedOperation: Operation.GreaterThanOrEqual,
            CreatedDate: null,
            Updated: false,
            UpdatedOperation: Operation.GreaterThanOrEqual,
            UpdatedDate: null,
            Minus1RoutingPreference: false,
            Plus1RoutingPreference: false,
            NewlyPaved: false,
            SegmentLengthFilter: false,
            SegmentLengthFilterOperation: Operation.LessThan,
            SegmentLengthFilterValue: null,
            SegmentLengthFilterUnit: isImperial ? Unit.Imperial : Unit.Metric,
            OneWay: false
        };
    }

    function updateProperties(): boolean {
        let upd = false;

        if (settings !== null ) {
            if (!settings.hasOwnProperty("Elevation")) {
                settings.Elevation = false;
                upd = true;
            }

            if (!settings.hasOwnProperty("ElevationOperation")) {
                settings.ElevationOperation = Operation.LessThan;
                upd = true;
            }

            if (!settings.hasOwnProperty("LastModifiedBy")) {
                settings.LastModifiedBy = null;
                upd = true;
            }

            if (!settings.hasOwnProperty("HasNoName")) {
                settings.HasNoName = false;
                upd = true;
            }

            if (!settings.hasOwnProperty("HasNoCity")) {
                settings.HasNoCity = false;
                upd = true;
            }

            if (!settings.hasOwnProperty("Minus1RoutingPreference")) {
                settings.Minus1RoutingPreference = settings.NonNeutralRoutingPreference;
                upd = true;
            }

            if (!settings.hasOwnProperty("Plus1RoutingPreference")) {
                settings.Plus1RoutingPreference = settings.NonNeutralRoutingPreference;
                upd = true;

            }
            // if (!settings.hasOwnProperty("NonNeutralRoutingPreference")) {
            //     settings.NonNeutralRoutingPreference = false;
            //     upd = true;
            // }

            if (!settings.hasOwnProperty("UnknownDirection")) {
                settings.UnknownDirection = false;
                upd = true;
            }

            if (!settings.hasOwnProperty("IncludeASC")) {
                settings.IncludeASC = false;
                upd = true;
            }

            if (!settings.hasOwnProperty("Roundabouts")) {
                settings.Roundabouts = (settings["ExcludeRoundabouts"] || false);
                upd = true;
            }

            if (!settings.hasOwnProperty("NoHN")) {
                settings.NoHN = false;
                upd = true;
            }

            if (!settings.hasOwnProperty("RampWithSL")) {
                settings.RampWithSL = false;
                upd = true;
            }

            if (!settings.hasOwnProperty("Unpaved")) {
                settings.Unpaved = false;
                upd = true;
            }

            if (!settings.hasOwnProperty("Tunnel")) {
                settings.Tunnel = false;
                upd = true;
            }

            if (!settings.hasOwnProperty("HeadlightsRequired")) {
                settings.HeadlightsRequired = false;
                upd = true;
            }

            if (!settings.hasOwnProperty("NearHOV")) {
                settings.NearHOV = false;
                upd = true;
            }

            if (!settings.hasOwnProperty("Toll")) {
                settings.Toll = false;
                upd = true;
            }

            if (!settings.hasOwnProperty("Beacons")) {
                settings.Beacons = false;
                upd = true;
            }

            if (!settings.hasOwnProperty("CreatedBy")) {
                settings.CreatedBy = null;
                upd = true;
            }

            if (!settings.hasOwnProperty("LaneGuidance")) {
                settings.LaneGuidance = false;
                upd = true;
            }

            if (!settings.hasOwnProperty("LaneGuidanceOperation")) {
                settings.LaneGuidanceOperation = 0;
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

            if (!settings.hasOwnProperty("NewlyPaved")) {
                settings.NewlyPaved = false;
                upd = true;
            }

            if (!settings.hasOwnProperty("SegmentLengthUnit") || settings.SegmentLengthUnit == null) {
                if (settings.SegmentLength != null) {
                    settings.SegmentLengthUnit = Unit.Metric;
                } else {
                    settings.SegmentLengthUnit = isImperial ? Unit.Imperial : Unit.Metric;
                }
                upd = true;
            }

            if (!settings.hasOwnProperty("SegmentLengthFilter")) {
                settings.SegmentLengthFilter = false;
                upd = true;
            }

            if (!settings.hasOwnProperty("SegmentLengthFilterOperation")) {
                settings.SegmentLengthFilterOperation = Operation.LessThan;
                upd = true;
            }

            if (!settings.hasOwnProperty("SegmentLengthFilterValue")) {
                settings.SegmentLengthFilterValue = null;
                upd = true;
            }

            if (!settings.hasOwnProperty("SegmentLengthFilterUnit")) {
                settings.SegmentLengthFilterUnit = isImperial ? Unit.Imperial : Unit.Metric;
                upd = true;
            }

            if (!settings.hasOwnProperty("OneWay")) {
                settings.OneWay = false;
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

            if (settings.hasOwnProperty("ExcludeRoundabouts")) {
                delete settings["ExcludeRoundabouts"];
                upd = true;
            }
        }

        return upd;
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

    function log(level: string, message: any): void {
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

    function nullif(s: string, nullVal: string): string {
        if (s !== null && s === nullVal) {
            return null;
        }
        return s;
    }

    Init();
}