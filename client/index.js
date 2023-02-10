import { Command } from "commander";
import fs from "fs";
import path from "path";
import { createGunzip } from "zlib";
import readline from "readline";
import jsonlParser from "stream-json/jsonl/Parser.js";
import { fetch as nodeFetch } from "undici";
import { Worker } from "worker_threads";

// Handle older Node.js versions (<18)
if (typeof fetch === "undefined") fetch = nodeFetch;

// Query set
const RANDOM_QUERY_SET = "../random-queries_5-17.json.gz";
// HTTP request log
const REQUEST_LOG = "../request.log.gz";
// Amount of concurrent clients
const CLIENTS = [1, 2, 4, 8, 16, 32, 64, 128];
// Valid Graph Storage types
const GRAPH_STORAGES = ["virtuoso", "graphdb", "osrm"];
// Valid Tiles Interface types
const TILES_INTERFACES = ["sparql", "cypher"];

async function run() {
    const program = new Command()
        .requiredOption("--test <test>", "Type of experiment (scalability, performance)")
        .requiredOption("--gs-type <gsType>", "Graph Storage type to be tested (graphdb, virtuoso, osrm, stardog, neo4j)")
        .requiredOption("--gs-address <gsAddress>", "Graph Storage server address")
        .option("--ti-type <tiType>", "Tiles Interface type (sparql, cypher) (if any)")
        .option("--ti-address <tiAddress>", "Tiles Interface server address (if any)")
        .option("--zoom <zoom>", "Zoom level to use on the Tiles Interface", 12)
        .option("--iterations <iterations>", "Number of repetitions of the query set", 1)
        .option("--disable-cache", "Disable client-side cache", false)
        .option("--record", "Flag to trigger stats recording")
        .parse(process.argv);

    // Validate Graph Storage type
    if (!GRAPH_STORAGES.includes(program.opts().gsType)) {
        console.error(`Unsupported Graph Storage ${program.opts().gsType}. Currently supported types: ${GRAPH_STORAGES}`);
        process.exit();
    }
    // Validate Tiles Interface type
    if(!TILES_INTERFACES.includes(program.opts().tiType)) {
        console.error(`Unsupported Tiles Interface ${program.opts().tiType}. Currently supported types: ${TILES_INTERFACES}`);
        process.exit();
    }

    // Load the query set
    const querySet = await loadQuerySet();
    // Load the set of HTTP requests that autocannon will execute as a Tiles Planner would do
    const httpReqs = await loadHttpReqs();

    // Main experiment loop
    for (let i = 0; i < 1/*CLIENTS.length*/; i++) {
        console.log(`---------RUNNING ${program.opts().test.toUpperCase()} TEST WITH ${CLIENTS[i]} concurrent clients---------`);
        // Start recording of stats in remote servers
        if (program.opts().record) {
            if (program.opts().tiAddress) {
                await toggleRecording({
                    record: true,
                    server: program.opts().tiAddress,
                    module: "tiles",
                    test: program.opts().test,
                    clients: i
                });
            }

            await toggleRecording({
                record: true,
                server: program.opts().gsAddress,
                module: "gdb",
                test: program.opts().test,
                clients: i
            });
        }

        // Run an instance of the Tiles Planner in an independent thread
        await runTilesPlanner({
            gsType: program.opts().gsType,
            ti: `http://${program.opts().tiAddress}:8080/${program.opts().tiType}/${program.opts().gsType}`,
            zoom: program.opts().zoom,
            disableCache: program.opts().disableCache,
            iterations: program.opts().iterations,
            querySet
        });
    }
}

function loadQuerySet() {
    return new Promise((resolve, reject) => {
        const set = [];
        fs.createReadStream(path.resolve(RANDOM_QUERY_SET))
            .pipe(createGunzip())
            .pipe(jsonlParser.parser())
            .on("data", q => {
                set.push(q.value);
            })
            .on("error", err => reject(err))
            .on("end", () => resolve(set));
    });
}

function loadHttpReqs() {
    return new Promise((resolve, reject) => {
        const reqs = [];
        readline.createInterface({
            input: fs.createReadStream(path.resolve(REQUEST_LOG)).pipe(createGunzip()),
        })
        .on("line", line => {
            if(line.startsWith("http")) {
                reqs.push(line);
            }
        }).on("close", () => resolve(reqs))
        .on("error", err => reject(err));
    });
}

async function toggleRecording({ record, server, module, test, clients }) {
    if (record) {
        await fetch(`http://${server}:3001?command=start&module=${module}&test=${test}&clients=${CLIENTS[clients]}`);
    } else {
        await fetch(`http://${server}:3001?command=stop`);
    }
}

function runTilesPlanner(params) {
    return new Promise((resolve, reject) => {
        const planner = new Worker(path.resolve("./helpers/tiles-planner.js"), {
            workerData: params
        });

        planner.once("message", (result) => resolve(result));
    });
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

run();