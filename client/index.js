import { Command } from "commander";
import fs from "fs";
import fsPromise from "fs/promises";
import path from "path";
import { createGunzip } from "zlib";
import readline from "readline";
import jsonlParser from "stream-json/jsonl/Parser.js";
import { fetch as nodeFetch } from "undici";
import { Worker } from "worker_threads";
import autocannon from 'autocannon';

// Handle older Node.js versions (<18)
if (typeof fetch === "undefined") fetch = nodeFetch;

// Query set
const RANDOM_QUERIES = "../queries-per-country";
// HTTP request log
const REQUEST_LOG = "../requests.log.gz";
// Amount of concurrent clients
const CLIENTS = [2, 4, 8, 16, 32, 64, 128];
// Valid Graph Storage types
const GRAPH_STORAGES = ["virtuoso", "graphdb", "osrm"];
// Valid Tiles Interface types
const TILES_INTERFACES = ["none", "sparql", "cypher"];

async function run() {
    const program = new Command()
        .requiredOption("--experiment <experiment>", "Type of experiment (scalability, performance)")
        .requiredOption("--gs-type <gsType>", "Graph Storage type to be tested (graphdb, virtuoso, osrm, stardog, neo4j)")
        .option("--gs-address <gsAddress>", "Graph Storage server address")
        .option("--ti-type <tiType>", "Tiles Interface type (sparql, cypher) (if any)", "none")
        .option("--ti-address <tiAddress>", "Tiles Interface server address (if any)")
        .option("--zoom <zoom>", "Zoom level to use on the Tiles Interface", 12)
        .option("--iterations <iterations>", "Number of repetitions of the query set", 1)
        .option("--disable-client-cache", "Disable client-side cache", false)
        .option("--bypass-server-cache", "Bypass server-side cache", false)
        .option("--record", "Flag to trigger stats recording")
        .option("--timeout <timeout>", "Timeout limit for aborting a query", 60000)
        .option("--country <country>", "Run the evaluation for a specific country only")
        .parse(process.argv);

    // Validate Graph Storage type
    if (!GRAPH_STORAGES.includes(program.opts().gsType)) {
        console.error(`Unsupported Graph Storage ${program.opts().gsType}. Currently supported types: ${GRAPH_STORAGES}`);
        process.exit();
    }
    // Validate Tiles Interface type
    if (!TILES_INTERFACES.includes(program.opts().tiType)) {
        console.error(`Unsupported Tiles Interface ${program.opts().tiType}. Currently supported types: ${TILES_INTERFACES}`);
        process.exit();
    }

    // Query timeout
    const TIMEOUT = parseInt(program.opts().timeout);
    // Load the query set
    const querySet = (await loadQuerySet(program.opts().country));
    // Load the set of HTTP requests that autocannon will execute as a Tiles Planner would do
    //const httpReqs = await loadHttpReqs();

    if (program.opts().experiment === "performance") {
        // *******  RUN PERFORMANCE EXPERIMENT *******
        if (program.opts().tiType && program.opts().tiType !== "none") {
            console.log(`---------RUNNING ${program.opts().experiment.toUpperCase()} TEST FOR A TILE INTERFACE OVER A ${program.opts().gsType.toUpperCase()} INSTANCE ---------`);

            for (const country of Object.keys(querySet)) {
                console.log(`*********TESTING OVER COUNTRY: ${country}`);

                // Execute test with a Tiles Planner instance
                const result = await runTilesPlanner({
                    gsType: program.opts().gsType,
                    ti: `http://${program.opts().tiAddress}:8080/${program.opts().tiType}/${program.opts().gsType}`,
                    zoom: program.opts().zoom,
                    disableClientCache: program.opts().disableClientCache,
                    bypassServerCache: program.opts().bypassServerCache,
                    iterations: program.opts().iterations,
                    timeout: TIMEOUT,
                    querySet: querySet[country]
                });

                // Persist results to disk
                if (!fs.existsSync(path.resolve(`./results/performance/tiles/${program.opts().gsType}/${TIMEOUT}`))) {
                    fs.mkdirSync(path.resolve(`./results/performance/tiles/${program.opts().gsType}/${TIMEOUT}`));
                }

                const fileName = "tiles_"
                    + program.opts().gsType + "_"
                    + "zoom-" + program.opts().zoom + "_"
                    + (program.opts().disableClientCache ? "no-client-cache" : "client-cache") + "_"
                    + (program.opts().bypassServerCache ? "no-server-cache" : "server-cache") + "_"
                    + country
                    + ".json";

                await fsPromise.writeFile(
                    path.resolve(`./results/performance/tiles/${program.opts().gsType}/${TIMEOUT}`, fileName),
                    JSON.stringify(result, null, 3),
                    "utf8"
                );
            }
        } else {
            if(!program.opts().gsAddress) {
                console.error("Please provide a valid IP address for the Graph Storage server with --gsAddress");
                process.exit();
            }
            // Testing with an autocannon instance
            console.log(`---------RUNNING ${program.opts().experiment.toUpperCase()} TEST OVER A ${program.opts().gsType.toUpperCase()} INSTANCE ---------`);
            // Prepare queries for autocannon according to the target graph store
            const preparedReqs = prepareAPIRequests(querySet, program.opts().gsType);
            // Execute test with autocannon
            const result = await autocannon({
                url: `http://${program.opts().gsAddress}:3000`,
                connections: 1,
                workers: 1,
                amount: program.opts().iterations * querySet.length, // repeat query set {iterations} times
                timeout: 60, // 60 seconds timeout for every query
                requests: preparedReqs
            });

            await fsPromise.writeFile(
                path.resolve(`./results/performance/${program.opts().gsType}/`, "result.json"),
                JSON.stringify(result, null, 3),
                "utf8"
            );
        }
    } else {
        // *******  RUN SCALABILITY EXPERIMENT *******
        if (program.opts().tiType && program.opts().tiType !== "none") {
            for (let i = 0; i < CLIENTS.length; i++) {
                console.log(`---------RUNNING ${program.opts().experiment.toUpperCase()} TEST WITH ${CLIENTS[i]} concurrent clients---------`);

                // Start recording of stats in remote servers
                if (program.opts().record) {
                    await toggleRecording({
                        record: true,
                        server: program.opts().tiAddress,
                        module: "tiles",
                        clients: i
                    });
                }

                // Wait 5 seconds before running clients
                await wait(5000);

                // Launch autocannon
                const loadGenerator = autocannon({
                    url: `http://${program.opts().tiAddress}:8080/${program.opts().tiType}/${program.opts().gsType}`,
                    connections: CLIENTS[i] - 1,
                    workers: CLIENTS[i] > 16 ? 16 : CLIENTS[i],
                    pipelining: CLIENTS[i] > 16 ? CLIENTS[i] / 16 : 1,
                    connectionRate: 5,
                    duration: 86400, // Set a very long time so autocannon does not stop in the middle of the test
                    requests: httpReqs
                });

                // Execute test with a Tiles Planner instance
                const result = await runTilesPlanner({
                    gsType: program.opts().gsType,
                    ti: `http://${program.opts().tiAddress}:8080/${program.opts().tiType}/${program.opts().gsType}`,
                    zoom: program.opts().zoom,
                    disableClientCache: program.opts().disableClientCache,
                    bypassServerCache: program.opts().bypassServerCache,
                    iterations: program.opts().iterations,
                    timeout: TIMEOUT,
                    querySet
                });
            }
        } else {
            // Prepare queries for autocannon according to the target graph store
            const preparedReqs = prepareAPIRequests(querySet, program.opts().gsType);
        }

        for (let i = 0; i < CLIENTS.length; i++) {
            console.log(`---------RUNNING ${program.opts().experiment.toUpperCase()} TEST WITH ${CLIENTS[i]} concurrent clients---------`);
            // Start recording of stats in remote servers
            if (program.opts().record) {
                if (program.opts().tiAddress) {
                    await toggleRecording({
                        record: true,
                        server: program.opts().tiAddress,
                        module: "tiles",
                        clients: CLIENTS[i]
                    });
                }

                await toggleRecording({
                    record: true,
                    server: program.opts().gsAddress,
                    module: "gdb",
                    clients: i
                });
            }

            // Wait 5 seconds before running clients
            await wait(5000);

            // Run an instance of the Tiles Planner in an independent thread
            await runTilesPlanner({
                gsType: program.opts().gsType,
                ti: `http://${program.opts().tiAddress}:8080/${program.opts().tiType}/${program.opts().gsType}`,
                zoom: program.opts().zoom,
                disableClientCache: program.opts().disableClientCache,
                iterations: program.opts().iterations,
                timeout: TIMEOUT,
                querySet
            });
        }
    }
    console.log("-----------------TEST COMPLETED SUCCESSFULLY----------------");
}

