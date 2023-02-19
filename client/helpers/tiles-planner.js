import { parentPort, workerData } from "worker_threads";
import { NBAStar, Utils, NetworkGraph } from "tiles-planner";

async function run() {
    const {
        gsType,
        ti,
        zoom,
        disableClientCache,
        bypassServerCache,
        querySet,
        iterations,
        timeout
    } = workerData;
    console.log(`Starting Tiles Planner evaluation (using NBA*) over ${gsType}`);

    // Create a Tiles Planner instance running the NBA* algorithm
    const planner = new NBAStar({
        zoom,
        tilesBaseURL: ti,
        distance: (node) => { return node.cost },
        heuristic: Utils.harvesineDistance,
        bypassServerCache
    });

    // Object that will hold all the measurements
    const results = {
        globals: {
            fullAvgResTime: 0,
            fullAvgTransfBytes: 0,
            totalTimeouts: 0,
            dijkstraRanks: {}
        },
        queryResults: []
    };

    // Execute the query set <iterations> times
    for (let i = 0; i < iterations; i++) {
        // Run each query
        for (const [j, q] of querySet.entries()) {
            try {
                console.log(`Q${j}`);
                // Execute query
                const sp = await executeQuery(planner, q, timeout);

                const metadata = sp ? sp.metadata : { timeout: true };
                metadata.from = q.from;
                metadata.to = q.to;
                // Keep original Dijkstra Rank 
                metadata.dijkstraRank = q.metadata.dijkstraRank;

                // Register results
                if (!results.queryResults[j]) {
                    results.queryResults[j] = [metadata];
                } else {
                    results.queryResults[j].push(metadata);
                }

                // Clean up in-memory network graph and tiles cache if cache is disabled
                if (disableClientCache) {
                    planner.NG = new NetworkGraph();
                    planner.tileCache = new Set();
                }
            } catch (err) {
                console.error(j, err);
            }
        }
    }

    // Aggregate results
    let total = 0;
    for (const qr of results.queryResults) {
        if (qr) {
            for (const r of qr) {
                // Initialize Dijkstra Rank specific report
                if (!results.globals.dijkstraRanks[r.dijkstraRank]) {
                    results.globals.dijkstraRanks[r.dijkstraRank] = {
                        timeouts: 0,
                        count: 0,
                        avgResTime: 0,
                        avgTransfBytes: 0,
                        avgReqCount: 0,
                        avgCacheHits: 0,
                        avgDistance: 0
                    }
                }

                // Check if result is a timeout
                if (r.timeout) {
                    results.globals.totalTimeouts++;
                    results.globals.dijkstraRanks[r.dijkstraRank].timeouts++;
                } else {
                    total++;
                    // Aggregate response times
                    results.globals.fullAvgResTime += r.executionTime;
                    // Aggregate transferred bytes
                    results.globals.fullAvgTransfBytes += r.byteCount;
                    // Aggregate response times per Dijkstra Rank
                    results.globals.dijkstraRanks[r.dijkstraRank].count++;
                    results.globals.dijkstraRanks[r.dijkstraRank].avgResTime += r.executionTime;
                    results.globals.dijkstraRanks[r.dijkstraRank].avgTransfBytes += r.byteCount;
                    results.globals.dijkstraRanks[r.dijkstraRank].avgReqCount += r.requestCount;
                    results.globals.dijkstraRanks[r.dijkstraRank].avgCacheHits += r.cacheHits;
                    results.globals.dijkstraRanks[r.dijkstraRank].avgDistance += r.cost;
                }
            }
        }
    }

    // Calculate averages
    results.globals.totalTimeouts = results.globals.totalTimeouts / iterations;
    if (total > 0) {
        results.globals.fullAvgResTime = results.globals.fullAvgResTime / total;
        results.globals.fullAvgTransfBytes = results.globals.fullAvgTransfBytes / total;
    }
    // Calculate averages per Dijkstra rank
    Object.keys(results.globals.dijkstraRanks).forEach(dr => {
        const drObj = results.globals.dijkstraRanks[dr];
        if (drObj.count > 0) {
            drObj.avgResTime = drObj.avgResTime / drObj.count;
            drObj.avgTransfBytes = drObj.avgTransfBytes / drObj.count;
            drObj.avgReqCount = drObj.avgReqCount / drObj.count;
            drObj.avgCacheHits = drObj.avgCacheHits / drObj.count;
            drObj.avgDistance = drObj.avgDistance / drObj.count;
        }
    });

    console.log(results.globals);
    // Send results back
    parentPort.postMessage(results);
}

function executeQuery(planner, q, timeout) {
    return new Promise((resolve, reject) => {
        // Set timeout
        const limit = setTimeout(() => {
            // Trigger kill switch
            planner.killed = true;
        }, timeout);

        // Run query
        planner.findPath(q.from, q.to).then(sp => {
            if (limit) clearTimeout(limit);
            resolve(sp);
        }).catch(err => reject(err));
    });
}

run();