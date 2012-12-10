function debug(msg) {
    if ((typeof console !== 'undefined') && console.log) {
        console.log(msg);
    }
}

function Revolver(eventBusUrl) {
    var self = this;
    var eb = null;

    function ebConnect() {
        var ebConnTimeoutId = setTimeout(function() {
            debug("EventBus connection timed out");

            self.notify('EventBus connection timed out', 'red', 1000 * 60 * 24);
        }, 1000);

        eb = new vertx.EventBus(eventBusUrl);

        eb.onopen = function() {
            debug("EventBus connected");

            clearTimeout(ebConnTimeoutId);
            ebConnTimeoutId = null;

            self.init();
        };

        eb.onclose = function() {
            debug("EventBus closed");

            self.notify('EventBus closed', 'red', 1000 * 60 * 24);

            eb = null;
        };
    }

    var locations = {};
    var currentLocationId = null;
    
    var nkill = 0;
    var notifier = null;
    var homenode = null;

    ebConnect();

    setInterval(function() {
        if (eb === null) {
            debug("no EventBus; reconnecting");

            ebConnect();
        }
    }, 5000);

    // display a notification
    self.notify = function(text, backgroundColor, timeVisible) {
        if (nkill) {
            clearInterval(nkill);
            nkill = 0;
        }

        notifier.innerHTML = text;
        notifier.style['background-color'] = backgroundColor;
        notifier.style.display = 'block';

        nkill = setTimeout(function() {
            notifier.style.display = 'none';
            nkill = 0;
        }, timeVisible);
    };

    self.setLocation = function(id, location) {
        var loc = {};

        if (locations[id]) {
            loc = locations[id];
        } else {
            locations[id] = loc;
        }

        loc.reload = location.reload;

        if (loc.origUrl !== location.url) {

            loc.origUrl = loc.url = location.url;

            loc.url = loc.url.replace(new RegExp('@WIDTH@', 'g'), homenode.offsetWidth);
            loc.url = loc.url.replace(new RegExp('@HEIGHT@', 'g'), homenode.offsetHeight);

            if (loc.iframe) {
                loc.iframe.src = loc.url;
            } else {
                loc.iframe = document.createElement('iframe');
                loc.iframe.setAttribute('src', loc.url);
                loc.iframe.setAttribute('id', 'iframe-' + id);
                loc.iframe.style.display = 'none';

                homenode.appendChild(loc.iframe);
            }
        }
    };

    self.removeLocation = function(id) {
        if (locations[id]) {
            var loc = locations[id];
            delete locations[id];

            if (loc.iframe) {
                loc.iframe.parentElement.removeChild(loc.iframe);
            }
        }
    };

    // called immediately after eventbus connection
    self.init = function() {
        notifier = document.getElementById('notifier');
        homenode = document.getElementById('homenode');

        currentLocationId = null;

        // nuke any existing locations
        for (var locationId in locations) {
            if (locations.hasOwnProperty(locationId)) {
                self.removeLocation(locationId);
            }
        }

        // dismiss notification
        self.notify('', 'black', 0);

        eb.send('revolver.getLocations', {}, function(msg) {
            for (var locationId in msg.locations) {
                if (msg.locations.hasOwnProperty(locationId)) {
                    self.setLocation(locationId, msg.locations[locationId]);
                }
            }

            self.rotateTo(msg.current);

            eb.registerHandler('revolver.rotateTo', function(msg) {
                self.rotateTo(msg.id);
            });

            eb.registerHandler('revolver.locationUpdated', function(msg) {
                self.setLocation(msg.id, {url: msg.url, reload: msg.reload});
            });

            eb.registerHandler('revolver.locationDeleted', function(msg) {
                self.removeLocation(msg.id);
            });

            eb.registerHandler('revolver.browser.reload', function() {
                // reload and ignore cache
                (window || document).location.reload(true);
            });
        });
    };

    self.rotateTo = function(id) {
        debug("rotating to " + id);

        if (currentLocationId) {
            locations[currentLocationId].iframe.style.display = 'none';
        }

        currentLocationId = id;

        var loc = locations[id];
        if (loc) {
            loc.iframe.style.display = 'block';
            
            if (loc.reload) {
                loc.iframe.src = loc.iframe.src;
            }
        } else {
            debug("no location for " + id);
        }
    };
}
