// what is this?
// A short easy method to install this script as a windows service

// Who is it for?
// Those who miss out on linux and are too lazy to findout how to setup the script to run automaticly

// How does it work?
// Run this this script, comment out install/uninstall function call to fit your needs.
// This will add a new service, make sure to start it yourself after it's created
// If you wanted it to run automaticly after install pull request that change @me

function install_service() {
    var Servcie = require('node-windows').Service;
    var svc = new Servcie({
        name: 'Mangadex Groups Rss Generator',
        description: 'Generates node rss feed and makes it accessable from an http server',
        script: PATH
    })
    //svc.uninstall()
    svc.install();
}

install_service()