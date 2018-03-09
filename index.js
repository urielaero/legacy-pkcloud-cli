var pkgcloud  = require('pkgcloud'),
    program = require('commander'),
    util = require('util'),
    async = require('async'),
    fs = require('fs');

program
    .version('0.0.0')
    .usage('action option')
    .option('-a --action <type>', 'Action', /^(loadbalancer|ld|server|sv|container)$/i, 'ld')
    .option('-l --list')
    .option('-i --info <name>', 'id')
    .option('-f --listFiles <name>', 'container-name')
    .option('-v --verbose')
    .option('-n --nodes')
    .option('-p --public');


program.on('--help', function(){
    console.log('  Examples:');
    console.log('');
    console.log('$ index.js --help');
    console.log('$ index.js -h');
    console.log('$ index.js -a ld -i 233753 -np //mte loadbalancer');
    console.log('$ index.js -a server -l //lista servers');
});

program.parse(process.argv);

var options = {
      provider: process.env.PROVIDER,
      username: process.env.PROVIDER_USERNAME,
      apiKey: process.env.PROVIDER_APIKEY,
      region: process.env.PROVIDER_REGION,
};

var clientCompute = pkgcloud.compute.createClient(options),
    clientLoadBalancer = pkgcloud.loadbalancer.createClient(options),
    clientContainer = pkgcloud.storage.createClient(options);


function getListLoadBalancer(){
    clientLoadBalancer.getLoadBalancers({}, function(err, list){
        if(err) return console.log(err);
        if(!program.verbose)
            list.forEach(function(l){
                delete l.client;
                delete l._events;
                delete l.virtualIps;
            });
        console.log(list);
    });
}

function getInfoLoadBalancer(name){
    console.log('info');
    clientLoadBalancer.getLoadBalancer(name, function(err, lb){
        if(err) return console.log(err);
        delete lb.client;
        console.log(lb);
    });
}

function getListServers(done){
    clientCompute.getServers(function(err, list){
        if(done) return done(err, list);
        if(err) return console.log(err);
        if(!program.verbose)
            list.forEach(function(l){
                delete l.client;
                delete l._events;
                delete l.virtualIps;            
                delete l._conf;
                //delete l.original;
                //delete l.openstack;
            });
        
        console.log(util.inspect(list, {depth: null}));
    });
}

function getInfoServer(id){
    clientCompute.getServer(id, function(err, server){
        if(err) return console.log(err);
        delete server.client;
        console.log(util.inspect(server, {depth: null}));
    })
}

function getInfoNodesLoadBalancer(id){
    clientLoadBalancer.getNodes(id, function(err, nodos){
        if(err) return console.log(err);
        console.log("Nodos totales: ", nodos.length);
        if(program.public){
            getListServers(function(err, list){
                if(err) return console.log(err);
                var ipNodos = nodos.map(function(n){
                    return n.address;
                });

                var ns = list.filter(function(l){
                    if(l.metadata && l.metadata['rax:auto_scaling:lb:233753'])
                        return true;
                    else if(l.addresses && l.addresses.private) {
                        var exist = l.addresses.private.filter(function(add){
                                        return ipNodos.indexOf(add.addr) != -1;
                                    })
                        return exist.length;
                    }
                });

                ns.forEach(function(n){
                    delete n.original;
                    delete n.openstack;
                    delete n.client;
                });

                console.log("Nodos encontrados: ", ns.length);
                console.log(util.inspect(ns, {depth: null}));
            });
            return;
        }


        if(!program.verbose)
            nodos.forEach(function(l){
                delete l.client;
                //delete l.original;
                //delete l.openstack;
            });
        
        console.log(util.inspect(nodos, {depth: null}));
    });
}

function uploadFile(pathFile, container, fileName) {
    //clientContainer.getFile(container, fileName, console.log)
    //return;
    var readStream = fs.createReadStream(pathFile);
    var writeStream = clientContainer.upload({
        container: container,
        remote: fileName
    });

    writeStream.on('error', function(err) {
        console.log('error', err);
    });

    writeStream.on('success', function(file) {
        console.log("file", file);
    });

    readStream.pipe(writeStream);
}

function removeFile(container, fileName) {
    clientContainer.removeFile(container, fileName, console.log)
}

function getFiles(container, uri){
    clientContainer.getFiles(container, function(err, files) {
        files.forEach(function(f) {
            console.log(uri + '/' +f.name);
        });
    });
}

if(program.action == 'ld' || program.action == 'loadbalancer'){
    if(program.list)
        getListLoadBalancer();
    else if(program.nodes)
        getInfoNodesLoadBalancer(program.info);
    else if(program.info)
        getInfoLoadBalancer(program.info)

}else if (program.action == 'server' || program.action == 'sv'){
    if(program.list)
        getListServers();
    else if(program.info)
        getInfoServer(program.info);
}else if (program.action == 'container') {
   if (program.info) {
        clientContainer.getContainer(program.info ,function (err, conts) {
            console.log(conts);
        });
    }else if (program.listFiles){
        console.log('container:', program.listFiles);
        clientContainer.getContainer(program.listFiles, function(err, res) {
            if (err) {
                return console.log(err);
            }
            getFiles(program.listFiles, res.cdnUri);
        });
    }
}else{
    console.log(program.usage);
}


//uploadFile('otros/50.jpg', 'mejoratuescuela-content', 'programas_50.jpg');
//removeFile('mejoratuescuela-content', 'programas_47.jpg')

//console.log(program.action);
