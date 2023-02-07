const http = require('http');
const fs = require('fs');
const { URL } = require('url');
const { exec } = require('child_process');

http.createServer((req, res) => {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const command = urlObj.searchParams.get('command');
    const module = urlObj.searchParams.get('module');
    const server = urlObj.searchParams.get('server');
    const concurrency = urlObj.searchParams.get('concurrency');

    if (command === 'start') {
        if(module === 'gdb') {
            if(!fs.existsSync(`../graph-database/${server}/results`)) {
                fs.mkdirSync(`../graph-database/${server}/results`);
            }
            exec(`sudo ./recordstats.sh > ../graph-database/${server}/results/${concurrency}.csv`);
        } else {
            if(!fs.existsSync(`../tiles-interface/results`)) {
                fs.mkdirSync(`../tiles-interface/results`);
            }
            exec(`sudo ./recordstats.sh > ../tiles-interface/results/${concurrency}.csv`);
        }
    }

    if (command === 'stop') {
        exec(`sudo pkill -f recordstat`);
    }

    res.statusCode = 200
    res.end();
}).listen(3001);
