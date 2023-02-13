import { parentPort, workerData } from "worker_threads";
import { NBAStar, Utils, NetworkGraph } from "tiles-planner";

async function run() {
    const {
        gsType,
        ti,
        zoom,
        disableCache,
        querySet,
        iterations
    } = workerData;
    console.log(`Starting Tiles Planner evaluation (using NBA*) over ${gsType}`);

    // Create a Tiles Planner instance running the NBA* algorithm
    const planner = new NBAStar({
        zoom,
        tilesBaseURL: ti,
        distance: (node) => { return node.cost },
        heuristic: Utils.harvesineDistance
    });

    // Object that will hold all the measurements
    const results = { 
        globals: {
            fullAvgResTime: 0,
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
                const sp = await planner.findPath(q.from, q.to);
                
                // Something went wrong with this query
                if (!sp) throw new Error("No path found");
                
                const metadata = sp.metadata;
                metadata.from = q.from,
                metadata.to = q.to
                // Keep original Dijkstra Rank 
                metadata.dijkstraRank = q.metadata.dijkstraRank;

                // Register results
                if (!results.queryResults[j]) {
                    results.queryResults[j] = [metadata];
                } else {
                    results.queryResults[j].push(metadata);
                }

                // Clean up in-memory network graph and tiles cache if cache is disabled
                if (disableCache) {
                    planner.NG = new NetworkGraph();
                    planner.tileCache = new Set();
                }
            } catch (err) {
                console.error(j, q);
                console.error(err);
            }
        }
    }

    // Aggregate results
    let total = 0;
    for(const qr of results.queryResults) {
        for (const r of qr) {
            total++;
            // Aggregate response times
            results.globals.fullAvgResTime += r.executionTime;
            // Aggregate response times per Dijkstra Rank
            if(!results.globals.dijkstraRanks[r.dijkstraRank]) {
                results.globals.dijkstraRanks[r.dijkstraRank] = { 
                    count: 1, 
                    avgResTime: r.executionTime,
                    avgTransfBytes: r.byteCount,
                    avgReqCount: r.requestCount,
                    avgDistance: r.cost 
                }
            } else {
                results.globals.dijkstraRanks[r.dijkstraRank].count++;
                results.globals.dijkstraRanks[r.dijkstraRank].avgResTime += r.executionTime;
                results.globals.dijkstraRanks[r.dijkstraRank].avgTransfBytes += r.byteCount;
                results.globals.dijkstraRanks[r.dijkstraRank].avgReqCount += r.requestCount;
                results.globals.dijkstraRanks[r.dijkstraRank].avgDistance += r.cost;
            }
        }
    }
    // Calculate averages
    results.globals.fullAvgResTime = results.globals.fullAvgResTime / total;
    Object.keys(results.globals.dijkstraRanks).forEach(dr => {
        const drObj = results.globals.dijkstraRanks[dr];
        drObj.avgResTime = drObj.avgResTime / drObj.count;
        drObj.avgTransfBytes = drObj.avgTransfBytes / drObj.count;
        drObj.avgReqCount = drObj.avgReqCount / drObj.count;
        drObj.avgDistance = drObj.avgDistance / drObj.count;
    });
    
    console.log(results.globals);
    // Send results back
    parentPort.postMessage(results);
}

run();