function debug() {
    if ((typeof console !== 'undefined') && console.log) {
        console.log.apply(console, arguments);
    }
}

window.onerror = function() {
    debug("window.onerror", arguments);

    return false;
};

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
        self.removeLocation(id);

        var loc = locations[id] = location;
        loc.id = id;
        loc.origUrl = loc.url;

        loc.url = loc.url.replace(new RegExp('@WIDTH@', 'g'), homenode.offsetWidth);
        loc.url = loc.url.replace(new RegExp('@HEIGHT@', 'g'), homenode.offsetHeight);

        if (loc.containerType === 'div') {
            loc.container = document.createElement('div');
            loc.container.className = "imgDiv";
            loc.container.style.display = 'none';
            loc.container.style.backgroundImage = "url('" + loc.url + "')";
        } else {
            loc.container = document.createElement('iframe');
            loc.container.setAttribute('src', loc.url);
            loc.container.style.display = 'none';
        }

        homenode.appendChild(loc.container);
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
                self.setLocation(msg.id, {
                    url: msg.url,
                    reload: msg.reload,
                    containerType: msg.containerType
                });
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

        var nextLoc = locations[id];

        function switchView(evt) {
            if (evt) {
                // was called as an event listener; remove this callback
                // "this" is the element we were attached to
                this.removeEventListener('load', switchView);
            }

            // hide all currently-displayed elements
            for (var locId in locations) {
                if (locations.hasOwnProperty(locId)) {
                    var loc = locations[locId];

                    if (loc.container.style.display !== 'none') {
                        loc.container.style.display = 'none';
                    }
                }
            }

            nextLoc.container.style.display = 'block';
        }

        if (nextLoc) {
            // only set currentLocationId if the next location actually exists
            currentLocationId = id;

            if (nextLoc.reload) {
                if (nextLoc.containerType === 'div') {
                    nextLoc.container.style.backgroundImage = nextLoc.container.style.backgroundImage;

                    // no load event dispatched for background image changes
                    switchView();
                } else {
                    nextLoc.container.src = nextLoc.container.src;

                    // only perform switch after new document is loaded, as a
                    // sort of double-buffering
                    nextLoc.container.addEventListener('load', switchView);
                }
            } else {
                // no reload; switch view immediately
                switchView();
            }
        } else {
            debug("no location for " + id);
        }
    };
}
