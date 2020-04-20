# Telemachus Telemetry Adapter
Telemetry adapter for OpenMCT to load telemetry from Kerbal Space Program with the [Telemachus](https://github.com/KSP-Telemachus/Telemachus) plugin installed. This plugin is inspired by the original Telemetry adapter by [hudsonfoo](https://github.com/hudsonfoo/kerbal-openmct) but written from the ground up for the latest (April 2020) release of OpenMCT.

## Prerequisites
This plugin assumes that your server is running `express` as it is used to configure the routes and communicate to the web clients.

## Configuration
This plugin assumes that Telemachus datalink is accessible from: http://localhost:8085/telemachus/datalink on the OpenMCT server. Set the `TELEMACHUS_DATALINK_URL` environment variable to overwrite this location. Each telemetry value once queried is saved to the history to be queried by historical telemetry providers. By default 1000 of the most recent elements are saved. This can be overwritten by the `TELEMACHUS_HISTORY_LENGTH` environment variable.

## Installation
If you are using my [OpenMCT Template](https://github.com/qkmaxware/openmct-template.git) simply clone this repo into `./plugins/openmct-telemachus` and run `npm install` to fetch all required dependencies. Then add the following config to the server's package.json.
```diff
  "plugins": {
+    "telemachus": {
+      "client": "plugins/openmct-telemachus/plugin.js",
+      "server": "plugins/openmct-telemachus/plugin.proxy.js"
+    }
  },
```

If you are using a different installation of OpenMCT, include the plugin.js file into the index.html and install it the traditional way.
```diff
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0, shrink-to-fit=no">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <title><%= name %> - <%= version %></title>
    <script src="openmct/openmct.js"></script>
    <link rel="icon" type="image/png" href="openmct/favicons/favicon-96x96.png" sizes="96x96" type="image/x-icon">
    <link rel="icon" type="image/png" href="openmct/favicons/favicon-32x32.png" sizes="32x32" type="image/x-icon">
    <link rel="icon" type="image/png" href="openmct/favicons/favicon-16x16.png" sizes="16x16" type="image/x-icon">

    <script src="static/lib/http.js"></script>
+    <script src="plugins/openmct-telemachus/plugin.js"></script>
</head>
<body>
    <script>
    ...
+    openmct.install(telemachus());

    openmct.start();
    </script>
</body>
```
Then run `npm install` and include the server-side telemachus proxy in your express app.js.
```diff
const app = express();
...
+const ksp_telemachus_proxy = require("plugins/openmct-telemachus/plugin.proxy");
+ksp_telemachus_proxy(app);
...
app.listen(port, function () {
    console.log('Open MCT hosted at http://localhost:' + port);
});
```

## Notes
This plugin just provides the telemetry sources for accessing data from Telemachus. You will still need to create `Overlay Plots` to plot this telemetry data as well as Displays and Dashboards for viewing the data. 