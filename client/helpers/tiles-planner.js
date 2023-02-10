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
        heuristic: Utils.harvesineDistance,
        disableCache
    });

    // Execute the query set <iterations> times
    for (let i = 0; i < iterations; i++) {
        // Run each query
        let j = 0;
        for (const q of querySet) {
            try {
                const sp = await planner.findPath(q.from, q.to);
                if (!sp) throw new Error("No path found");
                j++;
                // Clean up in-memory network graph if cache is disabled
                if (disableCache) planner.NG = new NetworkGraph();
            } catch (err) {
                console.error(j, q.from, q.metadata);
                //throw err;
            }
        }
    }
}

run();