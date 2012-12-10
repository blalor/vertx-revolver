var vertx = require('vertx.js');
var Q = require('lib/q.js');

function Revolver(config) {
    var self = this;

    // how long to display each location vor
    var displayLinger = 30;

    if (config.duration) {
        displayLinger = config.duration;
    }

    // the locations to display
    var locations = config.locations;

    // The order the locations will be rotated through
    var rotationOrder = config.rotationOrder;

    // the item currently being displayed
    var currentLocationIndex = 0;

    // rotation timer id
    var rotationTimerId = null;

    // supported events and their associated handlers
    var eventHandlers = {
        'locationUpdated': [],
        'locationDeleted': [],
        'rotateTo': []
    };

    function emit(eventType) {
        if (! (eventType in eventHandlers)) {
            throw new Error("unsupported event type " + eventType);
        }

        // arguments is an "array-like object", not an actual array.
        var handlerArgs = Array.prototype.slice.call(arguments, 1);

        var handlers = eventHandlers[eventType];

        console.log('emitting ' + JSON.stringify(arguments));

        for (var i = 0; i < handlers.length; i++) {
            var handler = handlers[i];

            // hrm, not sure what I need to pass for the first argument, but I'm
            // pretty sure it isn't the API instance…
            handler.apply(null, handlerArgs);
        }
    }

    /**
     * Subscribe a handler to an event type.
     *
     * @param eventType the event type
     * @param handler the handler to be dispatched when the event is received
     */
    self.on = function(eventType, handler) {
        if (! (eventType in eventHandlers)) {
            throw new Error("unsupported event type " + eventType);
        }

        eventHandlers[eventType].push(handler);
    };

    /**
     * Sets the linger duration.
     *
     * @param duration how long to linger on each location
     */
    self.setLinger = function(duration) {
        displayLinger = duration;

        self.pause();
        self.start();
    };

    /**
     * Starts rotation.
     */
    self.start = function() {
        rotationTimerId = vertx.setPeriodic(displayLinger * 1000, self.next);
    };

    /**
     * Disables rotation.
     */
    self.pause = function() {
        if (rotationTimerId) {
            vertx.cancelTimer(rotationTimerId);
            rotationTimerId = null;
        }
    };

    /**
     * Rotates to the next location.
     */
    self.next = function() {
        currentLocationIndex += 1;

        if (currentLocationIndex >= rotationOrder.length) {
            currentLocationIndex = 0;
        }

        emit('rotateTo', rotationOrder[currentLocationIndex]);
    };

    /**
     * Rotates to the previous location.
     */
    self.prev = function() {
        currentLocationIndex -= 1;

        if (currentLocationIndex < 0) {
            currentLocationIndex = (rotationOrder.length - 1);
        }

        emit('rotateTo', rotationOrder[currentLocationIndex]);
    };

    /**
     * Returns a promse that when fulfilled provides the list of configured
     * locations.
     */
    self.getLocations = function() {
        // @todo use persistence store
        return Q.fcall(function() {
            return {
                locations: locations,
                current: rotationOrder[currentLocationIndex]
            };
        });
    };

    /**
     * Adds or modifies a location.  Emits 'locationUpdated' upon completion.
     *
     * @param id the identifier; must be element-ID-safe
     * @param url the url
     * @param reload boolean; if true, location will be reloaded when displayed
     */
    self.setLocation = function(id, url, reload) {
        // add to rotation order if not already exists
        if (rotationOrder.indexOf(id) === -1) {
            rotationOrder.push(id);
        }

        locations[id] = {
            url: url,
            reload: reload
        };

        emit('locationUpdated', id, url, reload);
    };

    /**
     * Removes a location.  Emits 'locationDeleted' upon completion if it
     * existed.
     *
     * @param id the identifier
     */
    self.removeLocation = function(id) {
        if (locations[id]) {
            delete locations[id];

            // remove the id from the rotation order
            var orderInd = rotationOrder.indexOf(id);
            if (orderInd !== -1) {
                rotationOrder.splice(orderInd, 1);
            }

            emit('locationDeleted', id);
        }
    };
}

var revolver = new Revolver({
    duration: vertx.config.duration,
    locations: vertx.config.locations,
    rotationOrder: vertx.config.rotationOrder
});

// bind various EventBus messages to Revolver methods
revolver.on('locationUpdated', function(id, url, reload) {
    vertx.eventBus.publish(
        'revolver.locationUpdated',
        {id: id, url: url, reload: reload}
    );
});

revolver.on('locationDeleted', function(id) {
    vertx.eventBus.publish('revolver.locationDeleted', {id: id});
});

revolver.on('rotateTo', function(id) {
    vertx.eventBus.publish('revolver.rotateTo', {id: id});
});

vertx.eventBus.registerHandler('revolver.getLocations', function(msg, replier) {
    revolver
        .getLocations()
        .then(replier);
});

vertx.eventBus.registerHandler('revolver.setLocation', function(msg) {
    revolver.setLocation(msg.id, msg.url, msg.reload);
});

vertx.eventBus.registerHandler('revolver.removeLocation', function(msg) {
    revolver.removeLocation(msg.id);
});

// initialize the web server
vertx.deployModule(
    'vertx.web-server-v1.0',
    {
        port: vertx.config.httpPort,

        bridge: true,
        inbound_permitted:  [ {} ],
        outbound_permitted: [ {} ]
    },
    1, // one instance
    function(deployId) {
        if (deployId === null) {
            vertx.logger.error("failed to load web-server");
        }
    }
);

revolver.start();
