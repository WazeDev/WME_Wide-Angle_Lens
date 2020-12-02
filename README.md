# WME Wide-Angle Lens

This is script and plugins scans a defined area such as your managed area or even an entire state for issues and have associated plugins generate reports. The main script and its plugins can be found [on GreasyFork](https://greasyfork.org/en/scripts?set=23559); if installed from this GitHub repo, they will automatically update from GreasyFork. If you want to download all the latest files and import them into TamperMonkey at once, visit the [latest release](https://github.com/WazeDev/WME_Wide-Angle_Lens/releases/latest) to download a zip file.

* Draw an area place of any size but do not save it. The category of the place doesn't matter.
* Click the Wide-Angle Lens tab in the user info pane, click the Areas tab, give the area a name and add it to your area list.
* Click over to the Scan tab, pick the plugins you want to use, select the area to scan and watch as the map is panned through the area
* Don't touch anything while the scan is in progress
* Output will be generated based on the plugins you chose and the filter criteria specified on their associated tab

Words of caution:

* Don't create an area place that is too large. If the plugin you are using is scanning for streets and/or places, the zoom level required is such that scanning a large area may take a long time. You may be better off creating smaller areas.
* This has not been fully tested but I welcome any feedback

## Cities Plugin

This plugin will scan an area to determine if there are segments with a city that doesn't match the name of a city found in a layer. You will need to select a polygon layer that contains regions identifying cities. Depending on the number of cities in the layer you choose, there may be a long delay after pressing the "Scan" button before the actual scan starts.
Note that this plugin will likely run much slower than the others.  Checking to see if a segment is within a polygon is an expensive operation.

## Locks Plugin

This plugin will scan an area to determine if there are segments that don't match the specified locking standards specified on the plugin's settings tab.

## Map Comments Plugin

This plugin will scan an area and report all map comments that meet the criteria specified on the plugin's settings tab.

## Places Plugin

This plugin will scan an area and report on places that meet the criteria specified on the plugin's settings tab.

## Streets Plugin

This plugin will scan an area and report on streets that meet the criteria specified on the plugin's settings tab.  The settings tab is broken up into 3 sections:

### Output Options

Here you specify what type of information to include in the output generated.

### Filter Options

Here you specify filters that are used to limit the streets that are scanned. Streets must match all filter criteria specified in order to be included.

## Issues

Here you specify the issues you would like to be identified for streets. If you don't select any issues, all segments matching the filter criteria will be included in the output. If you choose at least one issue, only streets that have at least one of the issues will be included. This is an "OR" selection, meaning that a street only has to have one of the issues to be included.