function loadQuerySet(country) {
    return new Promise(async (resolve, reject) => {
        const countries = country ? [`${country}.json.gz`] : await fsPromise.readdir(RANDOM_QUERIES);
        const set = {};
        for (const country of countries) {
            set[country.split(".")[0]] = [];

            fs.createReadStream(path.resolve(`${RANDOM_QUERIES}/${country}`))
                .pipe(createGunzip())
                .pipe(jsonlParser.parser())
                .on("data", q => {
                    set[country.split(".")[0]].push(q.value);
                })
                .on("error", err => reject(err))
                .on("end", () => resolve(set));
        }
    });
}

function loadHttpReqs() {
    return new Promise((resolve, reject) => {
        const reqs = [];
        readline.createInterface({
            input: fs.createReadStream(path.resolve(REQUEST_LOG)).pipe(createGunzip()),
        })
            .on("line", line => {
                if (line.startsWith("http")) {
                    reqs.push(line);
                }
            }).on("close", () => resolve(reqs))
            .on("error", err => reject(err));
    });
}

function prepareAPIRequests(queries, graphStore) {
    return queries.map(q => {
        let path;

        if (graphStore === "osrm") {
            path = `/osrm?path=${q.from.coordinates.join(",")};${q.to.coordinates.join(",")}`;
        }

        return {
            method: "GET",
            path
        };
    });
}

async function toggleRecording({ record, server, module, clients }) {
    if (record) {
        await fetch(`http://${server}:3001?command=start&module=${module}&clients=${clients}`);
    } else {
        await fetch(`http://${server}:3001?command=stop`);
    }
}

function runTilesPlanner(params) {
    return new Promise((resolve, reject) => {
        const planner = new Worker(path.resolve("./helpers/tiles-planner.js"), {
            workerData: params
        });

        planner.on("error", err => reject(err));
        planner.once("message", (result) => resolve(result));
    });
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

run();