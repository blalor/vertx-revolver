var vertx = require('vertx.js');
var Revolver = require('lib/RevolverController.js');

var revolver = new Revolver({
    duration: vertx.config.duration,
    locations: vertx.config.locations,
    rotationOrder: vertx.config.rotationOrder
});

// bind various EventBus messages to Revolver methods
revolver.on('locationUpdated', function(id, url, reload, containerType) {
    vertx.eventBus.publish(
        'revolver.locationUpdated',
        {id: id, url: url, reload: reload, containerType: containerType}
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
    revolver.setLocation(msg.id, msg.url, msg.reload, msg.containerType);
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
