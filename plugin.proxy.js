const express = require("express");
const request = require("request");

module.exports = function install (app) {
    var router = new express.Router();

    var proxyRoot = "/proxy/telemachus";
    var latestSubpath = "/latest";
    var historySubpath = "/history/:field";
    var proxyPath = proxyRoot + latestSubpath;
    var proxyHistoryPath = proxyRoot + historySubpath;
    // Assumes the telemachusApiUrl is on the same host as the openMCT instance
    var proxyTo = process.env.TELEMACHUS_DATALINK_URL || "http://localhost:8085/telemachus/datalink";
    var maxHistory = process.env.TELEMACHUS_HISTORY_LENGTH || 1000;

    var history = {};

    // Get latest telemetry value, stored in the history map
    router.get(latestSubpath, function(req, res) {
        var realurl = req.originalUrl.replace(proxyPath, proxyTo);
        var now = Date.now();
        var fields = req.query;
        request(
            {
                url: realurl,
            },
            (error, response, body) => {
                if (error || response.statusCode !== 200) {
                    return res.json({});
                }

                // Save data to history
                var data = JSON.parse(body);
                for (var alias in data) {
                    var value = data[alias];
                    var field = fields[alias];
                    
                    if (history[field]) {
                        history[field].push({ timestamp: now, value: value });
                        while(history[field].length > maxHistory) {
                            history[field].shift();
                        }
                    } else {
                        history[field] = [ { timestamp: now, value: value } ];
                    }
                }

                // Return data
                res.json(data);
            }
        )
    });

    // query history map
    router.get(historySubpath, function(req, res) {
        var field = req.params.field;
        if (history[field] && history[field].length > 0) {
            res.json(history[field]);
        } else {
            res.json([]);
        }
    });
    router.post(historySubpath, function(req, res) {
        if (!req.body) {
            res.json([]);
            return;
        }
        var query = JSON.parse(req.body);
        var field = req.params.field;
        if (history[field] && history[field].length > 0) {
            var elements = history[field];
            var telemetry = elements.filter((element) => {
                element.timestamp >= query.start && element.timestamp <= query.end
            });
            if (telemetry.length < 1)
                res.json([]); // send empty array

            if (query.strategy) {
                switch (query.strategy) {
                    case "latest": {
                        var size = Math.max(query.size || 1, 1);
                        res.json(telemetry.slice(Math.max(telemetry.length - size, 0)));
                    } break;
                    case "minmax": {
                        var max = telemetry[0];
                        var min = telemetry[0];
                        for (var i = 0; i < telemetry.length; i++) {
                            if (telemetry[i].timestamp > max.timestamp) {
                                max = telemetry[i];
                            }
                            if (telemetry[i].timestamp < min.timestamp) {
                                min = telemetry[i];
                            }
                        }
                        res.json([min,max]);
                    }
                    default: {
                        res.json(telemetry);
                    }
                }
            } else {
                res.json(telemetry);
            }
        } else {
            res.json([]); // send empty array
        }
    });
    
    app.use(proxyRoot, router);
}