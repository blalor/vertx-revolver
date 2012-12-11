Revolver
========

Reolver is a dead-simple application.  It serves one purpose: to automatically revolve through a series of configurable URLs.  The primary use case is to provide a dashboard (or "extreme feedback" device, 'cause isn't *everything* extreme these days?) for a development team, giving them at-a-glance status of their builds, application status, and funny pictures.

In addition to the dead-simple part, it also supports some other cool features:

* keeps multiple displays in sync
* dynamically add, remove, and update URLs
* force-reload captured browsers

Revolver is built with [Vert.x](http://vertx.io/) and [VanillaJS](http://vanilla-js.com), with a pinch of [q](http://documentup.com/kriskowal/q/).

Motivation, Inspiration
-----------------------

This Revolver is a fork and reimagining of an internal application by the same name written by [Greg Tczap](https://github.com/gtczap).  I took Greg's version, threw it up on a [Raspberry Pi](http://www.raspberrypi.org/) and was indubitably impressed.  Then I realized just how dog-ass slow the ∏ was and that I wanted a more flexible way to control what was displayed.  I've also been working with [Vert.x](http://vertx.io) a ton and knew I could whack this together pretty quickly.

How it works
------------

The server is given a set of URLs, which are passed to browsers when they load the index page.  Each configured URL is loaded into an `<iframe>` or as the centered background-image of a `<div>` and displayed (and optionally refreshed) when commanded by the server at a configured rate.  

Setup
-----

1. You'll need [Vert.x](http://vertx.io/downloads.html) (tested against/developed with 1.3.0.final) and Java 7 (required by Vert.x).  
2. Copy `config.json.tmpl` to `config.json`
3. Modify `config.json` to suit your needs)
4. Start it up: `vertx run app.js -conf config.json`
5. Point your browser to [localhost:8082](http://localhost:8082/)
6. There is no step 6


Caveats
-------

You may find that some pages don't load as expected.  This could be due to a missing `X-Frame-Options` header.  I've been experimenting with a Node.js proxy to unconditionally add the appropriate header, but haven't found the ideal solution, yet.

Future
------

* Manipulating the configured URLs via HTTP endpoints
