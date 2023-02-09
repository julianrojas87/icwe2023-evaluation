const http = require('http');
const fs = require('fs');
const { URL } = require('url');
const { exec } = require('child_process');

http.createServer((req, res) => {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const command = urlObj.searchParams.get('command');
    const test = urlObj.searchParams.get('test');
    const module = urlObj.searchParams.get('module');
    const server = urlObj.searchParams.get('server');
    const clients = urlObj.searchParams.get('clients');

    if (command === 'start') {
        if(module === 'gdb') {
            if(!fs.existsSync(`../graph-database/${server}/${test}/results`)) {
                fs.mkdirSync(`../graph-database/${server}/${test}/results`);
            }
            exec(`sudo ./recordstats.sh > ../graph-database/${server}/results/${test}/${clients}.csv`);
        } else {
            if(!fs.existsSync(`../tiles-interface/results/${test}`)) {
                fs.mkdirSync(`../tiles-interface/results/${test}`);
            }
            exec(`sudo ./recordstats.sh > ../tiles-interface/results/${test}/${clients}.csv`);
        }
    }

    if (command === 'stop') {
        exec(`sudo pkill -f recordstat`);
    }

    res.statusCode = 200
    res.end();
}).listen(3001);
