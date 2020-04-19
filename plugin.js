const telemachus = (function() {
    const package = 'ksp.taxonomy';
    const spacecraft = "KSP Spacecraft";
    const telemetryType = package + ".telemetry";
    const telemachusApiUrl = "/proxy/telemachus/latest";
    const telemachusApiQueryUrl = "/proxy/telemachus/history";
    const ONE_SECOND = 1000;

    function getTelemetry(telemetryKeyToGet) {
        return http.get(telemachusApiUrl + "?a0=" + encodeURIComponent(telemetryKeyToGet)).then(function(result) {
            if (result === null)
                return null;
            if (result.data) {
                var data = result.data;
                if (typeof(result.data) === "object") {
                    data = result.data["a0"];
                }
                else {
                    data = JSON.parse(result.data)["a0"];
                }
                return data;
            } else {
                return null;
            }
        });
    }

    function queryTelemetry(resource, request) {
        return http.post(telemachusApiQueryUrl + "/" + resource, request).then(function(result) {
            if (result === null)
                return null;
            if (result.data) {
                return result.data;
            } else {
                return null;
            }
        });
    }

    // A dictionary is a list of all the things that we can get telemetry for
    function getDictionary() {
        return http.get("plugins/openmct-telemachus/vessel.dictionary.json").then(function(result){
            return result.data;
        });
    }

    function getSystemDictionary() {
        return http.get("plugins/openmct-telemachus/system.dictionary.json").then(function(result){
            return result.data;
        });
    }

    // Object provider makes the objects in a tree from the given unique keys
    function objectProvider() {
        this.get = function(identifier){
            return getDictionary().then(function(dictionary){
                if (identifier == null) {
                    return null;
                }
                if (identifier.namespace === package) {
                    if (identifier.key === spacecraft) {
                        // Root node only
                        return {
                            identifier: identifier,
                            name: dictionary.name,
                            type: 'folder',
                            location: 'ROOT'
                        };
                    } 
                    else {
                        // Sub-nodes, can be a subsystem or a measurement
                        for (var i = 0; i < dictionary.subsystems.length; i++) {
                            var subsystem = dictionary.subsystems[i];
                            // is subsystem
                            if (identifier.key === subsystem.identifier) {
                                return {
                                    identifier: identifier,
                                    name: subsystem.name,
                                    type: "folder",
                                    location: package + ":" + spacecraft
                                };
                            } 
                            // is measurement
                            else {
                                for (var j = 0; j < subsystem.measurements.length; j++) {
                                    var measurement = subsystem.measurements[j];
                                    if (identifier.key === measurement.identifier) {
                                        var values = null;
                                        switch (measurement.type) {
                                            case "float": {
                                                values = [
                                                    {
                                                        key: "value",               // unique identifier for this field.
                                                        source: "value",            // identifies the property of a datum where this value is stored. default "key"
                                                        name: "Value",              // a human readable label for this field. default "key"
                                                        units: measurement.units,   // the units of this value
                                                        format: "float",            // a specific format identifier
                                                        hints: {                    // Hints allow views to intelligently select relevant attributes for display
                                                            range: 1,
                                                            y: 1
                                                        }
                                                    },
                                                    {
                                                        key: "utc",                 // must match the key of the active time system
                                                        source: "timestamp",
                                                        name: "Timestamp",
                                                        format: "utc",
                                                        hints: {
                                                            domain: 1,
                                                            x: 1
                                                        }
                                                    }
                                                ];
                                            } break;
                                            case "boolean": {
                                                values = [
                                                    {
                                                        key: "value",
                                                        source: "value",
                                                        name: "Value",
                                                        units: measurement.units,
                                                        format: "enum",
                                                        enumerations: [
                                                            {
                                                                "string": "ON",
                                                                "value": true
                                                            },
                                                            {
                                                                "string": "OFF",
                                                                "value": false
                                                            }
                                                        ],
                                                        hints: {
                                                            range: 1
                                                        }
                                                    },
                                                    {
                                                        key: "utc",
                                                        source: "timestamp",
                                                        name: "Timestamp",
                                                        format: "utc",
                                                        hints: {
                                                            domain: 1
                                                        }
                                                    }
                                                ];
                                            } break;
                                        }
                                        return {
                                            identifier: identifier,
                                            name: measurement.name,
                                            type: telemetryType,
                                            location: package + ":" + subsystem.identifier,
                                            telemetry: {
                                                values: values,
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                return null;
            });
        }

        return this;
    }

    // Compositions make the tree
    function compositionProvider() {
        this.appliesTo = function(domain) {
            return domain.identifier.namespace === package && domain.type === 'folder';
        }
        this.load = function(domain) {
            return getDictionary().then(function(dictionary) {
                var elements = [];
                for (var i = 0; i < dictionary.subsystems.length; i++) {  
                    var subsystem = dictionary.subsystems[i];
                    if (domain.identifier.key === spacecraft) {
                        elements.push({
                            namespace: package,
                            key: subsystem.identifier,
                        });
                    }
                    else if (domain.identifier.key === subsystem.identifier) {
                        for (var j = 0; j < subsystem.measurements.length; j++) {
                            var measurement = subsystem.measurements[j];
                            elements.push({
                                namespace: package,
                                key: measurement.identifier
                            });
                        }
                    }
                }
                return elements;
            });
        }
        return this;
    }

    function telemachusTelemetryProvider() {
        // Historical telemetry
        this.supportsRequest = function(domain) {
            return domain.type === telemetryType;
        }
        this.request = function(domain, request) {
            return queryTelemetry(domain.identifier.key, request).then(function(data) {
                if (data) {
                    return data;
                } else {
                    return [];
                }
            });
        }
        // Realtime telemetry
        this.supportsSubscribe = function(domain) {
            return domain.type === telemetryType;
        }
        this.subscribe = function(domain, callback) {
            // callback is called with the telemetry whenever we get it
            const interval = setInterval(function() {
                try {
                    var now = Date.now();
                    getTelemetry(domain.identifier.key).then(function(telemetry){
                        // returned point must be in the form compatible with the object's telemetry object. ie {timestamp: Date, value: number, id: string}
                        if (telemetry !== undefined && telemetry !== null) {
                            var datapoint = { timestamp: now, value: telemetry };
                            callback(datapoint); 
                        }
                    });
                } catch (e) { console.error(e); /* errors don't fail program */ }
            }, ONE_SECOND);

            // unsubscribe is used to cancel a given ongoing telemetry request
            return function unsubscribe() {
                clearInterval(interval);
            };
        }
        return this;
    }

    function install(openmct) {
        openmct.objects.addRoot({
            namespace: package,
            key: spacecraft
        });
        
        openmct.types.addType(telemetryType, {
            name: 'Telemachus Telemetry',
            description: 'Telemetry provided by the Telemachus Kerbal Space Program plugin',
            cssClass: 'icon-telemetry',
            creatable: false
        });
        openmct.objects.addProvider(package, objectProvider());
        openmct.composition.addProvider(compositionProvider());
        openmct.telemetry.addProvider(new telemachusTelemetryProvider());

        console.log("telemachus plugin installed");
    }

    return install;
});